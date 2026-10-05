/** P06 M6: contract, approval binding, capability policy, project resolution, jobs store and Mission suggestion. */
import { describe, expect, it } from "vitest";
import { PROJECTS } from "@/app/command-center/shared-projects";
import { approvalKey, approve, verifyApproval, APPROVAL_MAX_TTL_MS } from "./approval";
import { claudeArgs } from "./claude-code";
import { bindingHash, CAPABILITIES, EXECUTABLE_CAPABILITIES, invalidRequest, nextStepAfter, type ExecutionRequest, type ExecutionResult } from "./contract";
import { missionSuggestion } from "./mission";
import { cliPolicy, DENIED_BASH, executionEnv, PRODUCTION_DISPATCH_ENABLED, PUSH_DISABLED_URL, surfaceAllowed } from "./policy";
import { bySlug, originOf, REPO_REGISTRY, resolveProject } from "./projects";
import { executionJobId, JobsExecutionStore, jobStatusFor, type JobsDb } from "./store";

const req = (over: Partial<ExecutionRequest> = {}): ExecutionRequest => ({
  executionId: "00000000-0000-4000-8000-000000000001", commandId: "00000000-0000-4000-8000-000000000002", missionId: null,
  founder: { uid: "owner" }, executor: "claude_code", project: { slug: "mettle" },
  repository: { origin: "ramicheAi/mettle", branch: "main", head: "a".repeat(40) },
  task: { instruction: "Fix athlete import validation.", contextRefs: ["chat_message:1"] }, capability: "L2",
  limits: { timeoutMs: 600_000, maxTurns: 40, maxBudgetUsd: null }, idempotencyKey: "cmd-1-L2", createdAt: "2026-10-05T15:00:00Z", ...over,
});
const KEY = approvalKey("k".repeat(40))!;

describe("execution contract", () => {
  it("a well-formed request has no problems; malformed fields are each named", () => {
    expect(invalidRequest(req())).toEqual([]);
    const bad = invalidRequest({ ...req(), executionId: "x", capability: "L5", repository: { origin: "nope", branch: "..", head: "abc" }, limits: { timeoutMs: 1, maxTurns: 0, maxBudgetUsd: -1 } });
    expect(bad.join(" ")).toMatch(/executionId[\s\S]*origin[\s\S]*branch[\s\S]*head[\s\S]*capability[\s\S]*timeoutMs[\s\S]*maxTurns[\s\S]*maxBudgetUsd/);
  });

  it("the binding covers everything an approval means, but not the per-attempt execution id", () => {
    const h = bindingHash(req());
    for (const over of [{ capability: "L4" as const }, { task: { instruction: "Deploy it.", contextRefs: [] } }, { repository: { origin: "ramicheAi/mettle", branch: "main", head: "b".repeat(40) } },
      { project: { slug: "galactik-antics" } }, { idempotencyKey: "other-key" }, { limits: { timeoutMs: 600_001, maxTurns: 40, maxBudgetUsd: null } }, { founder: { uid: "x" } }, { commandId: null }]) {
      expect(bindingHash(req(over))).not.toBe(h);
    }
    expect(bindingHash(req({ executionId: "00000000-0000-4000-8000-0000000000ff", createdAt: "2027-01-01T00:00:00Z" }))).toBe(h);
  });

  it("the next step is only ever an executable capability, and after a commit it is consequential (never a capability)", () => {
    expect(EXECUTABLE_CAPABILITIES).toEqual(["L0", "L1", "L2"]);
    expect(nextStepAfter("L2", 2, false)).toBeNull();   // L3 is not executable until an OS sandbox exists
    expect(nextStepAfter("L3", 2, false)).toBeNull();
    expect(nextStepAfter("L4", 2, true)).toEqual({ action: "Open a pull request", capability: null, consequential: "pull_request" });
    expect(nextStepAfter("L2", 0, false)).toBeNull();
    expect(CAPABILITIES).toEqual(["L0", "L1", "L2", "L3", "L4"]);   // no level grants push, merge or deploy
  });
});

describe("founder approval", () => {
  it("verifies for exactly the approved request, within its time, by its founder", () => {
    const r = req();
    const a = approve(r, "owner", KEY, 1_000_000);
    expect(verifyApproval(r, a, KEY, 1_000_000 + 60_000)).toEqual({ ok: true });
    expect(verifyApproval(r, a, KEY, 1_000_000 + APPROVAL_MAX_TTL_MS).ok).toBe(false);
    expect(verifyApproval({ ...r, capability: "L3" }, a, KEY, 1_000_001)).toMatchObject({ code: "approval_mismatch" });
    expect(verifyApproval(r, { ...a, expiresAt: new Date(1_000_000 + 60 * 60_000).toISOString() }, KEY, 1_000_001)).toMatchObject({ code: "approval_invalid" });   // extended expiry breaks the signature
    expect(verifyApproval(r, a, approvalKey("q".repeat(40)), 1_000_001)).toMatchObject({ code: "approval_invalid" });
    expect(verifyApproval(r, a, null, 1_000_001)).toMatchObject({ code: "approval_key_unavailable" });
    expect(verifyApproval(r, approve(r, "intruder", KEY, 1_000_000), KEY, 1_000_001)).toMatchObject({ code: "approval_wrong_founder" });
  });

  it("the approval key is derived and needs a real secret; a short or missing secret fails closed", () => {
    expect(approvalKey(undefined)).toBeNull();
    expect(approvalKey("short")).toBeNull();
    expect(approvalKey("k".repeat(40))!.equals(approvalKey("k".repeat(40))!)).toBe(true);
  });
});

describe("capability policy", () => {
  it("only L3 and L4 get a shell, and every level denies push, remotes, deploy tools and network fetchers", () => {
    const WT = "/Users/admin/.parallax/executions/mettle/00000000-0000-4000-8000-000000000001";
    expect(cliPolicy("L0", WT).tools).toEqual(["Read", "Glob", "Grep"]);
    expect(cliPolicy("L1", WT).tools).toEqual(["Read", "Glob", "Grep"]);
    expect(cliPolicy("L2", WT).tools).toEqual(["Read", "Glob", "Grep", "Edit", "Write"]);
    for (const c of ["L0", "L1", "L2"] as const) expect(cliPolicy(c, WT).tools).not.toContain("Bash");
    for (const c of CAPABILITIES) {
      const p = cliPolicy(c, WT);
      for (const d of ["git push", "gh", "vercel", "supabase", "curl"]) expect(p.disallowedTools).toContain(`Bash(${d}:*)`);
      expect(p.tools).not.toContain("WebFetch");
      expect(p.tools).not.toContain("NotebookEdit");
    }
    expect(cliPolicy("L3", WT).allowedTools).not.toContain("Bash(git commit:*)");
    expect(cliPolicy("L4", WT).allowedTools).toContain("Bash(git commit:*)");
    expect(DENIED_BASH).toContain("git config");
  });

  it("file access is confined to the worktree: no bare Read/Edit/Write allow rule, anchored // rules only (PR #47 Codex P1)", () => {
    const WT = "/Users/admin/.parallax/executions/mettle/00000000-0000-4000-8000-000000000001";
    for (const c of CAPABILITIES) {
      const p = cliPolicy(c, WT);
      for (const bare of ["Read", "Edit", "Write", "Glob", "Grep"]) expect(p.allowedTools).not.toContain(bare);
      for (const r of p.allowedTools.filter((x) => /^(Read|Edit|Write)\(/.test(x))) expect(r).toMatch(/^(Read|Edit|Write)\(\/\/Users\/admin\/\.parallax\/executions\/mettle\/[0-9a-f-]+\/\*\*\)$/);
      expect(p.disallowedTools).toContain(`Edit(/${WT}/.git/**)`);
    }
    expect(cliPolicy("L0", WT).allowedTools).toEqual([`Read(/${WT}/**)`]);
    expect(cliPolicy("L2", WT).allowedTools).toEqual([`Read(/${WT}/**)`, `Edit(/${WT}/**)`, `Write(/${WT}/**)`]);
    for (const bad of ["relative/path", "/x/*/y", "/x/[a]", "/x/../y", "/x/!y"]) expect(() => cliPolicy("L2", bad)).toThrow();
  });

  it("the CLI arguments never bypass permissions, load settings, MCP or skills", () => {
    const a = claudeArgs({ capability: "L4", cwd: "/w/x", projectName: "METTLE", maxTurns: 10, maxBudgetUsd: 2, model: "sonnet" });
    expect(a.join(" ")).not.toMatch(/dangerously|bypassPermissions|acceptEdits/);
    expect(a).toEqual(expect.arrayContaining(["--permission-mode", "dontAsk", "--strict-mcp-config", "--disable-slash-commands", "--no-session-persistence"]));
    expect(a[a.indexOf("--setting-sources") + 1]).toBe("");
  });

  it("the execution environment carries no cockpit secrets and disables every push route", () => {
    const env = executionEnv({ PATH: "/bin", HOME: "/h", USER: "u", PARALLAX_CSRF_SECRET: "x", SUPABASE_SERVICE_ROLE_KEY: "y", VERCEL_TOKEN: "z", GITHUB_TOKEN: "t", ANTHROPIC_API_KEY: "a" });
    expect(env.GIT_CONFIG_GLOBAL).toBe("/dev/null");
    for (const k of ["PARALLAX_CSRF_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "VERCEL_TOKEN", "GITHUB_TOKEN", "ANTHROPIC_API_KEY"]) expect(env[k]).toBeUndefined();
    const cfg = Array.from({ length: Number(env.GIT_CONFIG_COUNT) }, (_, i) => [env[`GIT_CONFIG_KEY_${i}`], env[`GIT_CONFIG_VALUE_${i}`]]);
    expect(cfg).toContainEqual(["remote.origin.pushurl", PUSH_DISABLED_URL]);
    expect(cfg).toContainEqual(["credential.helper", ""]);
    for (const p of ["https://", "git@", "ssh://", "file://", "/"]) expect(cfg).toContainEqual([`url.${PUSH_DISABLED_URL}.pushInsteadOf`, p]);
    expect(env.GIT_SSH_COMMAND).toBe("/usr/bin/false");
  });

  it("production dispatch is a constant off; the cockpit deployment can never run executions", () => {
    expect(PRODUCTION_DISPATCH_ENABLED).toBe(false);
    expect(surfaceAllowed("production", {})).toMatchObject({ ok: false, code: "production_dispatch_disabled" });
    expect(surfaceAllowed("harness", { NEXT_DIST_DIR: ".next-cc" })).toMatchObject({ ok: false });
    expect(surfaceAllowed("harness", {})).toEqual({ ok: true });
  });
});

describe("project and repository resolution", () => {
  it("every registry slug is a canonical project (no duplicate project truth)", () => {
    for (const e of REPO_REGISTRY) expect(PROJECTS.map((p) => p.slug)).toContain(e.slug);
  });

  it("one named project resolves; none or several, or an unsettled repository, asks instead of guessing", () => {
    expect(resolveProject("Inspect METTLE and continue the highest-priority unfinished work")).toMatchObject({ ok: true, entry: { origin: "ramicheAi/mettle" } });
    expect(resolveProject("Fix the cockpit spacing")).toMatchObject({ ok: true, entry: { origin: "ramicheAi/ramiche-site" } });
    expect(resolveProject("Fix the login bug")).toMatchObject({ ok: false, code: "project_unresolved" });
    expect(resolveProject("Port the METTLE leaderboard to Galactik")).toMatchObject({ ok: false, code: "project_ambiguous" });
    expect(resolveProject("Update the parallax site hero")).toMatchObject({ ok: false, code: "repository_unsettled" });
    expect(resolveProject("RAMICHE OS cleanup")).toMatchObject({ ok: false, code: "project_unresolved" });
    expect(resolveProject("metallic finish")).toMatchObject({ ok: false });   // word boundaries, not substrings
    expect(bySlug("nope")).toMatchObject({ ok: false, code: "project_unresolved" });
  });

  it("origins normalise from https, ssh and scp remotes; anything else is not an origin", () => {
    for (const u of ["https://github.com/ramicheAi/mettle.git", "git@github.com:ramicheAi/mettle.git", "ssh://git@github.com/ramicheAi/mettle", "https://github.com/ramicheAi/mettle/"]) expect(originOf(u)).toBe("ramicheAi/mettle");
    expect(originOf("/Users/admin/origin.git")).toBeNull();
    expect(originOf("https://evil.example/ramicheAi/mettle.git")).toBeNull();   // only github.com is an origin (PR #47 review)
  });
});

describe("jobs-backed execution store (existing jobs / job_events, no migration)", () => {
  function fakeDb() {
    const jobs = new Map<string, Record<string, unknown>>(); const events: Record<string, unknown>[] = [];
    const db: JobsDb = {
      async insertJob(row) { if (jobs.has(String(row.id))) return { conflict: true, error: null }; jobs.set(String(row.id), row); return { conflict: false, error: null }; },
      async getJob(id) { const j = jobs.get(id); return j ? { input: j.input as Record<string, unknown>, resultEvent: (events.find((e) => e.job_id === id)?.detail as ExecutionResult) ?? null } : null; },
      async updateJob(id, patch) { Object.assign(jobs.get(id)!, patch); return { error: null }; },
      async insertEvent(row) { events.push(row); return { error: null }; },
    };
    return { db, jobs, events };
  }

  it("one jobs row per idempotency key, with the binding hash; a repeat sees it; the result lands as a job_events detail", async () => {
    const { db, jobs, events } = fakeDb();
    const s = new JobsExecutionStore(db);
    const r = req();
    expect(await s.begin(r, "hash-1")).toEqual({ state: "new" });
    const row = jobs.get(executionJobId(r.idempotencyKey))!;
    expect(row).toMatchObject({ kind: "dev", status: "running", agent: "claude-code", source: "m6-executor", input: { bindingHash: "hash-1", capability: "L2", project: "mettle" } });
    expect(JSON.stringify(row)).not.toMatch(/secret|token|password/i);
    expect(await s.begin(r, "hash-1")).toEqual({ state: "existing", bindingHash: "hash-1", result: null });
    const result = { status: "succeeded", summary: "ok", completedAt: "2026-10-05T15:01:00Z", failure: null } as unknown as ExecutionResult;
    await s.finish(r, result);
    expect(row).toMatchObject({ status: "done", result: "ok", finished_at: "2026-10-05T15:01:00Z" });
    expect(events[0]).toMatchObject({ job_id: executionJobId(r.idempotencyKey), kind: "execution_result" });
    expect(["succeeded", "failed", "canceled", "timed_out", "boundary_violation", "rejected"].map((x) => jobStatusFor(x as never))).toEqual(["done", "failed", "canceled", "failed", "failed", "failed"]);
  });

  it("a store that cannot record fails closed (the executor will not run unrecorded work), and a lost result is loud", async () => {
    const s = new JobsExecutionStore({ ...fakeDb().db, insertJob: async () => ({ conflict: false, error: "down" }) });
    await expect(s.begin(req(), "h")).rejects.toThrow(/could not be created/);
    const result = { status: "succeeded", summary: "ok", completedAt: "t", failure: null } as unknown as ExecutionResult;
    await expect(new JobsExecutionStore({ ...fakeDb().db, updateJob: async () => ({ error: "down" }) }).finish(req(), result)).rejects.toThrow(/could not be saved/);
    await expect(new JobsExecutionStore({ ...fakeDb().db, updateJob: async () => ({ error: null }), insertEvent: async () => ({ error: "down" }) }).finish(req(), result)).rejects.toThrow(/could not be saved/);
  });
});

describe("Mission only when persistence adds value", () => {
  const ok = (over: Partial<ExecutionResult> = {}) => ({ status: "succeeded", nextStep: null, ...over }) as ExecutionResult;
  it("simple finished work is command, execution, result; multi-step or recommended work suggests a Mission; a Mission run links back", () => {
    expect(missionSuggestion({ missionId: null, missionRecommended: false, result: ok() })).toEqual({ suggest: false });
    expect(missionSuggestion({ missionId: null, missionRecommended: true, result: ok() })).toMatchObject({ suggest: true, attachTo: null });
    expect(missionSuggestion({ missionId: null, missionRecommended: false, result: ok({ nextStep: { action: "Create commit", capability: "L4", consequential: null } }) })).toMatchObject({ suggest: true });
    expect(missionSuggestion({ missionId: "00000000-0000-4000-8000-0000000000aa", missionRecommended: false, result: ok() })).toMatchObject({ suggest: true, attachTo: "00000000-0000-4000-8000-0000000000aa" });
    expect(missionSuggestion({ missionId: null, missionRecommended: true, result: ok({ status: "failed" }) })).toEqual({ suggest: false });
  });
});
