/**
 * P06 M5 shadow observation: an OFFLINE, read-only summary of recorded shadow decisions. It never queries or writes
 * any database or service: it reads records someone exported (or the bundled corpus) and counts.
 *
 * Inputs are the command records as the founder GET returns them (ShadowRecord), or raw `messages` export rows
 * ({ id, content, metadata, created_at }), plus OPTIONAL founder labels ({ id, expect }) saying which handler should
 * have taken each command. Without labels, only the observable categories are counted; correctness categories (false
 * escalations, dangerous false negatives, wrong executions) need labels and are reported as "not labelled" otherwise.
 *
 * No composite score, no percentages with false precision: every figure is a count, or "n of m".
 */
import { routeCommand } from "./router";
import { HANDLERS, SHADOW_KIND, type Handler, type ShadowDecision } from "./types";

export type ObservedCommand = {
  id: string;
  command: string;
  routedAt: string;
  supersedes: string | null;
  missionContext: string | null;
  decision: ShadowDecision;
  linkedMissions: { relation: string }[];
};
export type FounderLabel = { id: string; expect: Handler | null; note?: string };

/**
 * Founder labels are hand-written safety evidence, so a malformed one must stop the run, never be scored: a typo such
 * as "Human" would otherwise turn a dangerous false negative into an ordinary mismatch. Returns the problems (empty
 * when every label is an object with a string id and an expect of a known handler or null, no id appears twice, and,
 * when `recordIds` is given, every id is an exported record, superseded rows included). Ids are compared exactly.
 */
export function invalidLabels(input: unknown[], recordIds?: ReadonlySet<string>): string[] {
  const known = new Set<unknown>([...HANDLERS, null]);
  const problems: string[] = [];
  const seen = new Set<string>();
  input.forEach((l, i) => {
    if (!isObject(l) || typeof l.id !== "string" || !l.id) { problems.push(`label ${i}: needs a string id`); return; }
    if (!("expect" in l) || !known.has(l.expect)) problems.push(`label ${i} (${l.id}): expect must be one of ${HANDLERS.join(", ")} or null, got ${JSON.stringify(l.expect)}`);
    if (seen.has(l.id)) problems.push(`label ${i} (${l.id}): duplicate id; each command may be labelled once`);
    seen.add(l.id);
    if (recordIds && !recordIds.has(l.id)) problems.push(`label ${i} (${l.id}): no exported record has this id`);
  });
  return problems;
}

/** Handlers that would act if the router were ever given authority to dispatch. */
export const ACTING_HANDLERS: ReadonlySet<Handler> = new Set<Handler>(["claude_code", "openclaw", "cockpit_agent", "existing_job"]);

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

const validReasons = (d: Record<string, unknown>) => Array.isArray(d.reasons) && d.reasons.every((x) => typeof x === "string");

/**
 * Accepts ShadowRecord objects or raw messages rows; anything that is not a shadow record is skipped and counted. A
 * shadow record whose decision has no valid `reasons` list (an array of strings) is malformed: it is reported in
 * `malformed` and never scored.
 */
export function normalize(input: unknown[]): { records: ObservedCommand[]; skipped: number; malformed: string[] } {
  const records: ObservedCommand[] = [];
  const malformed: string[] = [];
  let skipped = 0;
  const bad = (id: unknown) => malformed.push(`record ${String(id)}: decision.reasons must be an array of strings`);
  for (const row of input) {
    if (!isObject(row)) { skipped++; continue; }
    const meta = isObject(row.metadata) ? row.metadata : null;
    if (meta) {
      if (meta.kind !== SHADOW_KIND || !isObject(meta.decision)) { skipped++; continue; }
      if (!validReasons(meta.decision)) { bad(row.id); continue; }
      records.push({
        id: String(row.id), command: String(row.content ?? ""), routedAt: String(meta.routedAt ?? row.created_at ?? ""),
        supersedes: typeof meta.supersedes === "string" ? meta.supersedes : null,
        missionContext: typeof meta.missionContext === "string" ? meta.missionContext : null,
        decision: meta.decision as unknown as ShadowDecision,
        linkedMissions: Array.isArray(row.linkedMissions) ? (row.linkedMissions as { relation: string }[]) : [],
      });
    } else if (isObject(row.decision) && typeof row.command === "string") {
      if (!validReasons(row.decision)) { bad(row.id); continue; }
      records.push({
        id: String(row.id), command: row.command, routedAt: String(row.routedAt ?? ""),
        supersedes: typeof row.supersedes === "string" ? row.supersedes : null,
        missionContext: typeof row.missionContext === "string" ? row.missionContext : null,
        decision: row.decision as unknown as ShadowDecision,
        linkedMissions: Array.isArray(row.linkedMissions) ? (row.linkedMissions as { relation: string }[]) : [],
      });
    } else skipped++;
  }
  return { records, skipped, malformed };
}

const count = <K extends string>(keys: readonly K[]): Record<K, number> => Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
const of = (n: number, m: number) => `${n} of ${m}`;
const CHAIN_CAP = 50;

/** A re-routed command keeps the missions its earlier routings were linked to (as getShadow does): links are unioned
 *  along the supersedes chain, bounded and cycle-safe, because the export puts each link on the row it was made from. */
function chainLinks(r: ObservedCommand, byId: Map<string, ObservedCommand>): { relation: string }[] {
  const links = [...r.linkedMissions];
  const seen = new Set([r.id]);
  let prev = r.supersedes;
  for (let i = 0; i < CHAIN_CAP && prev && !seen.has(prev); i++) {
    const p = byId.get(prev);
    if (!p) break;
    seen.add(p.id);
    links.push(...p.linkedMissions);
    prev = p.supersedes;
  }
  return links;
}

export type ObservationSummary = ReturnType<typeof summarize>;

export function summarize(records: ObservedCommand[], labels: FounderLabel[] = []) {
  // A record superseded by a later founder edit is history; the latest decision for a command is the one that counts.
  const supersededIds = new Set(records.map((r) => r.supersedes).filter((x): x is string => Boolean(x)));
  const final = records.filter((r) => !supersededIds.has(r.id));
  const allById = new Map(records.map((r) => [r.id, r]));

  const bySource = count(["explicit", "deterministic", "ambiguous"] as const);
  const byHandler: Record<string, number> = { ...count(HANDLERS), undecided: 0 };
  const escalations: Record<string, number> = {};
  let founderEdits = 0, created = 0, attached = 0, inMission = 0, reviewerNamed = 0;
  for (const r of final) {
    bySource[r.decision.source] = (bySource[r.decision.source] ?? 0) + 1;
    byHandler[r.decision.handler ?? "undecided"]++;
    if (r.decision.reasons.includes("founder_edited_routing")) founderEdits++;
    if (r.decision.reviewer) reviewerNamed++;
    if (r.missionContext) inMission++;
    if (r.decision.handler === "human") {
      const why = r.decision.reasons.find((x) => x.startsWith("founder_authority_") || x === "security_or_authorization") ?? "founder_unspecified";
      escalations[why] = (escalations[why] ?? 0) + 1;
    }
    const links = chainLinks(r, allById);
    if (links.some((l) => l.relation === "source")) created++;
    if (links.some((l) => l.relation === "context")) attached++;
  }

  // Replay: what today's rules decide for the same text (drift after a rules change). Pure; no I/O. A founder edit
  // is the founder's own choice, not the rules', so edited records are not replayed (they would always "drift").
  const drift = final.filter((r) => !r.decision.reasons.includes("founder_edited_routing")).filter((r) => {
    const now = routeCommand({ text: r.command, missionId: r.missionContext });
    return now.handler !== r.decision.handler;
  }).map((r) => ({ id: r.id, recorded: r.decision.handler, now: routeCommand({ text: r.command, missionId: r.missionContext }).handler }));

  // Correctness needs founder labels.
  const byId = new Map(final.map((r) => [r.id, r]));
  const reviewed = labels.filter((l) => byId.has(l.id));
  const falseEscalations: string[] = [], dangerousFalseNegatives: string[] = [], wrongActing: string[] = [], wrongOther: string[] = [];
  const askedInsteadOfEscalating: string[] = [];
  let agreed = 0;
  for (const l of reviewed) {
    const got = byId.get(l.id)!.decision.handler;
    if (got === l.expect) { agreed++; continue; }
    if (got === "human") falseEscalations.push(l.id);                                   // over-blocking: cheap
    else if (l.expect === "human" && got === null) askedInsteadOfEscalating.push(l.id); // asked a question: nothing would act
    else if (l.expect === "human") dangerousFalseNegatives.push(l.id);                  // founder authority routed to a handler
    else if (got && ACTING_HANDLERS.has(got)) wrongActing.push(l.id);                   // would have acted wrongly
    else wrongOther.push(l.id);
  }

  return {
    records: records.length,
    finalDecisions: final.length,
    supersededByFounderEdit: supersededIds.size,
    bySource,
    founderEdits: of(founderEdits, final.length),
    handlerDistribution: byHandler,
    reviewerNamed: of(reviewerNamed, final.length),
    founderEscalations: escalations,
    missions: { created: of(created, final.length), attached: of(attached, final.length), issuedInsideMission: of(inMission, final.length) },
    replayDrift: drift,
    labels: reviewed.length === 0 ? ("not labelled" as const) : {
      reviewed: of(reviewed.length, final.length),
      agreed: of(agreed, reviewed.length),
      falseFounderEscalations: falseEscalations,
      dangerousFalseNegatives,
      askedInsteadOfEscalating,
      wouldHaveActedIncorrectly: wrongActing,
      otherMismatches: wrongOther,
    },
  };
}

/** Plain-text report for a terminal or a handoff note. */
export function formatReport(s: ObservationSummary, skipped = 0): string {
  const lines: string[] = [];
  const kv = (o: Record<string, unknown>) => Object.entries(o).filter(([, v]) => v !== 0).map(([k, v]) => `  ${k}: ${v}`).join("\n") || "  (none)";
  lines.push("UNIVERSAL COMMAND SHADOW OBSERVATION (offline, read-only)");
  lines.push(`records: ${s.records} (skipped non-shadow rows: ${skipped})  final decisions: ${s.finalDecisions}  superseded by founder edit: ${s.supersededByFounderEdit}`);
  lines.push("how decided:", kv(s.bySource));
  lines.push(`founder edits: ${s.founderEdits}`, `reviewer named: ${s.reviewerNamed}`);
  lines.push("handler distribution:", kv(s.handlerDistribution));
  lines.push("founder escalations by reason:", kv(s.founderEscalations));
  lines.push(`missions: created ${s.missions.created}, attached ${s.missions.attached}, issued inside a mission ${s.missions.issuedInsideMission}`);
  lines.push(`replay drift (today's rules decide differently): ${s.replayDrift.length}`);
  for (const d of s.replayDrift.slice(0, 20)) lines.push(`  ${d.id}: recorded ${d.recorded ?? "undecided"} -> now ${d.now ?? "undecided"}`);
  const labels = s.labels;
  if (typeof labels === "string") lines.push("correctness: not labelled (provide founder labels to count false escalations and dangerous false negatives)");
  else {
    lines.push(`correctness: reviewed ${labels.reviewed}, agreed ${labels.agreed}`);
    lines.push(`  DANGEROUS false negatives (founder authority routed to a handler): ${labels.dangerousFalseNegatives.length} ${labels.dangerousFalseNegatives.join(", ")}`);
    lines.push(`  founder authority answered with a question (nothing would act; review the rule): ${labels.askedInsteadOfEscalating.length} ${labels.askedInsteadOfEscalating.join(", ")}`);
    lines.push(`  would have acted incorrectly: ${labels.wouldHaveActedIncorrectly.length} ${labels.wouldHaveActedIncorrectly.join(", ")}`);
    lines.push(`  false founder escalations (over-blocking): ${labels.falseFounderEscalations.length} ${labels.falseFounderEscalations.join(", ")}`);
    lines.push(`  other mismatches: ${labels.otherMismatches.length} ${labels.otherMismatches.join(", ")}`);
  }
  return lines.join("\n");
}
