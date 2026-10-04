/**
 * P06 M2: who may act on a Mission. In M2 that is exactly ONE principal: the founder.
 *
 *   founder  the authenticated owner session (P03 boundary: Firebase session + PARALLAX_OWNER_UID, exact Origin,
 *            session-bound CSRF). Recorded as actor "ramon", kind "human".
 *
 * There is no agent principal. A fleet machine credential proves only that the caller is a fleet machine, never which
 * agent it is, and a header such as x-parallax-agent is a self-declared claim, not authentication. Until a trusted
 * per-agent identity exists (a separate, later packet), machine callers get NO Mission authority: every Mission route
 * sits behind the owner guards, and every operation in service.ts refuses any principal that is not the founder before
 * it touches storage. No header and no body field is ever read as identity.
 */
import { getAgent } from "@/lib/agent-registry";
import type { MissionState } from "./types";

export const FOUNDER_ACTOR = "ramon";

export type Principal = { kind: "founder"; actor: typeof FOUNDER_ACTOR; actorKind: "human" };

export const FOUNDER: Principal = { kind: "founder", actor: FOUNDER_ACTOR, actorKind: "human" };

/** Runtime check, not just a type: a context built any other way is refused. */
export function isFounder(p: unknown): p is Principal {
  const x = p as Partial<Principal> | null;
  return !!x && x.kind === "founder" && x.actor === FOUNDER_ACTOR && x.actorKind === "human";
}

/**
 * Canonical, active registry id only, used to validate the owner and team the FOUNDER assigns. Aliases, directory
 * ids, case variants, surrounding whitespace and the founder's own name are refused: two spellings of one agent must
 * never become two mission identities.
 */
export function registeredAgentId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw;
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(id) || id === FOUNDER_ACTOR) return null;
  const agent = getAgent(id);
  if (!agent || agent.id !== id || agent.status !== "active") return null;
  return id;
}

export type Decision = { ok: true } | { ok: false; code: string; message: string };

/** completed -> verified is never a generic transition, for anyone; only the founder verify route performs it. */
export function canTransition(to: MissionState): Decision {
  return to === "verified"
    ? { ok: false, code: "verify_route_only", message: "verification is only available through the founder verify route" }
    : { ok: true };
}
