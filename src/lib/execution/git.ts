/** P06 M6: the few git reads and the one worktree write the executor needs. Arguments only, never a shell. */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";

export function git(cwd: string, args: string[], env?: Record<string, string>): Promise<{ ok: boolean; out: string; err: string }> {
  return new Promise((resolve) => {
    execFile("git", args, { cwd, env: (env ?? { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: process.env.HOME ?? "/", GIT_TERMINAL_PROMPT: "0" }) as NodeJS.ProcessEnv, maxBuffer: 32 * 1024 * 1024, timeout: 60_000 },
      (e, stdout, stderr) => resolve({ ok: !e, out: String(stdout), err: String(stderr) }));
  });
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
