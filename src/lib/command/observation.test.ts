/**
 * P06 M5 shadow observation: the offline summary counts what happened and, with founder labels, what was wrong. It is
 * pure: no network, no database. These pin each category against hand-built records.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { formatReport, invalidLabels, normalize, summarize, type ObservedCommand } from "./observation";
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
      falseFounderEscalations: ["x"], dangerousFalseNegatives: ["y"], askedInsteadOfEscalating: [], wouldHaveActedIncorrectly: ["z"], otherMismatches: [],
    });
  });

  it("a founder-labelled command the router answered with a question is counted on its own, not as dangerous", () => {
    const s = summarize([rec("q", "Mettle onboarding")], [{ id: "q", expect: "human" }]);
    expect(s.labels !== "not labelled" && [s.labels.dangerousFalseNegatives, s.labels.askedInsteadOfEscalating]).toEqual([[], ["q"]]);
    expect(formatReport(s)).toContain("founder authority answered with a question (nothing would act; review the rule): 1 q");
  });

  it("a re-routed command keeps the mission links made on its earlier routings (the supersedes chain)", () => {
    const a = rec("a", "Mettle onboarding", { linkedMissions: [{ relation: "source" }] });
    const b = rec("b", "Mettle onboarding", { supersedes: "a" });
    const c = rec("c", "Mettle onboarding", { supersedes: "b", linkedMissions: [{ relation: "context" }] });
    expect(summarize([a, b, c]).missions).toMatchObject({ created: "1 of 1", attached: "1 of 1" });
    const loop = [rec("x", "Merge PR 41", { supersedes: "y" }), rec("y", "Merge PR 41", { supersedes: "x", linkedMissions: [{ relation: "source" }] })];
    expect(() => summarize(loop)).not.toThrow();
  });

  it("malformed founder labels are rejected before anything is scored", () => {
    expect(invalidLabels([{ id: "a", expect: "human" }, { id: "b", expect: null }, { id: "c", expect: "claude_code" }])).toEqual([]);
    const bad = invalidLabels([{ id: "a", expect: "Human" }, { id: "b" }, { expect: "human" }, "x", { id: "", expect: null }]);
    expect(bad).toHaveLength(5);
    expect(bad[0]).toMatch(/label 0 \(a\): expect must be one of .* or null, got "Human"/);
  });

  it("labels must map one-to-one onto exported records: duplicates and unknown ids are malformed", () => {
    const ids = new Set(["a", "b-final"]);
    expect(invalidLabels([{ id: "a", expect: "human" }, { id: "a", expect: "claude_code" }], ids)).toEqual(["label 1 (a): duplicate id; each command may be labelled once"]);
    expect(invalidLabels([{ id: "a", expect: "human" }, { id: "a", expect: "human" }], ids)).toHaveLength(1);   // identical duplicates still fail
    expect(invalidLabels([{ id: "zzz", expect: "human" }], ids)).toEqual(["label 0 (zzz): no exported record has this id"]);
    expect(invalidLabels([{ id: "A", expect: "human" }], ids)).toEqual(["label 0 (A): no exported record has this id"]);   // ids are exact
    expect(invalidLabels([{ id: "a", expect: "human" }, { id: "b-final", expect: null }], ids)).toEqual([]);   // superseded row a, final row b-final
  });

  it("founder-edited records are not reported as replay drift", () => {
    const edited = rec("e", "Mettle onboarding", { supersedes: "o", decision: routeCommand({ text: "Mettle onboarding", handlerHint: "claude_code" }) });
    expect(summarize([edited]).replayDrift).toEqual([]);
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

  it("a shadow record without a valid reasons list is malformed, not scored", () => {
    const decision = routeCommand({ text: "Merge PR 41" });
    const without = (over: Record<string, unknown>) => ({ ...decision, ...over });
    const { records, malformed } = normalize([
      { id: "m1", content: "x", metadata: { kind: "universal_command_shadow", decision: without({ reasons: undefined }) } },
      { id: "m2", command: "x", decision: without({ reasons: null }) },
      { id: "m3", command: "x", decision: without({ reasons: "founder_edited_routing" }) },
      { id: "m4", command: "x", decision: without({ reasons: ["ok", 7] }) },
      { id: "ok", command: "Merge PR 41", decision },
    ]);
    expect(records.map((r) => r.id)).toEqual(["ok"]);
    expect(malformed.map((m) => m.split(":")[0])).toEqual(["record m1", "record m2", "record m3", "record m4"]);
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

describe("offline report CLI (scripts/command-shadow-report.mjs)", () => {
  const [maj, min] = process.versions.node.split(".").map(Number);
  const canStripTypes = maj > 23 || (maj === 23 && min >= 6);
  const run = (args: string[]) => spawnSync(process.execPath, [join(process.cwd(), "scripts/command-shadow-report.mjs"), ...args], { encoding: "utf8", timeout: 60000 });
  const tmp = mkdtempSync(join(tmpdir(), "shadow-report-"));
  const write = (name: string, v: unknown) => { const p = join(tmp, name); writeFileSync(p, JSON.stringify(v)); return p; };
  const row = (id: string, text: string) => ({ id, content: text, created_at: "2026-10-05T00:00:00Z", metadata: { kind: "universal_command_shadow", routedAt: "2026-10-05T00:00:00Z", supersedes: null, decision: routeCommand({ text }) } });

  it.skipIf(!canStripTypes)("exits 0 on clean labelled records and on the corpus", () => {
    const recs = write("clean.json", [row("a", "Merge PR 41"), row("b", "Fix the login bug"), { id: "x", content: "hi", metadata: { source: "chat" } }]);
    const labels = write("clean-labels.json", [{ id: "a", expect: "human" }, { id: "b", expect: "claude_code" }]);
    const r = run(["--records", recs, "--labels", labels]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("DANGEROUS false negatives (founder authority routed to a handler): 0");
    expect(r.stdout).toContain("skipped non-shadow rows: 1");
    expect(run(["--corpus"]).status).toBe(0);
  });

  it.skipIf(!canStripTypes)("a label on an older superseded row present in the export is accepted", () => {
    const edited = { ...row("b", "Fix the login bug"), metadata: { ...row("b", "Fix the login bug").metadata, supersedes: "a" } };
    const recs = write("chain.json", [row("a", "Fix the login bug"), edited]);
    expect(run(["--records", recs, "--labels", write("chain-labels.json", [{ id: "a", expect: "claude_code" }, { id: "b", expect: "claude_code" }])]).status).toBe(0);
  });

  it.skipIf(!canStripTypes)("exits 1 when any dangerous false negative is found", () => {
    const recs = write("bad.json", [row("a", "Claude Code, fix Mettle")]);
    const labels = write("bad-labels.json", [{ id: "a", expect: "human" }]);
    const r = run(["--records", recs, "--labels", labels]);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/DANGEROUS false negatives \(founder authority routed to a handler\): 1 a/);
  });

  it("exit 1 is set in exactly one place (a dangerous false negative); unexpected failures exit 2", () => {
    const src = readFileSync(join(process.cwd(), "scripts/command-shadow-report.mjs"), "utf8");
    expect(src.match(/exit\(1\)|exitCode = 1/g)).toEqual(["exitCode = 1"]);
    expect(src).toMatch(/dangerousFalseNegatives\.length > 0\) process\.exitCode = 1;/);
    expect(src).toMatch(/\["uncaughtException", "unhandledRejection"\]\) \{\n\s+process\.on\(ev, \(e\) => \{[^\n]*process\.exit\(2\); \}\);/);
  });

  it("the CLI contains no network or database access and writes nothing", () => {
    const src = readFileSync(join(process.cwd(), "scripts/command-shadow-report.mjs"), "utf8");
    expect(src).not.toMatch(/fetch\(|supabase|createClient|https?:\/\/|writeFile|appendFile|mkdir|unlink|rmSync|child_process/);
  });

  it.skipIf(!canStripTypes)("bad input is a usage error (exit 2), never confused with a dangerous false negative (exit 1)", () => {
    expect(run(["--bogus"]).status).toBe(2);
    expect(run(["--records", join(tmp, "missing.json")]).status).toBe(2);
    expect(run(["--records", write("obj.json", { data: [] })]).status).toBe(2);
    const typo = run(["--records", write("typo.json", [row("a", "Claude Code, fix Mettle")]), "--labels", write("typo-labels.json", [{ id: "a", expect: "Human" }])]);
    expect(typo.status).toBe(2);
    expect(typo.stdout).toBe("");
    const one = write("one.json", [row("a", "Claude Code, fix Mettle")]);
    for (const [name, labels] of [
      ["dup", [{ id: "a", expect: "human" }, { id: "a", expect: "claude_code" }]],
      ["dup-same", [{ id: "a", expect: "human" }, { id: "a", expect: "human" }]],
      ["unknown", [{ id: "A", expect: "human" }]],
    ] as const) {
      const r = run(["--records", one, "--labels", write(`${name}.json`, labels)]);
      expect([name, r.status, r.stdout]).toEqual([name, 2, ""]);
    }
    const reasonless = (reasons: unknown) => ({ ...row("a", "Merge PR 41"), metadata: { ...row("a", "Merge PR 41").metadata, decision: { ...routeCommand({ text: "Merge PR 41" }), reasons } } });
    for (const reasons of [undefined, null, "x", [1]]) {
      const r = run(["--records", write("reasonless.json", [reasonless(reasons)])]);
      expect([JSON.stringify(reasons) ?? "missing", r.status, r.stdout]).toEqual([JSON.stringify(reasons) ?? "missing", 2, ""]);
    }
    const recs = write("ok.json", [row("a", "Merge PR 41")]);
    expect(run(["--records", recs, "--labels", write("badlabels.json", { a: "human" })]).status).toBe(2);
    expect(run(["--records", recs, "--labels", write("badlabels2.json", [{ expect: "human" }])]).status).toBe(2);
  });
});
