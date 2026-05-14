/**
 * Phase C — Synthesis approval + handoff dispatch.
 *
 * Endpoint POST /api/command-center/chat/approve
 *   body: { messageId: string }  // the Supabase id of an Atlas synthesis msg
 *
 * Reads the structured plan stored in `metadata.plan` of that message, and
 * for each `action` dispatches a real handoff to the owner agent so they
 * commit concretely to the work (not just "@x should take this" theater).
 *
 * Two routes, gated by env:
 *   1. OpenClaw `sessions_send` — when OPENCLAW_CHAT_PRIMARY=1 AND the
 *      gateway is configured. The owner's actual Claude Code session
 *      receives the handoff with full tool access (Read/Write/Edit/Bash).
 *      This is the path that lets an agent ACTUALLY do work (open a file,
 *      run a script, query the DB, etc.).
 *   2. Claude Max proxy — default. Returns a structured commitment from
 *      the owner agent (acceptance, first 3 steps, blockers). No tool
 *      access, but a real conversational hand-off and a starting plan.
 *      Good enough for "what are we going to do tomorrow morning".
 *
 * Each handoff result is written back into the channel as a regular agent
 * message with metadata.kind = "execution_ack" and metadata.synthesis_id
 * pointing at the source synthesis row, so the UI can group the chain.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  gatewaySessionsSend,
  isOpenClawGatewayConfigured,
  resolveChatSessionKey,
} from "@/lib/openclaw-gateway";
import { AGENT_DM_UUID } from "@/lib/cc-agent-dm-uuids";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CLAUDE_MAX_DEFAULT_URL = "http://127.0.0.1:3456/v1/chat/completions";
const LM_STUDIO_DEFAULT_URL = "http://127.0.0.1:1234/v1/chat/completions";
const TENANT_ID = "11111111-1111-1111-1111-111111111111";

type ActionItem = {
  owner: string;
  task: string;
  deliverable?: string;
  due?: string;
};

type SynthesisPlan = {
  decision: string;
  actions: ActionItem[];
  risks?: string[];
  next_check_in?: string;
};

function cleanEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const cleaned = raw.replace(/[\s\x00-\x1f\x7f]+$/u, "").replace(/^\s+/u, "");
  return cleaned || undefined;
}

function getSupabaseService() {
  const url = cleanEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = cleanEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Mirror chat/route.ts model tiers so handoffs run on the SAME quality
 *  Claude model as the agent's chat persona — Atlas-led actions get Opus,
 *  specialists get Sonnet, lightweights get Haiku. */
// Mirrors src/app/api/command-center/chat/route.ts — keep in sync.
// Haiku is reserved for utility agents (Triage) only; brand/sales/comms
// personas need Sonnet to maintain identity under formal handoff prompts.
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

/** Pretty display name for the owner agent. */
function displayName(agentId: string): string {
  if (!agentId) return "Agent";
  return agentId.charAt(0).toUpperCase() + agentId.slice(1);
}

/** Build the handoff prompt sent to the owner agent. The shape mirrors the
 *  AutoGen / CrewAI "task assignment" pattern — concrete, role-aware,
 *  asks for both acknowledgment and a starting plan. */
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

  // The framing here intentionally reads less like "roleplay an internal
  // corporate agent" (which trips Anthropic's safety reflexes on smaller
  // models and yields "I'm Claude…" responses) and more like a normal
  // working-team conversation where ${name} is just one of the people in the
  // group. Anchor the persona via the named greeting + first-person voice
  // expectation, not via "you ARE an AI agent inside RAMICHE OS".
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

/** Dispatch a single handoff. OpenClaw path when available, Claude Max
 *  fallback otherwise. Returns the owner's commitment text + which route ran. */
async function dispatchHandoff(
  owner: string,
  prompt: string
): Promise<{ ok: true; text: string; via: "openclaw" | "claude-max" | "lm-studio" } | { ok: false; error: string }> {
  // 1) OpenClaw `sessions_send` — owner's Claude Code session with tools.
  const openclawPrimary =
    process.env.OPENCLAW_CHAT_PRIMARY === "1" ||
    process.env.OPENCLAW_CHAT_PRIMARY === "true";
  if (openclawPrimary && isOpenClawGatewayConfigured()) {
    const sessionKey = resolveChatSessionKey(owner);
    const gw = await gatewaySessionsSend(sessionKey, prompt, 120);
    if (gw.ok && gw.reply) {
      return { ok: true, text: gw.reply, via: "openclaw" };
    }
    // fall through to Claude Max — OpenClaw is opt-in best-effort
  }

  // 2) Claude Max proxy — same OpenAI-compatible bridge the chat route uses.
  const claudeUrl = cleanEnv("CLAUDE_MAX_PROXY_URL") || CLAUDE_MAX_DEFAULT_URL;
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
    /* fall through to LM Studio */
  }

  // 3) LM Studio (loaded local model)
  const lmUrl = cleanEnv("LM_STUDIO_URL") || LM_STUDIO_DEFAULT_URL;
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

export async function GET() {
  return NextResponse.json({ ok: true, accepts: ["POST"] });
}

export async function POST(req: NextRequest) {
  try {
    const { messageId } = (await req.json()) as { messageId?: string };
    if (!messageId || !/^[0-9a-f-]{36}$/i.test(messageId)) {
      return NextResponse.json({ ok: false, error: "messageId required (uuid)" }, { status: 400 });
    }

    const svc = getSupabaseService();
    if (!svc) {
      return NextResponse.json(
        { ok: false, error: "Supabase service role not configured" },
        { status: 500 }
      );
    }

    // Pull the synthesis row + verify it's actually a synthesis with a plan.
    const { data: row, error: readErr } = await svc
      .from("messages")
      .select("id, channel_id, content, metadata, sender_agent_id, tenant_id")
      .eq("id", messageId)
      .single();
    if (readErr || !row) {
      return NextResponse.json(
        { ok: false, error: `synthesis message not found: ${readErr?.message || "no row"}` },
        { status: 404 }
      );
    }

    const meta = (row.metadata as Record<string, unknown> | null) ?? {};
    if (meta.kind !== "synthesis") {
      return NextResponse.json(
        { ok: false, error: "message is not a synthesis" },
        { status: 400 }
      );
    }
    const plan = meta.plan as SynthesisPlan | undefined;
    if (
      !plan ||
      typeof plan.decision !== "string" ||
      !Array.isArray(plan.actions) ||
      plan.actions.length === 0
    ) {
      return NextResponse.json(
        { ok: false, error: "synthesis has no executable plan" },
        { status: 400 }
      );
    }

    // Idempotency — if the synthesis was already approved, do not dispatch again.
    if (meta.approved_at) {
      return NextResponse.json({
        ok: true,
        alreadyApproved: true,
        approvedAt: meta.approved_at,
      });
    }

    // Fire handoffs IN PARALLEL — every owner agent commits at once. They each
    // have the full plan context so they know how their lane fits.
    const channelName = (meta.channel_name as string | undefined) ?? undefined;
    const handoffPromises = plan.actions.map(async (action) => {
      const owner = action.owner.toLowerCase();
      const prompt = buildHandoffPrompt(owner, action, plan, channelName);
      const result = await dispatchHandoff(owner, prompt);
      return { owner, action, result };
    });
    const handoffs = await Promise.all(handoffPromises);

    // Write each commitment back into the channel as an execution_ack message.
    // The chain is discoverable because each row carries metadata.synthesis_id.
    const inserts: Array<{ owner: string; text: string; via: string }> = [];
    for (const h of handoffs) {
      if (!h.result.ok) {
        console.error(`[approve] handoff failed for ${h.owner}:`, h.result.error);
        continue;
      }
      const text = h.result.text.trim();
      if (!text) continue;
      const ownerUUID =
        AGENT_DM_UUID[h.owner] || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
      const { error: insertErr } = await svc.from("messages").insert({
        channel_id: row.channel_id,
        sender_agent_id: ownerUUID,
        sender_type: "agent",
        content: text,
        tenant_id: row.tenant_id || TENANT_ID,
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

    // Mark the synthesis as approved so future POSTs are idempotent and the
    // UI can render an "Approved" state on the card.
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

    return NextResponse.json({
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
    });
  } catch (e) {
    console.error("[approve] unexpected error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
