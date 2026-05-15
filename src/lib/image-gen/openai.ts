/**
 * OpenAI Images API client.
 *
 * Endpoint: https://api.openai.com/v1/images/generations
 * Models:
 *   - gpt-image-1   (default — cheaper, supports transparent background, returns b64_json)
 *   - dall-e-3      (fallback — only one image per call, returns URL)
 *
 * The key comes from OPENAI_IMAGE_API_KEY (NOT the proxy `OPENAI_API_KEY`
 * which is set to "not-needed" in OpenClaw to route chat completions through
 * the local Claude Max bridge — that bridge doesn't speak the Images API).
 */

import type { ImageGenRequest } from "./index";

const ENDPOINT = "https://api.openai.com/v1/images/generations";

type OpenAIImagesResponse = {
  data?: Array<{ b64_json?: string; url?: string }>;
  error?: { message?: string };
};

function cleanEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  return raw.replace(/[\s\x00-\x1f\x7f]+$/u, "").replace(/^\s+/u, "") || undefined;
}

/** Map any incoming size string to the closest supported gpt-image-1 / dall-e-3 size. */
function normalizeSize(model: string, size?: string): string {
  const s = (size || "").toLowerCase();
  if (model.startsWith("dall-e-3")) {
    if (s.includes("1792x1024") || s.includes("landscape")) return "1792x1024";
    if (s.includes("1024x1792") || s.includes("portrait")) return "1024x1792";
    return "1024x1024";
  }
  // gpt-image-1 family
  if (s.includes("1536x1024") || s.includes("landscape")) return "1536x1024";
  if (s.includes("1024x1536") || s.includes("portrait")) return "1024x1536";
  return "1024x1024";
}

export async function generateWithOpenAI(req: ImageGenRequest): Promise<
  | {
      ok: true;
      data: { kind: "base64"; mediaType: string; base64: string } | { kind: "url"; url: string };
    }
  | { ok: false; error: string; notConfigured?: boolean }
> {
  const apiKey = cleanEnv("OPENAI_IMAGE_API_KEY") || cleanEnv("OPENAI_API_KEY");
  if (!apiKey || apiKey === "not-needed") {
    return {
      ok: false,
      notConfigured: true,
      error:
        "OPENAI_IMAGE_API_KEY not set. Pull the real key from ~/.openclaw/openclaw.json → skills.entries['openai-image-gen'].apiKey into .env.local.",
    };
  }

  const requestedModel = cleanEnv("OPENAI_IMAGE_MODEL") || "gpt-image-1";
  const size = normalizeSize(requestedModel, req.size);
  const quality = req.quality || (requestedModel.startsWith("dall-e-3") ? "standard" : "high");

  // gpt-image-1 returns base64 by default; dall-e-3 returns URL.
  // We don't ask for a specific format and just handle whatever the API gives back.
  const body: Record<string, unknown> = {
    model: requestedModel,
    prompt: req.prompt.slice(0, 4000), // OpenAI prompt cap
    n: 1,
    size,
  };
  // dall-e-3 doesn't accept "high"/"medium"/"low" — only "standard"/"hd"
  if (requestedModel.startsWith("dall-e-3")) {
    body.quality = quality === "hd" ? "hd" : "standard";
  } else {
    body.quality = quality;
  }

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000), // image gen can take 30-60s
    });
  } catch (err) {
    return {
      ok: false,
      error: `OpenAI Images request failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  let parsed: OpenAIImagesResponse;
  try {
    parsed = (await res.json()) as OpenAIImagesResponse;
  } catch {
    return { ok: false, error: `OpenAI Images returned non-JSON (HTTP ${res.status})` };
  }

  if (!res.ok) {
    return {
      ok: false,
      error: parsed.error?.message || `OpenAI Images HTTP ${res.status}`,
    };
  }

  const first = parsed.data?.[0];
  if (!first) {
    return { ok: false, error: "OpenAI Images returned no images" };
  }

  if (first.b64_json) {
    return {
      ok: true,
      data: { kind: "base64", mediaType: "image/png", base64: first.b64_json },
    };
  }
  if (first.url) {
    return { ok: true, data: { kind: "url", url: first.url } };
  }

  return { ok: false, error: "OpenAI Images response had no b64_json or url" };
}
