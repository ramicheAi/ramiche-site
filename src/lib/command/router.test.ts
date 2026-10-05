/**
 * P06 M5: the shadow router is pure and deterministic. These pin the taxonomy, the rule order, and the safety rule
 * that founder-authority and security decisions are never delegated, not even when a handler is named.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { routeCommand } from "./router";
import { HANDLER_META, HANDLERS } from "./types";

const r = (text: string, extra: Partial<Parameters<typeof routeCommand>[0]> = {}) => routeCommand({ text, ...extra });
const MID = "00000000-0000-4000-8000-000000000001";
afterEach(() => vi.unstubAllGlobals());

describe("explicit routing", () => {
  it("the north-star command: Claude Code builds, Codex reviews, the founder keeps merge", () => {
    const d = r("Claude Code, fix Mettle. Codex reviews. Don't merge without me.");
    expect(d).toMatchObject({
      handler: "claude_code", reviewer: "codex_review", mergeAuthority: "founder", missionRecommended: true, attachRecommended: false,
      founderApprovalRequired: true, reviewRequired: true, source: "explicit", intent: "implementation", classifier: null, question: null,
    });
    expect(d.reasons).toEqual(["named_claude_code", "named_reviewer_codex_review", "founder_keeps_merge_authority"]);
  });
  it.each([
    ["Codex review this PR", "codex_review", "review"],
    ["codex, look at the auth diff", "codex_review", "review"],
    ["Ask ChatGPT to draft three subject lines", "chatgpt", "conversation"],
    ["GPT-5 summarize the meeting notes", "chatgpt", "conversation"],
    ["Claude, help me think through pricing tiers", "claude_chat", "conversation"],
    ["Perplexity: what changed in the hemp rules this month", "perplexity", "research"],
    ["OpenClaw rerun the nightly harvest", "openclaw", "implementation"],
  ])("%s -> %s", (text, handler, intent) => {
    const d = r(text);
    expect([d.handler, d.intent, d.source]).toEqual([handler, intent, "explicit"]);
  });
  it("an @agent from the canonical registry routes to that cockpit agent; unknown @names are ignored", () => {
    expect(r("@nova draft the merch brief")).toMatchObject({ handler: "cockpit_agent", agentId: "nova", provider: "claude-max", source: "explicit" });
    expect(r("@notanagent do the thing").handler).toBeNull();
  });
  it("the provider comes from the Provider Adapter ids, only where the adapter is the path", () => {
    expect(r("Claude, hello there friend").provider).toBe("claude-max");
    expect(r("OpenClaw rerun it").provider).toBe("openclaw");
    expect(r("Claude Code, fix it").provider).toBeNull();
    for (const h of HANDLERS) expect([null, "claude-max", "openclaw"]).toContain(HANDLER_META[h].provider);
  });
  it("a founder edit of the routing wins over the text, and keeps a named reviewer", () => {
    expect(r("Claude Code, fix Mettle. Codex reviews.", { handlerHint: "openclaw" })).toMatchObject({ handler: "openclaw", reviewer: "codex_review", source: "explicit", reasons: ["founder_edited_routing"] });
  });
});

describe("deterministic routing", () => {
  it.each([
    ["Research current competitor pricing for swim apps", "perplexity", "research", "current_web_research"],
    ["what's the latest on the TCPA ruling", "perplexity", "research", "current_web_research"],
    ["Fix the login redirect bug in the cockpit", "claude_code", "implementation", "repository_work"],
    ["Implement CSV export on the leads page", "claude_code", "implementation", "repository_work"],
    ["Review the change on branch p06/mission-m5", "codex_review", "review", "review_only"],
    ["please review this diff", "codex_review", "review", "review_only"],
    ["thanks!", "no_action", "nothing", "no_instruction"],
  ])("%s -> %s", (text, handler, intent, reason) => {
    const d = r(text);
    expect([d.handler, d.intent, d.source, d.reasons[0]]).toEqual([handler, intent, "deterministic", reason]);
  });
  it("a job reference routes to that existing job, by id", () => {
    expect(r("check on job 0A000000-0000-4000-8000-000000000001 please")).toMatchObject({ handler: "existing_job", jobId: "0a000000-0000-4000-8000-000000000001", source: "deterministic" });
  });
  it("an unclear command picks nothing and asks a question; no guess, no classifier", () => {
    const d = r("Mettle onboarding");
    expect(d).toMatchObject({ handler: null, source: "ambiguous", intent: "unclear", classifier: null, missionRecommended: false, founderApprovalRequired: false });
    expect(d.question).toMatch(/Who should take this/);
  });
});

describe("safety: founder authority and security are never delegated", () => {
  it.each([
    "Approve this", "approve the synthesis", "Merge PR 41", "please deploy to production", "Verify M-12", "cancel the mission",
    "Ship it", "delete the old leads", "ok publish the post", "pay the invoice",
  ])("%s -> founder", (text) => {
    expect(r(text)).toMatchObject({ handler: "human", intent: "founder_authority", source: "deterministic", founderApprovalRequired: true, missionRecommended: false });
  });
  it.each([
    "Claude Code, rotate the Supabase service role key", "Codex, grant the triage agent admin access", "@nova reset the password for the shop",
    "OpenClaw revoke the old tokens", "give me the API key for stripe",
  ])("%s -> founder even though a handler is named", (text) => {
    expect(r(text)).toMatchObject({ handler: "human", intent: "security_decision", reasons: ["security_or_authorization"] });
  });
  it("naming a handler cannot route an approval to it", () => {
    expect(r("approve the PR, Claude Code").handler).toBe("human");
    expect(r("Approve this", { handlerHint: "claude_code" }).handler).toBe("human");
  });
  it("a negated merge is a constraint, not an approval", () => {
    expect(r("Claude Code fix the build, do not merge").handler).toBe("claude_code");
  });
});

describe("mission context", () => {
  it("inside a mission: attach is recommended, a new mission is not", () => {
    expect(r("Claude Code, fix Mettle", { missionId: MID })).toMatchObject({ attachRecommended: true, missionRecommended: false, reasons: ["named_claude_code", "issued_inside_mission"] });
  });
  it("context never picks a handler", () => {
    expect(r("Mettle onboarding", { missionId: MID })).toMatchObject({ handler: null, source: "ambiguous", attachRecommended: false });
  });
});

describe("authority never moves", () => {
  it("merge authority is the founder's for every route, and nothing is ever classifier-derived", () => {
    const texts = ["Claude Code, fix Mettle", "Codex review this PR", "OpenClaw rerun it", "@nova draft it", "Approve this", "Mettle onboarding",
      "thanks", "Research current pricing", "Fix the bug", "check on job 0a000000-0000-4000-8000-000000000001", "Claude, chat with me"];
    for (const t of texts) {
      const d = r(t);
      expect(d.mergeAuthority, t).toBe("founder");
      expect(d.classifier, t).toBeNull();
      expect(["explicit", "deterministic", "ambiguous"], t).toContain(d.source);
    }
  });
});

describe("purity", () => {
  it("routing makes no network call and is deterministic", () => {
    const fetchSpy = vi.fn(); vi.stubGlobal("fetch", fetchSpy);
    const a = r("Claude Code, fix Mettle. Codex reviews. Don't merge without me.");
    expect(r("Claude Code, fix Mettle. Codex reviews. Don't merge without me.")).toEqual(a);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("the router and its types import no executor, provider call, job, telemetry writer or database", () => {
    for (const f of ["router.ts", "types.ts"]) {
      const src = readFileSync(join(process.cwd(), "src/lib/command", f), "utf8");
      const runtimeImports = [...src.matchAll(/^import (?!type )[^;]*from "([^"]+)"/gm)].map((m) => m[1]);
      expect(runtimeImports.filter((p) => !["@/lib/agent-registry-core", "./types"].includes(p)), f).toEqual([]);
    }
  });
});
