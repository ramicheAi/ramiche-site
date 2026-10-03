/**
 * P06 M2: shared Mission types. The shapes mirror the M1 tables (supabase/migrations/20261003120000_mission_identity_m1.sql)
 * exactly; nothing here adds a column or a state.
 */

export const MISSION_STATES = [
  "intent", "plan", "approved", "executing", "reviewing", "completed", "verified", "cancelled",
] as const;
export type MissionState = (typeof MISSION_STATES)[number];

export const TARGET_TYPES = [
  "job", "synthesis", "synthesis_action", "pipeline_gate", "pipeline_lead", "chat_channel", "chat_message",
  "yolo_build", "project", "firestore_task", "git_branch", "git_commit", "pull_request", "mission", "url",
] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

export const RELATIONS = [
  "context", "task", "dependency", "approval", "evidence", "deliverable", "branch", "source",
] as const;
export type Relation = (typeof RELATIONS)[number];

export type ActorKind = "human" | "agent" | "system";

export type Item = { id: string; text: string };

export type MissionRow = {
  id: string;
  ref: number;
  tenant_id: string;
  objective: string;
  owner: string;
  owner_kind: "human" | "agent";
  agent_ids: string[];
  success_criteria: Item[];
  deliverables: Item[];
  state: MissionState;
  created_by: string;
  created_by_kind: ActorKind;
  created_at: string;
  updated_at: string;
};

export type LinkRow = {
  id: string;
  mission_id: string;
  target_type: TargetType;
  target_id: string;
  target_index: number | null;
  relation: Relation;
  criterion_id: string | null;
  created_by: string;
  created_by_kind: ActorKind;
  created_at: string;
  removed_at: string | null;
  removed_by: string | null;
  removed_by_kind: ActorKind | null;
};

export type EventRow = {
  id: string;
  mission_id: string;
  seq: number;
  kind: string;
  from_state: MissionState | null;
  to_state: MissionState | null;
  actor: string;
  actor_kind: ActorKind;
  detail: Record<string, unknown>;
  created_at: string;
};

/** A storage error carries the Postgres SQLSTATE (MIxxx from the M1 guards, or a standard code) when there is one. */
export type StoreError = { code?: string; message: string };
export type StoreResult<T> = { ok: true; data: T } | { ok: false; error: StoreError };

/** The outcome every Mission operation returns. Routes turn it into a response and add nothing. */
export type MissionResult<T> =
  | { ok: true; status: 200 | 201; data: T }
  | { ok: false; status: 400 | 403 | 404 | 409 | 422 | 502 | 503; code: string; message: string };
