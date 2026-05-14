/**
 * Phase D — Decisions feed.
 *
 * GET /api/command-center/chat/decisions[?limit=50]
 *
 * Returns every Atlas synthesis row across every channel, hydrated with:
 *   - the parsed plan (decision, actions, risks, next_check_in)
 *   - the per-action status from metadata.action_statuses
 *   - the matching execution_ack messages (one per owner) so the Decisions
 *     page can show each agent's commitment inline
 *   - channel name (best-effort join against the channels table)
 *
 * Used by /command-center/decisions to render the cross-channel "what did
 * the team agree to" timeline.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AGENT_UUID_TO_SHORT_ID } from "@/lib/cc-agent-dm-uuids";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function cleanEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  return raw.replace(/[\s\x00-\x1f\x7f]+$/u, "").replace(/^\s+/u, "") || undefined;
}

function getSupabaseService() {
  const url = cleanEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = cleanEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(req: NextRequest) {
  const svc = getSupabaseService();
  if (!svc) {
    return NextResponse.json(
      { ok: false, error: "Supabase service role not configured" },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 5),
    200
  );

  // 1) Pull synthesis rows. We over-fetch a bit (limit * 2) then filter
  //    client-side by metadata.kind since jsonb path filters require
  //    Postgres operators that Supabase exposes inconsistently across
  //    deployments; the messages table is small enough that this is fine.
  const { data: candidates, error: synthErr } = await svc
    .from("messages")
    .select("id, channel_id, content, metadata, created_at, sender_agent_id")
    .order("created_at", { ascending: false })
    .limit(limit * 6);
  if (synthErr) {
    return NextResponse.json({ ok: false, error: synthErr.message }, { status: 500 });
  }
  const synths = (candidates ?? []).filter((m) => {
    const meta = m.metadata as Record<string, unknown> | null | undefined;
    return !!meta && meta.kind === "synthesis";
  });
  const synthIds = synths.map((s) => s.id as string).slice(0, limit);
  if (synthIds.length === 0) {
    return NextResponse.json({ ok: true, decisions: [] });
  }
  const synthsCapped = synths.slice(0, limit);
  const channelIds = Array.from(new Set(synthsCapped.map((s) => s.channel_id as string)));

  // 2) Pull all execution_ack + task_status messages that reference these
  //    synthesis ids. Same client-side filter trick as above.
  const { data: linkedRaw, error: linkedErr } = await svc
    .from("messages")
    .select("id, channel_id, content, metadata, created_at, sender_agent_id")
    .in("channel_id", channelIds)
    .order("created_at", { ascending: true });
  if (linkedErr) {
    return NextResponse.json({ ok: false, error: linkedErr.message }, { status: 500 });
  }
  const linked = (linkedRaw ?? []).filter((m) => {
    const meta = m.metadata as Record<string, unknown> | null | undefined;
    if (!meta) return false;
    const sid = typeof meta.synthesis_id === "string" ? meta.synthesis_id : null;
    return sid !== null && synthIds.includes(sid);
  });

  // Group execution_acks by (synthesis_id, owner) and task_status updates by
  // (synthesis_id, action_index, new_status) so the UI can render the chain.
  const acksBy = new Map<string, Map<string, (typeof linked)[number]>>();
  for (const m of linked) {
    const meta = m.metadata as Record<string, unknown>;
    if (meta.kind !== "execution_ack") continue;
    const sid = meta.synthesis_id as string;
    const owner = typeof meta.owner === "string" ? meta.owner.toLowerCase() : null;
    if (!owner) continue;
    if (!acksBy.has(sid)) acksBy.set(sid, new Map());
    if (!acksBy.get(sid)!.has(owner)) acksBy.get(sid)!.set(owner, m);
  }

  // 3) Channel names — best-effort. Falls back to first 8 chars of channel
  //    UUID if the channels table doesn't have a row (e.g. DM channels).
  const channelNames = new Map<string, string>();
  if (channelIds.length > 0) {
    const { data: chans } = await svc
      .from("channels")
      .select("id, name")
      .in("id", channelIds);
    for (const c of chans ?? []) {
      channelNames.set(c.id as string, (c.name as string) || (c.id as string).slice(0, 8));
    }
  }

  // 4) Shape the decision payload.
  const decisions = synthsCapped.map((row) => {
    const meta = row.metadata as Record<string, unknown>;
    const plan = meta.plan as Record<string, unknown> | undefined;
    const approvedAt = typeof meta.approved_at === "string" ? meta.approved_at : null;
    const statuses = Array.isArray(meta.action_statuses) ? (meta.action_statuses as string[]) : [];
    const sid = row.id as string;
    const ackMap = acksBy.get(sid) ?? new Map<string, (typeof linked)[number]>();
    const acks: Array<{
      owner: string;
      content: string;
      via?: string;
      createdAt: string;
    }> = [];
    for (const [owner, ackRow] of ackMap.entries()) {
      const ackMeta = ackRow.metadata as Record<string, unknown>;
      acks.push({
        owner,
        content: (ackRow.content as string) || "",
        via: typeof ackMeta.via === "string" ? (ackMeta.via as string) : undefined,
        createdAt: ackRow.created_at as string,
      });
    }
    const senderId = row.sender_agent_id as string;
    const synthesisAuthor =
      AGENT_UUID_TO_SHORT_ID[senderId] || (senderId ? senderId.slice(0, 8) : "agent");

    return {
      synthesisId: sid,
      channelId: row.channel_id as string,
      channelName:
        channelNames.get(row.channel_id as string) || (row.channel_id as string).slice(0, 8),
      synthesisAuthor,
      content: row.content as string,
      createdAt: row.created_at as string,
      approvedAt,
      plan: plan
        ? {
            decision: String(plan.decision || ""),
            actions: Array.isArray(plan.actions)
              ? (plan.actions as Array<Record<string, unknown>>).map((a) => ({
                  owner: String(a.owner || ""),
                  task: String(a.task || ""),
                  deliverable: a.deliverable ? String(a.deliverable) : undefined,
                  due: a.due ? String(a.due) : undefined,
                }))
              : [],
            risks: Array.isArray(plan.risks) ? (plan.risks as string[]).map(String) : [],
            next_check_in:
              typeof plan.next_check_in === "string" ? (plan.next_check_in as string) : undefined,
          }
        : null,
      action_statuses: statuses,
      acks,
    };
  });

  return NextResponse.json({ ok: true, decisions });
}
