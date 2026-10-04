/**
 * TEST ONLY. A MissionStore that runs the same operations as the Supabase adapter, as SQL through psql against a
 * disposable local PostgreSQL 17 that has the real M1 migration applied (supabase/tests/run-m2-local.sh builds it).
 * Every call runs `set role service_role`, so the M1 grants, RLS and guard triggers apply exactly as in production.
 * Never point this at a remote database: the harness refuses any host that is not a local socket directory.
 */
import { spawn } from "node:child_process";
import type { MissionStore } from "./store";
import type { StoreResult } from "./types";

export type PgConn = { bin: string; host: string; port: string; db: string };

export function pgConnFromEnv(): PgConn | null {
  const host = process.env.M2_PG_HOST;
  if (!host || !host.startsWith("/")) return null; // a unix socket directory only: never a network host
  return { bin: process.env.M2_PG_BIN ?? "/opt/homebrew/opt/postgresql@17/bin", host, port: process.env.M2_PG_PORT ?? "55501", db: process.env.M2_PG_DB ?? "m2" };
}

/** SQL string literal. standard_conforming_strings is on, so doubling quotes is the complete escape. */
export const lit = (v: string | null | undefined): string => (v === null || v === undefined ? "null" : `'${v.replace(/'/g, "''")}'`);
const jsonLit = (v: unknown) => `${lit(JSON.stringify(v))}::jsonb`;
const arrLit = (v: string[]) => `array[${v.map(lit).join(",")}]::text[]`;

export function runSql(c: PgConn, sql: string, role: "service_role" | "postgres" = "service_role"): Promise<StoreResult<string>> {
  return new Promise((resolve) => {
    const p = spawn(`${c.bin}/psql`, ["-h", c.host, "-p", c.port, "-U", "postgres", "-d", c.db, "-X", "-q", "-t", "-A",
      "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate"], { env: { ...process.env, LC_ALL: "C" } });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => {
      if (code === 0) return resolve({ ok: true, data: out.trim() });
      const m = /ERROR:\s+([0-9A-Z]{5})/.exec(err);
      resolve({ ok: false, error: { code: m?.[1], message: err.trim() } });
    });
    p.stdin.end(`${role === "service_role" ? "set role service_role;\n" : ""}${sql}\n`);
  });
}

async function one<T>(c: PgConn, sql: string): Promise<StoreResult<T>> {
  const r = await runSql(c, sql);
  if (!r.ok) return r;
  return { ok: true, data: (r.data ? JSON.parse(r.data) : null) as T };
}

export function pgMissionStore(c: PgConn): MissionStore {
  return {
    insertMission: (row) => one(c, `with r as (insert into public.missions (tenant_id, objective, owner, owner_kind, agent_ids, success_criteria, deliverables, created_by, created_by_kind)
      values (${lit(row.tenant_id)}, ${lit(row.objective)}, ${lit(row.owner)}, ${lit(row.owner_kind)}, ${arrLit(row.agent_ids)}, ${jsonLit(row.success_criteria)}, ${jsonLit(row.deliverables)}, ${lit(row.created_by)}, ${lit(row.created_by_kind)}) returning *)
      select to_jsonb(r) from r;`),
    getMission: (tenantId, id) => one(c, `select to_jsonb(m) from public.missions m where tenant_id = ${lit(tenantId)} and id = ${lit(id)};`),
    listMissions: (q) => one(c, `select coalesce(jsonb_agg(to_jsonb(m) order by m.ref desc), '[]') from (select * from public.missions
      where tenant_id = ${lit(q.tenantId)} ${q.state ? `and state = ${lit(q.state)}` : ""} ${q.owner ? `and owner = ${lit(q.owner)}` : ""}
      ${q.beforeRef !== undefined ? `and ref < ${Number(q.beforeRef)}` : ""} order by ref desc limit ${Number(q.limit)}) m;`),
    listLinks: (missionId, includeRemoved) => one(c, `select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at), '[]') from public.mission_links l
      where mission_id = ${lit(missionId)} ${includeRemoved ? "" : "and removed_at is null"};`),
    listEvents: (missionId, limit) => one(c, `select coalesce(jsonb_agg(to_jsonb(e) order by e.seq), '[]') from (select * from public.mission_events
      where mission_id = ${lit(missionId)} order by seq desc limit ${Number(limit)}) e;`),
    transition: (a) => one(c, `select to_jsonb(t) from public.mission_transition(${lit(a.id)}::uuid, ${lit(a.to)}, ${lit(a.actor)}, ${lit(a.actorKind)}, ${jsonLit(a.detail)}, ${lit(a.expectedFrom)}) t;`),
    reassign: (a) => one(c, `select to_jsonb(t) from public.mission_reassign(${lit(a.id)}::uuid, ${lit(a.owner)}, ${lit(a.ownerKind)}, ${arrLit(a.agentIds)}, ${lit(a.actor)}, ${lit(a.actorKind)}) t;`),
    insertLink: (row) => one(c, `with r as (insert into public.mission_links (mission_id, target_type, target_id, target_index, relation, criterion_id, created_by, created_by_kind)
      values (${lit(row.mission_id)}, ${lit(row.target_type)}, ${lit(row.target_id)}, ${row.target_index === null ? "null" : Number(row.target_index)}, ${lit(row.relation)}, ${lit(row.criterion_id)}, ${lit(row.created_by)}, ${lit(row.created_by_kind)}) returning *)
      select to_jsonb(r) from r;`),
    tombstoneLink: (a) => one(c, `with r as (update public.mission_links set removed_at = now(), removed_by = ${lit(a.by)}, removed_by_kind = ${lit(a.byKind)}
      where id = ${lit(a.linkId)} and mission_id = ${lit(a.missionId)} and removed_at is null returning *) select to_jsonb(r) from r;`),
    dependencyEdges: (ids) => ids.length === 0 ? Promise.resolve({ ok: true, data: [] }) : one(c, `select coalesce(jsonb_agg(jsonb_build_object('mission_id', mission_id, 'target_id', target_id)), '[]')
      from public.mission_links where mission_id = any(${arrLit(ids)}::uuid[]) and relation = 'dependency' and target_type = 'mission' and removed_at is null;`),
    liveMissionIds: (tenantId, ids) => ids.length === 0 ? Promise.resolve({ ok: true, data: [] }) : one(c, `select coalesce(jsonb_agg(id), '[]') from public.missions
      where tenant_id = ${lit(tenantId)} and id = any(${arrLit(ids)}::uuid[]) and state not in ('verified','cancelled');`),
    // The production adapter reads these tables as service_role (which bypasses RLS); the harness grants the same reads.
    lookupTarget: async (tenantId, type, id) => {
      const q: Record<string, string> = {
        job: `select jsonb_build_object('type','job','id',id) from public.jobs where tenant_id = ${lit(tenantId)} and id = ${lit(id)}`,
        synthesis: `select case when metadata->>'kind' = 'synthesis' then jsonb_build_object('type','synthesis','id',id,'actionCount', coalesce(jsonb_array_length(case when jsonb_typeof(metadata->'plan'->'actions') = 'array' then metadata->'plan'->'actions' end), 0)) end from public.messages where tenant_id = ${lit(tenantId)} and id = ${lit(id)}`,
        pipeline_gate: `select jsonb_build_object('type','pipeline_gate','id',id) from public.pipeline_gate where id = ${lit(id)}`,
        pipeline_lead: `select jsonb_build_object('type','pipeline_lead','id',id) from public.pipeline_leads where tenant_id = ${lit(tenantId)} and id = ${lit(id)}`,
        chat_channel: `select jsonb_build_object('type','chat_channel','id',id) from public.channels where tenant_id = ${lit(tenantId)} and id = ${lit(id)}`,
        chat_message: `select jsonb_build_object('type','chat_message','id',id) from public.messages where tenant_id = ${lit(tenantId)} and id = ${lit(id)}`,
        mission: `select jsonb_build_object('type','mission','id',id) from public.missions where tenant_id = ${lit(tenantId)} and id = ${lit(id)}`,
      };
      return one(c, q[type] + ";");
    },
  };
}
