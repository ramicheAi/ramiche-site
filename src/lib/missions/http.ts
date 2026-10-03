/**
 * P06 M2: the only glue between a route handler and the Mission layer. Routes call their guard first (the coverage
 * tests require it), then hand the guard result here. Nothing in this file decides policy.
 */
import type { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { CC_TENANT_ID, noStoreJson } from "@/lib/server/cockpit-chat-data";
import { agentPrincipalFrom, FOUNDER, type Principal } from "./principal";
import type { Ctx } from "./service";
import { supabaseMissionStore, type MissionStore } from "./store";
import type { MissionResult } from "./types";

/** Test seam: route tests inject a store; production always builds the service_role adapter. */
let storeOverride: MissionStore | null = null;
export function __setMissionStoreForTests(s: MissionStore | null): void { storeOverride = s; }

type Auth = { ok: true; kind: "owner"; uid: string } | { ok: true; kind: "service"; principal: string };

/**
 * Owner session -> founder. Missions machine credential -> the registered agent named in x-parallax-agent, or a
 * 403 when it names none. No other mapping exists.
 */
export function missionContext(auth: Auth, req: Request): { ok: true; ctx: Ctx } | { ok: false; response: NextResponse } {
  let principal: Principal | null;
  if (auth.kind === "owner") principal = FOUNDER;
  else principal = auth.principal === "service:missions" ? agentPrincipalFrom(req.headers) : null;
  if (!principal) {
    return { ok: false, response: noStoreJson({ data: null, error: { code: "unknown_agent", message: "x-parallax-agent must name a registered active agent" } }, 403) };
  }
  const store = storeOverride ?? (() => { const svc = getSupabaseAdmin(); return svc ? supabaseMissionStore(svc) : null; })();
  if (!store) return { ok: false, response: noStoreJson({ data: null, error: { code: "not_configured", message: "Supabase not configured" } }, 503) };
  return { ok: true, ctx: { store, tenantId: CC_TENANT_ID, principal } };
}

export async function jsonObject(req: Request): Promise<Record<string, unknown> | NextResponse> {
  try {
    const text = await req.text();
    if (text.length > 64 * 1024) throw new Error("too large");
    const parsed = text ? JSON.parse(text) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    return parsed as Record<string, unknown>;
  } catch {
    return noStoreJson({ data: null, error: { code: "invalid_json", message: "body must be a JSON object under 64 KB" } }, 400);
  }
}

export function respond<T>(r: MissionResult<T>): NextResponse {
  return r.ok
    ? noStoreJson({ data: r.data, error: null }, r.status)
    : noStoreJson({ data: null, error: { code: r.code, message: r.message } }, r.status);
}
