/** P06 M6: the few git reads and the one worktree write the executor needs. Arguments only, never a shell. */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The executor's own git. It ignores system and global config and forces fsmonitor and hooks off on the command line,
 * so a repository config planted by a run (core.fsmonitor, hooks) can never execute during the executor's checks.
 */
const SAFE_ENV = () => ({ PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: process.env.HOME ?? "/", GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_ASKPASS: "/usr/bin/false", SSH_ASKPASS: "/usr/bin/false" });
const SAFE_ARGS = ["-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", "-c", "core.sshCommand=/usr/bin/false", "-c", "core.attributesFile=/dev/null"];

export function git(cwd: string, args: string[], env?: Record<string, string>, timeoutMs = 60_000): Promise<{ ok: boolean; out: string; err: string }> {
  return new Promise((resolve) => {
    execFile("git", [...SAFE_ARGS, ...args], { cwd, env: (env ?? SAFE_ENV()) as NodeJS.ProcessEnv, maxBuffer: 32 * 1024 * 1024, timeout: timeoutMs },
      (e, stdout, stderr) => resolve({ ok: !e, out: String(stdout), err: String(stderr) || (e ? String((e as Error).message) : "") }));
  });
}

/**
 * The branch tip on the remote itself (not the possibly stale remote-tracking ref). Read-only, with the user's own
 * credential configuration (needed for private repositories), hooks and fsmonitor still off. Null when unreachable.
 */
export async function remoteBranchTip(cwd: string, branch: string, timeoutMs = 60_000): Promise<string | null> {
  const env = { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: process.env.HOME ?? "/", GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_NOSYSTEM: "1", GIT_ASKPASS: "/usr/bin/false", SSH_ASKPASS: "/usr/bin/false" };
  // The only credential helper is the macOS keychain: an empty value first clears any helper a repository config
  // (which a run could have edited) would otherwise make git execute.
  const r = await git(cwd, ["-c", "credential.helper=", "-c", "credential.helper=osxkeychain", "ls-remote", "--exit-code", "origin", `refs/heads/${branch}`], env, timeoutMs);
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

/** The shared git directory of a checkout, resolved BEFORE a run (a run must never be able to choose it). */
export async function commonGitDir(cwd: string): Promise<string | null> {
  const r = await git(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  return r.ok && r.out.trim() ? r.out.trim() : null;
}

/**
 * Hash of the shared .git state a run must never touch, read with plain filesystem calls (NO git: a planted config,
 * filter driver or attribute must never get a chance to execute while it is being checked). Covers config (incl.
 * config.worktree), hooks, info (attributes, exclude, sparse-checkout), alternates, every other worktree's metadata,
 * and this run's own worktree files that could redirect or reconfigure it (config.worktree, commondir, gitdir).
 */
export function gitDirSnapshot(common: string, ownWorktreeName: string | null): string {
  const h = createHash("sha256");
  const add = (p: string) => {
    try {
      const st = statSync(p);
      if (st.isDirectory()) { for (const n of readdirSync(p).sort()) add(join(/*turbopackIgnore: true*/ p, n)); return; }
      h.update(`${p}\0${st.size}\0`); h.update(readFileSync(p)); h.update("\0");
    } catch { h.update(`${p}\0absent\0`); }
  };
  for (const f of ["config", "config.worktree", "hooks", "info", join(/*turbopackIgnore: true*/ "objects", "info", "alternates"), "commondir"]) add(join(/*turbopackIgnore: true*/ common, f));
  try {
    for (const w of readdirSync(join(/*turbopackIgnore: true*/ common, "worktrees")).sort()) {
      if (w !== ownWorktreeName) add(join(/*turbopackIgnore: true*/ common, "worktrees", w));
      else for (const f of ["config.worktree", "commondir", "gitdir"]) add(join(/*turbopackIgnore: true*/ common, "worktrees", w, f));
    }
  } catch { /* no worktrees */ }
  return h.digest("hex");
}

/** Exact program values git-lfs installs; anything else that names a program is refused. */
const LFS_VALUES = new Set(["git-lfs clean -- %f", "git-lfs smudge -- %f", "git-lfs filter-process"]);

/**
 * Keys in a checkout's own git configuration that make git run a program which the executor's command-line overrides
 * cannot switch off (filter drivers run on status and checkout; includes can bring in any of them; credential
 * helpers, diff and merge drivers). Read with plain filesystem calls, before any git command that could run them. A
 * run that edited the shared .git is reported as a violation at once; this scan keeps a poisoned checkout from
 * executing anything in every later run. Founder-installed git-lfs values are allowed exactly.
 */
export function unsafeGitConfig(common: string): string[] {
  const files = [join(/*turbopackIgnore: true*/ common, "config"), join(/*turbopackIgnore: true*/ common, "config.worktree")];
  try { for (const w of readdirSync(join(/*turbopackIgnore: true*/ common, "worktrees"))) files.push(join(/*turbopackIgnore: true*/ common, "worktrees", w, "config.worktree")); } catch { /* none */ }
  const found: string[] = [];
  for (const f of files) {
    let text = "";
    try { text = readFileSync(f, "utf8"); } catch { continue; }
    let section = "";
    for (const raw of text.split("\n")) {
      // Whole-line comments only: a value is compared exactly, so "git-lfs clean -- %f; evil" is never truncated into
      // an allowed value.
      const line = raw.trim();
      if (!line || line.startsWith("#") || line.startsWith(";")) continue;
      // Fail closed: a line must be exactly a lone section header or a plain key/value. git also accepts a key on the
      // header's line ("[filter "x"] clean = ...") and continuation lines; both are refused, never half-parsed.
      if (line.startsWith("[")) {
        const head = line.match(/^\[\s*([A-Za-z0-9.-]+)(?:\s+"([^"\\]*)")?\s*\]$/);
        if (!head) { found.push(`unreadable line in ${f}`); continue; }
        section = (head[1] + (head[2] !== undefined ? `."${head[2]}"` : "")).toLowerCase();
        continue;
      }
      const kv = line.match(/^([A-Za-z][A-Za-z0-9-]*)\s*(?:=\s*(.*))?$/);
      if (!kv || /\\$/.test(line)) { found.push(`unreadable line in ${f}`); continue; }
      const key = kv[1].toLowerCase(), value = (kv[2] ?? "").replace(/^"|"$/g, "").trim();
      const sec = section.split(".")[0];
      const name = `${section}.${key}`;
      if (sec === "filter" && ["clean", "smudge", "process"].includes(key) && !LFS_VALUES.has(value)) found.push(name);
      else if ((sec === "include" || sec === "includeif") && key === "path") found.push(name);
      else if (sec === "diff" && (key === "command" || key === "textconv")) found.push(name);
      else if (sec === "merge" && key === "driver") found.push(name);
      else if (sec === "credential" && key === "helper" && value !== "" && value !== "osxkeychain") found.push(name);
    }
  }
  return found;
}

export async function isAncestor(cwd: string, a: string, b: string): Promise<boolean> {
  return (await git(cwd, ["merge-base", "--is-ancestor", a, b])).ok;
}

export async function changedFiles(worktree: string, base: string): Promise<string[]> {
  const [diff, untracked] = await Promise.all([
    git(worktree, ["diff", "--no-ext-diff", "--no-textconv", "--name-only", base]),
    git(worktree, ["ls-files", "--others", "--exclude-standard"]),
  ]);
  return [...new Set([...diff.out.split("\n"), ...untracked.out.split("\n")].map((s) => s.trim()).filter(Boolean))].sort();
}
