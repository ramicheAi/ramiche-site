/**
 * P06 M2: the only glue between a route handler and the Mission layer. Routes call their owner guard first (the P03
 * coverage test requires it), then hand the guard result here. Nothing in this file decides policy.
 */
import type { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { CC_TENANT_ID, noStoreJson } from "@/lib/server/cockpit-chat-data";
import { FOUNDER } from "./principal";
import type { Ctx } from "./service";
import { supabaseMissionStore, type MissionStore } from "./store";
import type { MissionResult } from "./types";

/** Test seam: route tests inject a store; production always builds the service_role adapter. */
let storeOverride: MissionStore | null = null;
export function __setMissionStoreForTests(s: MissionStore | null): void { storeOverride = s; }

/**
 * Only an owner-guard success (guardPrivateRead / guardProtectedMutation) can be turned into a Mission context, and it
 * always becomes the founder. There is no machine or agent mapping: nothing in the request headers or body is read.
 */
export function missionContext(owner: { ok: true; uid: string }): { ok: true; ctx: Ctx } | { ok: false; response: NextResponse } {
  if (!owner || owner.ok !== true || typeof owner.uid !== "string" || !owner.uid) {
    return { ok: false, response: noStoreJson({ error: "denied" }, 403) };
  }
  const store = storeOverride ?? (() => { const svc = getSupabaseAdmin(); return svc ? supabaseMissionStore(svc) : null; })();
  if (!store) return { ok: false, response: noStoreJson({ data: null, error: { code: "not_configured", message: "Supabase not configured" } }, 503) };
  return { ok: true, ctx: { store, tenantId: CC_TENANT_ID, principal: FOUNDER } };
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
