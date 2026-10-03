/**
 * P06 M2: who is acting on a Mission, and what they may do.
 *
 * There are exactly two principals, and neither comes from the request body:
 *   founder  the authenticated owner session (P03 boundary: Firebase session + PARALLAX_OWNER_UID, exact Origin,
 *            session-bound CSRF). Recorded as actor "ramon", kind "human". This is the ONLY principal that can
 *            approve, verify, cancel, reassign or remove links.
 *   agent    a fleet machine holding the missions service credential (P05-B2 boundary), naming a registered agent
 *            in the x-parallax-agent header. Recorded as that agent id, kind "agent". It can never be "ramon", never
 *            "human", and never reaches founder authority.
 *
 * The agent id is a declaration inside the machine trust boundary: the credential proves "a fleet machine", not
 * which agent. That is why no capability that matters for trust (approve, verify, cancel, reassign, remove) is
 * granted to the agent principal at all; a machine misnaming itself can only do what any agent may do.
 *
 * actor_kind='human' in a request body is never read. Body fields named actor, actor_kind, created_by, uid, role
 * and similar are ignored by every route.
 */
import { getAgent } from "@/lib/agent-registry";
import type { MissionRow, MissionState } from "./types";

export const FOUNDER_ACTOR = "ramon";
export const AGENT_HEADER = "x-parallax-agent";

export type Principal =
  | { kind: "founder"; actor: typeof FOUNDER_ACTOR; actorKind: "human" }
  | { kind: "agent"; actor: string; actorKind: "agent" };

export const FOUNDER: Principal = { kind: "founder", actor: FOUNDER_ACTOR, actorKind: "human" };

/**
 * Canonical, active registry id only. Aliases and directory ids resolve in getAgent, so the exact canonical id is
 * required here: two spellings of one agent must never become two mission identities.
 */
export function registeredAgentId(raw: unknown): string | null {
  // No trimming: " nova" is not an agent id. (HTTP header values arrive already trimmed by the platform.)
  if (typeof raw !== "string") return null;
  const id = raw;
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(id) || id === FOUNDER_ACTOR) return null;
  const agent = getAgent(id);
  if (!agent || agent.id !== id || agent.status !== "active") return null;
  return id;
}

export function agentPrincipalFrom(headers: Headers): Principal | null {
  const id = registeredAgentId(headers.get(AGENT_HEADER));
  return id ? { kind: "agent", actor: id, actorKind: "agent" } : null;
}

/** An agent is a participant when it owns the mission or is on its team, judged from the current row. */
export function isParticipant(p: Principal, m: Pick<MissionRow, "owner" | "owner_kind" | "agent_ids">): boolean {
  if (p.kind !== "agent") return false;
  return (m.owner_kind === "agent" && m.owner === p.actor) || m.agent_ids.includes(p.actor);
}

/**
 * Transitions an agent participant may request. Everything else is founder-only, and completed -> verified is not
 * reachable through the generic transition at all (only the founder verify route).
 */
const AGENT_TRANSITIONS: ReadonlySet<string> = new Set([
  "intent>plan",
  "approved>executing",
  "executing>reviewing",
  "reviewing>executing",
  "reviewing>completed",
]);

export type Decision = { ok: true } | { ok: false; code: string; message: string };
const deny = (code: string, message: string): Decision => ({ ok: false, code, message });
const allow: Decision = { ok: true };

export function canTransition(p: Principal, m: MissionRow, to: MissionState): Decision {
  if (to === "verified") return deny("verify_route_only", "verification is only available through the founder verify route");
  if (p.kind === "founder") return allow;
  if (!isParticipant(p, m)) return deny("not_participant", "agent is not the owner or on the team of this mission");
  if (!AGENT_TRANSITIONS.has(`${m.state}>${to}`)) return deny("founder_only", `${m.state} -> ${to} requires the founder`);
  return allow;
}

export function canCreate(p: Principal, owner: string, ownerKind: "human" | "agent"): Decision {
  if (p.kind === "founder") return allow;
  // An agent may open a mission it leads, or one Ramon owns; it may not assign leadership to another agent.
  if (ownerKind === "human" && owner === FOUNDER_ACTOR) return allow;
  if (ownerKind === "agent" && owner === p.actor) return allow;
  return deny("founder_only", "an agent may only create a mission it owns or one owned by the founder");
}

export function canAddLink(p: Principal, m: MissionRow, relation: string): Decision {
  if (p.kind === "founder") return allow;
  if (!isParticipant(p, m)) return deny("not_participant", "agent is not the owner or on the team of this mission");
  if (relation === "approval") return deny("founder_only", "approval links are founder-only");
  return allow;
}

export function canRemoveLink(p: Principal): Decision {
  return p.kind === "founder" ? allow : deny("founder_only", "removing a link is founder-only");
}

export function canReassign(p: Principal): Decision {
  return p.kind === "founder" ? allow : deny("founder_only", "reassignment is founder-only");
}
