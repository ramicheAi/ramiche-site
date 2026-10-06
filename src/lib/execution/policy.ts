/**
 * P06 M6 capability policy for the Claude Code executor: what the CLI is given at each level, and the gate that keeps
 * production dispatch off.
 *
 * Three independent layers bound each run; none trusts the model:
 *   1. The CLI gets an exact built-in tool set (--tools) in dontAsk mode, with no settings files, no MCP servers and no
 *      skills, so a repository's own .claude/settings.json cannot widen it. Bash, when present, is limited to
 *      allowlisted command prefixes, and push/remote commands are denied explicitly.
 *   2. The process runs in a fresh git worktree on its own branch, with a stripped environment (no cockpit secrets)
 *      and git configured so any push goes to an unreachable URL.
 *   3. After the run, git state is checked against the capability (executor.ts verifyBoundary): no writes at L0/L1, no
 *      commits below L4, no ref outside the execution branch moved, the founder's own checkout untouched.
 */
import type { Capability } from "./contract-core";

/** M6 builds and proves the executor; production Universal Command does not reach it. Changing this is a separate,
 *  founder-authorized step (it is a constant, not configuration, so it cannot be flipped by an environment change). */
export const PRODUCTION_DISPATCH_ENABLED = false as const;

export type Surface = "production" | "harness";
type Env = Record<string, string | undefined>;

/** Production dispatch is off, and the cockpit deployment (NEXT_DIST_DIR=.next-cc) never runs the executor at all. */
export function surfaceAllowed(surface: Surface, env: Env = process.env): { ok: true } | { ok: false; code: string; message: string } {
  if (surface === "production" && !PRODUCTION_DISPATCH_ENABLED) {
    return { ok: false, code: "production_dispatch_disabled", message: "Execution from Universal Command is not enabled yet. Nothing was run." };
  }
  if (env.NEXT_DIST_DIR === ".next-cc") {
    return { ok: false, code: "production_dispatch_disabled", message: "The live cockpit does not run executions. Nothing was run." };
  }
  return { ok: true };
}

const READ = ["Read", "Glob", "Grep"];
const WRITE = ["Edit", "Write"];

/** Test and build commands an L3 run may execute (prefix rules). Repository scripts run with the stripped environment. */
export const TEST_COMMANDS = ["npm test", "npm run test", "npm run lint", "npm run typecheck", "npm run build", "npx vitest run", "npx tsc --noEmit", "npx eslint", "pnpm test", "yarn test"];
const GIT_READ = ["git status", "git diff", "git log", "git show"];
const GIT_COMMIT = ["git add", "git commit"];

/** Denied whatever else is allowed (defense in depth behind the tool set and the push URL). */
export const DENIED_BASH = [
  "git push", "git remote", "git config", "git fetch", "git pull", "git checkout", "git switch", "git branch", "git reset", "git rebase",
  "git merge", "git tag", "git worktree", "git update-ref", "git filter-branch", "gh", "vercel", "npm publish", "npx vercel", "supabase", "curl", "wget", "ssh", "scp",
];

const rules = (prefixes: string[]) => prefixes.map((p) => `Bash(${p}:*)`);

export interface CliPolicy { tools: string[]; allowedTools: string[]; disallowedTools: string[] }

/**
 * File access is confined to the run's own worktree. A bare `Read`/`Edit`/`Write` allow rule matches every path on the
 * machine (Claude Code permissions docs, "Match all uses of a tool"), so allow rules are never bare: they are anchored
 * at the worktree with `//<absolute path>/**`. Outside it, reads and edits would need approval, and dontAsk denies
 * them. Allow rules match only when both the requested path and its symlink target match, so a symlink out of the
 * worktree is denied too. Glob and Grep follow Read rules. (PR #47 Codex P1.)
 */
export function fileRules(worktree: string): { read: string[]; write: string[]; deny: string[] } {
  if (!worktree.startsWith("/") || /[*?[\]!\\]|\s$/.test(worktree) || worktree.includes("..")) {
    throw new Error("worktree path cannot be expressed as an exact permission rule");
  }
  const wt = worktree.replace(/\/+$/, "");
  return {
    read: [`Read(/${wt}/**)`],
    write: [`Edit(/${wt}/**)`, `Write(/${wt}/**)`],
    deny: [`Edit(/${wt}/.git)`, `Write(/${wt}/.git)`, `Edit(/${wt}/.git/**)`, `Write(/${wt}/.git/**)`],
  };
}

export function cliPolicy(c: Capability, worktree: string): CliPolicy {
  const f = fileRules(worktree);
  const deny = [...rules(DENIED_BASH), ...f.deny];
  switch (c) {
    case "L0":
    case "L1":
      return { tools: READ, allowedTools: f.read, disallowedTools: deny };
    case "L2":
      return { tools: [...READ, ...WRITE], allowedTools: [...f.read, ...f.write], disallowedTools: deny };
    case "L3":
      return { tools: [...READ, ...WRITE, "Bash"], allowedTools: [...f.read, ...f.write, ...rules([...TEST_COMMANDS, ...GIT_READ])], disallowedTools: deny };
    case "L4":
      return { tools: [...READ, ...WRITE, "Bash"], allowedTools: [...f.read, ...f.write, ...rules([...TEST_COMMANDS, ...GIT_READ, ...GIT_COMMIT])], disallowedTools: deny };
  }
}

/** The push URL every execution's git sees: not a remote, so any push fails before reaching a network. */
export const PUSH_DISABLED_URL = "parallax-execution-push-disabled://denied";
/** Every way to name a push destination: remote URLs, scp form, file URLs, and local paths. */
export const PUSH_URL_PREFIXES = ["https://", "http://", "ssh://", "git://", "file://", "git@", "/", "./", "../", "~"];

/** The only environment the CLI receives: enough to run and authenticate, nothing from the cockpit. */
export function executionEnv(base: Env = process.env): Record<string, string> {
  const keep = ["PATH", "HOME", "USER", "LOGNAME", "LANG", "TMPDIR", "SHELL"];
  const env: Record<string, string> = {};
  for (const k of keep) if (base[k]) env[k] = base[k]!;
  env.TERM = "dumb";
  env.GIT_TERMINAL_PROMPT = "0";
  env.GIT_CONFIG_NOSYSTEM = "1";
  env.GIT_CONFIG_GLOBAL = "/dev/null";   // no credential helpers, aliases or url rewrites from the user's config
  env.GIT_SSH_COMMAND = "/usr/bin/false";   // no ssh transport at all (keys in HOME stay unusable)
  // Every git command the run executes sees these, whatever the repository's own config says. pushurl alone does not
  // cover `git push <explicit url or path>`, so every URL form is rewritten for push, and credential helpers are off.
  const cfg: [string, string][] = [
    ["remote.origin.pushurl", PUSH_DISABLED_URL], ["remote.pushDefault", "parallax-execution-no-remote"], ["core.hooksPath", "/dev/null"],
    ["credential.helper", ""],
    ...PUSH_URL_PREFIXES.map((p): [string, string] => [`url.${PUSH_DISABLED_URL}.pushInsteadOf`, p]),
  ];
  env.GIT_CONFIG_COUNT = String(cfg.length);
  cfg.forEach(([k, v], i) => { env[`GIT_CONFIG_KEY_${i}`] = k; env[`GIT_CONFIG_VALUE_${i}`] = v; });
  return env;
}
