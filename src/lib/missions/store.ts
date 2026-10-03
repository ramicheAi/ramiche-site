/**
 * P06 M2: the storage port for Missions, and its Supabase (service_role) adapter.
 *
 * The adapter is deliberately thin: one call per method, tenant filter on every mission read, state changes only
 * through the M1 SECURITY DEFINER functions (mission_transition, mission_reassign), links only inserted or
 * tombstoned. All policy lives in service.ts; all integrity rules the database can hold stay in M1's triggers.
 * Errors keep the Postgres SQLSTATE so service.ts can map M1's MIxxx codes precisely.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
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

export type ListQuery = { tenantId: string; state?: MissionState; owner?: string; beforeRef?: number; limit: number };

/** What a resolver needs to know about a database-backed target. Only existence and a few typed facts. */
export type TargetRecord =
  | { type: "job"; id: string }
  | { type: "synthesis"; id: string; actionCount: number }
  | { type: "pipeline_gate"; id: string }
  | { type: "pipeline_lead"; id: string }
  | { type: "chat_channel"; id: string }
  | { type: "chat_message"; id: string }
  | { type: "mission"; id: string };

export type DbTargetType = TargetRecord["type"];

export interface MissionStore {
  insertMission(row: NewMission): Promise<StoreResult<MissionRow>>;
  getMission(tenantId: string, id: string): Promise<StoreResult<MissionRow | null>>;
  listMissions(q: ListQuery): Promise<StoreResult<MissionRow[]>>;
  listLinks(missionId: string, includeRemoved: boolean): Promise<StoreResult<LinkRow[]>>;
  listEvents(missionId: string, limit: number): Promise<StoreResult<EventRow[]>>;
  transition(a: { id: string; to: MissionState; actor: string; actorKind: ActorKind; detail: Record<string, unknown>; expectedFrom: MissionState | null }): Promise<StoreResult<MissionRow>>;
  reassign(a: { id: string; owner: string; ownerKind: "human" | "agent"; agentIds: string[]; actor: string; actorKind: ActorKind }): Promise<StoreResult<MissionRow>>;
  insertLink(row: NewLink): Promise<StoreResult<LinkRow>>;
  /** Tombstones one live link of one mission. Returns null when no such live link exists. */
  tombstoneLink(a: { missionId: string; linkId: string; by: string; byKind: ActorKind }): Promise<StoreResult<LinkRow | null>>;
  /** Live mission->mission dependency edges leaving any of these missions. */
  dependencyEdges(fromMissionIds: string[]): Promise<StoreResult<{ mission_id: string; target_id: string }[]>>;
  /** Existence (and typed facts) of a database-backed target inside the tenant. null = does not exist. */
  lookupTarget(tenantId: string, type: DbTargetType, id: string): Promise<StoreResult<TargetRecord | null>>;
}

/** Page size for edge reads; must not exceed the PostgREST max-rows setting (1000 by default). */
export const EDGE_PAGE = 500;

const MISSION_COLS = "id, ref, tenant_id, objective, owner, owner_kind, agent_ids, success_criteria, deliverables, state, created_by, created_by_kind, created_at, updated_at";
const LINK_COLS = "id, mission_id, target_type, target_id, target_index, relation, criterion_id, created_by, created_by_kind, created_at, removed_at, removed_by, removed_by_kind";
const EVENT_COLS = "id, mission_id, seq, kind, from_state, to_state, actor, actor_kind, detail, created_at";

type PgErr = { code?: string; message?: string } | null;
function wrap<T>(data: unknown, error: PgErr): StoreResult<T> {
  if (error) return { ok: false, error: { code: error.code, message: error.message ?? "database error" } };
  return { ok: true, data: data as T };
}

export function supabaseMissionStore(svc: SupabaseClient): MissionStore {
  return {
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
      let b = svc.from("mission_links").select(LINK_COLS).eq("mission_id", missionId);
      if (!includeRemoved) b = b.is("removed_at", null);
      const { data, error } = await b.order("created_at", { ascending: true });
      return wrap(data ?? [], error);
    },
    async listEvents(missionId, limit) {
      const { data, error } = await svc.from("mission_events").select(EVENT_COLS).eq("mission_id", missionId)
        .order("seq", { ascending: false }).limit(limit);
      return wrap((data ?? []).slice().reverse(), error);
    },
    async transition(a) {
      const { data, error } = await svc.rpc("mission_transition", {
        p_mission_id: a.id, p_to_state: a.to, p_actor: a.actor, p_actor_kind: a.actorKind,
        p_detail: a.detail, p_expected_from: a.expectedFrom,
      });
      return wrap(data, error);
    },
    async reassign(a) {
      const { data, error } = await svc.rpc("mission_reassign", {
        p_mission_id: a.id, p_owner: a.owner, p_owner_kind: a.ownerKind, p_agent_ids: a.agentIds,
        p_actor: a.actor, p_actor_kind: a.actorKind,
      });
      return wrap(data, error);
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
      if (fromMissionIds.length === 0) return { ok: true, data: [] };
      // Paged to completion: PostgREST caps a response (1000 rows by default), and a silently truncated edge set
      // would let the cycle walk miss a path. Ordered by id so pages are stable.
      const out: { mission_id: string; target_id: string }[] = [];
      for (let from = 0; ; from += EDGE_PAGE) {
        const { data, error } = await svc.from("mission_links").select("mission_id, target_id")
          .in("mission_id", fromMissionIds).eq("relation", "dependency").eq("target_type", "mission").is("removed_at", null)
          .order("id", { ascending: true }).range(from, from + EDGE_PAGE - 1);
        if (error) return wrap(null, error);
        const rows = (data ?? []) as { mission_id: string; target_id: string }[];
        out.push(...rows);
        if (rows.length < EDGE_PAGE) return { ok: true, data: out };
      }
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
          return wrap(data ? { type, id } : null, error);
        }
        case "chat_message": {
          const { data, error } = await svc.from("messages").select("id").eq("tenant_id", tenantId).eq("id", id).maybeSingle();
          return wrap(data ? { type, id } : null, error);
        }
        case "mission": {
          const { data, error } = await svc.from("missions").select("id").eq("tenant_id", tenantId).eq("id", id).maybeSingle();
          return wrap(data ? { type, id } : null, error);
        }
      }
    },
  };
}
