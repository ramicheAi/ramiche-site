/**
 * Image-gen provider abstraction for CC chat agents.
 *
 * Why this exists:
 *   When @aetherion ships a "carousel concept" today, the deliverable is just
 *   a written description of 5 slides. Ramon wants the actual .png/.jpg files.
 *   This module turns prompts into image URLs that get attached to the agent's
 *   chat message as real media.
 *
 * Providers wired in this commit:
 *   - openai  : OpenAI Images API (gpt-image-1 default, dall-e-3 fallback).
 *               Real key sourced from ~/.openclaw/openclaw.json into
 *               OPENAI_IMAGE_API_KEY (kept separate from the proxy
 *               OPENAI_API_KEY so chat completions don't accidentally hit
 *               the paid API).
 *   - gemini  : Gemini 3 Pro Image aka "Nano Banana Pro". Uses GEMINI_API_KEY
 *               which is already in env.
 *
 * Stubbed (returns notConfigured error until creds land):
 *   - midjourney : Routes to a third-party Discord proxy (useapi.net / GoAPI /
 *                  imagineapi.dev). Needs MIDJOURNEY_PROXY_URL +
 *                  MIDJOURNEY_PROXY_TOKEN before it can dispatch.
 *   - local      : Automatic1111-compatible HTTP API (Draw Things server,
 *                  ComfyUI, Fooocus). Needs LOCAL_SD_URL.
 *
 * Routing:
 *   - Per-agent map via AGENT_IMAGE_PROVIDERS env (JSON: {"aetherion":"openai"})
 *   - System default via IMAGE_GEN_DEFAULT_PROVIDER (default: "openai")
 *   - Caller can also force a specific provider via the `provider` arg.
 */

import { generateWithOpenAI } from "./openai";
import { generateWithGemini } from "./gemini";

export type ImageGenProvider =
  | "openai"
  | "gemini"
  | "midjourney"
  | "local"
  | "auto";

export type ImageGenRequest = {
  prompt: string;
  /** Lowercased agent short id (`aetherion`, `themaestro`, …). Used by the
   *  router to pick a provider when none is specified explicitly. */
  agentId?: string;
  provider?: ImageGenProvider;
  /** Square 1024x1024 by default. Provider-specific sizes are normalized
   *  inside each implementation; pass any reasonable WxH string. */
  size?: string;
  /** OpenAI quality knob: "auto" | "high" | "medium" | "low". Ignored by other providers. */
  quality?: string;
};

export type ImageGenResult =
  | {
      ok: true;
      /** Either a base64 data URL (when provider returns inline bytes) or a
       *  remote URL the caller must upload to its own storage. The route
       *  handler re-uploads everything to Supabase Storage so the chat can
       *  attach a stable public URL regardless of provider. */
      data: { kind: "base64"; mediaType: string; base64: string } | { kind: "url"; url: string };
      providerUsed: ImageGenProvider;
      latencyMs: number;
    }
  | {
      ok: false;
      error: string;
      providerUsed: ImageGenProvider;
      notConfigured?: boolean;
    };

function cleanEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  return raw.replace(/[\s\x00-\x1f\x7f]+$/u, "").replace(/^\s+/u, "") || undefined;
}

function parseAgentProviderMap(): Record<string, ImageGenProvider> {
  const raw = cleanEnv("AGENT_IMAGE_PROVIDERS");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: Record<string, ImageGenProvider> = {};
    for (const [agent, prov] of Object.entries(parsed)) {
      const p = prov.toLowerCase();
      if (p === "openai" || p === "gemini" || p === "midjourney" || p === "local") {
        out[agent.toLowerCase()] = p;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Pick the provider for a given request:
 *   1. Explicit `provider` (unless "auto")
 *   2. Per-agent override from AGENT_IMAGE_PROVIDERS
 *   3. System default IMAGE_GEN_DEFAULT_PROVIDER (default "openai")
 */
export function resolveProvider(req: ImageGenRequest): ImageGenProvider {
  if (req.provider && req.provider !== "auto") return req.provider;
  const map = parseAgentProviderMap();
  if (req.agentId && map[req.agentId.toLowerCase()]) {
    return map[req.agentId.toLowerCase()];
  }
  const def = cleanEnv("IMAGE_GEN_DEFAULT_PROVIDER")?.toLowerCase();
  if (def === "gemini" || def === "midjourney" || def === "local" || def === "openai") {
    return def;
  }
  return "openai";
}

/**
 * Top-level entry point. Resolves the provider, dispatches, and returns a
 * unified result. The route handler is the only caller — it then uploads the
 * raw bytes/URL to Supabase Storage and returns a stable public URL.
 */
export async function generateImage(req: ImageGenRequest): Promise<ImageGenResult> {
  const provider = resolveProvider(req);
  const t = Date.now();

  try {
    switch (provider) {
      case "openai": {
        const r = await generateWithOpenAI(req);
        return r.ok
          ? { ok: true, data: r.data, providerUsed: "openai", latencyMs: Date.now() - t }
          : { ok: false, error: r.error, providerUsed: "openai", notConfigured: r.notConfigured };
      }
      case "gemini": {
        const r = await generateWithGemini(req);
        return r.ok
          ? { ok: true, data: r.data, providerUsed: "gemini", latencyMs: Date.now() - t }
          : { ok: false, error: r.error, providerUsed: "gemini", notConfigured: r.notConfigured };
      }
      case "midjourney":
        return {
          ok: false,
          providerUsed: "midjourney",
          notConfigured: true,
          error:
            "Midjourney proxy not configured. Set MIDJOURNEY_PROXY_URL and MIDJOURNEY_PROXY_TOKEN (useapi.net / GoAPI / imagineapi.dev) to enable.",
        };
      case "local":
        return {
          ok: false,
          providerUsed: "local",
          notConfigured: true,
          error:
            "Local image-gen server not configured. Install Draw Things (Mac App Store, enable Server) or ComfyUI, then set LOCAL_SD_URL=http://127.0.0.1:7860 (Automatic1111-compatible).",
        };
      default:
        return {
          ok: false,
          providerUsed: provider,
          error: `Unknown image-gen provider: ${provider}`,
        };
    }
  } catch (err) {
    return {
      ok: false,
      providerUsed: provider,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
