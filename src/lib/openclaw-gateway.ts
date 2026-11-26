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
 * - CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET — Cloudflare Access service
 *   token, required only when the gateway hostname sits behind Access
 *   (e.g. https://openclaw.parallaxvinc.com). Server-only; see
 *   `src/lib/cloudflare-access.ts`.
 */

import { randomUUID } from "node:crypto";

import { openclawSessionKeyMap } from "@/lib/agent-registry";
import {
  cloudflareAccessHeaders,
  detectAccessBlock,
  hostLabel,
} from "@/lib/cloudflare-access";

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
}): Promise<
  | { ok: true; result: unknown }
  | { ok: false; error: string; status?: number; reference?: string }
> {
  const auth = bearer();
  if (!auth) {
    return { ok: false, error: "OPENCLAW_GATEWAY_TOKEN or OPENCLAW_GATEWAY_PASSWORD not set" };
  }

  try {
    // Cloudflare Access service token, when the gateway hostname is behind Access.
    // Absent headers are not an error here: a local/LAN gateway needs none. If the
    // host IS behind Access and the token is missing, the request returns a login
    // page and `detectAccessBlock` below turns that into an explicit error.
    const access = cloudflareAccessHeaders();
    const res = await fetch(`${baseUrl()}/tools/invoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth}`,
        ...(access.configured ? access.headers : {}),
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

    // Must run BEFORE parsing: an intercepted request arrives as a 200 HTML login
    // page, which parses to `{}` and used to surface as "no reply text".
    const blocked = detectAccessBlock(res, hostLabel(baseUrl()));
    if (blocked.blocked) {
      return { ok: false, error: blocked.detail };
    }

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const reference = newReference();

    if (!res.ok) {
      // The raw body is for the log, the sentence is for the operator.
      console.error("[gateway] invoke failed", { reference, status: res.status, body: data });
      return {
        ok: false,
        error: describeGatewayFailure(data, res.status, res.statusText, reference),
        status: res.status,
        reference,
      };
    }

    if (data.ok === false) {
      console.error("[gateway] invoke reported failure", { reference, body: data });
      return {
        ok: false,
        error: describeGatewayFailure(data, res.status, res.statusText, reference),
        reference,
      };
    }

    return { ok: true, result: data.result };
  } catch (e) {
    const reference = newReference();
    console.error("[gateway] invoke threw", { reference, error: e instanceof Error ? e.message : String(e) });
    return {
      ok: false,
      error: `The agent gateway could not be reached. Reference ${reference}. Check that the gateway is running, then try again.`,
      reference,
    };
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
export function resolveChatSessionKey(agentId: string): string {
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
/**
 * A short reference the operator can quote and the server can grep.
 *
 * The gateway's own response bodies can hold routing detail, tenant names and internal hints. None
 * of that belongs on screen, but "something went wrong" is useless in a support thread, so every
 * failure carries this id in the response AND in the server log line that holds the raw body.
 */
function newReference(): string {
  return randomUUID().replace(/-/g, "").slice(0, 8);
}

/**
 * Collapse an upstream message into one safe sentence.
 *
 * No newlines, no control characters, bounded length, and the three things that must never reach a
 * screen even when the gateway puts them in its own error text: bearer credentials, key-shaped
 * tokens, and filesystem paths (which reveal the host layout and the account name).
 */
function safeMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let clean = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return null;
  clean = clean
    .replace(/(bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, "$1[redacted]")
    .replace(/\b(sk|pk|rk|ghp|gho|xox[baprs])[-_][A-Za-z0-9_-]{8,}/gi, "[redacted]")
    .replace(/\b[A-Fa-f0-9]{32,}\b/g, "[redacted]")
    .replace(/\/(?:Users|home|var|private|opt)\/[^\s"']+/g, "[path]")
    .replace(/[A-Za-z]:\\[^\s"']+/g, "[path]");
  return clean.length > 200 ? `${clean.slice(0, 197)}...` : clean;
}

/**
 * Turn whatever the gateway returned into something an operator can read.
 *
 * Before this, a non-2xx response whose body had no `error.message` was surfaced as
 * `JSON.stringify(data)` — the operator was shown raw upstream JSON. The raw body is still logged
 * (with the reference) because an engineer needs it; it is no longer shown to a person.
 */
function describeGatewayFailure(
  data: Record<string, unknown>,
  status: number,
  statusText: string | undefined,
  reference: string,
): string {
  const err = data.error;
  const fromObject =
    err && typeof err === "object" && err !== null && "message" in err
      ? safeMessage((err as { message?: unknown }).message)
      : null;
  const fromString = typeof err === "string" ? safeMessage(err) : null;
  const fromMessage = safeMessage(data.message);
  const base =
    fromObject ??
    fromString ??
    fromMessage ??
    `The agent gateway answered HTTP ${status}${statusText ? ` ${statusText}` : ""}.`;
  // Actionable next step, and an honest one: a 4xx is a policy/configuration refusal that a retry
  // cannot fix, while a 5xx or an unknown status may succeed on a second attempt.
  const guidance =
    status >= 400 && status < 500
      ? "This needs a configuration fix, not a retry."
      : "Try again in a moment.";
  return `${base} Reference ${reference}. ${guidance}`;
}

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
    error: `The agent gateway accepted the turn but returned no reply text. Reference ${newReference()}. Try again in a moment.`,
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
