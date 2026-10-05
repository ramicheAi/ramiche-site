/**
 * P06 M5: Universal Command shadow routing, founder only. Records what WOULD handle a command and nothing else:
 * no handler is invoked, no job is created, no provider or external system is called, no Mission is created or
 * changed here. Missions are created or attached by the founder through the existing M2 API (client side).
 */
import { routeCommand, isHandler } from "./router";
import type { CommandRow, CommandStore } from "./store";
import { ROUTER_VERSION, SHADOW_KIND, type ShadowDecision, type ShadowRecord } from "./types";
import type { Ctx as MissionCtx } from "@/lib/missions/service";
import { isFounder } from "@/lib/missions/principal";
import type { ProviderId } from "@/lib/provider-adapter";
import type { CommandProvider } from "./types";
import type { MissionResult } from "@/lib/missions/types";

/** Compile-time proof that every provider a shadow route names is a real Provider Adapter id (no second roster). */
type IsProviderId<T extends ProviderId> = T;
export type CheckedCommandProvider = IsProviderId<CommandProvider>;

export type CommandCtx = { store: CommandStore; mission: MissionCtx };

const CHAIN_CAP = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ok = <T>(data: T, status: 200 | 201 = 200): MissionResult<T> => ({ ok: true, status, data });
const fail = (status: 400 | 403 | 404 | 422 | 502, code: string, message: string): MissionResult<never> => ({ ok: false, status, code, message });
const storeFail = (): MissionResult<never> => fail(502, "storage_error", "command storage call failed");

/** Only the founder session reaches this layer (routes map an owner guard to the founder context). */
function founderOnly(ctx: CommandCtx): MissionResult<never> | null {
  return isFounder(ctx.mission.principal) ? null : fail(403, "founder_only", "Universal Command is founder only");
}

function toRecord(row: CommandRow, linked: ShadowRecord["linkedMissions"]): ShadowRecord | null {
  const m = row.metadata ?? {};
  if (m.kind !== SHADOW_KIND) return null;
  return {
    id: row.id, command: row.content, routedAt: String(m.routedAt ?? row.created_at), routerVersion: String(m.routerVersion ?? ""),
    shadow: true, executed: false,
    missionContext: typeof m.missionContext === "string" ? m.missionContext : null,
    supersedes: typeof m.supersedes === "string" ? m.supersedes : null,
    decision: m.decision as ShadowDecision, linkedMissions: linked,
  };
}

export async function shadowRoute(ctx: CommandCtx, body: Record<string, unknown>): Promise<MissionResult<ShadowRecord>> {
  const denied = founderOnly(ctx); if (denied) return denied;
  const extra = Object.keys(body).filter((k) => !["text", "missionId", "handlerHint", "supersedes"].includes(k));
  if (extra.length) return fail(400, "unknown_fields", `unknown fields: ${extra.join(", ")}`);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return fail(422, "invalid_text", "say what you want done");
  if ([...text].length > 2000) return fail(422, "invalid_text", "keep a command to at most 2,000 characters");
  let handlerHint: import("./types").Handler | null = null;
  if (body.handlerHint !== undefined && body.handlerHint !== null) {
    // An @agent route needs an agent name in the text, and an existing-job route needs the job id in the text;
    // editing the routing cannot pick either without its identifier.
    if (!isHandler(body.handlerHint) || body.handlerHint === "cockpit_agent") return fail(422, "invalid_handler", "unknown handler");
    if (body.handlerHint === "existing_job" && !/\bjob\s+[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(text)) {
      return fail(422, "invalid_handler", "an existing-job route needs the job id in the command");
    }
    handlerHint = body.handlerHint;
  }
  let missionId: string | null = null;
  if (body.missionId !== undefined && body.missionId !== null) {
    // Existence only, tenant-scoped (404 for anything not ours): one row, not the full detail read.
    if (typeof body.missionId !== "string" || !UUID.test(body.missionId)) return fail(404, "not_found", "mission not found");
    const m = await ctx.mission.store.getMission(ctx.mission.tenantId, body.missionId.toLowerCase());
    if (!m.ok) return storeFail();
    if (!m.data) return fail(404, "not_found", "mission not found");
    missionId = m.data.id;
  }
  let supersedes: string | null = null;
  if (body.supersedes !== undefined && body.supersedes !== null) {
    if (typeof body.supersedes !== "string" || !UUID.test(body.supersedes)) return fail(422, "invalid_supersedes", "supersedes must be a command id");
    const prev = await ctx.store.getCommand(ctx.mission.tenantId, body.supersedes.toLowerCase());
    if (!prev.ok) return storeFail();
    if (!prev.data || !toRecord(prev.data, [])) return fail(404, "not_found", "the command being re-routed does not exist");
    supersedes = prev.data.id;
  }

  const decision = routeCommand({ text, handlerHint, missionId });
  const channel = await ctx.store.commandChannel(ctx.mission.tenantId);
  if (!channel.ok) return storeFail();
  const row = await ctx.store.insertCommand({
    tenantId: ctx.mission.tenantId, channelId: channel.data, content: text,
    metadata: { kind: SHADOW_KIND, v: 1, routerVersion: ROUTER_VERSION, routedAt: new Date().toISOString(), shadow: true, executed: false, missionContext: missionId, supersedes, decision },
  });
  if (!row.ok) return storeFail();
  const rec = toRecord(row.data, []);
  return rec ? ok(rec, 201) : storeFail();
}

export async function getShadow(ctx: CommandCtx, id: unknown): Promise<MissionResult<ShadowRecord>> {
  const denied = founderOnly(ctx); if (denied) return denied;
  if (typeof id !== "string" || !UUID.test(id)) return fail(404, "not_found", "no such command");
  const row = await ctx.store.getCommand(ctx.mission.tenantId, id.toLowerCase());
  if (!row.ok) return storeFail();
  if (!row.data || !toRecord(row.data, [])) return fail(404, "not_found", "no such command");
  // A re-routed command keeps the missions its earlier routings created or were attached to: walk the supersedes chain
  // (bounded) so a re-route never hides an existing mission and invites a duplicate.
  const chain = [row.data.id];
  let prev = (row.data.metadata ?? {}).supersedes;
  for (let i = 0; i < CHAIN_CAP && typeof prev === "string" && !chain.includes(prev); i++) {
    const p = await ctx.store.getCommand(ctx.mission.tenantId, prev);
    if (!p.ok) return storeFail();
    if (!p.data || !toRecord(p.data, [])) break;
    chain.push(p.data.id);
    prev = (p.data.metadata ?? {}).supersedes;
  }
  const linked = await ctx.store.linkedMissions(ctx.mission.tenantId, chain);
  if (!linked.ok) return storeFail();
  const seen = new Set<string>();
  const unique = linked.data.filter((l) => { const k = `${l.id}|${l.relation}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return ok(toRecord(row.data, unique) as ShadowRecord);
}
