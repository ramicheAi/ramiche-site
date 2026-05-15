/**
 * Gemini 3 Pro Image client (aka "Nano Banana Pro").
 *
 * Endpoint: https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent
 * Model:    gemini-3-pro-image  (or fall back to gemini-2.0-flash-exp-image)
 *
 * Key: GEMINI_API_KEY (already configured for chat fallback path; reused here).
 *
 * Mirrors the behavior of OpenClaw's `nano-banana-pro` skill but called
 * directly from Node instead of via a Python subprocess — the web app can't
 * shell out, and the skill writes to disk on the Mac, which isn't where we
 * want the asset for chat attachments.
 */

import type { ImageGenRequest } from "./index";

function cleanEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  return raw.replace(/[\s\x00-\x1f\x7f]+$/u, "").replace(/^\s+/u, "") || undefined;
}

type GeminiContent = {
  parts: Array<{ text?: string; inlineData?: { data?: string; mimeType?: string } }>;
  role?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: GeminiContent;
    finishReason?: string;
  }>;
  error?: { message?: string };
  promptFeedback?: { blockReason?: string };
};

export async function generateWithGemini(req: ImageGenRequest): Promise<
  | {
      ok: true;
      data: { kind: "base64"; mediaType: string; base64: string } | { kind: "url"; url: string };
    }
  | { ok: false; error: string; notConfigured?: boolean }
> {
  const apiKey = cleanEnv("GEMINI_API_KEY");
  if (!apiKey) {
    return {
      ok: false,
      notConfigured: true,
      error: "GEMINI_API_KEY not set in .env.local",
    };
  }

  // Nano Banana Pro is the marketing name; the API model id can change as
  // Google iterates. Allow override via env so we can pin to a specific
  // version when the default flips under us.
  const model =
    cleanEnv("GEMINI_IMAGE_MODEL") || "gemini-3-pro-image";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${apiKey}`;

  // Gemini image-gen takes the prompt as a regular text part. The response
  // comes back with an inlineData part containing base64 png/jpeg bytes.
  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: req.prompt.slice(0, 4000) }],
      },
    ],
    generationConfig: {
      // Resolution defaults to 1K; allow caller to bump.
      responseModalities: ["IMAGE"],
    },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (err) {
    return {
      ok: false,
      error: `Gemini image request failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  let parsed: GeminiResponse;
  try {
    parsed = (await res.json()) as GeminiResponse;
  } catch {
    return { ok: false, error: `Gemini returned non-JSON (HTTP ${res.status})` };
  }

  if (!res.ok) {
    return { ok: false, error: parsed.error?.message || `Gemini HTTP ${res.status}` };
  }

  if (parsed.promptFeedback?.blockReason) {
    return {
      ok: false,
      error: `Gemini blocked the prompt: ${parsed.promptFeedback.blockReason}`,
    };
  }

  const parts = parsed.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return { ok: false, error: "Gemini returned no image parts" };
  }

  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    return {
      ok: false,
      error: "Gemini response had no inlineData image bytes",
    };
  }

  return {
    ok: true,
    data: {
      kind: "base64",
      mediaType: imagePart.inlineData.mimeType || "image/png",
      base64: imagePart.inlineData.data,
    },
  };
}
