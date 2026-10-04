/**
 * P06 M4A: client-safe helpers for the founder Mission surface. Pure functions only: no fetch, no policy.
 *
 * The server (src/lib/missions/service.ts + M1) is the authority for every rule. These helpers only decide what the UI
 * OFFERS, mirroring M1's transition table so the founder sees the legal next steps; a stale or wrong offer is still
 * refused by the server. completed -> verified is never offered as a transition: it is the separate Verify action,
 * which calls the dedicated /verify route.
 */
import { AGENT_CORE } from "@/lib/agent-registry-core";
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
export function forwardSteps(state: MissionState): StepAction[] {
  return FORWARD[state].map((to) => ({ to, label: STEP_LABEL[`${state}>${to}`] ?? `Move to ${STATE_LABEL[to]}` }));
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
    case "intent": return "Shape it into a plan.";
    case "plan": return m.success_criteria.length === 0 ? "Add at least one success criterion before approval." : "Review the plan and approve it.";
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
  else if (chars(objective) > 2000) e.objective = "Keep the objective under 2000 characters.";
  const criteria = linesToItems(f.criteriaText, "c");
  if (criteria.length > 50) e.criteria = "At most 50 success criteria.";
  else if (criteria.some((c) => chars(c.text) > 500)) e.criteria = "Each criterion must be under 500 characters.";
  const deliverables = linesToItems(f.deliverablesText, "d");
  if (deliverables.length > 50) e.deliverables = "At most 50 deliverables.";
  else if (deliverables.some((c) => chars(c.text) > 500)) e.deliverables = "Each deliverable must be under 500 characters.";
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
