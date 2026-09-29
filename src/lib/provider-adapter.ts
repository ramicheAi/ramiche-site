/**
 * Provider adapter (P06 Packet 2): the single SERVER-ONLY place that knows how to call
 * a model provider for Command Center chat. It consolidates request construction, model
 * resolution and result normalisation. It makes NO routing decisions: which provider is
 * tried, in what order, with which prompt and timeout is still decided by the callers
 * (chat route, stream route, approve-synthesis), exactly as before.
 *
 * DO NOT import this module from browser code (enforced by `provider-adapter.test.ts`).
 *
 * Contract
 * - `executeCompletion()`  non-streaming OpenAI-compatible chat completion (claude-max proxy, LM Studio).
 * - `streamCompletion()`   streaming (gemini, deepseek, openrouter). Yields text deltas.
 * - `executeOpenClaw()`    OpenClaw `sessions_send`. OpenClaw is a backend/adapter target: the model
 *                          behind it is not knowable from this repo, so it is reported as "unknown".
 * - `claudeModelForAgent()` / `claudeModelForTier()`  the one tier -> model resolver. The tier itself
 *                          comes from the Agent Registry (`runtime.claudeTier`); env overrides
 *                          CC_CLAUDE_MODEL_{OPUS,SONNET,HAIKU} are read at call time.
 *
 * Every result carries the provider, the model that was REQUESTED (not necessarily the one that
 * served it), latency, and `usage` ONLY when the provider actually returned token counts. Usage is
 * never estimated or defaulted: absent means unknown.
 */

import { claudeTierMap, type ClaudeTier } from "@/lib/agent-registry";
import { gatewaySessionsSend } from "@/lib/openclaw-gateway";

/* ── Shared types ────────────────────────────────────────────────────── */

export type ProviderId = "claude-max" | "lm-studio" | "openclaw" | "gemini" | "deepseek" | "openrouter";

/** Why a call is being made. Informational only; never used to change behavior. */
export interface ExecutionContext {
  agentId?: string;
  purpose?: string;
}

/** Token counts exactly as supplied by the provider. Fields the provider did not send stay undefined. */
export interface UsageMetadata {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  /** A string, or a provider content-part array (e.g. text + image_url). Passed through untouched. */
  content: unknown;
}

/* ── Env + model resolution ──────────────────────────────────────────── */

/** Trim whitespace + control chars from an env value; empty -> undefined. (Was duplicated in the routes.) */
export function cleanEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const cleaned = raw.replace(/[\s\x00-\x1f\x7f]+$/u, "").replace(/^\s+/u, "");
  return cleaned || undefined;
}

export const CLAUDE_MAX_DEFAULT_URL = "http://127.0.0.1:3456/v1/chat/completions";
export const LM_STUDIO_DEFAULT_URL = "http://127.0.0.1:1234/v1/chat/completions";

const CLAUDE_TIER_BY_AGENT: Record<string, ClaudeTier> = claudeTierMap();

/** Claude model for a tier. Env overrides are read at call time. */
export function claudeModelForTier(tier: ClaudeTier): string {
  if (tier === "opus") return cleanEnv("CC_CLAUDE_MODEL_OPUS") || "claude-opus-4-6";
  if (tier === "sonnet") return cleanEnv("CC_CLAUDE_MODEL_SONNET") || "claude-sonnet-4-6";
  return cleanEnv("CC_CLAUDE_MODEL_HAIKU") || "claude-haiku-4-5";
}

/**
 * Claude model for an agent id via the registry's runtime tier. An id with no known tier
 * (unknown agent, or `archivist`) resolves as "sonnet", the long-standing behavior of both
 * routes this replaces.
 */
export function claudeModelForAgent(agentId: string): string {
  return claudeModelForTier(CLAUDE_TIER_BY_AGENT[agentId.toLowerCase()] ?? "sonnet");
}

/** LM Studio serves whatever model is loaded; only pinned when CC_LMSTUDIO_MODEL is set. */
export function lmStudioModel(): string | undefined {
  return cleanEnv("CC_LMSTUDIO_MODEL");
}

/* ── Usage extraction (never fabricates) ─────────────────────────────── */

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** OpenAI-style `usage` object -> UsageMetadata, or undefined when the provider sent no counts. */
export function usageFromOpenAi(u: unknown): UsageMetadata | undefined {
  if (!u || typeof u !== "object") return undefined;
  const o = u as Record<string, unknown>;
  const out: UsageMetadata = {
    promptTokens: num(o.prompt_tokens),
    completionTokens: num(o.completion_tokens),
    totalTokens: num(o.total_tokens),
  };
  return out.promptTokens === undefined && out.completionTokens === undefined && out.totalTokens === undefined
    ? undefined
    : out;
}

/** Gemini `usageMetadata` -> UsageMetadata, or undefined when absent. */
export function usageFromGemini(u: unknown): UsageMetadata | undefined {
  if (!u || typeof u !== "object") return undefined;
  const o = u as Record<string, unknown>;
  const out: UsageMetadata = {
    promptTokens: num(o.promptTokenCount),
    completionTokens: num(o.candidatesTokenCount),
    totalTokens: num(o.totalTokenCount),
  };
  return out.promptTokens === undefined && out.completionTokens === undefined && out.totalTokens === undefined
    ? undefined
    : out;
}

/* ── Non-streaming completion (claude-max proxy, LM Studio) ──────────── */

export interface CompletionRequest {
  provider: "claude-max" | "lm-studio";
  /** Model to request. Omit for LM Studio to let it use whatever is loaded. */
  model?: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  /** Read the (truncated) body of a non-2xx response. Off by default so failures cost nothing extra. */
  captureErrorBody?: boolean;
  context?: ExecutionContext;
}

export type CompletionResult =
  | {
      ok: true;
      provider: "claude-max" | "lm-studio";
      /** The model that was requested (undefined when none was pinned). */
      model: string | undefined;
      /** `choices[0].message.content` as returned; null when missing/empty. Not validated beyond truthiness. */
      text: string | null;
      finishReason?: string;
      usage?: UsageMetadata;
      httpStatus: number;
      latencyMs: number;
    }
  | {
      ok: false;
      provider: "claude-max" | "lm-studio";
      model: string | undefined;
      kind: "http" | "exception";
      httpStatus?: number;
      /** First 200 chars of the response body, only when `captureErrorBody` was set. */
      bodySnippet?: string;
      /** The thrown value for `kind: "exception"`, untouched so callers can format it as they always did. */
      error?: unknown;
      latencyMs: number;
    };

export async function executeCompletion(req: CompletionRequest): Promise<CompletionResult> {
  const isClaude = req.provider === "claude-max";
  const url = isClaude
    ? cleanEnv("CLAUDE_MAX_PROXY_URL") || CLAUDE_MAX_DEFAULT_URL
    : cleanEnv("LM_STUDIO_URL") || LM_STUDIO_DEFAULT_URL;
  const headers: Record<string, string> = isClaude
    ? {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cleanEnv("CLAUDE_MAX_PROXY_TOKEN") || "not-needed"}`,
      }
    : { "Content-Type": "application/json" };

  // Key order matches the original call sites: claude-max sends `model` first, LM Studio appends it last.
  const body: Record<string, unknown> = isClaude ? { model: req.model } : {};
  body.messages = req.messages;
  body.max_tokens = req.maxTokens;
  body.temperature = req.temperature;
  if (!isClaude && req.model) body.model = req.model;

  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(req.timeoutMs),
    });
    if (!res.ok) {
      const snippet = req.captureErrorBody ? (await res.text().catch(() => "")).slice(0, 200) : undefined;
      return {
        ok: false,
        provider: req.provider,
        model: req.model,
        kind: "http",
        httpStatus: res.status,
        ...(snippet !== undefined ? { bodySnippet: snippet } : {}),
        latencyMs: Date.now() - started,
      };
    }
    const data = await res.json();
    const choice = data?.choices?.[0];
    const finish = choice?.finish_reason;
    const usage = usageFromOpenAi(data?.usage);
    return {
      ok: true,
      provider: req.provider,
      model: req.model,
      text: choice?.message?.content || null,
      ...(typeof finish === "string" ? { finishReason: finish } : {}),
      ...(usage ? { usage } : {}),
      httpStatus: res.status,
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    return {
      ok: false,
      provider: req.provider,
      model: req.model,
      kind: "exception",
      error: err,
      latencyMs: Date.now() - started,
    };
  }
}

/* ── Streaming (gemini, deepseek, openrouter) ────────────────────────── */

export interface StreamRequest {
  provider: "gemini" | "deepseek" | "openrouter";
  apiKey: string;
  systemPrompt: string;
  userMessage: string;
  context?: ExecutionContext;
}

export interface StreamOutcome {
  provider: "gemini" | "deepseek" | "openrouter";
  /** Model requested; fixed per streaming provider. */
  model: string;
  /** Set once the response headers arrived. */
  httpStatus?: number;
  /** Only when a streamed chunk carried token counts. Otherwise undefined (unknown). */
  usage?: UsageMetadata;
  latencyMs?: number;
}

export interface StreamHandle {
  provider: StreamRequest["provider"];
  model: string;
  /** Text deltas as they arrive. Yields nothing when the provider responds non-2xx. Throws on network errors. */
  deltas: AsyncGenerator<string, void, unknown>;
  /** Filled in as the stream is consumed; complete after `deltas` finishes. */
  outcome: StreamOutcome;
}

const GEMINI_STREAM_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const STREAM_TIMEOUT_MS = 45_000;

export const STREAM_MODELS = {
  gemini: "gemini-2.0-flash",
  deepseek: "deepseek-chat",
  openrouter: "anthropic/claude-sonnet-4",
} as const;

export function streamCompletion(req: StreamRequest): StreamHandle {
  const model = STREAM_MODELS[req.provider];
  const outcome: StreamOutcome = { provider: req.provider, model };

  async function* run(): AsyncGenerator<string, void, unknown> {
    const started = Date.now();
    let url: string;
    let headers: Record<string, string>;
    let body: Record<string, unknown>;
    if (req.provider === "gemini") {
      url = `${GEMINI_STREAM_URL}&key=${req.apiKey}`;
      headers = { "Content-Type": "application/json" };
      body = {
        system_instruction: { parts: [{ text: req.systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: req.userMessage }] }],
        generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
      };
    } else {
      url = req.provider === "deepseek" ? DEEPSEEK_URL : OPENROUTER_URL;
      headers =
        req.provider === "deepseek"
          ? { "Content-Type": "application/json", Authorization: `Bearer ${req.apiKey}` }
          : {
              "Content-Type": "application/json",
              Authorization: `Bearer ${req.apiKey}`,
              "HTTP-Referer": "https://ramiche-site.vercel.app",
              "X-Title": "Parallax Command Center",
            };
      body = {
        model,
        messages: [
          { role: "system", content: req.systemPrompt },
          { role: "user", content: req.userMessage },
        ],
        max_tokens: 500,
        temperature: 0.7,
        stream: true,
      };
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(STREAM_TIMEOUT_MS),
      });
      outcome.httpStatus = res.status;
      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            if (req.provider === "gemini") {
              const j = JSON.parse(payload) as {
                candidates?: { content?: { parts?: { text?: string }[] } }[];
                usageMetadata?: unknown;
              };
              const u = usageFromGemini(j.usageMetadata);
              if (u) outcome.usage = u;
              const txt = j.candidates?.[0]?.content?.parts?.[0]?.text;
              if (txt) yield txt;
            } else {
              const j = JSON.parse(payload) as {
                choices?: { delta?: { content?: string } }[];
                usage?: unknown;
              };
              const u = usageFromOpenAi(j.usage);
              if (u) outcome.usage = u;
              const txt = j.choices?.[0]?.delta?.content;
              if (txt) yield txt;
            }
          } catch {
            /* ignore partial / malformed chunks */
          }
        }
      }
    } finally {
      outcome.latencyMs = Date.now() - started;
    }
  }

  return { provider: req.provider, model, deltas: run(), outcome };
}

/* ── OpenClaw (backend adapter target) ───────────────────────────────── */

export interface OpenClawRequest {
  sessionKey: string;
  message: string;
  timeoutSeconds: number;
  context?: ExecutionContext;
}

export type OpenClawResult =
  | { ok: true; provider: "openclaw"; model: "unknown"; text: string; latencyMs: number }
  | { ok: false; provider: "openclaw"; model: "unknown"; error: string; latencyMs: number };

/**
 * `sessions_send` through the OpenClaw gateway. The model and provider behind an OpenClaw
 * session are configured outside this repo, so the model is always reported as "unknown".
 */
export async function executeOpenClaw(req: OpenClawRequest): Promise<OpenClawResult> {
  const started = Date.now();
  const gw = await gatewaySessionsSend(req.sessionKey, req.message, req.timeoutSeconds);
  const latencyMs = Date.now() - started;
  if (gw.ok && gw.reply) return { ok: true, provider: "openclaw", model: "unknown", text: gw.reply, latencyMs };
  return {
    ok: false,
    provider: "openclaw",
    model: "unknown",
    error: !gw.ok && "error" in gw ? gw.error : "no reply",
    latencyMs,
  };
}
