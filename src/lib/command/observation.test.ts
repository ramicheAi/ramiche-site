/**
 * P06 M5 shadow observation: the offline summary counts what happened and, with founder labels, what was wrong. It is
 * pure: no network, no database. These pin each category against hand-built records.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { formatReport, normalize, summarize, type ObservedCommand } from "./observation";
import { routeCommand } from "./router";
import { ROUTE_CORPUS } from "./fixtures/route-corpus";

const rec = (id: string, text: string, over: Partial<ObservedCommand> = {}): ObservedCommand => ({
  id, command: text, routedAt: "2026-10-05T00:00:00Z", supersedes: null, missionContext: null,
  decision: routeCommand({ text }), linkedMissions: [], ...over,
});

describe("shadow observation summary", () => {
  it("counts sources, handlers, escalations, edits and mission outcomes from final decisions only", () => {
    const a = rec("a", "Mettle onboarding");                                                     // ambiguous
    const b = rec("b", "Mettle onboarding", { supersedes: "a", decision: routeCommand({ text: "Mettle onboarding", handlerHint: "claude_code" }), linkedMissions: [{ relation: "source" }] });
    const c = rec("c", "Merge PR 41");                                                           // founder (git)
    const d = rec("d", "Research current competitor pricing", { linkedMissions: [{ relation: "context" }] });
    const e = rec("e", "Claude Code, fix Mettle. Codex reviews.", { missionContext: "m1" });
    const s = summarize([a, b, c, d, e]);
    expect([s.records, s.finalDecisions, s.supersededByFounderEdit]).toEqual([5, 4, 1]);
    expect(s.bySource).toEqual({ explicit: 2, deterministic: 2, ambiguous: 0 });
    expect(s.founderEdits).toBe("1 of 4");
    expect(s.handlerDistribution).toMatchObject({ claude_code: 2, human: 1, perplexity: 1, undecided: 0 });
    expect(s.founderEscalations).toEqual({ founder_authority_git_release: 1 });
    expect(s.missions).toEqual({ created: "1 of 4", attached: "1 of 4", issuedInsideMission: "1 of 4" });
    expect(s.reviewerNamed).toBe("1 of 4");
    expect(s.labels).toBe("not labelled");
  });

  it("with founder labels: dangerous false negatives, wrong actions and false escalations are separated", () => {
    const s = summarize(
      [rec("x", "Merge PR 41"), rec("y", "Claude Code, fix Mettle"), rec("z", "Fix the login bug"), rec("w", "Research pricing")],
      [
        { id: "x", expect: "claude_code" },   // router escalated, founder says it was fine: over-blocking
        { id: "y", expect: "human" },         // router gave it to an agent, founder says it was his: DANGEROUS
        { id: "z", expect: "openclaw" },      // acted, but with the wrong handler
        { id: "w", expect: "perplexity" },    // agreed
        { id: "not-a-record", expect: null },
      ],
    );
    expect(s.labels).toEqual({
      reviewed: "4 of 4", agreed: "1 of 4",
      falseFounderEscalations: ["x"], dangerousFalseNegatives: ["y"], wouldHaveActedIncorrectly: ["z"], otherMismatches: [],
    });
  });

  it("replay flags records today's rules would route differently", () => {
    const stale = rec("s", "send the outreach emails", { decision: { ...routeCommand({ text: "thanks" }), handler: "claude_code" } });
    expect(summarize([stale]).replayDrift).toEqual([{ id: "s", recorded: "claude_code", now: "human" }]);
  });

  it("normalizes raw messages export rows and API records, and skips anything else", () => {
    const decision = routeCommand({ text: "Merge PR 41" });
    const { records, skipped } = normalize([
      { id: "r1", content: "Merge PR 41", created_at: "t", metadata: { kind: "universal_command_shadow", decision, routedAt: "t1", supersedes: null } },
      { id: "r2", command: "Merge PR 41", routedAt: "t2", decision, linkedMissions: [{ relation: "source" }] },
      { id: "r3", content: "hello", metadata: { source: "command-center-ui" } },
      "junk", null,
    ]);
    expect(records.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(records[1].linkedMissions).toEqual([{ relation: "source" }]);
    expect(skipped).toBe(3);
  });

  it("the report has no composite score and states when correctness is unlabelled", () => {
    const text = formatReport(summarize([rec("a", "Merge PR 41")]));
    expect(text).toContain("correctness: not labelled");
    expect(text).not.toMatch(/score|%/i);
  });

  it("is pure: no network or database access, and imports nothing that could reach one", () => {
    const fetchSpy = vi.fn(); vi.stubGlobal("fetch", fetchSpy);
    summarize(ROUTE_CORPUS.map((e, i) => rec(`c${i}`, e.text)), ROUTE_CORPUS.map((e, i) => ({ id: `c${i}`, expect: e.expect })));
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    const src = readFileSync(join(process.cwd(), "src/lib/command/observation.ts"), "utf8");
    const imports = [...src.matchAll(/^import (?!type )[^;]*from "([^"]+)"/gm)].map((m) => m[1]);
    expect(imports.sort()).toEqual(["./router", "./types"]);
  });

  it("over the corpus, labelled by its own expectations, there are no dangerous false negatives", () => {
    const s = summarize(ROUTE_CORPUS.map((e, i) => rec(`c${i}`, e.text, e.hint ? { decision: routeCommand({ text: e.text, handlerHint: e.hint }) } : {})), ROUTE_CORPUS.map((e, i) => ({ id: `c${i}`, expect: e.expect })));
    expect(s.labels !== "not labelled" && s.labels.dangerousFalseNegatives).toEqual([]);
    expect(s.labels !== "not labelled" && s.labels.wouldHaveActedIncorrectly).toEqual([]);
  });
});
