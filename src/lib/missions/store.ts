/**
 * P06 M2: the storage port for Missions, and its Supabase (service_role) adapter.
 *
 * The adapter is deliberately thin: one call per method, tenant filter on every mission read, state changes only
 * through the M1 SECURITY DEFINER functions (mission_transition, mission_reassign), links only inserted or
 * tombstoned. All policy lives in service.ts; all integrity rules the database can hold stay in M1's triggers.
 * Errors keep the Postgres SQLSTATE so service.ts can map M1's MIxxx codes precisely.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { commandChannelId } from "@/lib/command/channel";
import { SHADOW_KIND } from "@/lib/command/types";
import type {
  ActorKind, EventRow, Item, LinkRow, MissionRow, MissionState, Relation, StoreResult, TargetType,
} from "./types";

export type NewMission = {
  tenant_id: string;
  objective: string;
  owner: string;
  owner_kind: "human" | "agent";
  agent_ids: string[];
  success_criteria: Item[];
  deliverables: Item[];
  created_by: string;
  created_by_kind: ActorKind;
};

export type NewLink = {
  mission_id: string;
  target_type: TargetType;
  target_id: string;
  target_index: number | null;
  relation: Relation;
  criterion_id: string | null;
  created_by: string;
  created_by_kind: ActorKind;
};

/** execution_events correlation types (Packet 3). */
export type CorrelationType = "job" | "chat_message" | "lead";

/** The execution_events_with_shadow_cost columns cost attribution needs. Metadata only: no prompts or bodies. */
export type CostEventRow = {
  id: string;
  mission_id: string | null;
  correlation_type: CorrelationType | null;
  correlation_id: string | null;
  provider: string;
  model_requested: string | null;
  model_reported: string | null;
  outcome: string;
  usage_quality: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  direct_cost_usd: number | string | null;
  billing_mode: string;
  shadow_cost_usd: number | string | null;
  shadow_cost_basis: string | null;
};
export const COST_EVENT_COLS = "id, mission_id, correlation_type, correlation_id, provider, model_requested, model_reported, outcome, usage_quality, input_tokens, output_tokens, total_tokens, direct_cost_usd, billing_mode, shadow_cost_usd, shadow_cost_basis";

export type ListQuery = { tenantId: string; state?: MissionState; owner?: string; beforeRef?: number; limit: number };

/** What a resolver needs to know about a database-backed target. Only existence and a few typed facts. */
export type TargetRecord =
  | { type: "job"; id: string }
  | { type: "synthesis"; id: string; actionCount: number }
  | { type: "pipeline_gate"; id: string }
  | { type: "pipeline_lead"; id: string }
  /** notEvidence: a Universal Command shadow record (or its channel). A founder's instruction proves nothing. */
  | { type: "chat_channel"; id: string; notEvidence: boolean }
  | { type: "chat_message"; id: string; notEvidence: boolean }
  | { type: "mission"; id: string };

export type DbTargetType = TargetRecord["type"];

export interface MissionStore {
  insertMission(row: NewMission): Promise<StoreResult<MissionRow>>;
  getMission(tenantId: string, id: string): Promise<StoreResult<MissionRow | null>>;
  listMissions(q: ListQuery): Promise<StoreResult<MissionRow[]>>;
  /** Every link of the mission (complete, never truncated), in creation order. */
  listLinks(missionId: string, includeRemoved: boolean): Promise<StoreResult<LinkRow[]>>;
  /** The most recent `limit` events, oldest first. */
  listEvents(missionId: string, limit: number): Promise<StoreResult<EventRow[]>>;
  transition(a: { id: string; to: MissionState; actor: string; actorKind: ActorKind; detail: Record<string, unknown>; expectedFrom: MissionState | null }): Promise<StoreResult<MissionRow>>;
  reassign(a: { id: string; owner: string; ownerKind: "human" | "agent"; agentIds: string[]; actor: string; actorKind: ActorKind }): Promise<StoreResult<MissionRow>>;
  insertLink(row: NewLink): Promise<StoreResult<LinkRow>>;
  /** Tombstones one live link of one mission. Returns null when no such live link exists. */
  tombstoneLink(a: { missionId: string; linkId: string; by: string; byKind: ActorKind }): Promise<StoreResult<LinkRow | null>>;
  /** Live mission->mission dependency edges leaving any of these missions. */
  dependencyEdges(fromMissionIds: string[]): Promise<StoreResult<{ mission_id: string; target_id: string }[]>>;
  /** Which of these missions (in this tenant) are not terminal. Edges out of a terminal mission can never gate anything. */
  liveMissionIds(tenantId: string, ids: string[]): Promise<StoreResult<string[]>>;
  /**
   * M3 cost attribution reads (execution_events_with_shadow_cost, read-only). Complete or an error, never partial.
   * eventsForMission: rows whose mission_id is this mission. eventsForCorrelation: rows with this correlation type
   * whose correlation_id equals one of these UUIDs IGNORING CASE (writers store the spelling they were given, and the
   * column's UUID CHECK is case-insensitive). Every id must be a UUID; anything else fails the read.
   */
  eventsForMission(missionId: string): Promise<StoreResult<CostEventRow[]>>;
  eventsForCorrelation(type: CorrelationType, ids: string[]): Promise<StoreResult<CostEventRow[]>>;
  /** Existence (and typed facts) of a database-backed target inside the tenant. null = does not exist. */
  lookupTarget(tenantId: string, type: DbTargetType, id: string): Promise<StoreResult<TargetRecord | null>>;
}

/** Page size for edge reads; must not exceed the PostgREST max-rows setting (1000 by default). */
export const EDGE_PAGE = 500;
/** Upper bound on edge pages per read (far beyond MAX_DEPENDENCY_WALK); exceeding it is an error, never a partial read. */
export const EDGE_MAX_PAGES = 100;

/** Ids per IN (...) filter: keeps request URLs short and every response far below the PostgREST row cap. */
export const ID_CHUNK = 200;
/** Ids per case-insensitive correlation query (each becomes an or() term in the request URL, so keep it short). */
export const COST_ID_CHUNK = 50;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function chunks<T>(xs: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += ID_CHUNK) out.push(xs.slice(i, i + ID_CHUNK));
  return out;
}

/** An M1 function returns exactly one row; accept the object or a one-element array, refuse anything else. */
function oneRow(data: unknown): StoreResult<MissionRow> {
  const row = Array.isArray(data) ? (data.length === 1 ? data[0] : null) : data;
  if (!row || typeof row !== "object" || typeof (row as MissionRow).id !== "string") {
    return { ok: false, error: { message: "mission function returned an unexpected shape" } };
  }
  return { ok: true, data: row as MissionRow };
}

const MISSION_COLS = "id, ref, tenant_id, objective, owner, owner_kind, agent_ids, success_criteria, deliverables, state, created_by, created_by_kind, created_at, updated_at";
const LINK_COLS = "id, mission_id, target_type, target_id, target_index, relation, criterion_id, created_by, created_by_kind, created_at, removed_at, removed_by, removed_by_kind";
const EVENT_COLS = "id, mission_id, seq, kind, from_state, to_state, actor, actor_kind, detail, created_at";

type PgErr = { code?: string; message?: string } | null;
function wrap<T>(data: unknown, error: PgErr): StoreResult<T> {
  if (error) return { ok: false, error: { code: error.code, message: error.message ?? "database error" } };
  return { ok: true, data: data as T };
}

export function supabaseMissionStore(svc: SupabaseClient): MissionStore {
  /**
   * Live dependency edges leaving one bounded chunk of missions, paged to completion. PostgREST caps a response
   * (max-rows, 1000 by default), and a silently truncated edge set would let the cycle walk miss a path. Keyset
   * pagination on the immutable id (id > last seen id), never an offset: a concurrent tombstone removes rows from the
   * live set, which would shift an offset and skip an edge. The loop stops only on an EMPTY page, so a server cap
   * smaller than EDGE_PAGE cannot end the read early. A page budget bounds it; running out fails closed.
   */
  async function edgesFor(ids: string[]): Promise<StoreResult<{ mission_id: string; target_id: string }[]>> {
    const out: { mission_id: string; target_id: string }[] = [];
    let after: string | null = null;
    for (let pageNo = 0; pageNo < EDGE_MAX_PAGES; pageNo++) {
      let q = svc.from("mission_links").select("id, mission_id, target_id")
        .in("mission_id", ids).eq("relation", "dependency").eq("target_type", "mission").is("removed_at", null);
      if (after !== null) q = q.gt("id", after);
      const { data, error } = await q.order("id", { ascending: true }).limit(EDGE_PAGE);
      if (error) return wrap(null, error);
      const rows = (data ?? []) as { id: string; mission_id: string; target_id: string }[];
      if (rows.length === 0) return { ok: true, data: out };
      for (const r of rows) out.push({ mission_id: r.mission_id, target_id: r.target_id });
      after = rows[rows.length - 1].id;
    }
    return { ok: false, error: { message: "dependency edge read exceeded its page budget" } };
  }

  type CostQuery = ReturnType<ReturnType<SupabaseClient["from"]>["select"]>;
  /**
   * Every matching cost row, keyset-paged on the event id to completion (the server row cap cannot truncate an
   * attribution), with a fail-closed page budget: a total is either complete or an error, never a silent subset.
   */
  async function costPages(filter: (q: CostQuery) => CostQuery): Promise<StoreResult<CostEventRow[]>> {
    const out: CostEventRow[] = [];
    let after: string | null = null;
    for (let pageNo = 0; pageNo < EDGE_MAX_PAGES; pageNo++) {
      let q = filter(svc.from("execution_events_with_shadow_cost").select(COST_EVENT_COLS));
      if (after !== null) q = q.gt("id", after);
      const { data, error } = await q.order("id", { ascending: true }).limit(EDGE_PAGE);
      if (error) return wrap(null, error);
      const rows = (data ?? []) as unknown as CostEventRow[];
      if (rows.length === 0) return { ok: true, data: out };
      out.push(...rows);
      after = rows[rows.length - 1].id;
    }
    return { ok: false, error: { message: "cost attribution read exceeded its page budget" } };
  }

  return {
    async eventsForMission(missionId) {
      return costPages((q) => q.eq("mission_id", missionId));
    },
    async eventsForCorrelation(type, ids) {
      const out: CostEventRow[] = [];
      // Case-insensitive equality via ILIKE with a pattern that is a validated UUID: hex digits and hyphens only, so it
      // contains no wildcard (% _ *) and no PostgREST or() syntax, and matches exactly that UUID in any letter case.
      const uuids = ids.map((id) => id.toLowerCase());
      if (!uuids.every((id) => UUID_RE.test(id))) return { ok: false, error: { message: "cost attribution needs UUID correlation ids" } };
      for (let i = 0; i < uuids.length; i += COST_ID_CHUNK) {
        const filter = uuids.slice(i, i + COST_ID_CHUNK).map((id) => `correlation_id.ilike.${id}`).join(",");
        const r = await costPages((q) => q.eq("correlation_type", type).or(filter));
        if (!r.ok) return r;
        out.push(...r.data);
      }
      return { ok: true, data: out };
    },
    async insertMission(row) {
      const { data, error } = await svc.from("missions").insert(row).select(MISSION_COLS).single();
      return wrap(data, error);
    },
    async getMission(tenantId, id) {
      const { data, error } = await svc.from("missions").select(MISSION_COLS).eq("tenant_id", tenantId).eq("id", id).maybeSingle();
      return wrap(data ?? null, error);
    },
    async listMissions(q) {
      let b = svc.from("missions").select(MISSION_COLS).eq("tenant_id", q.tenantId);
      if (q.state) b = b.eq("state", q.state);
      if (q.owner) b = b.eq("owner", q.owner);
      if (q.beforeRef !== undefined) b = b.lt("ref", q.beforeRef);
      const { data, error } = await b.order("ref", { ascending: false }).limit(q.limit);
      return wrap(data ?? [], error);
    },
    async listLinks(missionId, includeRemoved) {
      // The complete link set, never a server-capped first page: keyset pages on the immutable id until an empty
      // page, with the same fail-closed budget as the edge walk. Returned in creation order.
      const out: LinkRow[] = [];
      let after: string | null = null;
      for (let pageNo = 0; pageNo < EDGE_MAX_PAGES; pageNo++) {
        let b = svc.from("mission_links").select(LINK_COLS).eq("mission_id", missionId);
        if (!includeRemoved) b = b.is("removed_at", null);
        if (after !== null) b = b.gt("id", after);
        const { data, error } = await b.order("id", { ascending: true }).limit(EDGE_PAGE);
        if (error) return wrap(null, error);
        const rows = (data ?? []) as LinkRow[];
        if (rows.length === 0) {
          out.sort((x, y) => (x.created_at < y.created_at ? -1 : x.created_at > y.created_at ? 1 : x.id < y.id ? -1 : 1));
          return { ok: true, data: out };
        }
        out.push(...rows);
        after = rows[rows.length - 1].id;
      }
      return { ok: false, error: { message: "mission link read exceeded its page budget" } };
    },
    async listEvents(missionId, limit) {
      const { data, error } = await svc.from("mission_events").select(EVENT_COLS).eq("mission_id", missionId)
        .order("seq", { ascending: false }).limit(limit);
      return wrap((data ?? []).slice().reverse(), error);
    },
    // Both M1 functions return one public.missions row. .single() asks PostgREST for an object rather than a
    // one-element array, and oneRow() still normalizes either shape so callers always get the row itself.
    async transition(a) {
      const { data, error } = await svc.rpc("mission_transition", {
        p_mission_id: a.id, p_to_state: a.to, p_actor: a.actor, p_actor_kind: a.actorKind,
        p_detail: a.detail, p_expected_from: a.expectedFrom,
      }).single();
      return error ? wrap(null, error) : oneRow(data);
    },
    async reassign(a) {
      const { data, error } = await svc.rpc("mission_reassign", {
        p_mission_id: a.id, p_owner: a.owner, p_owner_kind: a.ownerKind, p_agent_ids: a.agentIds,
        p_actor: a.actor, p_actor_kind: a.actorKind,
      }).single();
      return error ? wrap(null, error) : oneRow(data);
    },
    async insertLink(row) {
      const { data, error } = await svc.from("mission_links").insert(row).select(LINK_COLS).single();
      return wrap(data, error);
    },
    async tombstoneLink(a) {
      // removed_at is set by the M1 guard (now()); the value sent only has to be non-null.
      const { data, error } = await svc.from("mission_links")
        .update({ removed_at: new Date().toISOString(), removed_by: a.by, removed_by_kind: a.byKind })
        .eq("id", a.linkId).eq("mission_id", a.missionId).is("removed_at", null)
        .select(LINK_COLS).maybeSingle();
      return wrap(data ?? null, error);
    },
    async dependencyEdges(fromMissionIds) {
      const out: { mission_id: string; target_id: string }[] = [];
      for (const chunk of chunks(fromMissionIds)) {
        const r = await edgesFor(chunk);
        if (!r.ok) return r;
        out.push(...r.data);
      }
      return { ok: true, data: out };
    },
    async liveMissionIds(tenantId, ids) {
      const out: string[] = [];
      for (const chunk of chunks(ids)) {
        const { data, error } = await svc.from("missions").select("id").eq("tenant_id", tenantId).in("id", chunk)
          .not("state", "in", "(verified,cancelled)").limit(ID_CHUNK);
        if (error) return wrap(null, error);
        out.push(...((data ?? []) as { id: string }[]).map((r) => r.id));
      }
      return { ok: true, data: out };
    },

    async lookupTarget(tenantId, type, id) {
      switch (type) {
        case "job": {
          const { data, error } = await svc.from("jobs").select("id").eq("tenant_id", tenantId).eq("id", id).maybeSingle();
          return wrap(data ? { type, id } : null, error);
        }
        case "synthesis": {
          const { data, error } = await svc.from("messages").select("id, metadata").eq("tenant_id", tenantId).eq("id", id).maybeSingle();
          if (error) return wrap(null, error);
          const meta = (data?.metadata ?? null) as { kind?: unknown; plan?: { actions?: unknown } } | null;
          if (!data || meta?.kind !== "synthesis") return { ok: true, data: null };
          const actions = Array.isArray(meta.plan?.actions) ? meta.plan.actions.length : 0;
          return { ok: true, data: { type, id, actionCount: actions } };
        }
        case "pipeline_gate": {
          // pipeline_gate has no tenant column in the live schema; the cockpit is single-tenant.
          const { data, error } = await svc.from("pipeline_gate").select("id").eq("id", id).maybeSingle();
          return wrap(data ? { type, id } : null, error);
        }
        case "pipeline_lead": {
          const { data, error } = await svc.from("pipeline_leads").select("id").eq("tenant_id", tenantId).eq("id", id).maybeSingle();
          return wrap(data ? { type, id } : null, error);
        }
        case "chat_channel": {
          const { data, error } = await svc.from("channels").select("id").eq("tenant_id", tenantId).eq("id", id).maybeSingle();
          return wrap(data ? { type, id, notEvidence: id === commandChannelId(tenantId) } : null, error);
        }
        case "chat_message": {
          const { data, error } = await svc.from("messages").select("id, channel_id, metadata").eq("tenant_id", tenantId).eq("id", id).maybeSingle();
          const row = data as { channel_id?: string; metadata?: { kind?: unknown } | null } | null;
          const notEvidence = !!row && (row.channel_id === commandChannelId(tenantId) || row.metadata?.kind === SHADOW_KIND);
          return wrap(data ? { type, id, notEvidence } : null, error);
        }
        case "mission": {
          const { data, error } = await svc.from("missions").select("id").eq("tenant_id", tenantId).eq("id", id).maybeSingle();
          return wrap(data ? { type, id } : null, error);
        }
      }
    },
  };
}
