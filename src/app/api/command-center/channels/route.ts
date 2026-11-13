import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sanitizeDbError } from "@/lib/chat-persistence";
import { ownerOnly } from "@/lib/server/command-center-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/command-center/channels
 *
 * Owner-gated server-side channel list, replacing the chat page's direct
 * anon-client read of public.channels (zero anon/authenticated privileges
 * since the P05-B3 lockdown — see conversations/[id]/messages/route.ts for
 * the full rationale). A read failure here is reported as a failure; the
 * chat page falls back to its hardcoded defaults only when it actually
 * receives an empty/missing list, never when the request itself failed.
 */
async function GET_handler() {
  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json(
      { error: { code: "not_configured", message: "Supabase service role not configured" } },
      { status: 503 }
    );
  }

  const { data, error } = await db
    .from("channels")
    .select("*")
    .order("last_activity_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: sanitizeDbError(error) }, { status: 502 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export const GET = ownerOnly(GET_handler);
