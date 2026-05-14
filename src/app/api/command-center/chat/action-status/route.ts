/**
 * Phase D — Action status updates on a synthesis plan.
 *
 * POST /api/command-center/chat/action-status
 *   body: {
 *     synthesisId: string,           // uuid of the synthesis message
 *     actionIndex: number,           // 0-based index into metadata.plan.actions
 *     status: "pending"|"in_progress"|"done"|"blocked"|"cancelled",
 *     note?: string                  // optional one-line note posted to the channel
 *   }
 *
 * The status is persisted on the synthesis row itself in
 * metadata.action_statuses (parallel array to plan.actions). When the action
 * transitions to "done" or "blocked", a small system-style message is also
 * inserted into the channel from the owner agent so everyone sees the
 * progress without having to open the Decisions page.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AGENT_DM_UUID } from "@/lib/cc-agent-dm-uuids";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

const VALID_STATUSES = ["pending", "in_progress", "done", "blocked", "cancelled"] as const;
type ActionStatus = (typeof VALID_STATUSES)[number];

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

export async function GET() {
  return NextResponse.json({ ok: true, accepts: ["POST"] });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      synthesisId?: string;
      actionIndex?: number;
      status?: string;
      note?: string;
    };

    if (!body.synthesisId || !/^[0-9a-f-]{36}$/i.test(body.synthesisId)) {
      return NextResponse.json({ ok: false, error: "synthesisId required (uuid)" }, { status: 400 });
    }
    if (typeof body.actionIndex !== "number" || body.actionIndex < 0) {
      return NextResponse.json(
        { ok: false, error: "actionIndex required (non-negative integer)" },
        { status: 400 }
      );
    }
    if (!body.status || !(VALID_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json(
        { ok: false, error: `status must be one of ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    const newStatus = body.status as ActionStatus;

    const svc = getSupabaseService();
    if (!svc) {
      return NextResponse.json(
        { ok: false, error: "Supabase service role not configured" },
        { status: 500 }
      );
    }

    const { data: row, error: readErr } = await svc
      .from("messages")
      .select("id, channel_id, metadata, tenant_id")
      .eq("id", body.synthesisId)
      .single();
    if (readErr || !row) {
      return NextResponse.json(
        { ok: false, error: `synthesis not found: ${readErr?.message || "no row"}` },
        { status: 404 }
      );
    }
    const meta = (row.metadata as Record<string, unknown> | null) ?? {};
    if (meta.kind !== "synthesis") {
      return NextResponse.json({ ok: false, error: "row is not a synthesis" }, { status: 400 });
    }
    const plan = meta.plan as { actions?: Array<{ owner?: string; task?: string }> } | undefined;
    if (!plan || !Array.isArray(plan.actions) || body.actionIndex >= plan.actions.length) {
      return NextResponse.json(
        { ok: false, error: "actionIndex out of bounds for this plan" },
        { status: 400 }
      );
    }
    const action = plan.actions[body.actionIndex];

    // Build a parallel array — slot N tracks the status of plan.actions[N].
    // Missing/old entries default to "pending" so the UI is well-defined for
    // historical synthesis rows that don't have this field yet.
    const existing = (Array.isArray(meta.action_statuses) ? meta.action_statuses : []) as string[];
    const statuses: ActionStatus[] = [];
    for (let i = 0; i < plan.actions.length; i++) {
      const prior = existing[i];
      const valid =
        typeof prior === "string" && (VALID_STATUSES as readonly string[]).includes(prior)
          ? (prior as ActionStatus)
          : "pending";
      statuses[i] = valid;
    }
    statuses[body.actionIndex] = newStatus;

    const transitionedAt = new Date().toISOString();
    const updatedMeta = {
      ...meta,
      action_statuses: statuses,
      // Track the last transition for the Decisions page progress bar.
      action_status_updated_at: transitionedAt,
    };
    const { error: updErr } = await svc
      .from("messages")
      .update({ metadata: updatedMeta })
      .eq("id", row.id);
    if (updErr) {
      console.error("[action-status] update error:", updErr);
      return NextResponse.json(
        { ok: false, error: `update failed: ${updErr.message}` },
        { status: 500 }
      );
    }

    // When an action moves to a terminal/notable state, post a short status
    // line into the channel from the OWNER agent. This is what keeps the
    // chat readable as a real conversation — Ramon sees "✓ done" from each
    // person without leaving the channel.
    const owner = String(action?.owner || "").toLowerCase();
    const ownerUUID =
      AGENT_DM_UUID[owner] || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const shouldAnnounce = newStatus === "done" || newStatus === "blocked";
    if (shouldAnnounce && row.channel_id) {
      const noteLine = body.note?.trim() ? ` — ${body.note.trim().slice(0, 240)}` : "";
      const verb =
        newStatus === "done" ? "shipped" : newStatus === "blocked" ? "is blocked on" : newStatus;
      const taskLine = String(action?.task || "the assigned action").slice(0, 200);
      const content =
        newStatus === "done"
          ? `✓ Done: ${taskLine}${noteLine}`
          : `⚠ Blocked: ${verb} ${taskLine}${noteLine}`;
      const { error: insertErr } = await svc.from("messages").insert({
        channel_id: row.channel_id,
        sender_agent_id: ownerUUID,
        sender_type: "agent",
        content,
        tenant_id: row.tenant_id || TENANT_ID,
        attachments: [],
        status: "sent",
        metadata: {
          kind: "task_status",
          synthesis_id: row.id,
          action_index: body.actionIndex,
          new_status: newStatus,
          owner,
        },
      });
      if (insertErr) {
        console.error("[action-status] status announce insert failed:", insertErr);
      }
    }

    return NextResponse.json({
      ok: true,
      synthesisId: row.id,
      actionIndex: body.actionIndex,
      status: newStatus,
      action_statuses: statuses,
      transitionedAt,
    });
  } catch (e) {
    console.error("[action-status] unexpected:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
