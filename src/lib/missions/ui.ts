/**
 * P06 M4A: client-safe helpers for the founder Mission surface. Pure functions only: no fetch, no policy.
 *
 * The server (src/lib/missions/service.ts + M1) is the authority for every rule. These helpers only decide what the UI
 * OFFERS, mirroring M1's transition table so the founder sees the legal next steps; a stale or wrong offer is still
 * refused by the server. completed -> verified is never offered as a transition: it is the separate Verify action,
 * which calls the dedicated /verify route.
 */
import { AGENT_CORE } from "@/lib/agent-registry-core";
import type { CountSum, MissionCosts } from "./costs";
import type { Item, LinkRow, MissionRow, MissionState, Relation, TargetType } from "./types";

export const FOUNDER = "ramon";

/** M1 mission_transition_allowed, minus completed -> verified (the Verify action) and minus cancel (its own action). */
const FORWARD: Record<MissionState, MissionState[]> = {
  intent: ["plan"],
  plan: ["approved"],
  approved: ["executing"],
  executing: ["reviewing"],
  reviewing: ["completed", "executing"],
  completed: [],
  verified: [],
  cancelled: [],
};
const CANCELLABLE: ReadonlySet<MissionState> = new Set(["intent", "plan", "approved", "executing", "reviewing", "completed"]);

export const STATE_LABEL: Record<MissionState, string> = {
  intent: "Intent", plan: "Plan", approved: "Approved", executing: "Executing",
  reviewing: "Reviewing", completed: "Completed", verified: "Verified", cancelled: "Cancelled",
};

/** Button text for a forward step, phrased as the action, not the destination. */
const STEP_LABEL: Partial<Record<`${MissionState}>${MissionState}`, string>> = {
  "intent>plan": "Move to plan",
  "plan>approved": "Approve",
  "approved>executing": "Start execution",
  "executing>reviewing": "Send to review",
  "reviewing>completed": "Mark completed",
  "reviewing>executing": "Send back for rework",
};

export type StepAction = { to: MissionState; label: string };

/** Forward steps the founder can take now. Never includes "verified". */
export function forwardSteps(state: MissionState, criteriaCount = 1): StepAction[] {
  return FORWARD[state]
    // Approval needs a success criterion (M1 MI007) and criteria cannot be edited after creation, so never offer it.
    .filter((to) => !(to === "approved" && criteriaCount === 0))
    .map((to) => ({ to, label: STEP_LABEL[`${state}>${to}`] ?? `Move to ${STATE_LABEL[to]}` }));
}
export const canCancel = (state: MissionState): boolean => CANCELLABLE.has(state);
export const canVerify = (state: MissionState): boolean => state === "completed";
export const isTerminal = (state: MissionState): boolean => state === "verified" || state === "cancelled";
/** Owner and team are frozen from completed (M1 MI019) and in terminal states. */
export const canReassign = (state: MissionState): boolean => !["completed", "verified", "cancelled"].includes(state);
/** Links freeze in terminal states (M1 MI022). */
export const canEditLinks = (state: MissionState): boolean => !isTerminal(state);

/** The one thing the founder should look at next, in plain words. */
export function nextHint(m: Pick<MissionRow, "state" | "success_criteria">, evidence: Pick<LinkRow, "criterion_id">[]): string {
  switch (m.state) {
    case "intent": return m.success_criteria.length === 0
      ? "No success criteria, so this mission can never be approved. Cancel it and create a new one with criteria."
      : "Shape it into a plan.";
    case "plan": return m.success_criteria.length === 0
      ? "This mission has no success criteria, so it cannot be approved. Criteria are set when a mission is created: cancel this one and create a new one with criteria."
      : "Review the plan and approve it.";
    case "approved": return "Start execution when the team is ready.";
    case "executing": return "Work in progress. Send to review when the deliverables exist.";
    case "reviewing": return "Review the work: complete it, or send it back for rework.";
    case "completed": {
      const missing = uncoveredCriteria(m.success_criteria, evidence);
      return missing.length ? `Link evidence for ${missing.map((c) => c.id).join(", ")} before verifying.` : "All criteria have evidence. Ready for your verification.";
    }
    case "verified": return "Verified. This mission is closed.";
    case "cancelled": return "Cancelled. This mission is closed.";
  }
}

/** Success criteria without a live evidence link (M1 verification needs evidence for every one). */
export function uncoveredCriteria(criteria: Item[], evidence: Pick<LinkRow, "criterion_id">[]): Item[] {
  const covered = new Set(evidence.map((l) => l.criterion_id).filter(Boolean));
  return criteria.filter((c) => !covered.has(c.id));
}

export const formatRef = (ref: number): string => `M-${ref}`;

/** Lone UTF-16 surrogates become U+FFFD; valid pairs are kept. encodeURIComponent throws on a lone surrogate. */
export function toWellFormed(s: string): string {
  return s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD");
}

/** Decisions -> New Mission link: objective cut to 2000 code points, made well-formed, then encoded. Never throws. */
export function planPrefillHref(synthesisId: string, decision: string): string {
  const objective = toWellFormed([...decision].slice(0, 2000).join(""));
  return `/command-center/missions?fromSynthesis=${encodeURIComponent(toWellFormed(synthesisId))}&objective=${encodeURIComponent(objective)}`;
}

/**
 * Decisions -> "Create Mission from this plan", or null when the shortcut must not be offered.
 * Offered only for an UNAPPROVED plan: approving a legacy synthesis immediately dispatches and executes its actions
 * (cc-approve-synthesis), so a Mission must be established before that, never created for work already under way.
 * Transitional until planning and execution are integrated with Mission identity.
 */
export function planMissionShortcut(d: { synthesisId: string; approvedAt: string | null; plan: { decision: string } | null | undefined }): string | null {
  if (!d.plan || d.approvedAt) return null;
  return planPrefillHref(d.synthesisId, d.plan.decision);
}

/** Older pages appended to newer ones: no duplicate ids, newest (highest ref) first. */
export function mergeMissionPages(current: MissionRow[], page: MissionRow[]): MissionRow[] {
  const byId = new Map<string, MissionRow>();
  for (const m of [...current, ...page]) if (!byId.has(m.id)) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => b.ref - a.ref);
}

/** Canonical active registry agents, for the owner/team pickers. The server re-validates every id. */
export function selectableAgents(): { id: string; name: string }[] {
  return AGENT_CORE.filter((a) => a.status === "active").map((a) => ({ id: a.id, name: a.name }));
}
const AGENT_NAME = new Map(AGENT_CORE.map((a) => [a.id, a.name]));
export const agentName = (id: string): string => (id === FOUNDER ? "Ramon" : AGENT_NAME.get(id) ?? id);

/* ── create form ─────────────────────────────────────────────────────────────────────────────────────── */

export type CreateForm = {
  objective: string;
  /** "ramon" for the founder, otherwise an agent id */
  owner: string;
  agentIds: string[];
  /** one item per line */
  criteriaText: string;
  deliverablesText: string;
};
export const emptyCreateForm = (objective = ""): CreateForm => ({ objective, owner: FOUNDER, agentIds: [], criteriaText: "", deliverablesText: "" });

/** Lines -> [{id: c1, text}, ...]. Blank lines are skipped; ids are generated so the founder never types them. */
export function linesToItems(text: string, prefix: "c" | "d"): Item[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((t, i) => ({ id: `${prefix}${i + 1}`, text: t }));
}

export type FormErrors = Partial<Record<"objective" | "criteria" | "deliverables" | "agents", string>>;

/** Fast feedback only; the server enforces the same bounds (M1 CHECKs, M2 validation). */
export function validateCreate(f: CreateForm): FormErrors {
  const e: FormErrors = {};
  const chars = (s: string) => [...s].length;
  const objective = f.objective.trim();
  if (!objective) e.objective = "Say what this mission is for.";
  else if (chars(objective) > 2000) e.objective = "Keep the objective to at most 2,000 characters.";
  const criteria = linesToItems(f.criteriaText, "c");
  // Required here (not by M1 at creation) because approval needs one and M4A has no way to add criteria later.
  if (criteria.length === 0) e.criteria = "Add at least one success criterion: how will you know it is done?";
  else if (criteria.length > 50) e.criteria = "At most 50 success criteria.";
  else if (criteria.some((c) => chars(c.text) > 500)) e.criteria = "Each criterion must be at most 500 characters.";
  const deliverables = linesToItems(f.deliverablesText, "d");
  if (deliverables.length > 50) e.deliverables = "At most 50 deliverables.";
  else if (deliverables.some((c) => chars(c.text) > 500)) e.deliverables = "Each deliverable must be at most 500 characters.";
  if (f.agentIds.length > 24) e.agents = "At most 24 agents.";
  return e;
}

/** Exactly the M2 POST /missions body. No identity fields: the server takes the founder from the session. */
export function createBody(f: CreateForm): Record<string, unknown> {
  const isFounder = f.owner === FOUNDER;
  return {
    objective: f.objective.trim(),
    owner: f.owner,
    ownerKind: isFounder ? "human" : "agent",
    agentIds: f.agentIds,
    successCriteria: linesToItems(f.criteriaText, "c"),
    deliverables: linesToItems(f.deliverablesText, "d"),
  };
}

/* ── links ───────────────────────────────────────────────────────────────────────────────────────────── */

/** The link targets the founder can add by hand, in the order a person thinks of them. */
export const LINK_TARGETS: { type: TargetType; label: string; placeholder: string }[] = [
  { type: "url", label: "Web link", placeholder: "https://..." },
  { type: "job", label: "Job", placeholder: "job id" },
  { type: "chat_message", label: "Chat message", placeholder: "message id" },
  { type: "synthesis", label: "Synthesis plan", placeholder: "synthesis message id" },
  { type: "pipeline_lead", label: "Lead", placeholder: "lead id" },
  { type: "pipeline_gate", label: "Approval gate item", placeholder: "gate id" },
  { type: "mission", label: "Another mission", placeholder: "mission id" },
  { type: "project", label: "Project", placeholder: "project slug, e.g. mettle" },
  { type: "pull_request", label: "Pull request", placeholder: "owner/repo#123" },
  { type: "git_branch", label: "Git branch", placeholder: "branch name" },
  { type: "git_commit", label: "Git commit", placeholder: "full 40-character sha" },
];
/** Mirrors the server's EVIDENCE_TYPES: only records the server resolves in the database can prove a criterion. */
export const EVIDENCE_TARGETS: ReadonlySet<TargetType> = new Set<TargetType>([
  "job", "synthesis", "synthesis_action", "pipeline_gate", "pipeline_lead", "chat_channel", "chat_message", "mission",
]);
export const RELATION_LABEL: Record<Relation, string> = {
  evidence: "Evidence for a criterion", context: "Context", source: "Source", deliverable: "Deliverable",
  task: "Task", dependency: "Depends on", approval: "Approval", branch: "Branch",
};
export const targetLabel = (t: TargetType): string => LINK_TARGETS.find((x) => x.type === t)?.label ?? t.replace(/_/g, " ");

/** A server error body, in one sentence the founder can act on. */
export function errorText(body: unknown, fallback = "Something went wrong."): string {
  const e = (body as { error?: unknown } | null)?.error;
  if (e === "denied") return "Your session is not authorized. Sign in again.";
  if (e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string") return (e as { message: string }).message;
  return fallback;
}

/* ── cost & usage (M3) ───────────────────────────────────────────────────────────────────────────────── */

/** "0.01230000" -> "$0.0123". Exact: the server's decimal string is only trimmed, never parsed into a float. */
export function formatUsd(v: string): string {
  const [whole, frac = ""] = v.split(".");
  const f = frac.replace(/0+$/, "").padEnd(2, "0");
  return `$${whole}.${f}`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Actual marginal cost in one honest line. Never "$0.00" for something that was not recorded. */
export function actualCostText(a: MissionCosts["actualCost"]): string {
  switch (a.status) {
    case "no_events": return "No usage attributed to this mission yet.";
    case "none_recorded": return "No actual marginal cost recorded (subscription or local calls only).";
    case "unknown": return `No actual marginal cost recorded. Cost unknown for ${plural(a.unknownEvents, "call")}.`;
    case "partial": return `${formatUsd(a.knownUsd ?? "0")} + unknown. Recorded across ${plural(a.knownEvents, "call")}. Partial: cost unknown for ${plural(a.unknownEvents, "call")}.`;
    case "complete": return `${formatUsd(a.knownUsd ?? "0")} recorded across ${plural(a.knownEvents, "call")}.`;
  }
}

/** A token count where some events may not report it: the known sum plus how many are unknown, never a fake zero. */
export function tokenText(c: CountSum): string {
  if (c.sum === null) return c.unknownEvents ? `unknown (${plural(c.unknownEvents, "call")})` : "none";
  const n = c.sum.toLocaleString("en-US");
  return c.unknownEvents ? `${n} known, unknown for ${plural(c.unknownEvents, "call")}` : n;
}

/* ── founder triage (M4B): groups and cues derived from mission state only. No scores, no inference. ─────────────── */

export type MissionGroup = "needs_you" | "active" | "early" | "done";

/** Every state belongs to exactly one group (the Record type makes a missing state a compile error). */
export const GROUP_OF: Record<MissionState, MissionGroup> = {
  reviewing: "needs_you", completed: "needs_you",
  executing: "active", approved: "active", plan: "active",
  intent: "early",
  verified: "done", cancelled: "done",
};
export const GROUP_ORDER: MissionGroup[] = ["needs_you", "active", "early", "done"];
export const GROUP_LABEL: Record<MissionGroup, string> = { needs_you: "Needs you", active: "Active", early: "Inbox / early", done: "Done" };

/** Most recently updated first; ties (and unreadable dates) fall back to the newest ref, so the order is total. */
function byRecency(a: MissionRow, b: MissionRow): number {
  const ta = Date.parse(a.updated_at), tb = Date.parse(b.updated_at);
  return ((Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta)) || (b.ref - a.ref);
}

/** The four groups in display order (empty ones included), each sorted most recently updated first. */
export function groupMissions(missions: MissionRow[]): { group: MissionGroup; label: string; missions: MissionRow[] }[] {
  return GROUP_ORDER.map((group) => ({
    group, label: GROUP_LABEL[group],
    missions: missions.filter((m) => GROUP_OF[m.state] === group).sort(byRecency),
  }));
}

export type Cue = { label: string; tone: "attention" | "active" | "quiet" | "done" };

/**
 * One deterministic cue per mission, from its state alone. For a completed mission the cue depends on evidence
 * coverage; when the caller has no links loaded (the list) `evidence` is omitted and the cue says only what is known.
 * Nothing here infers "blocked" or urgency.
 */
export function attentionCue(m: Pick<MissionRow, "state" | "success_criteria">, evidence?: Pick<LinkRow, "criterion_id">[]): Cue {
  switch (m.state) {
    case "reviewing": return { label: "Needs review", tone: "attention" };
    case "completed":
      if (!evidence) return { label: "Needs verification", tone: "attention" };
      return uncoveredCriteria(m.success_criteria, evidence).length === 0
        ? { label: "Verify", tone: "attention" }
        : { label: "Evidence missing", tone: "attention" };
    case "approved": return { label: "Ready to start", tone: "active" };
    case "executing": return { label: "Active", tone: "active" };
    case "plan": return { label: "Planning", tone: "active" };
    case "intent": return m.success_criteria.length === 0 ? { label: "No criteria", tone: "quiet" } : { label: "New", tone: "quiet" };
    case "verified": return { label: "Verified", tone: "done" };
    case "cancelled": return { label: "Cancelled", tone: "done" };
  }
}

/** The next action for a list row, where evidence links are not loaded. */
export function listHint(m: Pick<MissionRow, "state" | "success_criteria">): string {
  if (m.state === "completed") return "Completed, not yet verified. Open it to check the evidence and verify.";
  if (m.state === "reviewing") return "Your review: complete it, or send it back for rework.";
  return nextHint(m, []);
}

/** "2 of 3 criteria have evidence" (null when there are no criteria to cover). */
export function coverageText(criteria: Item[], evidence: Pick<LinkRow, "criterion_id">[]): string | null {
  if (criteria.length === 0) return null;
  const covered = criteria.length - uncoveredCriteria(criteria, evidence).length;
  return `${covered} of ${criteria.length} ${criteria.length === 1 ? "criterion has" : "criteria have"} evidence`;
}

/**
 * What the current state means for the founder, where a decision or a distinction matters. Completed and Verified are
 * never the same thing: completed is the work's claim, verified is the founder's check against evidence.
 */
export function decisionText(m: Pick<MissionRow, "state" | "success_criteria">, evidence: Pick<LinkRow, "criterion_id">[]): string | null {
  switch (m.state) {
    case "reviewing": return "Your review is the current decision point: mark the work completed, or send it back for rework.";
    case "completed": return uncoveredCriteria(m.success_criteria, evidence).length === 0
      ? "Completed, NOT yet verified. The work says it is finished. It becomes verified only when you check the success criteria against the evidence and verify."
      : "Completed, NOT yet verified. The work says it is finished, but some success criteria have no evidence yet, so it cannot be verified.";
    case "verified": return "Verified: you checked the success criteria against the evidence.";
    default: return null;
  }
}
