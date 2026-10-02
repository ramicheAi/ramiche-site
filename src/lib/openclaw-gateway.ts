/**
 * OpenClaw Gateway HTTP — POST /tools/invoke
 * Docs: https://docs.clawd.bot/gateway/tools-invoke-http-api
 *
 * Requires `sessions_send` (chat) and/or `sessions_spawn` (YOLO approve) removed from
 * the gateway HTTP deny list in openclaw.json when calling from this app.
 *
 * Env:
 * - OPENCLAW_GATEWAY_URL — default http://127.0.0.1:24511 (matches the live
 *   port in ~/.openclaw/openclaw.json on Ramon's Mac). The earlier 18789 was
 *   stale — corrected May 2026.
 * - OPENCLAW_GATEWAY_TOKEN or OPENCLAW_GATEWAY_PASSWORD — Bearer value (see
 *   gateway.auth.token in openclaw.json).
 */

import { openclawSessionKeyMap } from "@/lib/agent-registry";
import { AGENT_DM_UUID } from "@/lib/cc-agent-dm-uuids";
import { isLegacyDmChannel } from "@/lib/dm-conversations";

const DEFAULT_BASE = "http://127.0.0.1:24511";

export function isOpenClawGatewayConfigured(): boolean {
  const t = process.env.OPENCLAW_GATEWAY_TOKEN?.trim();
  const p = process.env.OPENCLAW_GATEWAY_PASSWORD?.trim();
  return !!(t || p);
}

function baseUrl(): string {
  const u = process.env.OPENCLAW_GATEWAY_URL?.trim() || DEFAULT_BASE;
  return u.replace(/\/$/, "");
}

function bearer(): string | null {
  const t = process.env.OPENCLAW_GATEWAY_TOKEN?.trim();
  if (t) return t;
  const p = process.env.OPENCLAW_GATEWAY_PASSWORD?.trim();
  return p || null;
}

export async function gatewayToolsInvoke(body: {
  tool: string;
  action?: string;
  args?: Record<string, unknown>;
  sessionKey?: string;
}): Promise<{ ok: true; result: unknown } | { ok: false; error: string; status?: number }> {
  const auth = bearer();
  if (!auth) {
    return { ok: false, error: "OPENCLAW_GATEWAY_TOKEN or OPENCLAW_GATEWAY_PASSWORD not set" };
  }

  try {
    const res = await fetch(`${baseUrl()}/tools/invoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth}`,
      },
      body: JSON.stringify({
        tool: body.tool,
        action: body.action ?? "json",
        args: body.args ?? {},
        sessionKey: body.sessionKey,
        dryRun: false,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok) {
      const err =
        typeof data.error === "object" && data.error !== null && "message" in data.error
          ? String((data.error as { message?: string }).message)
          : JSON.stringify(data);
      return { ok: false, error: err || res.statusText, status: res.status };
    }

    if (data.ok === false) {
      const err =
        typeof data.error === "object" && data.error !== null && "message" in data.error
          ? String((data.error as { message?: string }).message)
          : JSON.stringify(data.error ?? data);
      return { ok: false, error: err };
    }

    return { ok: true, result: data.result };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Built-in CC agent id → OpenClaw `sessionKey` mapping. Confirmed via live
 *  `sessions_list` on the gateway (May 2026 post-prune). Every agent runs a
 *  primary session keyed `agent:<short>:main`. Names that diverge from the
 *  lowercased CC agent id:
 *    atlas      → main      (internal agent name is literally "main")
 *    drstrange  → strange
 *    michael    → swimelite
 *    themaestro → maestro
 *  Env OPENCLAW_AGENT_SESSION_KEYS (JSON) overrides this map per agent. */
const DEFAULT_AGENT_SESSION_KEYS: Record<string, string> = openclawSessionKeyMap();

/** Map UI agent id → OpenClaw session key. Lookup priority:
 *    1. env OPENCLAW_AGENT_SESSION_KEYS JSON map (per-agent override)
 *    2. built-in DEFAULT_AGENT_SESSION_KEYS map (sane defaults from
 *       openclaw.json on Ramon's Mac)
 *    3. env OPENCLAW_CHAT_SESSION_KEY (global default)
 *    4. literal "main" (Atlas session) — last-resort safe default. */
export function resolveChatSessionKey(agentId: string, conversationId?: string): string {
  const base = resolveAgentSessionKey(agentId);
  if (!conversationId) return base;
  const agentUuid = AGENT_DM_UUID[agentId.toLowerCase()] ?? null;
  // A legacy DM (conversation id === the agent's own uuid) keeps the historical key, so the sessions that
  // already exist on the gateway stay attached and nothing about the old DMs changes.
  if (agentUuid && isLegacyDmChannel(conversationId, agentUuid)) return base;
  return conversationScopedSessionKey(base, conversationId);
}

/** The per-agent key, exactly as it resolved before conversations existed. */
function resolveAgentSessionKey(agentId: string): string {
  const id = agentId.toLowerCase();
  const raw = process.env.OPENCLAW_AGENT_SESSION_KEYS?.trim();
  if (raw) {
    try {
      const map = JSON.parse(raw) as Record<string, string>;
      if (map[id]) return map[id];
      if (map["*"]) return map["*"];
    } catch {
      /* malformed env JSON — fall through to defaults */
    }
  }
  if (DEFAULT_AGENT_SESSION_KEYS[id]) return DEFAULT_AGENT_SESSION_KEYS[id];
  return process.env.OPENCLAW_CHAT_SESSION_KEY?.trim() || "agent:main:main";
}

/**
 * Give one conversation its own gateway session while keeping the AGENT segment of the key intact, so the
 * Parallax agent identity is still legible in `sessions_list` and only the session slot differs.
 *
 *   agent:triage:main  +  3fa1b2c3-… ->  agent:triage:c-3fa1b2c3d4e5
 *
 * Keys of the canonical `a:b:c` shape have their LAST segment replaced (the session slot). Any other shape
 * (an operator override such as "triage-main") gets the segment appended, so a custom key is never mangled.
 * The suffix is a deterministic 12 hex characters of the conversation uuid: same conversation, same key,
 * every request, and no two conversations collide.
 */
export function conversationScopedSessionKey(baseKey: string, conversationId: string): string {
  const suffix = `c-${conversationId.replace(/-/g, "").slice(0, 12).toLowerCase()}`;
  const parts = baseKey.split(":");
  if (parts.length >= 3) return [...parts.slice(0, -1), suffix].join(":");
  return `${baseKey}:${suffix}`;
}

/**
 * Pull the assistant's reply string out of the gateway response payload.
 *
 * The gateway returns one of several shapes depending on version / tool call;
 * we try each in priority order:
 *   1. `result.details.reply`             — current OpenClaw shape (verified live)
 *   2. `result.content[0].text` (parsed)  — MCP-style content envelope; the text
 *                                            itself is JSON containing `.reply`
 *   3. `result.reply`                     — older / direct shape
 *   4. `result.reply.{text,content}`      — older shape where reply is an object
 *   5. `result.message`                   — last-resort wrapper
 *   6. plain string                       — straight reply
 */
function extractSessionsSendReply(result: unknown): string | null {
  if (result == null) return null;
  if (typeof result === "string") return result;
  if (typeof result !== "object") return null;
  const r = result as Record<string, unknown>;

  // 1. Current shape: { details: { reply: "..." } }
  if (r.details && typeof r.details === "object") {
    const d = r.details as Record<string, unknown>;
    if (typeof d.reply === "string" && d.reply.trim()) return d.reply;
  }

  // 2. MCP content envelope: { content: [{ type: "text", text: "<json>" }] }
  if (Array.isArray(r.content) && r.content.length > 0) {
    const first = r.content[0] as Record<string, unknown> | null;
    if (first && typeof first.text === "string") {
      try {
        const parsed = JSON.parse(first.text) as Record<string, unknown>;
        if (typeof parsed.reply === "string" && parsed.reply.trim()) return parsed.reply;
        if (parsed.reply && typeof parsed.reply === "object") {
          const rep = parsed.reply as Record<string, unknown>;
          if (typeof rep.text === "string") return rep.text;
          if (typeof rep.content === "string") return rep.content;
        }
      } catch {
        // not JSON — fall through and use the raw text as the reply
        if (first.text.trim()) return first.text;
      }
    }
  }

  // 3. Older direct shape: { reply: "..." }
  if (typeof r.reply === "string" && r.reply.trim()) return r.reply;
  if (r.reply && typeof r.reply === "object") {
    const rep = r.reply as Record<string, unknown>;
    if (typeof rep.text === "string") return rep.text;
    if (typeof rep.content === "string") return rep.content;
  }

  // 4. Last-resort: { message: "..." }
  if (typeof r.message === "string" && r.message.trim()) return r.message;
  return null;
}

/**
 * Send user message into a real OpenClaw session and wait for assistant reply (when policy allows).
 */
export async function gatewaySessionsSend(
  sessionKey: string,
  message: string,
  timeoutSeconds = 90
): Promise<{ ok: true; reply: string; raw: unknown } | { ok: false; error: string }> {
  const inv = await gatewayToolsInvoke({
    tool: "sessions_send",
    args: { sessionKey, message, timeoutSeconds },
  });
  if (!inv.ok) return inv;

  const reply = extractSessionsSendReply(inv.result);
  if (reply?.trim()) {
    return { ok: true, reply: reply.trim(), raw: inv.result };
  }

  return {
    ok: false,
    error: "Gateway returned no reply text (check sessions_send policy / timeout)",
  };
}

/**
 * Spawn a delegated sub-agent run (YOLO promotion, task start).
 */
export async function gatewaySessionsSpawn(params: {
  task: string;
  agentId?: string;
  label?: string;
}): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  const inv = await gatewayToolsInvoke({
    tool: "sessions_spawn",
    args: {
      task: params.task,
      agentId: params.agentId,
      label: params.label,
      runtime: "subagent",
    },
  });
  if (!inv.ok) return inv;
  return { ok: true, result: inv.result };
}
