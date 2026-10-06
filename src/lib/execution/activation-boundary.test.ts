/**
 * P06 M6F phase 1 boundary, rehearsed as if production dispatch were on (the gate is simulated open in this file only;
 * the real constant stays false). Production may run only L0 inspect and L1 analyze: a change command is narrowed to
 * read-only in plain sight, an explicit L2+ is refused by prepare and again by the executor, and an L1 run gets only
 * read tools, so push, PR, merge, deploy, migrations, credentials, messages and payments have no tool to run with.
 */
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./policy", async (orig) => {
  const real = await orig<typeof import("./policy")>();
  return { ...real, surfaceAllowed: () => ({ ok: true }) };   // simulate activation of the dispatch gate ONLY
});

const { routeCommand } = await import("@/lib/command/router");
const { approve, approvalKey } = await import("./approval");
const { runExecution } = await import("./executor");
const { cliPolicy } = await import("./policy");
const { approveExecution, prepareExecution } = await import("./service");
const { MemoryExecutionStore } = await import("./store");
import type { ShadowRecord } from "@/lib/command/types";
import type { RepoEntry } from "./projects";
import type { ApproveDeps } from "./service";

const FAKE = join(process.cwd(), "src/lib/execution/__fixtures__/fake-claude.mjs");
const OWNER = "owner-p1";
const KEY = approvalKey("p".repeat(48))!;
const registry: RepoEntry[] = [{ slug: "mettle", origin: "test-owner/proj-a", checkouts: ["proj-a"], aliases: ["mettle"] }];
let root: string, bare: string, rec: string;
const g = (cwd: string, ...a: string[]) => execFileSync("git", a, { cwd, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } }).trim();
const tip = async (_e: RepoEntry, b: string) => { try { return g(bare, "rev-parse", "--verify", `refs/heads/${b}`); } catch { return null; } };

beforeEach(() => {
  chmodSync(FAKE, 0o755);
  root = mkdtempSync(join(tmpdir(), "m6f-p1-"));
  bare = join(root, "origin.git");
  mkdirSync(join(root, "checkouts"));
  g(root, "init", "-q", "--bare", "-b", "main", bare);
  const seed = join(root, "seed");
  g(root, "init", "-q", "-b", "main", seed);
  writeFileSync(join(seed, "README.md"), "x\n");
  g(seed, "add", "-A"); g(seed, "commit", "-qm", "init"); g(seed, "push", "-q", bare, "main");
  const repo = join(root, "checkouts", "proj-a");
  g(root, "clone", "-q", bare, repo);
  g(repo, "remote", "set-url", "origin", "https://github.com/test-owner/proj-a.git");
  rec = join(root, "record.json");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const shadow = (text: string): ShadowRecord => ({
  id: "9e000000-0000-4000-8000-0000000000b1", command: text, routedAt: "t", routerVersion: "m5-rules-1", shadow: true, executed: false,
  missionContext: null, supersedes: null, decision: routeCommand({ text }), linkedMissions: [],
});
const prod = (): ApproveDeps => ({
  surface: "production", ownerUid: OWNER, approvalKey: KEY, remoteTip: tip, registry,
  executor: {
    roots: [join(root, "checkouts")], execRoot: join(root, "exec"), store: new MemoryExecutionStore(), claudeBin: FAKE, registry,
    remoteTip: async (_r, b) => tip(registry[0], b), freeBytes: () => 1e12, telemetry: vi.fn(async () => {}), extraEnv: { FAKE_CLAUDE_RECORD: rec },
  },
});
const INSPECT = "Claude Code, inspect METTLE and tell me what is blocking production.";

describe("phase 1 production: L0/L1 only", () => {
  it("the founder sees 'analyze' and approves; the run gets only read tools and succeeds", async () => {
    expect(routeCommand({ text: INSPECT }).intent).toBe("implementation");   // router unchanged: it implies L2
    const p = await prepareExecution({ record: shadow(INSPECT), founderUid: OWNER }, prod());
    if (!p.ok) throw new Error(p.message);
    expect(p.request.capability).toBe("L1");
    expect(p.sentence).toBe("Claude Code wants to analyze METTLE (read only: changing files is not enabled yet).");
    const out = await approveExecution({ record: shadow(INSPECT), founderUid: OWNER, seenBindingHash: p.bindingHash }, prod());
    expect(out.ok && out.result.status).toBe("succeeded");
    const seen = JSON.parse(readFileSync(rec, "utf8")) as { argv: string[] };
    expect(seen.argv[seen.argv.indexOf("--tools") + 1].split(",").sort()).toEqual(["Glob", "Grep", "Read"]);
  }, 30_000);

  it("an explicit L2, L3 or L4 is refused by prepare; L0 is allowed", async () => {
    for (const c of ["L2", "L3", "L4"] as const) {
      const p = await prepareExecution({ record: shadow(INSPECT), founderUid: OWNER, choices: { capability: c } }, prod());
      expect(p).toMatchObject({ ok: false });
      expect(["capability_not_enabled", "capability_unavailable", "capability_widened"]).toContain((p as { code: string }).code);
    }
    expect(await prepareExecution({ record: shadow(INSPECT), founderUid: OWNER, choices: { capability: "L0" } }, prod())).toMatchObject({ ok: true, request: { capability: "L0" } });
    expect(existsSync(rec)).toBe(false);
  });

  it("the executor refuses an approved L2 on the production surface even if prepare were bypassed", async () => {
    const p = await prepareExecution({ record: shadow(INSPECT), founderUid: OWNER }, { ...prod(), surface: "harness" });
    if (!p.ok) throw new Error(p.message);
    expect(p.request.capability).toBe("L2");
    const out = await runExecution(p.request, approve(p.request, OWNER, KEY), { ...prod().executor, surface: "production", ownerUid: OWNER, approvalKey: KEY });
    expect(out).toMatchObject({ status: "rejected", failure: { code: "capability_not_enabled" } });
    expect(existsSync(rec)).toBe(false);
  });

  it("consequential actions have no tool at L0/L1: no Bash, no Edit, no Write, no MCP", () => {
    for (const c of ["L0", "L1"] as const) {
      const pol = cliPolicy(c, "/x/wt");
      expect(pol.tools.sort()).toEqual(["Glob", "Grep", "Read"]);
      expect(pol.allowedTools.every((r) => r.startsWith("Read("))).toBe(true);
    }
  });

  it("founder authority commands still stop before any execution (deploy, payments, messages)", async () => {
    for (const t of ["deploy this to production", "Refund the last customer payment", "Send the proposal email to the client"]) {
      const p = await prepareExecution({ record: shadow(t), founderUid: OWNER }, prod());
      expect(p.ok, t).toBe(false);
    }
  });
});
