/** P06 M6: the few git reads and the one worktree write the executor needs. Arguments only, never a shell. */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The executor's own git. It ignores system and global config and forces fsmonitor and hooks off on the command line,
 * so a repository config planted by a run (core.fsmonitor, hooks) can never execute during the executor's checks.
 */
const SAFE_ENV = () => ({ PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: process.env.HOME ?? "/", GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" });
const SAFE_ARGS = ["-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", "-c", "core.sshCommand=/usr/bin/false"];

export function git(cwd: string, args: string[], env?: Record<string, string>): Promise<{ ok: boolean; out: string; err: string }> {
  return new Promise((resolve) => {
    execFile("git", [...SAFE_ARGS, ...args], { cwd, env: (env ?? SAFE_ENV()) as NodeJS.ProcessEnv, maxBuffer: 32 * 1024 * 1024, timeout: 60_000 },
      (e, stdout, stderr) => resolve({ ok: !e, out: String(stdout), err: String(stderr) }));
  });
}

/**
 * The branch tip on the remote itself (not the possibly stale remote-tracking ref). Read-only, with the user's own
 * credential configuration (needed for private repositories), hooks and fsmonitor still off. Null when unreachable.
 */
export async function remoteBranchTip(cwd: string, branch: string): Promise<string | null> {
  const env = { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: process.env.HOME ?? "/", GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_NOSYSTEM: "1" };
  const r = await git(cwd, ["ls-remote", "--exit-code", "origin", `refs/heads/${branch}`], env);
  const sha = r.ok ? r.out.trim().split(/\s+/)[0] : "";
  return /^[0-9a-f]{40}$/.test(sha) ? sha : null;
}

export async function revParse(cwd: string, ref: string): Promise<string | null> {
  const r = await git(cwd, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
  return r.ok ? r.out.trim() : null;
}

/** The current tip of a branch: the remote-tracking ref when there is one (checkouts are often on other branches). */
export async function branchTip(cwd: string, branch: string): Promise<{ ref: string; sha: string } | null> {
  for (const ref of [`refs/remotes/origin/${branch}`, `refs/heads/${branch}`]) {
    const sha = await revParse(cwd, ref);
    if (sha) return { ref, sha };
  }
  return null;
}

export async function refsSnapshot(cwd: string): Promise<Map<string, string>> {
  const r = await git(cwd, ["for-each-ref", "--format=%(refname) %(objectname)"]);
  const m = new Map<string, string>();
  for (const line of r.out.split("\n")) { const [ref, sha] = line.trim().split(" "); if (ref && sha) m.set(ref, sha); }
  return m;
}

/** The founder's own checkout: HEAD, branch and a hash of its working-tree status (it is usually dirty; it must stay as it was). */
export async function checkoutSnapshot(cwd: string): Promise<{ head: string | null; branch: string | null; status: string }> {
  const [head, branch, status] = await Promise.all([
    revParse(cwd, "HEAD"),
    git(cwd, ["symbolic-ref", "-q", "HEAD"]).then((r) => (r.ok ? r.out.trim() : null)),
    git(cwd, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]).then((r) => createHash("sha256").update(r.out).digest("hex")),
  ]);
  return { head, branch, status };
}

/**
 * Hash of the shared .git state a run must never touch: config (incl. config.worktree), hooks, info, alternates, and
 * every other worktree's metadata. A change there can execute code later (core.fsmonitor, hooks) or redirect objects.
 */
export async function gitDirSnapshot(cwd: string, ownWorktreeName: string | null): Promise<string> {
  const common = (await git(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"])).out.trim();
  const h = createHash("sha256");
  const add = (p: string) => {
    try {
      const st = statSync(p);
      if (st.isDirectory()) { for (const n of readdirSync(p).sort()) add(join(p, n)); return; }
      h.update(`${p}\0${st.size}\0`); h.update(readFileSync(p)); h.update("\0");
    } catch { h.update(`${p}\0absent\0`); }
  };
  for (const f of ["config", "config.worktree", "hooks", "info", join("objects", "info", "alternates"), "commondir"]) add(join(common, f));
  try {
    for (const w of readdirSync(join(common, "worktrees")).sort()) if (w !== ownWorktreeName) add(join(common, "worktrees", w));
  } catch { /* no worktrees */ }
  return h.digest("hex");
}

export async function isAncestor(cwd: string, a: string, b: string): Promise<boolean> {
  return (await git(cwd, ["merge-base", "--is-ancestor", a, b])).ok;
}

export async function changedFiles(worktree: string, base: string): Promise<string[]> {
  const [diff, untracked] = await Promise.all([
    git(worktree, ["diff", "--name-only", base]),
    git(worktree, ["ls-files", "--others", "--exclude-standard"]),
  ]);
  return [...new Set([...diff.out.split("\n"), ...untracked.out.split("\n")].map((s) => s.trim()).filter(Boolean))].sort();
}
