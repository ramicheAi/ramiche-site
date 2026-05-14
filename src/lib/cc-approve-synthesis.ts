/**
 * Shared synthesis approval + handoff dispatch (Phase C).
 * Used by POST /api/command-center/chat/approve and Telegram webhook.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  gatewaySessionsSend,
  isOpenClawGatewayConfigured,
  resolveChatSessionKey,
} from "@/lib/openclaw-gateway";
import { AGENT_DM_UUID } from "@/lib/cc-agent-dm-uuids";

export const TENANT_ID = "11111111-1111-1111-1111-111111111111";

export type ActionItem = {
  owner: string;
  task: string;
  deliverable?: string;
  due?: string;
};

export type SynthesisPlan = {
  decision: string;
  actions: ActionItem[];
  risks?: string[];
  next_check_in?: string;
};

export type ApproveResult =
  | {
      ok: true;
      alreadyApproved?: boolean;
      approvedAt?: string;
      dispatched?: number;
      total?: number;
      handoffs?: Array<{ owner: string; text: string; via: string }>;
      failures?: Array<{ owner: string; error: string }>;
    }
  | { ok: false; error: string; status?: number };

function cleanEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const cleaned = raw.replace(/[\s\x00-\x1f\x7f]+$/u, "").replace(/^\s+/u, "");
  return cleaned || undefined;
}

export function getSupabaseServiceForApprove(): SupabaseClient | null {
  const url = cleanEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = cleanEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const AGENT_MODEL_TIER: Record<string, "opus" | "sonnet" | "haiku"> = {
  atlas: "opus",
  themis: "sonnet",
  drstrange: "sonnet",
  simons: "sonnet",
  kiyosaki: "sonnet",
  proximon: "sonnet",
  widow: "sonnet",
  shuri: "sonnet",
  aetherion: "sonnet",
  selah: "sonnet",
  prophets: "sonnet",
  mercury: "sonnet",
  vee: "sonnet",
  ink: "sonnet",
  echo: "sonnet",
  haven: "sonnet",
  michael: "sonnet",
  themaestro: "sonnet",
  nova: "sonnet",
  triage: "haiku",
};

function modelForAgent(agentId: string): string {
  const tier = AGENT_MODEL_TIER[agentId.toLowerCase()] ?? "sonnet";
  if (tier === "opus") return cleanEnv("CC_CLAUDE_MODEL_OPUS") || "claude-opus-4-6";
  if (tier === "sonnet") return cleanEnv("CC_CLAUDE_MODEL_SONNET") || "claude-sonnet-4-6";
  return cleanEnv("CC_CLAUDE_MODEL_HAIKU") || "claude-haiku-4-5";
}

function displayName(agentId: string): string {
  if (!agentId) return "Agent";
  return agentId.charAt(0).toUpperCase() + agentId.slice(1);
}

function buildHandoffPrompt(
  owner: string,
  action: ActionItem,
  plan: SynthesisPlan,
  channelName: string | undefined
): string {
  const name = displayName(owner);
  const peers = plan.actions
    .filter((a) => a.owner.toLowerCase() !== owner.toLowerCase())
    .map((a) => `  - @${a.owner}: ${a.task}${a.due ? ` (by ${a.due})` : ""}`)
    .join("\n");

  return [
    `You are ${name}. Speak in first person as ${name} would — direct, operational, in your own voice. Never break character to describe yourself as an AI, assistant, or external model; you are simply ${name} on this team, replying to a teammate. If asked who you are, say ${name}.`,
    "",
    `Atlas just wrapped a${channelName ? ` ${channelName}` : ""} planning sync and you've taken the lead on one workstream:`,
    "",
    `  • What you said you'd do: ${action.task}`,
    action.deliverable ? `  • Deliverable: ${action.deliverable}` : "",
    action.due ? `  • By when: ${action.due}` : "",
    "",
    `The whole-team decision Atlas landed on: ${plan.decision}`,
    "",
    peers ? `Other people running pieces in parallel (so you know who to coordinate with):\n${peers}` : "",
    plan.risks && plan.risks.length > 0
      ? `\nThings the room flagged as risk:\n${plan.risks.map((r) => `  - ${r}`).join("\n")}`
      : "",
    "",
    `Reply to the group now, sounding like yourself. Cover, in roughly this order:`,
    `  1) Quick confirm you've got it (or flag if something's off).`,
    `  2) The first 3 things you'll do tomorrow morning to start.`,
    `  3) What you need from anyone else — name them with @handle.`,
    `  4) Any blocker you can already see from your seat.`,
    "",
    `Under 100 words. Plain text — no headers, no bullets unless you really need them.`,
  ]
    .filter((l) => l !== null && l !== undefined)
    .join("\n");
}

async function dispatchHandoff(
  owner: string,
  prompt: string
): Promise<{ ok: true; text: string; via: "openclaw" | "claude-max" | "lm-studio" } | { ok: false; error: string }> {
  const openclawPrimary =
    process.env.OPENCLAW_CHAT_PRIMARY === "1" ||
    process.env.OPENCLAW_CHAT_PRIMARY === "true";
  if (openclawPrimary && isOpenClawGatewayConfigured()) {
    const sessionKey = resolveChatSessionKey(owner);
    const gw = await gatewaySessionsSend(sessionKey, prompt, 120);
    if (gw.ok && gw.reply) {
      return { ok: true, text: gw.reply, via: "openclaw" };
    }
  }

  const claudeUrl = cleanEnv("CLAUDE_MAX_PROXY_URL") || "http://127.0.0.1:3456/v1/chat/completions";
  const claudeToken = cleanEnv("CLAUDE_MAX_PROXY_TOKEN") || "not-needed";
  try {
    const res = await fetch(claudeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${claudeToken}`,
      },
      body: JSON.stringify({
        model: modelForAgent(owner),
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: "Confirm and outline your next steps." },
        ],
        max_tokens: 400,
        temperature: 0.5,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (res.ok) {
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) return { ok: true, text, via: "claude-max" };
    }
  } catch {
    /* fall through */
  }

  const lmUrl = cleanEnv("LM_STUDIO_URL") || "http://127.0.0.1:1234/v1/chat/completions";
  try {
    const res = await fetch(lmUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: "Confirm and outline your next steps." },
        ],
        max_tokens: 400,
        temperature: 0.5,
      }),
      signal: AbortSignal.timeout(75_000),
    });
    if (res.ok) {
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) return { ok: true, text, via: "lm-studio" };
    }
  } catch {
    /* fall through */
  }

  return { ok: false, error: "no chat backend responded for handoff" };
}

/** Run Phase C approval for a synthesis row by Supabase message UUID. */
export async function approveSynthesisMessage(messageId: string): Promise<ApproveResult> {
  if (!messageId || !/^[0-9a-f-]{36}$/i.test(messageId)) {
    return { ok: false, error: "messageId required (uuid)", status: 400 };
  }

  const svc = getSupabaseServiceForApprove();
  if (!svc) {
    return { ok: false, error: "Supabase service role not configured", status: 500 };
  }

  const { data: row, error: readErr } = await svc
    .from("messages")
    .select("id, channel_id, content, metadata, sender_agent_id, tenant_id")
    .eq("id", messageId)
    .single();
  if (readErr || !row) {
    return {
      ok: false,
      error: `synthesis message not found: ${readErr?.message || "no row"}`,
      status: 404,
    };
  }

  const meta = (row.metadata as Record<string, unknown> | null) ?? {};
  if (meta.kind !== "synthesis") {
    return { ok: false, error: "message is not a synthesis", status: 400 };
  }
  const plan = meta.plan as SynthesisPlan | undefined;
  if (
    !plan ||
    typeof plan.decision !== "string" ||
    !Array.isArray(plan.actions) ||
    plan.actions.length === 0
  ) {
    return { ok: false, error: "synthesis has no executable plan", status: 400 };
  }

  if (meta.approved_at) {
    return {
      ok: true,
      alreadyApproved: true,
      approvedAt: meta.approved_at as string,
    };
  }

  const channelName = (meta.channel_name as string | undefined) ?? undefined;
  const handoffPromises = plan.actions.map(async (action) => {
    const owner = action.owner.toLowerCase();
    const prompt = buildHandoffPrompt(owner, action, plan, channelName);
    const result = await dispatchHandoff(owner, prompt);
    return { owner, action, result };
  });
  const handoffs = await Promise.all(handoffPromises);

  const inserts: Array<{ owner: string; text: string; via: string }> = [];
  for (const h of handoffs) {
    if (!h.result.ok) {
      console.error(`[approve] handoff failed for ${h.owner}:`, h.result.error);
      continue;
    }
    const text = h.result.text.trim();
    if (!text) continue;
    const ownerUUID = AGENT_DM_UUID[h.owner] || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const { error: insertErr } = await svc.from("messages").insert({
      channel_id: row.channel_id,
      sender_agent_id: ownerUUID,
      sender_type: "agent",
      content: text,
      tenant_id: (row.tenant_id as string) || TENANT_ID,
      attachments: [],
      status: "sent",
      metadata: {
        kind: "execution_ack",
        synthesis_id: row.id,
        owner: h.owner,
        via: h.result.via,
        task: h.action.task,
        deliverable: h.action.deliverable,
        due: h.action.due,
      },
    });
    if (insertErr) {
      console.error(`[approve] ack insert failed for ${h.owner}:`, insertErr);
      continue;
    }
    inserts.push({ owner: h.owner, text, via: h.result.via });
  }

  const approvedAt = new Date().toISOString();
  const { error: updErr } = await svc
    .from("messages")
    .update({
      metadata: {
        ...meta,
        approved_at: approvedAt,
        approved_handoff_count: inserts.length,
      },
    })
    .eq("id", messageId);
  if (updErr) {
    console.error("[approve] could not stamp approved_at:", updErr);
  }

  return {
    ok: true,
    approvedAt,
    dispatched: inserts.length,
    total: plan.actions.length,
    handoffs: inserts,
    failures: handoffs
      .filter((h) => !h.result.ok)
      .map((h) => ({
        owner: h.owner,
        error: (h.result as { ok: false; error: string }).error,
      })),
  };
}
