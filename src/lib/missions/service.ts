/**
 * P06 M2: the canonical Mission layer. Every route calls exactly one function here; no route implements policy.
 *
 * Authority: the founder only. Every exported operation starts with `founderOnly`, so a context that does not carry
 * the founder principal is refused before any input is parsed or any storage is touched. Machine callers never reach
 * here (the routes are owner-guarded), and this check makes that true even if a route were wired wrongly.
 *
 * Order inside every mutation: validate input -> load the mission inside the tenant -> authorize against the current
 * row -> one storage call (an M1 function or a single insert/tombstone) -> map the result. M1 re-checks every
 * structural rule in the same transaction as the write, so a stale read here can only make a request fail, never
 * let a forbidden write through.
 */
import { canTransition, FOUNDER_ACTOR, isFounder, type Principal } from "./principal";
import type { CorrelationType, CostEventRow, MissionStore } from "./store";
import { costTargets, mergeAttribution, summarize, type MissionCosts } from "./costs";
import { EVIDENCE_TYPES, resolveTarget, type ResolvedTarget } from "./targets";
import type { EventRow, LinkRow, MissionResult, MissionRow, MissionState, StoreError, TargetType } from "./types";
import * as v from "./validate";

export type Ctx = { store: MissionStore; tenantId: string; principal: Principal };

type Fail = Extract<MissionResult<never>, { ok: false }>;
const fail = (status: Fail["status"], code: string, message: string): Fail => ({ ok: false, status, code, message });
const ok = <T>(data: T, status: 200 | 201 = 200): MissionResult<T> => ({ ok: true, status, data });

/**
 * M1 guard codes -> HTTP. Messages are ours, not the database's, so nothing internal leaks; the MI code is kept so
 * a caller can tell exactly which rule it hit.
 */
const MI: Record<string, [Fail["status"], string]> = {
  MI001: [422, "unknown state"],
  MI002: [422, "invalid actor"],
  MI003: [422, "event detail rejected"],
  MI004: [404, "mission not found"],
  MI005: [409, "mission state changed since it was read"],
  MI006: [409, "transition not allowed from the current state"],
  MI007: [422, "at least one success criterion is required before approval"],
  MI008: [403, "this actor cannot verify this mission"],
  MI009: [409, "every success criterion needs live evidence before verification"],
  MI013: [409, "mission is terminal"],
  MI015: [409, "mission definition is frozen once approved"],
  MI017: [409, "reassignment changes nothing"],
  MI018: [422, "invalid owner or team"],
  MI019: [409, "owner and team are frozen from completed"],
  MI021: [404, "mission not found"],
  MI022: [409, "mission is terminal; its links are frozen"],
  MI024: [422, "criterion is not a success criterion of this mission"],
  MI025: [422, "invalid mission link target"],
  MI026: [404, "linked mission does not exist"],
  MI027: [409, "link is already removed"],
  MI029: [409, "success criteria cannot change while live evidence exists"],
  "23505": [409, "an identical live link already exists"],
  "23514": [422, "value rejected by a database constraint"],
  "23503": [404, "referenced record does not exist"],
};
function fromStore(e: StoreError): Fail {
  const hit = e.code ? MI[e.code] : undefined;
  if (hit) return fail(hit[0], e.code as string, hit[1]);
  return fail(502, "storage_error", "mission storage call failed");
}

/** Body-supplied identity fields are never read; this is the full list of keys each operation accepts. */
function only(body: Record<string, unknown>, allowed: string[]): Fail | null {
  const extra = Object.keys(body).filter((k) => !allowed.includes(k));
  return extra.length ? fail(400, "unknown_fields", `unknown fields: ${extra.slice(0, 5).join(", ")}`) : null;
}

async function load(ctx: Ctx, id: unknown): Promise<MissionRow | Fail> {
  if (!v.isUuid(id)) return fail(404, "MI004", "mission not found");
  const r = await ctx.store.getMission(ctx.tenantId, id.toLowerCase());
  if (!r.ok) return fromStore(r.error);
  if (!r.data) return fail(404, "MI004", "mission not found");
  return r.data;
}
const isFail = (x: unknown): x is Fail => !!x && typeof x === "object" && (x as Fail).ok === false;

function founderOnly(ctx: Ctx): Fail | null {
  return isFounder(ctx.principal) ? null : fail(403, "founder_only", "Mission operations require the authenticated founder");
}

/** Matches M1's per-string bound in mission_detail_ok. */
export const NOTE_MAX_BYTES = 1000;

/** Optional free-text note on a transition: plain text, bounded, stored under the key "note" only. */
function noteDetail(raw: unknown): { ok: true; detail: Record<string, unknown> } | Fail {
  if (raw === undefined) return { ok: true, detail: {} };
  // M1's only bound on a note is its 1000-byte string limit; the character cap matches it rather than undercutting it.
  const t = v.text(raw, "note", NOTE_MAX_BYTES);
  if (!t.ok) return fail(422, "invalid_note", t.message);
  // M1's mission_detail_ok bounds every stored string at 1000 UTF-8 BYTES; 500 characters of CJK or emoji exceed it.
  if (Buffer.byteLength(t.value, "utf8") > NOTE_MAX_BYTES) return fail(422, "invalid_note", `note must be at most ${NOTE_MAX_BYTES} bytes`);
  return { ok: true, detail: { note: t.value } };
}

// ─── create / read ──────────────────────────────────────────────────────────────────────────────────────

export async function createMission(ctx: Ctx, body: Record<string, unknown>): Promise<MissionResult<MissionRow>> {
  const denied = founderOnly(ctx);
  if (denied) return denied;
  const extra = only(body, ["objective", "owner", "ownerKind", "agentIds", "successCriteria", "deliverables"]);
  if (extra) return extra;
  const objective = v.text(body.objective, "objective", 2000);
  if (!objective.ok) return fail(422, "invalid_objective", objective.message);
  const own = v.owner(body.owner, body.ownerKind);
  if (!own.ok) return fail(422, "invalid_owner", own.message);
  const team = v.team(body.agentIds);
  if (!team.ok) return fail(422, "invalid_team", team.message);
  const criteria = v.items(body.successCriteria, "successCriteria");
  if (!criteria.ok) return fail(422, "invalid_criteria", criteria.message);
  const deliverables = v.items(body.deliverables, "deliverables");
  if (!deliverables.ok) return fail(422, "invalid_deliverables", deliverables.message);


  const r = await ctx.store.insertMission({
    tenant_id: ctx.tenantId,
    objective: objective.value,
    owner: own.value.owner,
    owner_kind: own.value.ownerKind,
    agent_ids: team.value,
    success_criteria: criteria.value,
    deliverables: deliverables.value,
    created_by: ctx.principal.actor,
    created_by_kind: ctx.principal.actorKind,
  });
  return r.ok ? ok(r.data, 201) : fromStore(r.error);
}

/** Events are a recent window: the latest EVENT_WINDOW, oldest first, with eventsTruncated set when older ones exist. */
export const EVENT_WINDOW = 200;
export type MissionDetail = { mission: MissionRow; links: LinkRow[]; events: EventRow[]; eventsTruncated: boolean };

export async function getMission(ctx: Ctx, id: unknown, opts: { includeRemoved?: boolean } = {}): Promise<MissionResult<MissionDetail>> {
  const denied = founderOnly(ctx);
  if (denied) return denied;
  const m = await load(ctx, id);
  if (isFail(m)) return m;
  const [links, events] = await Promise.all([
    ctx.store.listLinks(m.id, !!opts.includeRemoved),
    ctx.store.listEvents(m.id, EVENT_WINDOW + 1),
  ]);
  if (!links.ok) return fromStore(links.error);
  if (!events.ok) return fromStore(events.error);
  const eventsTruncated = events.data.length > EVENT_WINDOW;
  return ok({ mission: m, links: links.data, events: eventsTruncated ? events.data.slice(1) : events.data, eventsTruncated });
}

export async function listMissions(
  ctx: Ctx,
  q: { state?: string | null; owner?: string | null; before?: string | null; limit?: string | null },
): Promise<MissionResult<{ missions: MissionRow[]; nextBefore: number | null }>> {
  const denied = founderOnly(ctx);
  if (denied) return denied;
  if (q.state && !v.isState(q.state)) return fail(422, "invalid_state", "unknown state filter");
  if (q.owner && !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(q.owner)) return fail(422, "invalid_owner", "invalid owner filter");
  let beforeRef: number | undefined;
  if (q.before) {
    if (!/^[1-9][0-9]{0,15}$/.test(q.before)) return fail(422, "invalid_cursor", "before must be a positive integer ref");
    beforeRef = Number(q.before);
  }
  let limit = 50;
  if (q.limit) {
    if (!/^[1-9][0-9]{0,2}$/.test(q.limit) || Number(q.limit) > 100) return fail(422, "invalid_limit", "limit must be 1..100");
    limit = Number(q.limit);
  }
  const r = await ctx.store.listMissions({
    tenantId: ctx.tenantId, state: (q.state || undefined) as MissionState | undefined, owner: q.owner || undefined, beforeRef, limit,
  });
  if (!r.ok) return fromStore(r.error);
  const nextBefore = r.data.length === limit ? r.data[r.data.length - 1].ref : null;
  return ok({ missions: r.data, nextBefore });
}

// ─── state ──────────────────────────────────────────────────────────────────────────────────────────────

/** Every legal transition except completed -> verified, which only verifyMission performs. Founder only. */
export async function transitionMission(ctx: Ctx, id: unknown, body: Record<string, unknown>): Promise<MissionResult<MissionRow>> {
  const denied = founderOnly(ctx);
  if (denied) return denied;
  const extra = only(body, ["to", "expectedFrom", "note"]);
  if (extra) return extra;
  if (!v.isState(body.to)) return fail(422, "invalid_state", "to must be a mission state");
  if (body.expectedFrom !== undefined && !v.isState(body.expectedFrom)) return fail(422, "invalid_state", "expectedFrom must be a mission state");
  const note = noteDetail(body.note);
  if (isFail(note)) return note;
  const m = await load(ctx, id);
  if (isFail(m)) return m;
  const allowed = canTransition(body.to);
  if (!allowed.ok) return fail(403, allowed.code, allowed.message);
  const r = await ctx.store.transition({
    id: m.id, to: body.to, actor: ctx.principal.actor, actorKind: ctx.principal.actorKind,
    detail: note.detail, expectedFrom: (body.expectedFrom as MissionState | undefined) ?? m.state,
  });
  return r.ok ? ok(r.data) : fromStore(r.error);
}

/**
 * completed -> verified. The ONLY path to verified, and it requires the founder principal, which only the owner
 * session guard produces. The DB then enforces evidence coverage per criterion and that the verifier was never on
 * the execution team (M1). expectedFrom is fixed to completed, so a stale view cannot verify the wrong thing.
 */
export async function verifyMission(ctx: Ctx, id: unknown, body: Record<string, unknown>): Promise<MissionResult<MissionRow>> {
  // Same founder check as every operation, kept explicit here because this is the founder-authority boundary that
  // M1 deliberately cannot enforce (it cannot see the session).
  if (!isFounder(ctx.principal)) return fail(403, "founder_only", "only the authenticated founder can verify a mission");
  const extra = only(body, ["note"]);
  if (extra) return extra;
  const note = noteDetail(body.note);
  if (isFail(note)) return note;
  const m = await load(ctx, id);
  if (isFail(m)) return m;
  if (m.state !== "completed") return fail(409, "MI006", "only a completed mission can be verified");
  const r = await ctx.store.transition({
    id: m.id, to: "verified", actor: FOUNDER_ACTOR, actorKind: "human",
    detail: { ...note.detail, authority: "founder_session" }, expectedFrom: "completed",
  });
  return r.ok ? ok(r.data) : fromStore(r.error);
}

export async function reassignMission(ctx: Ctx, id: unknown, body: Record<string, unknown>): Promise<MissionResult<MissionRow>> {
  const denied = founderOnly(ctx);
  if (denied) return denied;
  const extra = only(body, ["owner", "ownerKind", "agentIds"]);
  if (extra) return extra;
  const own = v.owner(body.owner, body.ownerKind);
  if (!own.ok) return fail(422, "invalid_owner", own.message);
  // Reassignment states the whole new team. An omitted agentIds must never be read as "remove everyone".
  if (!Array.isArray(body.agentIds)) return fail(422, "invalid_team", "agentIds is required (send [] to clear the team)");
  const team = v.team(body.agentIds);
  if (!team.ok) return fail(422, "invalid_team", team.message);
  const m = await load(ctx, id);
  if (isFail(m)) return m;
  const r = await ctx.store.reassign({
    id: m.id, owner: own.value.owner, ownerKind: own.value.ownerKind, agentIds: team.value,
    actor: ctx.principal.actor, actorKind: ctx.principal.actorKind,
  });
  return r.ok ? ok(r.data) : fromStore(r.error);
}

// ─── links ──────────────────────────────────────────────────────────────────────────────────────────────

/** Bound on the dependency walk. A graph this large is a bug, so the check fails closed rather than guessing. */
export const MAX_DEPENDENCY_WALK = 2000;

/**
 * Does a live dependency path lead from `start` back to `goal`? true / false, or a Fail when the walk cannot finish.
 *
 * Only LIVE missions gate anything: a verified or cancelled mission's outgoing dependencies can never block work again
 * (its links are frozen by M1). So edges leaving a terminal mission are not part of the graph, and the invariant held
 * here is "no dependency cycle among live missions". That is also what makes a link stranded by a concurrent terminal
 * transition harmless: once its source is terminal, the edge is inert.
 */
async function reaches(ctx: Ctx, start: string, goal: string): Promise<boolean | Fail> {
  const seen = new Set<string>([start]);
  let frontier = [start];
  while (frontier.length) {
    if (seen.has(goal)) return true;
    const live = await ctx.store.liveMissionIds(ctx.tenantId, frontier);
    if (!live.ok) return fromStore(live.error);
    if (live.data.length === 0) return false;
    const r = await ctx.store.dependencyEdges(live.data);
    if (!r.ok) return fromStore(r.error);
    const next: string[] = [];
    for (const e of r.data) {
      const t = e.target_id.toLowerCase();
      if (t === goal) return true;
      if (!seen.has(t)) { seen.add(t); next.push(t); }
    }
    if (seen.size > MAX_DEPENDENCY_WALK) return fail(422, "dependency_graph_too_large", "dependency graph exceeds the walk bound");
    frontier = next;
  }
  return false;
}

export type LinkResult = { link: LinkRow; resolution: ResolvedTarget["resolution"] };

export async function addLink(ctx: Ctx, id: unknown, body: Record<string, unknown>): Promise<MissionResult<LinkResult>> {
  const denied = founderOnly(ctx);
  if (denied) return denied;
  const extra = only(body, ["targetType", "targetId", "targetIndex", "relation", "criterionId"]);
  if (extra) return extra;
  if (!v.isTargetType(body.targetType)) return fail(422, "invalid_target_type", "unknown targetType");
  if (!v.isRelation(body.relation)) return fail(422, "invalid_relation", "unknown relation");
  const relation = body.relation;
  const targetType = body.targetType as TargetType;
  let criterionId: string | null = null;
  if (relation === "evidence") {
    if (typeof body.criterionId !== "string" || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(body.criterionId)) {
      return fail(422, "invalid_criterion", "evidence must name a success criterion id");
    }
    if (!EVIDENCE_TYPES.has(targetType)) return fail(422, "unverifiable_evidence", `${targetType} cannot be evidence until it can be resolved (M3)`);
    criterionId = body.criterionId;
  } else if (body.criterionId !== undefined) {
    return fail(422, "invalid_criterion", "only evidence carries a criterionId");
  }
  if (relation === "dependency" && targetType !== "mission") {
    return fail(422, "invalid_dependency", "a dependency must point at another mission");
  }

  const m = await load(ctx, id);
  if (isFail(m)) return m;
  if (criterionId && !m.success_criteria.some((c) => c.id === criterionId)) {
    return fail(422, "MI024", "criterion is not a success criterion of this mission");
  }

  const t = await resolveTarget(ctx.store, ctx.tenantId, targetType, body.targetId, body.targetIndex);
  if (!t.ok) return fail(t.status, t.code, t.message);
  const target = t.target;
  // A Universal Command record is the founder's instruction, not an outcome: it may be a source or context, never proof.
  if (relation === "evidence" && target.notEvidence) {
    return fail(422, "command_not_evidence", "a Universal Command record is an instruction, not evidence; link what the work produced");
  }

  // A mission never links to itself under any relation: self-evidence would prove nothing (M1 also refuses, MI025).
  if (target.targetType === "mission" && target.targetId === m.id) {
    return fail(422, relation === "dependency" ? "self_dependency" : "self_link", "a mission cannot link to itself");
  }
  if (relation === "dependency") {
    const cyc = await reaches(ctx, target.targetId, m.id);
    if (isFail(cyc)) return cyc;
    if (cyc) return fail(409, "dependency_cycle", "this dependency would create a cycle");
  }

  const r = await ctx.store.insertLink({
    mission_id: m.id, target_type: target.targetType, target_id: target.targetId, target_index: target.targetIndex,
    relation, criterion_id: criterionId, created_by: ctx.principal.actor, created_by_kind: ctx.principal.actorKind,
  });
  if (!r.ok) return fromStore(r.error);

  if (relation === "dependency") {
    // Insert-then-verify closes the race where two requests add A->B and B->A at the same moment: each insert is
    // committed before its re-check, so whichever re-check runs second sees both edges and withdraws its own link
    // (tombstoned, so the attempt stays in the audit trail). Both may withdraw; neither can leave a cycle behind.
    const cyc = await reaches(ctx, target.targetId, m.id);
    if (cyc === true || isFail(cyc)) {
      // One retry covers a transient storage error. If the withdrawal still fails (for example the mission became
      // terminal in between, which freezes its links), fail loud with a distinct code: the edge needs a human.
      const withdraw = () => ctx.store.tombstoneLink({ missionId: m.id, linkId: r.data.id, by: "mission-guard", byKind: "system" });
      let undo = await withdraw();
      if (!undo.ok) undo = await withdraw();
      if (!undo.ok) {
        // MI022: this mission turned terminal between the insert and the withdrawal, so M1 froze the link. No live
        // cycle existed before this insert (the invariant), and the only new edge leaves this mission; if it is now
        // terminal that edge is inert, so no live cycle exists. Confirm it really is terminal before saying so.
        if (undo.error.code === "MI022") {
          const live = await ctx.store.liveMissionIds(ctx.tenantId, [m.id]);
          if (live.ok && live.data.length === 0) {
            return fail(409, "dependency_cycle", "this dependency would have created a cycle; the mission is now terminal and the link is inert");
          }
        }
        return fail(502, "dependency_cycle_unwithdrawn", `cycle detected after insert and link ${r.data.id} could not be withdrawn; investigate`);
      }
      return isFail(cyc) ? cyc : fail(409, "dependency_cycle", "this dependency would create a cycle");
    }
  }
  return ok({ link: r.data, resolution: target.resolution }, 201);
}

export async function removeLink(ctx: Ctx, id: unknown, linkId: unknown): Promise<MissionResult<LinkRow>> {
  const denied = founderOnly(ctx);
  if (denied) return denied;
  if (!v.isUuid(linkId)) return fail(404, "link_not_found", "link not found");
  const m = await load(ctx, id);
  if (isFail(m)) return m;
  const r = await ctx.store.tombstoneLink({
    missionId: m.id, linkId: linkId.toLowerCase(), by: ctx.principal.actor, byKind: ctx.principal.actorKind,
  });
  if (!r.ok) return fromStore(r.error);
  if (!r.data) return fail(404, "link_not_found", "no live link with that id on this mission");
  return ok(r.data);
}

/**
 * M3: cost and usage attributable to one mission, derived on read from execution_events_with_shadow_cost (see
 * costs.ts for the exact attribution and truth rules). Founder-only and tenant-scoped through the mission load; the
 * telemetry rows themselves have no tenant column and are reached only through this mission's id and its own live,
 * tenant-resolved links. Any read failure fails the whole request: a partial total is never returned.
 */
export async function missionCosts(ctx: Ctx, id: unknown): Promise<MissionResult<MissionCosts>> {
  const denied = founderOnly(ctx);
  if (denied) return denied;
  const m = await load(ctx, id);
  if (isFail(m)) return m;
  const links = await ctx.store.listLinks(m.id, false);
  if (!links.ok) return fromStore(links.error);
  const targets = costTargets(links.data);
  const direct = await ctx.store.eventsForMission(m.id);
  if (!direct.ok) return fromStore(direct.error);
  const linked: { type: CorrelationType; rows: CostEventRow[] }[] = [];
  for (const [type, ids] of targets) {
    const r = await ctx.store.eventsForCorrelation(type, [...ids.keys()]);
    if (!r.ok) return fromStore(r.error);
    linked.push({ type, rows: r.data });
  }
  try {
    return ok(summarize(m.id, mergeAttribution(direct.data, linked, targets)));
  } catch {
    // An unexpected stored value (e.g. a cost the exact-decimal parser does not accept) fails loudly, never as a guess.
    return fail(502, "cost_data_unreadable", "mission cost data could not be read exactly");
  }
}

/** Read-only preview of what a link would point at, without writing anything. */
export async function previewTarget(ctx: Ctx, q: { targetType?: string | null; targetId?: string | null; targetIndex?: string | null }): Promise<MissionResult<ResolvedTarget>> {
  const denied = founderOnly(ctx);
  if (denied) return denied;
  if (!v.isTargetType(q.targetType)) return fail(422, "invalid_target_type", "unknown targetType");
  let index: number | undefined;
  if (q.targetIndex !== null && q.targetIndex !== undefined) {
    if (!/^[0-9]{1,3}$/.test(q.targetIndex)) return fail(422, "invalid_target", "targetIndex must be 0..999");
    index = Number(q.targetIndex);
  }
  const t = await resolveTarget(ctx.store, ctx.tenantId, q.targetType, q.targetId ?? undefined, index);
  return t.ok ? ok(t.target) : fail(t.status, t.code, t.message);
}
