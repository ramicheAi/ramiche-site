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
  it("editing the routing can never bypass the authority scan (Codex P1, PR #42)", () => {
    expect(r("we need to deploy", { handlerHint: "claude_code" }).handler).toBe("human");
    expect(r("it should be merged soon", { handlerHint: "openclaw" }).handler).toBe("human");
    expect(r("we need to deploy production", { handlerHint: "claude_code" }).handler).toBe("human");
    expect(r("Mettle onboarding", { handlerHint: "claude_code" }).handler).toBe("claude_code");
  });
  it("an edit to existing_job carries the job id from the text (Codex P2, PR #42)", () => {
    expect(r("check on job 0a000000-0000-4000-8000-000000000001", { handlerHint: "existing_job" })).toMatchObject({ handler: "existing_job", jobId: "0a000000-0000-4000-8000-000000000001" });
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
  it.each([
    "Claude Code, merge PR 41", "Claude Code please merge PR 41", "Claude Code: push to main and deploy", "Codex approve it",
    "codex, approve and merge PR 12", "openclaw deploy to prod", "@atlas publish the post", "chatgpt: approve the refund",
    "fix the bug and deploy", "go ahead, merge", "ok, merge", "pls merge", "Review and merge PR 12", "then deploy it",
    "Perplexity, research it and then publish the summary", "Claude, can you approve this",
    // a handler is named: an authority verb ANYWHERE is the founder's
    "have Claude Code merge PR 41", "let codex approve it", "Codex should approve PR 9", "Claude Code, go merge it",
    "Claude Code, we need to deploy", "@atlas, kindly publish the post", "Claude Code, add a button and merge 41",
    "Claude Code, deploy prod", "have Claude Code deploy staging", "Claude Code, ship v2", "Claude Code, merge into main",
    "Claude Code, merge feature-x into main", "openclaw release v1.2", "@atlas publish tonight's newsletter", "Claude Code, approve PR41",
    "Claude Code no wait merge it", "Codex, sign off on PR 41", "Claude Code, roll out to production",
    // no handler named
    "force push to main", "I approve", "verify the mission", "merge 41", "sign off on PR 41", "roll out to production", "deploy prod", "ship v2", "approve PR41", "merge into main",
  ])("an authority verb at the start of ANY clause, after a handler name or filler, is the founder's: %s", (text) => {
    expect(r(text)).toMatchObject({ handler: "human", intent: "founder_authority", founderApprovalRequired: true, });
    expect(r(text).reasons[0]).toMatch(/^founder_authority_/);
  });
  it.each([
    ["Claude Code, fix Mettle. Codex reviews. Don't merge without me.", "claude_code"],
    ["Claude Code fix the build, do not merge", "claude_code"],
    ["Add a publish button to the post editor", "claude_code"],
    ["Fix the cancel flow on checkout", "claude_code"],
    ["Implement the approve button", "claude_code"],
    ["Claude Code, write the deploy script", "claude_code"],
    ["Codex, review the release notes", "codex_review"],
    ["build the login and sign-up flow", "claude_code"],
    ["write tests and verify them", "claude_code"],
    ["refactor the payment and refund logic", "claude_code"],
    ["implement cancel and delete endpoints", "claude_code"],
    ["Claude Code, fix the bug, then verify the tests pass", "claude_code"],
    ["update the README: deploy notes", "claude_code"],
    ["Add a button to approve the request", "claude_code"],
    ["Claude Code, speed up the deploy to staging", "claude_code"],
    ["Codex, check the release pipeline", "codex_review"],
    ["Claude Code, never merge without asking", "claude_code"],
  ])("an authority word that is not a clause's verb, or a negated one, does not take the route: %s", (text, handler) => {
    expect(r(text).handler).toBe(handler);
  });
  it("an authority verb aimed at a code object stays with the named handler", () => {
    for (const t of ["Claude Code, delete the unused imports", "Claude Code, release the lock after the write"]) expect(r(t).handler, t).toBe("claude_code");
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
    for (const f of ["router.ts", "types.ts", "authority.ts"]) {
      const src = readFileSync(join(process.cwd(), "src/lib/command", f), "utf8");
      const runtimeImports = [...src.matchAll(/^import (?!type )[^;]*from "([^"]+)"/gm)].map((m) => m[1]);
      expect(runtimeImports.filter((p) => !["@/lib/agent-registry-core", "./types", "./authority"].includes(p)), f).toEqual([]);
    }
  });
});

describe("canonical command text (obfuscation without mangling)", () => {
  it("joins runs of three or more separated single letters, whatever the whitespace or punctuation", async () => {
    const { canonicalCommand } = await import("./authority");
    for (const [raw, want] of [
      ["m e r g e", "merge"], ["m  e  r  g  e", "merge"], ["m\te\tr\tg\te", "merge"], ["m\ne\nr\ng\ne it", "merge it"],
      ["d.e.p.l.o.y", "deploy"], ["r-e-f-u-n-d", "refund"], ["a_p_p_r_o_v_e", "approve"], ["s / h / i / p", "ship"],
      ["fix it then  m  e  r  g  e  PR 41", "fix it then merge pr 41"],
    ] as const) expect(canonicalCommand(raw), JSON.stringify(raw)).toBe(want);
  });
  it("leaves ordinary text, two-letter pairs and abbreviations inside words alone", async () => {
    const { canonicalCommand } = await import("./authority");
    for (const [raw, want] of [
      ["fix the a b test layout", "fix the a b test layout"],
      ["Plan A and B", "plan a and b"],
      ["update file.ts.map and e.g. notes", "update file.ts.map and e.g. notes"],
      ["release v1.2.3 notes", "release v1.2.3 notes"],
      ["fix   the\t\tbug\nnow", "fix the bug now"],
    ] as const) expect(canonicalCommand(raw), JSON.stringify(raw)).toBe(want);
  });
});

describe("routing performance on pathological input", () => {
  it.each([
    ["spaced letters", "a ".repeat(5000)], ["dotted letters", "a.".repeat(5000)], ["tabbed letters", "m\t".repeat(5000)],
    ["repeated merge", "merge ".repeat(2000)], ["conditional chain", "if ".repeat(2000) + "merge"], ["repeated vercel", "vercel ".repeat(2000)],
    ["delete chain", ("delete " + "word ".repeat(10)).repeat(300)], ["long code command", "Claude Code, " + "refactor the component ".repeat(500)],
    ["negated merges", "don't merge it ".repeat(2000)], ["negated shares", "don't share the key ".repeat(1500)],
    ["exempted notifies", "notify users component ".repeat(800)], ["exempted deletes", "Claude Code, " + "delete the leads filter component and ".repeat(400)],
  ])("%s stays fast (no catastrophic backtracking)", (_name, text) => {
    const t0 = performance.now();
    routeCommand({ text });
    expect(performance.now() - t0).toBeLessThan(1000);   // measured at 1 to 93 ms (30k chars); the bound only catches blow-ups
  });
});
