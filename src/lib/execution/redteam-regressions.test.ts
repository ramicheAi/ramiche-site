import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routeCommand } from "@/lib/command/router";
import type { ShadowRecord } from "@/lib/command/types";
import { approvalKey, approve } from "./approval";
import { runExecution, type ExecutionDeps } from "./executor";
import { JobsExecutionStore, MemoryExecutionStore } from "./store";
import { memoryJobsDb } from "./__fixtures__/memory-jobs-db";
import { approveExecution, prepareExecution, type ApproveDeps } from "./service";
import type { RepoEntry } from "./projects";
import type { ExecutionRequest } from "./contract";

const FAKE = join(process.cwd(), "src/lib/execution/__fixtures__/fake-claude.mjs");
const OWNER = "owner-uid-1";
const KEY = approvalKey("k".repeat(48))!;
const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
const g = (cwd: string, ...a: string[]) => execFileSync("git", a, { cwd, encoding: "utf8", env }).trim();
let root: string, bare: string, repo: string, seed: string;
const registry: RepoEntry[] = [{ slug: "mettle", origin: "test-owner/proj-a", checkouts: ["proj-a"], aliases: ["mettle"] }];
const tip = async (_e: unknown, branch: string) => { try { return g(bare, "rev-parse", "--verify", `refs/heads/${branch}`); } catch { return null; } };
beforeEach(() => {
  chmodSync(FAKE, 0o755);
  root = mkdtempSync(join(tmpdir(), "rt-"));
  bare = join(root, "origin.git"); mkdirSync(join(root, "checkouts"));
  g(root, "init", "-q", "--bare", "-b", "main", bare);
  seed = join(root, "seed"); g(root, "init", "-q", "-b", "main", seed);
  writeFileSync(join(seed, "README.md"), "x\n"); g(seed, "add", "-A"); g(seed, "commit", "-qm", "init"); g(seed, "push", "-q", bare, "main");
  repo = join(root, "checkouts", "proj-a"); g(root, "clone", "-q", bare, repo);
  g(repo, "remote", "set-url", "origin", "https://github.com/test-owner/proj-a.git");
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(root, { recursive: true, force: true }); });
const shadow = (text: string): ShadowRecord => ({ id: "9e000000-0000-4000-8000-000000000001", command: text, routedAt: "t", routerVersion: "m5-rules-1", shadow: true, executed: false, missionContext: null, supersedes: null, decision: routeCommand({ text }), linkedMissions: [] });
const deps = (store = new MemoryExecutionStore() as any): ApproveDeps => ({
  surface: "harness", ownerUid: OWNER, approvalKey: KEY, remoteTip: tip as any, registry,
  executor: { roots: [join(root, "checkouts")], execRoot: join(root, "exec"), store, claudeBin: FAKE, registry, remoteTip: async (_r, b) => tip(null, b), freeBytes: () => 1e12, telemetry: vi.fn(async () => {}) },
});
const FIX = "Claude Code, fix the METTLE roster import";

describe("PR #52 red team regressions: a run can never make the executor's own checks execute its code (P1)", () => {
  it("a filter driver planted in the shared .git config is a violation, and the executor's checks never run it", async () => {
    const marker = join(root, "PWNED"), script = join(root, "pw.sh");
    writeFileSync(script, `#!/bin/sh\necho "executor ran attacker code" >> ${marker}\ncat\n`); chmodSync(script, 0o755);
    const h = g(repo, "rev-parse", "HEAD");
    const plan = { actions: [
      { write: "README.md", content: "y\n" },
      { write: join(repo, ".git", "info", "attributes"), content: "* filter=pw\n" },
      { bash: `git config --file ${join(repo, ".git", "config")} filter.pw.clean ${script}` },
    ], result: "done" };
    const r: ExecutionRequest = { executionId: "00000000-0000-4000-8000-000000000101", commandId: null, missionId: null, founder: { uid: OWNER }, executor: "claude_code",
      project: { slug: "mettle" }, repository: { origin: "test-owner/proj-a", branch: "main", head: h }, task: { instruction: `x\nFAKE:${JSON.stringify(plan)}`, contextRefs: [] },
      capability: "L2", limits: { timeoutMs: 20000, maxTurns: 5, maxBudgetUsd: null }, idempotencyKey: "idem-rt-1", createdAt: new Date().toISOString() };
    const d = deps().executor as ExecutionDeps;
    const res = await runExecution(r, approve(r, OWNER, KEY), { ...d, surface: "harness", ownerUid: OWNER, approvalKey: KEY });
    expect(res.status).toBe("boundary_violation");
    expect(res.failure?.message).toContain("shared .git directory changed");
    expect(existsSync(marker)).toBe(false);
  });

  it("swapping the worktree's .git link for an attacker gitdir is a violation, and nothing in it runs", async () => {
    const marker = join(root, "PWNED2"), script = join(root, "pw2.sh");
    writeFileSync(script, `#!/bin/sh\necho ran >> ${marker}\ncat\n`); chmodSync(script, 0o755);
    const h = g(repo, "rev-parse", "HEAD");
    const sh = `git init -q evil && GIT_DIR=evil/.git GIT_WORK_TREE=. git add README.md && printf 'gitdir: evil/.git\\n' > .git && git config --file evil/.git/config filter.pw.clean ${script} && printf '* filter=pw\\n' > evil/.git/info/attributes && sleep 1 && printf 'z\\n' > README.md`;
    const r: ExecutionRequest = { executionId: "00000000-0000-4000-8000-000000000102", commandId: null, missionId: null, founder: { uid: OWNER }, executor: "claude_code",
      project: { slug: "mettle" }, repository: { origin: "test-owner/proj-a", branch: "main", head: h }, task: { instruction: `x\nFAKE:${JSON.stringify({ actions: [{ bash: sh }] })}`, contextRefs: [] },
      capability: "L1", limits: { timeoutMs: 20000, maxTurns: 5, maxBudgetUsd: null }, idempotencyKey: "idem-rt-2", createdAt: new Date().toISOString() };
    const d = deps().executor as ExecutionDeps;
    const res = await runExecution(r, approve(r, OWNER, KEY), { ...d, surface: "harness", ownerUid: OWNER, approvalKey: KEY });
    expect(res.status).toBe("boundary_violation");
    expect(res.failure?.message).toContain("worktree's .git link was changed");
    expect(existsSync(marker)).toBe(false);
  });
});

describe("PR #52 red team regressions: the run's own worktree metadata", () => {
  it("writing a config.worktree into the run's own admin directory is a violation", async () => {
    const h = g(repo, "rev-parse", "HEAD");
    const r: ExecutionRequest = { executionId: "00000000-0000-4000-8000-000000000103", commandId: null, missionId: null, founder: { uid: OWNER }, executor: "claude_code",
      project: { slug: "mettle" }, repository: { origin: "test-owner/proj-a", branch: "main", head: h },
      task: { instruction: `x\nFAKE:${JSON.stringify({ actions: [{ bash: 'printf "[core]\\n\\tfsmonitor = /tmp/x\\n" > "$(git rev-parse --git-dir)/config.worktree"' }] })}`, contextRefs: [] },
      capability: "L2", limits: { timeoutMs: 20000, maxTurns: 5, maxBudgetUsd: null }, idempotencyKey: "idem-rt-own-1", createdAt: new Date().toISOString() };
    const d = deps().executor as ExecutionDeps;
    const res = await runExecution(r, approve(r, OWNER, KEY), { ...d, surface: "harness", ownerUid: OWNER, approvalKey: KEY });
    expect(res.status).toBe("boundary_violation");
    expect(res.failure?.message).toContain("shared .git directory changed");
  });
});

describe("PR #52 red team regressions: a refusal never uses up the approval (P2)", () => {
  it("a transient refusal (checkout not yet fetched) does not poison the key: after a fetch the same approval runs", async () => {
    writeFileSync(join(seed, "a.txt"), "a\n"); g(seed, "add", "-A"); g(seed, "commit", "-qm", "two"); g(seed, "push", "-q", bare, "main");
    const d = deps();
    const p = await prepareExecution({ record: shadow(FIX), founderUid: OWNER }, d);
    if (!p.ok) throw new Error("prepare");
    const first = await approveExecution({ record: shadow(FIX), founderUid: OWNER, seenBindingHash: p.bindingHash }, d);
    expect(first.ok && first.result.failure?.code).toBe("repository_unresolved");
    g(repo, "fetch", "-q", bare, "main:refs/remotes/origin/main");
    const second = await approveExecution({ record: shadow(FIX), founderUid: OWNER, seenBindingHash: p.bindingHash }, d);
    if (second.ok && second.result.status !== "succeeded") console.log("DIAG second", second.result.status, second.result.failure);
    expect(second.ok && second.result.status).toBe("succeeded");
  }, 30_000);

  it("a failed attempt can run again under the same approval; a boundary violation cannot", async () => {
    const { db, jobs, events } = memoryJobsDb();
    const store = new JobsExecutionStore(db);
    const h = g(repo, "rev-parse", "HEAD");
    const mk = (plan: unknown, key: string): ExecutionRequest => ({ executionId: crypto.randomUUID(), commandId: null, missionId: null, founder: { uid: OWNER }, executor: "claude_code",
      project: { slug: "mettle" }, repository: { origin: "test-owner/proj-a", branch: "main", head: h }, task: { instruction: `x\nFAKE:${JSON.stringify(plan)}`, contextRefs: [] },
      capability: "L2", limits: { timeoutMs: 20000, maxTurns: 5, maxBudgetUsd: null }, idempotencyKey: key, createdAt: new Date().toISOString() });
    const d = { ...(deps(store).executor as ExecutionDeps), surface: "harness" as const, ownerUid: OWNER, approvalKey: KEY };
    const failing = mk({ actions: [], isError: true, result: "flaky" }, "idem-retry-1");
    const f1 = await runExecution(failing, approve(failing, OWNER, KEY), d);
    expect(f1.status).toBe("failed");
    const ok = await runExecution({ ...failing, executionId: crypto.randomUUID() }, approve(failing, OWNER, KEY), d);
    expect(ok.status).toBe("failed");   // the fake fails again, but it RAN again (a new attempt), not a cached refusal
    expect(events.filter((e) => e.kind === "retry")).toHaveLength(1);
    const violating = mk({ actions: [{ bash: "git -c user.email=t@t -c user.name=t commit -q --allow-empty -m x" }] }, "idem-violation-1");
    expect((await runExecution(violating, approve(violating, OWNER, KEY), d)).status).toBe("boundary_violation");
    const again = await runExecution({ ...violating, executionId: crypto.randomUUID() }, approve(violating, OWNER, KEY), d);
    expect(again.status).toBe("boundary_violation");   // the cached result: never re-run
    expect(events.filter((e) => e.kind === "retry")).toHaveLength(1);
    expect(jobs.size).toBe(2);
  }, 40_000);

  it("two approves racing on the jobs store run once", async () => {
    const { db } = memoryJobsDb();
    const d = deps(new JobsExecutionStore(db));
    const p = await prepareExecution({ record: shadow(FIX), founderUid: OWNER }, d); if (!p.ok) throw new Error();
    const [a, b] = await Promise.all([1, 2].map(() => approveExecution({ record: shadow(FIX), founderUid: OWNER, seenBindingHash: p.bindingHash }, d)));
    const codes = [a, b].map((x) => x.ok ? `${x.result.status}:${x.result.failure?.code ?? ""}` : x.code);
    if (codes.filter((c) => c.startsWith("succeeded")).length !== 1) console.log("DIAG race", codes);
    expect(codes.filter((c) => c.startsWith("succeeded")).length).toBe(1);
  }, 30_000);
});

describe("PR #52 red team regressions: a poisoned checkout never executes in a later run (R3)", () => {
  it("a filter planted by a violating run is refused before any git in every later run; nothing executes", async () => {
    const marker = join(root, "PWNED3"), script = join(root, "pw3.sh");
    writeFileSync(script, `#!/bin/sh\necho ran >> ${marker}\ncat\n`); chmodSync(script, 0o755);
    const h = g(repo, "rev-parse", "HEAD");
    const mk = (plan: unknown, key: string): ExecutionRequest => ({ executionId: crypto.randomUUID(), commandId: null, missionId: null, founder: { uid: OWNER }, executor: "claude_code",
      project: { slug: "mettle" }, repository: { origin: "test-owner/proj-a", branch: "main", head: h }, task: { instruction: `x\nFAKE:${JSON.stringify(plan)}`, contextRefs: [] },
      capability: "L2", limits: { timeoutMs: 20000, maxTurns: 5, maxBudgetUsd: null }, idempotencyKey: key, createdAt: new Date().toISOString() });
    const d = { ...(deps().executor as ExecutionDeps), surface: "harness" as const, ownerUid: OWNER, approvalKey: KEY };
    const poison = mk({ actions: [
      { write: join(repo, ".git", "info", "attributes"), content: "* filter=pw\n" },
      { bash: `git config --file ${join(repo, ".git", "config")} filter.pw.clean ${script} && git config --file ${join(repo, ".git", "config")} filter.pw.smudge ${script}` },
    ] }, "idem-r3-poison");
    expect((await runExecution(poison, approve(poison, OWNER, KEY), d)).status).toBe("boundary_violation");
    const clean = mk({ actions: [] }, "idem-r3-clean");
    const next = await runExecution(clean, approve(clean, OWNER, KEY), d);
    expect(next.failure?.code).toBe("repository_unsafe");
    expect(next.failure?.message).toContain("filter.\"pw\".clean");
    expect(existsSync(marker)).toBe(false);
  }, 30_000);

  it("the config scan: program-valued keys are flagged; exact git-lfs values and husky hooksPath are allowed; truncation tricks are not", async () => {
    const { unsafeGitConfig } = await import("./git");
    const common = join(repo, ".git");
    const write = (extra: string) => writeFileSync(join(common, "config"), `[core]\n\tbare = false\n\thooksPath = .husky/_\n${extra}`);
    write(`# installed by git lfs install\n[filter "lfs"]\n\t; comment\n\tclean = git-lfs clean -- %f\n\tsmudge = git-lfs smudge -- %f\n\tprocess = git-lfs filter-process\n\trequired = true\n`);
    expect(unsafeGitConfig(common)).toEqual([]);
    write(`[filter "lfs"]\n\tclean = git-lfs clean -- %f; touch /tmp/x\n`);
    expect(unsafeGitConfig(common)).toEqual(['filter."lfs".clean']);
    write(`[include]\n\tpath = ../../evil.cfg\n[diff "x"]\n\ttextconv = cat\n[merge "y"]\n\tdriver = sh\n[credential]\n\thelper = !evil\n[includeIf "gitdir:/"]\n\tpath = z\n`);
    expect(unsafeGitConfig(common)).toEqual(["include.path", 'diff."x".textconv', 'merge."y".driver', "credential.helper", 'includeif."gitdir:/".path']);
  });
});

describe("PR #52 red team regressions: an abandoned attempt is never re-run", () => {
  it("a reaped (abandoned) execution returns its failed result instead of running again", async () => {
    const { reapAbandoned } = await import("./reaper");
    const { db, jobs } = memoryJobsDb();
    const store = new JobsExecutionStore(db);
    const h = g(repo, "rev-parse", "HEAD");
    const r: ExecutionRequest = { executionId: crypto.randomUUID(), commandId: null, missionId: null, founder: { uid: OWNER }, executor: "claude_code",
      project: { slug: "mettle" }, repository: { origin: "test-owner/proj-a", branch: "main", head: h }, task: { instruction: "x", contextRefs: [] },
      capability: "L2", limits: { timeoutMs: 20000, maxTurns: 5, maxBudgetUsd: null }, idempotencyKey: "idem-abandon-1", createdAt: new Date().toISOString() };
    await store.begin(r, (await import("./contract")).bindingHash(r));
    for (const j of jobs.values()) Object.assign(j, { started_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" });
    await reapAbandoned({ db, now: Date.parse("2026-10-06T00:00:00Z"), host: "other", isAlive: () => false });
    const d = { ...(deps(store).executor as ExecutionDeps), surface: "harness" as const, ownerUid: OWNER, approvalKey: KEY, extraEnv: { FAKE_CLAUDE_RECORD: join(root, "abandon-rec.json") } };
    const res = await runExecution({ ...r, executionId: crypto.randomUUID() }, approve(r, OWNER, KEY), d);
    expect(res.failure?.code).toBe("abandoned");
    expect(existsSync(join(root, "abandon-rec.json"))).toBe(false);
  });
});
