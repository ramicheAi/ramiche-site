/**
 * P06 M6C: Universal Command -> decision -> exact request -> founder approval -> executor -> result, end to end on real
 * git with the fake CLI (surface "harness"), plus the red-team cases for the connection itself.
 */
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routeCommand } from "@/lib/command/router";
import type { ShadowRecord } from "@/lib/command/types";
import { approvalKey } from "./approval";
import { MemoryExecutionStore } from "./store";
import { approveExecution, executionAvailable, impliedCapability, prepareExecution, type ApproveDeps } from "./service";
import type { RepoEntry } from "./projects";

const FAKE = join(process.cwd(), "src/lib/execution/__fixtures__/fake-claude.mjs");
const OWNER = "owner-uid-1";
const KEY = approvalKey("k".repeat(48))!;
const g = (cwd: string, ...a: string[]) => execFileSync("git", a, { cwd, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } }).trim();

let root: string, bare: string, repo: string, rec: string;
const registry: RepoEntry[] = [{ slug: "mettle", origin: "test-owner/proj-a", checkouts: ["proj-a"], aliases: ["mettle"] }];
const tip = async (_e: RepoEntry, branch: string) => { try { return g(bare, "rev-parse", "--verify", `refs/heads/${branch}`); } catch { return null; } };

beforeEach(() => {
  chmodSync(FAKE, 0o755);
  root = mkdtempSync(join(tmpdir(), "m6c-"));
  bare = join(root, "origin.git");
  mkdirSync(join(root, "checkouts"));
  g(root, "init", "-q", "--bare", "-b", "main", bare);
  const seed = join(root, "seed");
  g(root, "init", "-q", "-b", "main", seed);
  writeFileSync(join(seed, "README.md"), "x\n");
  g(seed, "add", "-A"); g(seed, "commit", "-qm", "init"); g(seed, "push", "-q", bare, "main");
  repo = join(root, "checkouts", "proj-a");
  g(root, "clone", "-q", bare, repo);
  g(repo, "remote", "set-url", "origin", "https://github.com/test-owner/proj-a.git");
  rec = join(root, "record.json");
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(root, { recursive: true, force: true }); });

const shadow = (text: string, over: Partial<ShadowRecord> = {}): ShadowRecord => ({
  id: "9e000000-0000-4000-8000-000000000001", command: text, routedAt: "t", routerVersion: "m5-rules-1", shadow: true, executed: false,
  missionContext: null, supersedes: null, decision: routeCommand({ text }), linkedMissions: [], ...over,
});
const deps = (over: Partial<ApproveDeps> = {}): ApproveDeps => ({
  surface: "harness", ownerUid: OWNER, approvalKey: KEY, remoteTip: tip, registry,
  executor: {
    roots: [join(root, "checkouts")], execRoot: join(root, "exec"), store: new MemoryExecutionStore(), claudeBin: FAKE, registry,
    remoteTip: async (_r, b) => tip(registry[0], b), freeBytes: () => 1e12, telemetry: vi.fn(async () => {}), extraEnv: { FAKE_CLAUDE_RECORD: rec },
  },
  ...over,
});
const FIX = "Claude Code, fix the METTLE roster import";

describe("prepare: the smallest exact decision, derived on the server", () => {
  it("a Claude Code implementation command becomes an L2 request on the resolved project at the remote head", async () => {
    const p = await prepareExecution({ record: shadow(FIX), founderUid: OWNER }, deps());
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.sentence).toBe("Claude Code wants to modify METTLE locally.");
    expect(p.request).toMatchObject({ capability: "L2", project: { slug: "mettle" }, repository: { origin: "test-owner/proj-a", branch: "main", head: g(bare, "rev-parse", "main") }, commandId: shadow(FIX).id, founder: { uid: OWNER } });
    expect(p.details).toMatchObject({ Executor: "Claude Code", Project: "METTLE", Repository: "test-owner/proj-a", Capability: "L2 (Modify locally)" });
    const again = await prepareExecution({ record: shadow(FIX), founderUid: OWNER }, deps());
    expect(again.ok && again.bindingHash).toBe(p.bindingHash);   // stable: what the founder sees is what approve re-derives
  });

  it("non-executable decisions stop plainly: founder authority, no executor, no handler", async () => {
    expect(await prepareExecution({ record: shadow("deploy this to production"), founderUid: OWNER }, deps())).toMatchObject({ ok: false, code: "founder_authority" });
    expect(await prepareExecution({ record: shadow("Research competitor pricing"), founderUid: OWNER }, deps())).toMatchObject({ ok: false, code: "no_executor" });
    expect(await prepareExecution({ record: shadow("Mettle onboarding"), founderUid: OWNER }, deps())).toMatchObject({ ok: false, code: "needs_handler" });
  });

  it("the capability can be narrowed, never widened, and never above what can execute", async () => {
    const analyze = shadow("Claude Code, review the METTLE roster logic");
    expect(impliedCapability(analyze.decision)).toBe("L1");
    expect(await prepareExecution({ record: analyze, founderUid: OWNER, choices: { capability: "L2" } }, deps())).toMatchObject({ ok: false, code: "capability_widened" });
    expect(await prepareExecution({ record: shadow(FIX), founderUid: OWNER, choices: { capability: "L4" } }, deps())).toMatchObject({ ok: false, code: "capability_widened" });
    expect(await prepareExecution({ record: shadow(FIX), founderUid: OWNER, choices: { capability: "L1" } }, deps())).toMatchObject({ ok: true, request: { capability: "L1" } });
  });

  it("an unresolved or ambiguous project asks; it never guesses", async () => {
    const p = await prepareExecution({ record: shadow("Claude Code, fix the login bug"), founderUid: OWNER }, deps());
    expect(p).toMatchObject({ ok: false, code: "project_unresolved", question: "Which project is this for?" });
  });
});

describe("approve: runs exactly what was shown, or nothing", () => {
  it("end to end: the founder approves the shown request and the executor runs it; the result comes back with a Mission suggestion", async () => {
    const p = await prepareExecution({ record: shadow(FIX), founderUid: OWNER }, deps());
    if (!p.ok) throw new Error("prepare failed");
    const out = await approveExecution({ record: shadow(FIX), founderUid: OWNER, seenBindingHash: p.bindingHash }, deps());
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result.status).toBe("succeeded");
    expect(out.result.project).toBe("mettle");
    expect(existsSync(rec)).toBe(true);   // the CLI ran
    // The router recommends a Mission for named Claude Code work, so a Mission is suggested (never created).
    expect(shadow(FIX).decision.missionRecommended).toBe(true);
    expect(out.mission).toEqual({ suggest: true, reason: "This is multi-step work worth tracking.", attachTo: null });
  }, 30_000);

  it("a new commit between prepare and approve stops: nothing runs (changed HEAD after approval)", async () => {
    const p = await prepareExecution({ record: shadow(FIX), founderUid: OWNER }, deps());
    if (!p.ok) throw new Error("prepare failed");
    const other = join(root, "other");
    g(root, "clone", "-q", bare, other); writeFileSync(join(other, "n.txt"), "n\n"); g(other, "add", "-A"); g(other, "commit", "-qm", "moved"); g(other, "push", "-q", "origin", "main");
    const out = await approveExecution({ record: shadow(FIX), founderUid: OWNER, seenBindingHash: p.bindingHash }, deps());
    expect(out).toMatchObject({ ok: false, code: "changed_since_shown" });
    expect(existsSync(rec)).toBe(false);
  });

  it("red team: a forged, widened or replayed approval never runs anything new", async () => {
    const p = await prepareExecution({ record: shadow(FIX), founderUid: OWNER }, deps());
    if (!p.ok) throw new Error("prepare failed");
    // forged hash / changed task after approval / widened capability: re-derivation differs, so nothing runs
    expect(await approveExecution({ record: shadow(FIX), founderUid: OWNER, seenBindingHash: "0".repeat(64) }, deps())).toMatchObject({ code: "changed_since_shown" });
    expect(await approveExecution({ record: shadow(FIX + " and deploy it"), founderUid: OWNER, seenBindingHash: p.bindingHash }, deps())).toMatchObject({ ok: false });
    expect(await approveExecution({ record: shadow(FIX), founderUid: OWNER, choices: { capability: "L1" }, seenBindingHash: p.bindingHash }, deps())).toMatchObject({ code: "changed_since_shown" });
    // forged founder identity / machine caller: not the session founder
    expect(await approveExecution({ record: shadow(FIX), founderUid: "agent:atlas", seenBindingHash: p.bindingHash }, deps())).toMatchObject({ code: "not_founder" });
    expect(await approveExecution({ record: shadow(FIX), founderUid: OWNER, seenBindingHash: "" }, deps())).toMatchObject({ code: "approval_invalid" });
    expect(existsSync(rec)).toBe(false);
    // replay: approving the same shown request twice runs once (idempotency key), the second returns the first result
    const d = deps();
    const first = await approveExecution({ record: shadow(FIX), founderUid: OWNER, seenBindingHash: p.bindingHash }, d);
    rmSync(rec);
    const second = await approveExecution({ record: shadow(FIX), founderUid: OWNER, seenBindingHash: p.bindingHash }, d);
    expect(first.ok && second.ok && second.result).toEqual(first.ok && first.result);
    expect(existsSync(rec)).toBe(false);
  }, 30_000);

  it("a Mission link in the command is a suggestion only: the executor never writes Missions and gains no authority from it", async () => {
    const inMission = shadow(FIX, { missionContext: "00000000-0000-4000-8000-0000000000aa" });
    const p = await prepareExecution({ record: inMission, founderUid: OWNER }, deps());
    if (!p.ok) throw new Error("prepare failed");
    expect(p.request.missionId).toBe("00000000-0000-4000-8000-0000000000aa");
    expect(p.request.capability).toBe("L2");   // same capability as without the Mission
    const out = await approveExecution({ record: inMission, founderUid: OWNER, seenBindingHash: p.bindingHash }, deps());
    expect(out.ok && out.mission).toEqual({ suggest: true, reason: "Link this result to its Mission as evidence.", attachTo: "00000000-0000-4000-8000-0000000000aa" });
  }, 30_000);

  it("the production gate answers first: no remote read, no store write, no run, whatever the request", async () => {
    const remoteTip = vi.fn(tip);
    const store = new MemoryExecutionStore();
    const out = await approveExecution({ record: shadow(FIX), founderUid: OWNER, seenBindingHash: "a".repeat(64) },
      deps({ surface: "production", remoteTip, executor: { ...deps().executor, store } }));
    expect(out).toMatchObject({ ok: false, code: "production_dispatch_disabled" });
    expect(remoteTip).not.toHaveBeenCalled();
    expect(store.rows.size).toBe(0);
    expect(executionAvailable()).toBe(false);
    vi.stubEnv("NEXT_DIST_DIR", ".next-cc");
    expect(await approveExecution({ record: shadow(FIX), founderUid: OWNER, seenBindingHash: "a".repeat(64) }, deps())).toMatchObject({ code: "production_dispatch_disabled" });
    expect(existsSync(rec)).toBe(false);
  });

  it("no approval key on the host refuses before running", async () => {
    const p = await prepareExecution({ record: shadow(FIX), founderUid: OWNER }, deps());
    if (!p.ok) throw new Error("prepare failed");
    expect(await approveExecution({ record: shadow(FIX), founderUid: OWNER, seenBindingHash: p.bindingHash }, deps({ approvalKey: null }))).toMatchObject({ code: "approval_key_unavailable" });
    expect(existsSync(rec)).toBe(false);
  });
});
