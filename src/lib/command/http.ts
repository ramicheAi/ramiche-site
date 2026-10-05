/**
 * P06 M5: route glue. An owner-guard success becomes the founder Mission context (missions/http missionContext, which
 * reads nothing from headers or body) plus the command store. No machine or agent mapping exists.
 */
import type { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { noStoreJson } from "@/lib/server/cockpit-chat-data";
import { missionContext } from "@/lib/missions/http";
import type { CommandCtx } from "./service";
import { supabaseCommandStore, type CommandStore } from "./store";

let storeOverride: CommandStore | null = null;
export function __setCommandStoreForTests(s: CommandStore | null): void { storeOverride = s; }

export function commandContext(owner: { ok: true; uid: string }): { ok: true; ctx: CommandCtx } | { ok: false; response: NextResponse } {
  const m = missionContext(owner);
  if (!m.ok) return m;
  const store = storeOverride ?? (() => { const svc = getSupabaseAdmin(); return svc ? supabaseCommandStore(svc) : null; })();
  if (!store) return { ok: false, response: noStoreJson({ data: null, error: { code: "not_configured", message: "Supabase not configured" } }, 503) };
  return { ok: true, ctx: { store, mission: m.ctx } };
}
