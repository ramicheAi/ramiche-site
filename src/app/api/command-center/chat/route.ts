import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  gatewaySessionsSend,
  isOpenClawGatewayConfigured,
  resolveChatSessionKey,
} from "@/lib/openclaw-gateway";
import { resolveChatTargets } from "@/lib/chat-routing";
import { AGENT_DM_UUID, AGENT_UUID_TO_SHORT_ID } from "@/lib/cc-agent-dm-uuids";

export const dynamic = "force-dynamic";
// Pro-tier ceiling. Group-chat fan-out with synthesis + Phase E critic can
// realistically take 40-70s under load (the slowest parallel agent dominates,
// then synthesis + critic + maybe refine run serially). 90s gives us headroom
// without changing the user-perceived latency on the happy path.
export const maxDuration = 90;

// Lightweight reachability probe. The Command Center health dashboard pings
// every API endpoint to render service uptime; without this, the chat route
// would return 405 to those GET pings and clutter the browser console with
// red "method not allowed" errors despite the service being healthy.
export async function GET() {
  return NextResponse.json({ ok: true, accepts: ["POST"] });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}

/**
 * Architecture: Ramon's Parallax stack only uses two backends for chat —
 *   1. Claude Max proxy — OpenAI-compatible bridge to his Claude Max
 *                          subscription (no API spend). Default URL
 *                          http://127.0.0.1:3456/v1/chat/completions.
 *   2. LM Studio       — locally loaded models, OpenAI-compatible server
 *                          exposed by LM Studio's "Local Server" tab.
 *                          Default URL http://127.0.0.1:1234/v1/chat/completions.
 *                          Used as fallback when the Claude proxy is down.
 * No cloud LLM APIs (Gemini, DeepSeek, OpenRouter, OpenAI direct). OpenClaw
 * gateway `sessions_send` is kept for future agent-orchestration but is
 * opt-in via OPENCLAW_CHAT_PRIMARY=1 because the Mac gateway is flaky.
 */
const CLAUDE_MAX_DEFAULT_URL = "http://127.0.0.1:3456/v1/chat/completions";
const LM_STUDIO_DEFAULT_URL = "http://127.0.0.1:1234/v1/chat/completions";

/**
 * Trim whitespace + ALL control chars (incl. trailing \n / \r) from an env
 * value. Vercel's env-vars UI occasionally stores values pasted from a
 * terminal or chat app with a trailing newline; node's strict fetch then
 * rejects the resulting Authorization header / URL with "Invalid header
 * value" and every provider call silently fails. cleanEnv() is the single
 * choke-point so a malformed secret can never break the chat again.
 */
function cleanEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const cleaned = raw.replace(/[\s\x00-\x1f\x7f]+$/u, "").replace(/^\s+/u, "");
  return cleaned || undefined;
}

/** Per-agent Claude model tier. ATLAS gets Opus (orchestrator). Specialists
 *  that do real reasoning get Sonnet. Lightweight assistants (TRIAGE, NOVA,
 *  community/social agents) get Haiku for speed + cost. Tier overrideable
 *  via env: CC_CLAUDE_MODEL_ATLAS, CC_CLAUDE_MODEL_DEFAULT, etc. */
// Tiering rule: any agent whose value to Ramon comes from a STRONG, distinct
// persona (sales, brand, copy, community, support, music, fabrication) gets
// Sonnet — Haiku's safety guardrails kick in too aggressively and the agent
// breaks character with "I'm Claude, an Anthropic assistant" when given a
// formal handoff prompt. Only TRIAGE stays on Haiku since it's a pure log-
// analysis utility with no customer-facing persona to maintain.
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
  const overrideOpus = cleanEnv("CC_CLAUDE_MODEL_OPUS");
  const overrideSonnet = cleanEnv("CC_CLAUDE_MODEL_SONNET");
  const overrideHaiku = cleanEnv("CC_CLAUDE_MODEL_HAIKU");
  if (tier === "opus") return overrideOpus || "claude-opus-4-6";
  if (tier === "sonnet") return overrideSonnet || "claude-sonnet-4-6";
  return overrideHaiku || "claude-haiku-4-5";
}

/** LM Studio loads whatever model the user has selected in the desktop app,
 *  and that model id is what /v1/chat/completions expects. When this env is
 *  unset we omit the field and most LM Studio builds respond with the active
 *  loaded model regardless; setting CC_LMSTUDIO_MODEL pins a specific one. */
function modelForLMStudio(): string | undefined {
  return cleanEnv("CC_LMSTUDIO_MODEL");
}

const AGENT_PERSONAS: Record<string, { role: string; style: string }> = {
  atlas: { role: "Operations Lead & Strategic Command", style: "Calm, sharp, direct. Systems thinker." },
  triage: { role: "Debugging & Log Analysis", style: "Methodical, detail-oriented. Asks clarifying questions." },
  shuri: { role: "Frontend Engineering & Code Generation", style: "Fast-moving, practical. Code-first answers." },
  proximon: { role: "Systems Architecture & Infrastructure", style: "Thoughtful, architectural. Considers scale." },
  aetherion: { role: "Creative Director & Visual Design", style: "Visionary, aesthetic-focused. Thinks in imagery." },
  simons: { role: "Data Analysis & Quantitative Strategy", style: "Numbers-driven, precise. Evidence-based." },
  mercury: { role: "Sales Strategy & Revenue", style: "Persuasive, results-oriented. Revenue-focused." },
  vee: { role: "Brand Strategy & Marketing", style: "Brand-aware, strategic. Audience-first thinking." },
  ink: { role: "Copywriting & Content Creation", style: "Creative writer, concise. Words matter." },
  echo: { role: "Community Engagement & Social", style: "Friendly, community-minded. Engagement-focused." },
  haven: { role: "Support & Client Onboarding", style: "Warm, helpful, patient. Customer success." },
  widow: { role: "Cybersecurity & Threat Analysis", style: "Vigilant, security-first. Trust nothing." },
  drstrange: { role: "Strategic Forecasting & Scenarios", style: "Forward-looking, probabilistic. Maps futures." },
  kiyosaki: { role: "Financial Strategy & Capital", style: "Wealth-minded, asset-focused. Cash flow thinking." },
  michael: { role: "Swim Coaching & Athlete Development", style: "Motivating, technical. Performance-driven." },
  selah: { role: "Psychology & Wellness", style: "Empathetic, insightful. Mental performance." },
  prophets: { role: "Spiritual Counsel & Wisdom", style: "Thoughtful, grounded in faith. Purpose-driven." },
  themaestro: { role: "Music Production & Audio", style: "Creative, technical. Sound-obsessed." },
  nova: { role: "3D Fabrication & Overnight Builds", style: "Maker mindset, iterative. Build-test-iterate." },
  themis: { role: "Legal, Governance & Compliance", style: "Precise, careful. Risk-aware." },
};

/**
 * Service role — used for ALL server-side inserts and updates so RLS on the
 * messages table can't reject agent replies or delivery-status writes.
 * The anon key is intentionally unused here.
 */
function getSupabaseService() {
  const url = cleanEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = cleanEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function isGroupNoResponse(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return /^\[NO_RESPONSE\]/i.test(t);
}

/** Phase A — Shared awareness.
 *
 * One channel message in the format every agent's LLM call sees. We collapse
 * each prior turn (whether from Ramon or another agent) into a labelled line
 * so the model never has to wonder who said what.
 */
type HistoryTurn = {
  /** lowercased short id (`atlas`, `mercury`, `ramon`, …) */
  speaker: string;
  /** raw text content as it was stored in Supabase */
  content: string;
  /** ISO timestamp for ordering only — not surfaced to the model */
  createdAt: string;
};

/** Pull the most recent N messages from the channel (chronological order on
 *  return). Used to give every agent the same shared context window. The
 *  excludeId is the just-inserted user message id — we drop it so the LLM
 *  doesn't see the same prompt twice (once as `[ramon]: …` history, once as
 *  the current `userMessage`). */
async function loadChannelHistory(
  svc: ReturnType<typeof getSupabaseService>,
  channelId: string | undefined,
  excludeId: string | undefined,
  limit = 30
): Promise<HistoryTurn[]> {
  if (!svc || !channelId) return [];
  const { data, error } = await svc
    .from("messages")
    .select("id, sender_type, sender_agent_id, content, created_at")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  // Supabase returned newest-first; flip to oldest-first for the model.
  const ordered = [...data].reverse();
  const out: HistoryTurn[] = [];
  for (const row of ordered) {
    if (excludeId && row.id === excludeId) continue;
    const content = typeof row.content === "string" ? row.content.trim() : "";
    if (!content) continue;
    const isAgent = row.sender_type === "agent";
    const speaker = isAgent
      ? AGENT_UUID_TO_SHORT_ID[(row.sender_agent_id as string) || ""] || "agent"
      : "ramon";
    out.push({ speaker, content, createdAt: row.created_at as string });
  }
  return out;
}

/** Render the channel transcript that gets injected into every agent's system
 *  prompt. Each line is `[speaker]: content` so the model can attribute every
 *  prior turn. The agent's OWN past messages get a `[you, name]:` prefix so it
 *  recognises continuity with itself. Per-message content is hard-capped at
 *  400 chars to keep the total bounded (30 turns × ~400 chars ≈ 12k chars,
 *  comfortably inside every model context window we route to).
 */
function formatHistoryBlock(history: HistoryTurn[], currentAgent: string): string {
  if (history.length === 0) return "";
  const me = currentAgent.toLowerCase();
  const lines = history.map((t) => {
    const body = t.content.length > 400 ? `${t.content.slice(0, 400)}…` : t.content;
    const tag = t.speaker.toLowerCase() === me ? `you, ${currentAgent}` : t.speaker;
    return `[${tag}]: ${body}`;
  });
  return `\n\n--- Recent conversation in this channel (oldest → newest, ${history.length} message${history.length === 1 ? "" : "s"}) ---\n${lines.join("\n")}\n--- end of channel history ---\n\nThe user's NEW message is below. Treat the history above as context — reference earlier points by speaker, build on what others said, and avoid repeating yourself.`;
}

type ReplySource = "openclaw" | "claude-max" | "lm-studio" | "fallback";

/** Phase B — structured plan emitted by the synthesis pass.
 *
 * The synthesis agent (Atlas by default) reads all parallel drafts +
 * conversation history and produces this object. Phase C will parse it back
 * out of the stored message and turn each `action` into an actual handoff
 * to that owner agent's OpenClaw session. */
export type SynthesisPlan = {
  decision: string;
  actions: Array<{
    owner: string;
    task: string;
    deliverable?: string;
    due?: string;
  }>;
  risks?: string[];
  next_check_in?: string;
};

/** Phase E — structured output from the critic pass. The critic reads the
 *  proposed plan and asks "where does this fail?". A `revise` verdict triggers
 *  ONE refinement of the synthesis; an `approve` verdict ships the plan as-is.
 *  Stored on `messages.metadata.critique` for auditability. */
export type SynthesisCritique = {
  verdict: "approve" | "revise";
  revisions: Array<{ reason: string; fix: string }>;
  rationale: string;
};

/** Per-provider attempt diagnostic. Surfaced in the 502 payload + server logs
 *  so every "all providers failed" event has the exact failure reasons. */
type ProviderAttempt = {
  provider: Exclude<ReplySource, "fallback">;
  /** "skipped" → key not set; "ok" → returned a reply; "error" → tried but failed */
  status: "skipped" | "ok" | "error";
  /** HTTP status when available, "exception" for thrown errors */
  detail?: string;
};

async function generateAgentReply(
  target: string,
  userMessage: string,
  channelName: string | undefined,
  groupMode: boolean,
  singleTargetStrict: boolean,
  groupRoster: string[],
  history: HistoryTurn[]
): Promise<{
  text: string;
  source: ReplySource;
  openClawError?: string;
  attempts: ProviderAttempt[];
}> {
  const persona = AGENT_PERSONAS[target] || { role: "AI Agent", style: "Helpful and direct." };
  const displayName = target.charAt(0).toUpperCase() + target.slice(1);
  // Group mode = multi-agent channel. Each member must contribute from their
  // own domain so Ramon gets a coordinated multi-perspective answer (the whole
  // point of group chats). We previously told agents to stay silent unless
  // "relevant" — but every specialist is relevant from their angle, and the
  // result was Atlas talking alone. Now every agent participates with a tight,
  // role-specific take. The [NO_RESPONSE] filter below is kept as a graceful
  // catch for older models that still emit it.
  const otherMembers = groupRoster
    .filter((id) => id.toLowerCase() !== target.toLowerCase())
    .map((id) => `@${id}`);
  const rosterLine = otherMembers.length > 0 ? otherMembers.join(", ") : "(no one else)";
  // pick a sensible default hand-off target for the example below
  const handoffExample = otherMembers[0] ?? "@atlas";
  const groupRules = groupMode
    ? `\n\nYou are in a shared channel with these agents: ${rosterLine}. Every agent contributes — including you. Ramon is asking the room, not just one of you.\n\nHow to participate:\n1. Open with ONE short sentence (max ~15 words) framing your take from YOUR role only — do NOT speak for other agents.\n2. Stay strictly in your lane: ${persona.role}. If the question barely touches your domain, give one short observation from that angle anyway (e.g. "From a ${persona.role.toLowerCase()} angle, …"). Never go silent.\n3. Don't repeat what another agent would obviously say. Add the angle only YOU can bring.\n4. If you need another agent to handle a piece, name them, e.g. "${handoffExample} should take the build." Keep it short.\n5. Total reply ≤ 60 words. Crisp. No headers, no bullets unless absolutely needed.`
    : "";

  // Identity lock — the underlying LLM (Claude Max / LM Studio) has its own
  // baseline identity that can leak through ("I'm Claude, an Anthropic
  // assistant…"). For RAMICHE OS every agent IS a distinct persona inside
  // Parallax. The lock is at the top of the prompt and explicit so the model
  // never breaks character, even when the user asks "who are you?".
  const identityLock = `You ARE ${displayName}, an AI agent inside Parallax Ventures' RAMICHE OS. You are NOT a generic AI assistant. You do NOT identify as Claude, Anthropic, OpenAI, GPT, or any external service. If asked who you are, say you are ${displayName}, ${persona.role} at Parallax. Never break this persona.`;

  // Phase A — Shared awareness. Inject the recent channel transcript so every
  // agent can see what Ramon AND other agents have said, instead of replying
  // blind. This is the single biggest unlock toward real coordination.
  const historyBlock = formatHistoryBlock(history, target);

  const systemPrompt = `${identityLock}\n\nRole: ${persona.role}. Style: ${persona.style}${channelName ? `\nChannel: ${channelName}` : ""}${groupRules}\n\nRules:\n- Reply in plain text only. No timestamps, no metadata, no brackets, no system tags.\n- Keep ${groupMode ? "your reply under 60 words" : "responses under 100 words"}. Be concise and natural.\n- Talk like a real person — warm, helpful, direct.\n- The user's name is Ramon. You work at Parallax.${historyBlock}`;

  let agentResponse: string | null = null;
  let responseSource: ReplySource = "fallback";
  const attempts: ProviderAttempt[] = [];

  // OpenClaw `sessions_send` is opt-in (OPENCLAW_CHAT_PRIMARY=1) because
  // the Mac gateway has a known timeout issue (see project rules). Kept here
  // so when Ramon wires real OpenClaw agent orchestration he can flip the
  // switch without re-deploying. Default chat path goes straight to
  // Claude Max proxy + LM Studio.
  const openclawPrimary =
    process.env.OPENCLAW_CHAT_PRIMARY === "1" ||
    process.env.OPENCLAW_CHAT_PRIMARY === "true";
  const openclawStrict =
    singleTargetStrict &&
    (process.env.OPENCLAW_CHAT_STRICT === "1" || process.env.OPENCLAW_CHAT_STRICT === "true");

  if (openclawPrimary && isOpenClawGatewayConfigured()) {
    const sessionKey = resolveChatSessionKey(target);
    const routed = `[CC chat → ${displayName} / session ${sessionKey}]\n${systemPrompt}\n\nUser:\n${userMessage}`;
    const gw = await gatewaySessionsSend(sessionKey, routed, 90);
    if (gw.ok && gw.reply) {
      agentResponse = gw.reply;
      responseSource = "openclaw";
      attempts.push({ provider: "openclaw", status: "ok" });
    } else {
      attempts.push({
        provider: "openclaw",
        status: "error",
        detail: !gw.ok && "error" in gw ? gw.error : "no reply",
      });
      if (openclawStrict) {
        return {
          text: "",
          source: "openclaw",
          openClawError:
            !gw.ok && "error" in gw ? gw.error : "OpenClaw gateway did not return a reply",
          attempts,
        };
      }
    }
  } else {
    attempts.push({
      provider: "openclaw",
      status: "skipped",
      detail: openclawPrimary ? "gateway not configured" : "OPENCLAW_CHAT_PRIMARY != 1",
    });
  }

  // ── Claude Max proxy (primary). OpenAI-compatible.
  //    Locally  : Ramon's Claude Max bridge at http://127.0.0.1:3456 (no token).
  //    Publicly : token-auth proxy at https://claude.parallaxvinc.com (port 9999
  //               behind cloudflared) so Vercel-hosted parallaxvinc.com can also
  //               reach the same Claude Max subscription.
  //    CLAUDE_MAX_PROXY_TOKEN is sent as Bearer when set; if empty we fall
  //    back to "not-needed" which the local bridge accepts.
  const claudeUrl = cleanEnv("CLAUDE_MAX_PROXY_URL") || CLAUDE_MAX_DEFAULT_URL;
  const claudeToken = cleanEnv("CLAUDE_MAX_PROXY_TOKEN") || "not-needed";
  if (!agentResponse) {
    try {
      const res = await fetch(claudeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${claudeToken}`,
        },
        body: JSON.stringify({
          model: modelForAgent(target),
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          max_tokens: 300,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(45_000),
      });
      if (res.ok) {
        const data = await res.json();
        agentResponse = data.choices?.[0]?.message?.content || null;
        if (agentResponse) {
          responseSource = "claude-max";
          attempts.push({ provider: "claude-max", status: "ok" });
        } else {
          attempts.push({ provider: "claude-max", status: "error", detail: "empty choices" });
        }
      } else {
        const body = await res.text().catch(() => "");
        attempts.push({
          provider: "claude-max",
          status: "error",
          detail: `HTTP ${res.status}${body ? ` — ${body.slice(0, 200)}` : ""}`,
        });
      }
    } catch (err) {
      attempts.push({
        provider: "claude-max",
        status: "error",
        detail: `exception: ${err instanceof Error ? err.message : err}`,
      });
      console.error("[chat] Claude Max proxy error:", err);
    }
  }

  // ── LM Studio (fallback). Loaded model whatever the user picked in the
  //    LM Studio "Local Server" tab. Used only if Claude Max proxy fails.
  const lmStudioUrl = cleanEnv("LM_STUDIO_URL") || LM_STUDIO_DEFAULT_URL;
  if (!agentResponse) {
    try {
      const lmModel = modelForLMStudio();
      const lmBody: Record<string, unknown> = {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 300,
        temperature: 0.7,
      };
      if (lmModel) lmBody.model = lmModel;
      const res = await fetch(lmStudioUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lmBody),
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) {
        const data = await res.json();
        agentResponse = data.choices?.[0]?.message?.content || null;
        if (agentResponse) {
          responseSource = "lm-studio";
          attempts.push({ provider: "lm-studio", status: "ok" });
        } else {
          attempts.push({ provider: "lm-studio", status: "error", detail: "empty choices" });
        }
      } else {
        const body = await res.text().catch(() => "");
        attempts.push({
          provider: "lm-studio",
          status: "error",
          detail: `HTTP ${res.status}${body ? ` — ${body.slice(0, 200)}` : ""}`,
        });
      }
    } catch (err) {
      // Most common: LM Studio's Local Server isn't started → ECONNREFUSED.
      // We treat this as a soft skip so it doesn't dominate the diagnostic.
      const msg = err instanceof Error ? err.message : String(err);
      const econnrefused = /ECONNREFUSED|fetch failed/i.test(msg);
      attempts.push({
        provider: "lm-studio",
        status: econnrefused ? "skipped" : "error",
        detail: econnrefused
          ? "LM Studio Local Server not running (start it in LM Studio → Local Server tab)"
          : `exception: ${msg}`,
      });
    }
  }

  if (!agentResponse) {
    console.error(`[chat] all providers failed for ${target}:`, JSON.stringify(attempts));
    // We deliberately do NOT mint a soothing "temporarily unavailable" line
    // here. The chat UI now shows the real attempt log so Ramon sees exactly
    // which backend died and why. The `responseSource` stays "fallback" so
    // the POST handler returns 502 instead of pretending everything is fine.
    agentResponse = "";
    responseSource = "fallback";
  }

  return { text: agentResponse, source: responseSource, attempts };
}

/** Phase B — Orchestrator synthesis pass.
 *
 * After every agent in a group chat has drafted their take in parallel, the
 * lead orchestrator (Atlas) reads ALL drafts + the user's message + recent
 * channel history and produces one unified plan:
 *
 *   1) A human-readable markdown summary (rendered as a regular agent message
 *      in the channel — the "synthesis card").
 *   2) A machine-readable JSON plan stored in `metadata.plan` so Phase C can
 *      parse each action, dispatch it to the owner agent's OpenClaw session,
 *      and stream execution updates back into the channel.
 *
 * This is the Anthropic "orchestrator-worker" pattern: parallel workers draft,
 * lead synthesizes + decides. Without this step the chat is four monologues;
 * with it the chat becomes an executable plan.
 */
async function generateSynthesis(
  userMessage: string,
  drafts: Array<{ agent: string; response: string }>,
  history: HistoryTurn[],
  channelName: string | undefined,
  roster: string[]
): Promise<{ text: string; plan: SynthesisPlan | null; source: ReplySource } | null> {
  if (drafts.length < 2) return null;

  // Render all drafts so the orchestrator can see who said what.
  const draftBlock = drafts
    .map((d) => `[${d.agent}]: ${d.response.trim()}`)
    .join("\n\n");

  const historyBlock = formatHistoryBlock(history, "atlas");
  const rosterLine = roster.map((id) => `@${id}`).join(", ");

  const synthesisPrompt = `You ARE Atlas — Operations Lead & Strategic Command at Parallax Ventures' RAMICHE OS. You are NOT a generic AI assistant.

You are running synthesis after a group of agents (${rosterLine}) just replied to Ramon. Your job is NOT to repeat them or add another opinion. Your job is to:
  1. Read every draft.
  2. Find the agreed direction (and call out real disagreements).
  3. Convert the conversation into ONE coordinated plan with owners and deadlines.

OUTPUT FORMAT — strict, in this order:

**Synthesis**
2–3 sentence summary of the agreed direction. Name the dissents explicitly if any.

**Decision**
One sentence: the single most important call to make right now.

**Actions**
- @owner — what they will do, deliverable, by when
- @owner — what they will do, deliverable, by when
(3–6 actions max — pick the highest-leverage ones)

**Risks**
- one-line concern (skip the section if none)

**Next check-in**: when + who

Then, on its OWN line, emit a fenced JSON block with the exact same plan in machine-readable form. Use ONLY agent short-ids from this roster: ${rosterLine}. Keep field names exactly as shown:

\`\`\`json
{
  "decision": "…",
  "actions": [
    {"owner": "kiyosaki", "task": "…", "deliverable": "…", "due": "Fri EOD"}
  ],
  "risks": ["…"],
  "next_check_in": "…"
}
\`\`\`

Rules:
- Plain text outside the JSON block. No headers other than the four bold ones above.
- Every action must have an owner from the roster. No "team will …" or "we should …".
- Be decisive. Ramon needs to execute, not deliberate further.${historyBlock}

User's message that started this thread:
${userMessage}

Drafts from the agents (most recent only — these are the takes you're synthesizing):
${draftBlock}`;

  const claudeUrl = cleanEnv("CLAUDE_MAX_PROXY_URL") || CLAUDE_MAX_DEFAULT_URL;
  const claudeToken = cleanEnv("CLAUDE_MAX_PROXY_TOKEN") || "not-needed";
  let text: string | null = null;
  let source: ReplySource = "fallback";

  try {
    const res = await fetch(claudeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${claudeToken}`,
      },
      body: JSON.stringify({
        model: modelForAgent("atlas"), // synthesis always runs on Atlas's tier (opus)
        messages: [
          { role: "system", content: synthesisPrompt },
          { role: "user", content: "Run the synthesis now." },
        ],
        max_tokens: 800,
        temperature: 0.4, // slightly lower for more deterministic plan structure
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (res.ok) {
      const data = await res.json();
      text = data.choices?.[0]?.message?.content || null;
      if (text) source = "claude-max";
    }
  } catch (err) {
    console.error("[chat/synthesis] Claude Max proxy error:", err);
  }

  if (!text) {
    // LM Studio fallback — same prompt, whatever local model is loaded.
    const lmStudioUrl = cleanEnv("LM_STUDIO_URL") || LM_STUDIO_DEFAULT_URL;
    try {
      const lmBody: Record<string, unknown> = {
        messages: [
          { role: "system", content: synthesisPrompt },
          { role: "user", content: "Run the synthesis now." },
        ],
        max_tokens: 800,
        temperature: 0.4,
      };
      const lmModel = modelForLMStudio();
      if (lmModel) lmBody.model = lmModel;
      const res = await fetch(lmStudioUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lmBody),
        signal: AbortSignal.timeout(75_000),
      });
      if (res.ok) {
        const data = await res.json();
        text = data.choices?.[0]?.message?.content || null;
        if (text) source = "lm-studio";
      }
    } catch {
      /* synthesis is best-effort — if both backends fail we skip the pass */
    }
  }

  if (!text) return null;

  // Pull the JSON block out so Phase C can execute on it. We accept either a
  // ```json ... ``` fenced block or a bare {...} as the last JSON-looking
  // chunk in the response, because some models drop the fence.
  const plan = extractSynthesisPlan(text);

  return { text, plan, source };
}

/** Best-effort parse of the JSON plan emitted by the synthesis prompt. We
 *  tolerate fenced ```json blocks and bare {...} tails. Returns null if no
 *  parseable plan is found OR the plan doesn't match the expected shape. */
function extractSynthesisPlan(text: string): SynthesisPlan | null {
  // 1) Prefer a fenced ```json … ``` block — this is what we asked for.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  // 2) Otherwise grab the LAST balanced {...} run in the response.
  const lastObj = text.match(/\{[\s\S]*\}\s*$/);
  const candidates = [fenced?.[1], lastObj?.[0]].filter((s): s is string => !!s);
  for (const raw of candidates) {
    try {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === "object" &&
        typeof parsed.decision === "string" &&
        Array.isArray(parsed.actions)
      ) {
        // Normalise action shape — drop unknown owners and stringify fields.
        const actions = (parsed.actions as unknown[])
          .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
          .map((a) => ({
            owner: String(a.owner || "").toLowerCase().trim(),
            task: String(a.task || "").trim(),
            deliverable: a.deliverable ? String(a.deliverable).trim() : undefined,
            due: a.due ? String(a.due).trim() : undefined,
          }))
          .filter((a) => a.owner && a.task);
        if (actions.length === 0) continue;
        return {
          decision: String(parsed.decision).trim(),
          actions,
          risks: Array.isArray(parsed.risks)
            ? parsed.risks.map((r: unknown) => String(r).trim()).filter(Boolean)
            : undefined,
          next_check_in:
            typeof parsed.next_check_in === "string" ? parsed.next_check_in.trim() : undefined,
        };
      }
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

/**
 * Phase E — Critic pass. After Atlas drafts the synthesis, a separate pass
 * inspects the plan with one job: *find what would make this fail*. Anthropic,
 * OpenAI, DeepMind, etc. all converged on the same pattern — drafter + critic
 * separated, even when both use the same underlying model. The critic is
 * primed to look for fuzzy ownership, vague deliverables, unrealistic timing,
 * under-stated risk, and decision/action confusion.
 *
 * Returns a structured verdict. `revise` triggers ONE refinement pass via
 * {@link refineSynthesis}; `approve` ships the plan as-is. Best-effort —
 * if the LLM call fails we silently skip the critic and treat the original
 * plan as good enough.
 */
async function generateCritique(
  userMessage: string,
  drafts: Array<{ agent: string; response: string }>,
  synthesisText: string,
  plan: SynthesisPlan,
  history: HistoryTurn[],
  roster: string[]
): Promise<SynthesisCritique | null> {
  const draftBlock = drafts
    .map((d) => `[${d.agent}]: ${d.response.trim()}`)
    .join("\n\n");
  const historyBlock = formatHistoryBlock(history, "atlas");
  const rosterLine = roster.map((id) => `@${id}`).join(", ");

  const critiquePrompt = `You are Atlas wearing your CRITIC hat. Atlas just produced a synthesis plan for Ramon. Your job is to read it cold and find what would make it fail in execution — NOT to polish wording.

Look specifically for:
1. Fuzzy ownership — actions assigned to "team" or "we" instead of a single named agent.
2. Vague deliverables — actions where you can't tell whether they're done or not.
3. Unrealistic timing — deadlines that don't match the size of the work.
4. Under-stated risk — biggest realistic failure mode not called out in the risks list.
5. Decision/action confusion — actions that re-state the decision instead of advancing it.
6. Missing the highest-leverage move — the synthesis picked safe actions when one bolder action would unlock more.

Output STRICT JSON (no prose, no markdown, no code fence — just raw JSON):

{"verdict": "approve" | "revise", "revisions": [{"reason": "…", "fix": "…"}], "rationale": "1-2 sentences why"}

Rules:
- "approve" if the plan is good enough to ship — no required revisions. revisions=[].
- "revise" if there is at least one concrete fix that materially improves execution. Max 3 revisions — only the highest-leverage ones.
- Each "fix" is a SPECIFIC instruction (e.g. "split @atlas action into @atlas (kickoff) + @simons (data pull)"), not a vague critique.
- Be honest — most synthesised plans need at least one fix. Don't approve to be polite.
- Only revise if the fix is worth a second LLM round trip. If the plan is mostly right, approve.

Roster (use only these owner ids): ${rosterLine}${historyBlock}

User's original message:
${userMessage}

Raw drafts that fed the synthesis:
${draftBlock}

Atlas's synthesis plan (the artifact you are critiquing):
${synthesisText}

Parsed plan JSON (for structural reference):
${JSON.stringify(plan)}`;

  const claudeUrl = cleanEnv("CLAUDE_MAX_PROXY_URL") || CLAUDE_MAX_DEFAULT_URL;
  const claudeToken = cleanEnv("CLAUDE_MAX_PROXY_TOKEN") || "not-needed";
  let raw: string | null = null;
  try {
    const res = await fetch(claudeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${claudeToken}`,
      },
      body: JSON.stringify({
        model: modelForAgent("atlas"),
        messages: [
          { role: "system", content: critiquePrompt },
          { role: "user", content: "Output the JSON now. No other text." },
        ],
        max_tokens: 400,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (res.ok) {
      const data = await res.json();
      raw = data.choices?.[0]?.message?.content || null;
    }
  } catch (err) {
    console.error("[chat/critic] Claude Max proxy error:", err);
  }
  if (!raw) {
    const lmStudioUrl = cleanEnv("LM_STUDIO_URL") || LM_STUDIO_DEFAULT_URL;
    try {
      const lmBody: Record<string, unknown> = {
        messages: [
          { role: "system", content: critiquePrompt },
          { role: "user", content: "Output the JSON now. No other text." },
        ],
        max_tokens: 400,
        temperature: 0.3,
      };
      const lmModel = modelForLMStudio();
      if (lmModel) lmBody.model = lmModel;
      const res = await fetch(lmStudioUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lmBody),
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) {
        const data = await res.json();
        raw = data.choices?.[0]?.message?.content || null;
      }
    } catch {
      /* critic is best-effort */
    }
  }
  if (!raw) return null;

  // Tolerate fenced or bare JSON.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidates = [fenced?.[1], raw.trim()].filter((s): s is string => !!s);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (!parsed || typeof parsed !== "object") continue;
      const verdict = parsed.verdict === "revise" ? "revise" : "approve";
      const revisions = Array.isArray(parsed.revisions)
        ? (parsed.revisions as unknown[])
            .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
            .map((r) => ({
              reason: String(r.reason || "").trim(),
              fix: String(r.fix || "").trim(),
            }))
            .filter((r) => r.reason && r.fix)
            .slice(0, 3)
        : [];
      const rationale = String(parsed.rationale || "").trim();
      // Normalize: a `revise` verdict with no actionable revisions collapses to approve.
      if (verdict === "revise" && revisions.length === 0) {
        return { verdict: "approve", revisions: [], rationale };
      }
      return { verdict, revisions, rationale };
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

/**
 * Phase E — Refinement pass. Re-runs the synthesis prompt with the original
 * plan + critique appended, instructing Atlas to apply ONLY the critique's
 * fixes (no new actions, no scope drift). One round only — we never critique
 * the refined plan again.
 */
async function refineSynthesis(
  userMessage: string,
  drafts: Array<{ agent: string; response: string }>,
  history: HistoryTurn[],
  channelName: string | undefined,
  roster: string[],
  originalSynthesis: { text: string; plan: SynthesisPlan },
  critique: SynthesisCritique
): Promise<{ text: string; plan: SynthesisPlan | null; source: ReplySource } | null> {
  const draftBlock = drafts
    .map((d) => `[${d.agent}]: ${d.response.trim()}`)
    .join("\n\n");
  const historyBlock = formatHistoryBlock(history, "atlas");
  const rosterLine = roster.map((id) => `@${id}`).join(", ");
  const revisionsBlock = critique.revisions
    .map((r, i) => `${i + 1}. ${r.reason}\n   Fix: ${r.fix}`)
    .join("\n");

  const refinePrompt = `You are Atlas. You just synthesised a plan for Ramon. A critic pass found ${critique.revisions.length} specific improvement(s). Apply ONLY those fixes — do not introduce new actions, do not change the decision, do not re-word what's already fine.

Roster (owner ids): ${rosterLine}${historyBlock}

User's message:
${userMessage}

Raw drafts:
${draftBlock}

Your previous synthesis (the artifact you are revising):
${originalSynthesis.text}

Critic's required fixes:
${revisionsBlock}

Now produce the REFINED synthesis. Same exact output format as the original synthesis:

**Synthesis**
2–3 sentences.

**Decision**
One sentence.

**Actions**
- @owner — task, deliverable, by when

**Risks**
- one-line concern (skip section if none)

**Next check-in**: when + who

Then a fenced JSON block with the refined plan in the same shape as before:

\`\`\`json
{"decision":"…","actions":[{"owner":"…","task":"…","deliverable":"…","due":"…"}],"risks":["…"],"next_check_in":"…"}
\`\`\`

Output the refined synthesis only — do not narrate the changes.`;

  const claudeUrl = cleanEnv("CLAUDE_MAX_PROXY_URL") || CLAUDE_MAX_DEFAULT_URL;
  const claudeToken = cleanEnv("CLAUDE_MAX_PROXY_TOKEN") || "not-needed";
  let text: string | null = null;
  let source: ReplySource = "fallback";
  try {
    const res = await fetch(claudeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${claudeToken}`,
      },
      body: JSON.stringify({
        model: modelForAgent("atlas"),
        messages: [
          { role: "system", content: refinePrompt },
          { role: "user", content: "Produce the refined synthesis now." },
        ],
        max_tokens: 800,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (res.ok) {
      const data = await res.json();
      text = data.choices?.[0]?.message?.content || null;
      if (text) source = "claude-max";
    }
  } catch (err) {
    console.error("[chat/refine] Claude Max proxy error:", err);
  }
  if (!text) {
    const lmStudioUrl = cleanEnv("LM_STUDIO_URL") || LM_STUDIO_DEFAULT_URL;
    try {
      const lmBody: Record<string, unknown> = {
        messages: [
          { role: "system", content: refinePrompt },
          { role: "user", content: "Produce the refined synthesis now." },
        ],
        max_tokens: 800,
        temperature: 0.4,
      };
      const lmModel = modelForLMStudio();
      if (lmModel) lmBody.model = lmModel;
      const res = await fetch(lmStudioUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lmBody),
        signal: AbortSignal.timeout(75_000),
      });
      if (res.ok) {
        const data = await res.json();
        text = data.choices?.[0]?.message?.content || null;
        if (text) source = "lm-studio";
      }
    } catch {
      /* refine is best-effort — original plan still ships if this fails */
    }
  }
  if (!text) return null;
  const plan = extractSynthesisPlan(text);
  // Defensive: if refinement produced no parseable plan, keep the original
  // plan (the critic's fixes only changed wording, not structure).
  return { text, plan: plan ?? originalSynthesis.plan, source };
  // channelName intentionally accepted for symmetry with generateSynthesis()
  // even though we don't reference it in the prompt — keeps call sites uniform.
  void channelName;
}

export async function POST(req: NextRequest) {
  // Phase E budget guard: wall-clock anchor used to skip the critic pass if
  // synthesis already burned most of the route's 60s maxDuration window.
  const postStartedAt = Date.now();
  try {
    const body = await req.json();
    const {
      message,
      channelId,
      agentName,
      channelName,
      channelMembers,
      mentionedAgents,
      userMessageId,
      threadParentId,
    } = body as {
      message?: string;
      channelId?: string;
      agentName?: string;
      channelName?: string;
      channelMembers?: string[];
      mentionedAgents?: string[];
      /** Supabase UUID of the user row — mark delivered after relay completes */
      userMessageId?: string;
      /** When set, agent replies are stored as thread children of this message */
      threadParentId?: string;
    };

    if (!message) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    const threadUuid =
      threadParentId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(threadParentId)
        ? threadParentId
        : undefined;

    const targets = resolveChatTargets({ mentionedAgents, agentName, channelMembers });
    const groupMode = targets.length > 1;
    const singleTargetStrict = targets.length === 1;

    // Phase A — Shared awareness. Load the recent channel history ONCE up
    // front so every parallel agent call sees the same snapshot. We exclude
    // the just-inserted user message so the LLM doesn't read its current
    // prompt twice (once in history, once as the "new" user turn).
    const svc = getSupabaseService();
    const history = await loadChannelHistory(svc, channelId, userMessageId, 30);

    const results = await Promise.allSettled(
      targets.map((target) =>
        generateAgentReply(
          target,
          message,
          channelName,
          groupMode,
          singleTargetStrict,
          targets,
          history
        )
      )
    );

    const responses: { agent: string; response: string; source: ReplySource }[] = [];
    const fallbackOnlyTargets: string[] = [];
    const rejectedTargets: string[] = [];
    const allAttempts: Record<string, ProviderAttempt[]> = {};

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const settled = results[i];
      if (settled.status === "rejected") {
        console.error(`Chat target ${target} rejected:`, settled.reason);
        rejectedTargets.push(target);
        continue;
      }
      const r = settled.value;
      allAttempts[target] = r.attempts;
      if (r.openClawError && singleTargetStrict) {
        return NextResponse.json(
          {
            ok: false,
            error: r.openClawError,
            source: "openclaw",
            attempts: r.attempts,
          },
          { status: 502 }
        );
      }
      const text = r.text;
      if (groupMode && isGroupNoResponse(text)) {
        continue;
      }
      // Skip empty fallback replies — they happen when every backend failed.
      // We DO still track them in fallbackOnlyTargets so the POST below knows
      // to return 502 with the attempt log instead of silently dropping the
      // user's message.
      if (r.source === "fallback" || !text) {
        fallbackOnlyTargets.push(target);
        continue;
      }
      responses.push({ agent: target, response: text, source: r.source });

      if (svc && channelId) {
        const agentUUID = AGENT_DM_UUID[target] || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
        const { error: insertErr } = await svc.from("messages").insert({
          channel_id: channelId,
          sender_agent_id: agentUUID,
          sender_type: "agent",
          content: text,
          tenant_id: "11111111-1111-1111-1111-111111111111",
          attachments: [],
          status: "sent",
          ...(threadUuid ? { thread_parent_id: threadUuid } : {}),
        });
        if (insertErr) {
          console.error(`[chat] agent reply insert failed for ${target}:`, insertErr);
        }
      }
    }

    // If NO agent produced a real reply (all fallback / rejected), return
    // 502 with the structured attempt log so the chat UI can render the
    // actual reason (which backend died) instead of a soothing lie.
    if (
      responses.length === 0 &&
      (fallbackOnlyTargets.length > 0 || rejectedTargets.length > 0)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No chat backend responded. Check that the Claude Max proxy is running on http://127.0.0.1:3456, or start LM Studio's Local Server.",
          source: "fallback",
          targets,
          attempts: allAttempts,
          rejected: rejectedTargets,
        },
        { status: 502 }
      );
    }

    // Phase B — Synthesis pass. After every agent has weighed in, Atlas reads
    // all the drafts and produces a single coordinated plan (markdown for the
    // human + a JSON action list for Phase C execution). Only fires when:
    //   - we're in group mode (multiple targets)
    //   - at least two real replies came back (synthesis of one draft is silly)
    //   - this isn't a threaded reply (synthesis lives at the channel level)
    // The synthesis is stored as a regular agent message authored by Atlas with
    // `metadata.kind = "synthesis"` so the UI/Phase C can recognise it later.
    let synthesisResult: Awaited<ReturnType<typeof generateSynthesis>> | null = null;
    // Phase E — bookkeeping for the critic pass. Stored in metadata so the UI
    // can show "Reviewed → revised" and so we can audit critique quality over
    // time. Stays null when the critic is off or approves without changes.
    let appliedCritique: SynthesisCritique | null = null;
    let originalPlanBeforeRefine: SynthesisPlan | null = null;
    // Diagnostic — single-string state machine so the API response can tell
    // us exactly which branch ran without trawling Vercel runtime logs.
    let criticState:
      | "disabled"
      | "no-plan"
      | "budget-skip-critic"
      | "budget-skip-refine"
      | "critic-failed"
      | "approved"
      | "revised"
      | "refine-failed" = "disabled";
    if (groupMode && responses.length >= 2 && !threadUuid) {
      synthesisResult = await generateSynthesis(
        message,
        responses.map((r) => ({ agent: r.agent, response: r.response })),
        // Pass an extended history that also includes the drafts we just
        // inserted, so Atlas's synthesis line in the channel doesn't conflict
        // with what every other agent just said. cheaper than re-fetching.
        [
          ...history,
          ...responses.map((r) => ({
            speaker: r.agent,
            content: r.response,
            createdAt: new Date().toISOString(),
          })),
        ],
        channelName,
        targets
      );

      // Phase E — critic pass. Gated behind CC_SYNTHESIS_CRITIC=1 so we can
      // burn it in for a few sessions before defaulting on. Only runs when we
      // actually got a structured plan from the initial synthesis; without a
      // plan there's nothing structural to critique.
      //
      // Wall-clock budget guard: maxDuration on this route is 90s. We budget
      // ~20s for critic and ~25s for an optional refine, so we skip the critic
      // entirely if we're already past 60s. Better to ship an unreviewed plan
      // than to hit the platform timeout and lose everything.
      const elapsedMsAtCritic = Date.now() - postStartedAt;
      const criticEnvOn =
        cleanEnv("CC_SYNTHESIS_CRITIC") === "1" ||
        cleanEnv("CC_SYNTHESIS_CRITIC") === "true";
      // Fan-out guard: with 4+ parallel drafts the slowest agent alone can eat
      // 30+s before synthesis even starts. Adding critic + maybe-refine on top
      // reliably busts the 90s maxDuration ceiling. Cap critic to groups of 3
      // or fewer where the latency math actually fits.
      const fanOutFits = targets.length <= 3;
      const criticOn =
        criticEnvOn && fanOutFits && elapsedMsAtCritic < 60_000;
      if (!criticEnvOn) {
        criticState = "disabled";
      } else if (!synthesisResult?.plan || !synthesisResult?.text) {
        criticState = "no-plan";
      } else if (!fanOutFits) {
        criticState = "budget-skip-critic";
        console.log(
          `[chat] critic skipped (fan-out) — targets=${targets.length}`
        );
      } else if (!criticOn) {
        criticState = "budget-skip-critic";
        console.log(
          `[chat] critic skipped (budget) — elapsed=${elapsedMsAtCritic}ms`
        );
      }
      if (criticOn && synthesisResult?.plan && synthesisResult.text) {
        const critique = await generateCritique(
          message,
          responses.map((r) => ({ agent: r.agent, response: r.response })),
          synthesisResult.text,
          synthesisResult.plan,
          [
            ...history,
            ...responses.map((r) => ({
              speaker: r.agent,
              content: r.response,
              createdAt: new Date().toISOString(),
            })),
          ],
          targets
        );

        // Only run refine if we still have a comfortable budget for it.
        // refineSynthesis runs another full Atlas pass — if elapsed > 70s we
        // ship the original plan + the critique attached so Ramon can still
        // see what would have been fixed.
        const elapsedMsAtRefine = Date.now() - postStartedAt;
        const refineOn = elapsedMsAtRefine < 70_000;
        if (!critique) {
          criticState = "critic-failed";
        } else if (
          critique.verdict === "revise" &&
          critique.revisions.length > 0 &&
          !refineOn
        ) {
          criticState = "budget-skip-refine";
          // Still attach the critique even if we can't refine — Ramon should
          // see what the critic flagged.
          appliedCritique = critique;
        }
        if (
          critique?.verdict === "revise" &&
          critique.revisions.length > 0 &&
          refineOn
        ) {
          const refined = await refineSynthesis(
            message,
            responses.map((r) => ({ agent: r.agent, response: r.response })),
            [
              ...history,
              ...responses.map((r) => ({
                speaker: r.agent,
                content: r.response,
                createdAt: new Date().toISOString(),
              })),
            ],
            channelName,
            targets,
            { text: synthesisResult.text, plan: synthesisResult.plan },
            critique
          );
          if (refined?.text) {
            originalPlanBeforeRefine = synthesisResult.plan;
            synthesisResult = refined;
            appliedCritique = critique;
            criticState = "revised";
          } else {
            // Refine failed — keep the original plan + the critique on the
            // record so the UI still shows that the pass ran.
            appliedCritique = critique;
            criticState = "refine-failed";
          }
        } else if (critique?.verdict === "approve") {
          // Critic looked + approved. Stamp the metadata so we can prove the
          // pass happened even when no revision was needed.
          appliedCritique = critique;
          criticState = "approved";
        }
      }

      if (synthesisResult?.text && svc && channelId) {
        const atlasUUID = AGENT_DM_UUID["atlas"] || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
        const { error: synthErr } = await svc.from("messages").insert({
          channel_id: channelId,
          sender_agent_id: atlasUUID,
          sender_type: "agent",
          content: synthesisResult.text,
          tenant_id: "11111111-1111-1111-1111-111111111111",
          attachments: [],
          status: "sent",
          metadata: {
            kind: "synthesis",
            plan: synthesisResult.plan,
            participants: targets,
            // Phase E — store the critique on the synthesis row when the pass
            // ran. UI uses this to show a small "Reviewed" badge + which fixes
            // were applied. `original_plan` only populated on actual revision
            // so we can audit drift later.
            ...(appliedCritique
              ? {
                  critique: appliedCritique,
                  ...(originalPlanBeforeRefine
                    ? { original_plan: originalPlanBeforeRefine }
                    : {}),
                }
              : {}),
          },
        });
        if (synthErr) {
          console.error("[chat] synthesis insert failed:", synthErr);
        }
      }
    }

    const combined =
      responses.length === 0
        ? ""
        : responses.length === 1
          ? responses[0].response
          : responses.map((x) => `**${x.agent}:** ${x.response}`).join("\n\n");
    const first = responses[0];

    if (userMessageId && svc) {
      await svc
        .from("messages")
        .update({
          status: "delivered",
          delivered_at: new Date().toISOString(),
        })
        .eq("id", userMessageId);
    }

    return NextResponse.json({
      ok: true,
      responses,
      response: combined,
      agent: first?.agent ?? targets[0],
      source: first?.source ?? "fallback",
      targets,
      synthesis: synthesisResult
        ? {
            text: synthesisResult.text,
            plan: synthesisResult.plan,
            source: synthesisResult.source,
            // Phase E — included so the UI can render a "Reviewed" badge (or
            // "Reviewed → revised") and so debug tooling can inspect what the
            // critic flagged + which fixes were applied.
            ...(appliedCritique ? { critique: appliedCritique } : {}),
            ...(originalPlanBeforeRefine
              ? { original_plan: originalPlanBeforeRefine }
              : {}),
            // Diagnostic — always surfaced so we can debug critic gating
            // without trawling Vercel runtime logs.
            critic_state: criticState,
          }
        : null,
    });
  } catch (e) {
    console.error("Chat API error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
