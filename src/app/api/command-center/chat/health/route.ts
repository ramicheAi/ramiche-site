import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

interface Check {
  name: string;
  ok: boolean;
  detail: string;
  fix?: string;
}

function getSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Single-URL diagnostic for the Command Center chat stack.
 *
 * Tells you exactly what's broken in Supabase right now — env, schema columns,
 * realtime publication membership, row counts per channel, and a recent message
 * sample. Use when chat is "not working".
 *
 * Visit `/api/command-center/chat/health` in the browser.
 */
export async function GET() {
  const checks: Check[] = [];
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENCLAW_GATEWAY_TOKEN: !!process.env.OPENCLAW_GATEWAY_TOKEN,
    CC_PUSH_SECRET: !!process.env.CC_PUSH_SECRET,
  };

  checks.push({
    name: "env.NEXT_PUBLIC_SUPABASE_URL",
    ok: env.NEXT_PUBLIC_SUPABASE_URL,
    detail: env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "missing",
    fix: env.NEXT_PUBLIC_SUPABASE_URL ? undefined : "Set in Vercel env. Strip any trailing newline.",
  });
  checks.push({
    name: "env.NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ok: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    detail: env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "set" : "missing",
  });
  checks.push({
    name: "env.SUPABASE_SERVICE_ROLE_KEY",
    ok: env.SUPABASE_SERVICE_ROLE_KEY,
    detail: env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "missing",
    fix: env.SUPABASE_SERVICE_ROLE_KEY
      ? undefined
      : "Required for server-side reads/inserts. Without it, chat search, pulse, and agent push all fail silently.",
  });

  const svc = getSupabaseService();
  if (!svc) {
    return NextResponse.json(
      {
        ok: false,
        env,
        checks,
        summary: "Service role not configured — cannot probe further.",
      },
      { status: 200 }
    );
  }

  // Channels probe
  let channels: Array<{ id: string; slug: string | null; name: string | null; type: string | null; messageCount: number; latestAt: string | null }> = [];
  try {
    const { data, error } = await svc
      .from("channels")
      .select("id, slug, name, type")
      .eq("tenant_id", TENANT_ID);
    if (error) {
      checks.push({ name: "channels.read", ok: false, detail: error.message, fix: "Run command-center-migration.sql against your Supabase project." });
    } else {
      checks.push({
        name: "channels.read",
        ok: true,
        detail: `${data?.length ?? 0} channels`,
        fix: (data?.length ?? 0) === 0 ? "Seed channels — chat falls back to DEFAULT_CHANNELS UUIDs which won't have messages." : undefined,
      });
      channels = (data ?? []).map((c) => ({
        id: c.id as string,
        slug: (c.slug as string) ?? null,
        name: (c.name as string) ?? null,
        type: (c.type as string) ?? null,
        messageCount: 0,
        latestAt: null,
      }));
    }
  } catch (e) {
    checks.push({ name: "channels.read", ok: false, detail: String(e) });
  }

  // Messages probe — column presence + per-channel counts
  let messagesColumnPinnedOk = false;
  let messagesTotal = 0;
  try {
    const { count, error } = await svc
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID);
    if (error) {
      checks.push({ name: "messages.read", ok: false, detail: error.message, fix: "Run command-center-migration.sql or check RLS." });
    } else {
      messagesTotal = count ?? 0;
      checks.push({
        name: "messages.read",
        ok: true,
        detail: `${messagesTotal} messages total`,
        fix: messagesTotal === 0 ? "No messages — chat will appear empty until at least one row exists." : undefined,
      });
    }
  } catch (e) {
    checks.push({ name: "messages.read", ok: false, detail: String(e) });
  }

  // Column probes: `pinned`, `thread_parent_id`, `attachments`
  for (const col of ["pinned", "thread_parent_id", "attachments", "sender_type", "sender_agent_id"]) {
    try {
      const { error } = await svc.from("messages").select(col).limit(1);
      const ok = !error;
      if (col === "pinned") messagesColumnPinnedOk = ok;
      checks.push({
        name: `messages.column.${col}`,
        ok,
        detail: ok ? "exists" : (error?.message ?? "missing"),
        fix: ok
          ? undefined
          : col === "pinned"
            ? "ALTER TABLE messages ADD COLUMN pinned boolean DEFAULT false;"
            : col === "thread_parent_id"
              ? "ALTER TABLE messages ADD COLUMN thread_parent_id uuid REFERENCES messages(id) ON DELETE CASCADE;"
              : `ALTER TABLE messages ADD COLUMN ${col} ...`,
      });
    } catch (e) {
      checks.push({ name: `messages.column.${col}`, ok: false, detail: String(e) });
    }
  }

  // Per-channel counts (only top 8 channels by id)
  if (channels.length > 0) {
    await Promise.all(
      channels.slice(0, 8).map(async (c) => {
        try {
          const { count } = await svc
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("channel_id", c.id);
          c.messageCount = count ?? 0;
        } catch {
          /* ignore */
        }
        try {
          const { data } = await svc
            .from("messages")
            .select("created_at")
            .eq("channel_id", c.id)
            .order("created_at", { ascending: false })
            .limit(1);
          if (data && data[0]) c.latestAt = (data[0].created_at as string) ?? null;
        } catch {
          /* ignore */
        }
      })
    );
  }

  // Realtime publication probe — checks pg_publication_tables for `messages`
  let realtimeMessagesOk: boolean | null = null;
  let realtimeReactionsOk: boolean | null = null;
  let realtimeDetail = "could not probe (need rpc)";
  try {
    const { data: rpcData, error: rpcErr } = await svc.rpc("pg_publication_tables_for", { pub: "supabase_realtime" });
    if (!rpcErr && Array.isArray(rpcData)) {
      const names = rpcData.map((r: { tablename?: string }) => r.tablename ?? "");
      realtimeMessagesOk = names.includes("messages");
      realtimeReactionsOk = names.includes("message_reactions") || names.includes("reactions");
      realtimeDetail = `publication tables: ${names.join(", ") || "(none)"}`;
    } else if (rpcErr) {
      realtimeDetail = `rpc error: ${rpcErr.message}`;
    }
  } catch (e) {
    realtimeDetail = `rpc failed: ${String(e)}`;
  }
  if (realtimeMessagesOk !== null) {
    checks.push({
      name: "realtime.publication.messages",
      ok: realtimeMessagesOk,
      detail: realtimeDetail,
      fix: realtimeMessagesOk
        ? undefined
        : "ALTER PUBLICATION supabase_realtime ADD TABLE messages; (run in Supabase SQL editor)",
    });
  }
  if (realtimeReactionsOk !== null) {
    checks.push({
      name: "realtime.publication.message_reactions",
      ok: realtimeReactionsOk,
      detail: realtimeDetail,
      fix: realtimeReactionsOk
        ? undefined
        : "ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;",
    });
  }

  // Recent sample
  let recentSample: Array<{ id: string; channel: string; sender: string; content: string; createdAt: string }> = [];
  try {
    const { data } = await svc
      .from("messages")
      .select("id, channel_id, sender_type, sender_agent_id, content, created_at")
      .eq("tenant_id", TENANT_ID)
      .order("created_at", { ascending: false })
      .limit(5);
    recentSample = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      channel: (r.channel_id as string) ?? "",
      sender: ((r.sender_type as string) ?? "?") + ":" + ((r.sender_agent_id as string) ?? "user"),
      content: ((r.content as string) ?? "").slice(0, 120),
      createdAt: (r.created_at as string) ?? "",
    }));
  } catch {
    /* ignore */
  }

  const failures = checks.filter((c) => !c.ok);
  const verdict =
    failures.length === 0
      ? "all_green"
      : failures.some((f) => f.name.startsWith("env.") || f.name === "channels.read" || f.name === "messages.read")
        ? "broken"
        : "degraded";

  return NextResponse.json({
    ok: verdict !== "broken",
    verdict,
    env,
    checks,
    channels,
    messagesTotal,
    messagesColumnPinnedOk,
    recentSample,
    nextSteps: failures.filter((f) => f.fix).map((f) => `${f.name}: ${f.fix}`),
  });
}
