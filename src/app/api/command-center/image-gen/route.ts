/**
 * Image-gen API.
 *
 * POST /api/command-center/image-gen
 *   body: { prompt: string, agentId?: string, provider?: string, size?: string, quality?: string }
 *   resp: { ok: true, url: string, providerUsed: string, latencyMs: number }
 *       | { ok: false, error: string, providerUsed: string, notConfigured?: boolean }
 *
 * Flow:
 *   1. Resolve provider (openai default, gemini override per-agent, etc.)
 *   2. Call the appropriate library client (src/lib/image-gen/*)
 *   3. If the provider returns base64 bytes, upload to Supabase Storage
 *      bucket `agent-output` and return the public URL.
 *   4. If the provider returns a remote URL (e.g. dall-e-3), re-fetch and
 *      re-upload to Supabase so the chat has a stable public asset that
 *      won't expire (OpenAI's URLs expire ~1 hour after generation).
 *
 * Storage requirement:
 *   Create a public Supabase Storage bucket named `agent-output` (settings
 *   identical to chat-attachments). The route will gracefully fall back to
 *   returning the raw remote URL if the bucket doesn't exist or service
 *   role isn't configured.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateImage, type ImageGenProvider } from "@/lib/image-gen";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120; // image gen can take 30-60s, plus upload

const BUCKET = "agent-output";

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

/** Persist arbitrary bytes to Supabase Storage and return the public URL. */
async function uploadToSupabase(
  bytes: Buffer,
  contentType: string,
  filenameHint: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const svc = getSupabaseService();
  if (!svc) {
    return { ok: false, error: "Supabase service role not configured — can't persist image." };
  }
  const ext = contentType === "image/jpeg" ? "jpg" : contentType === "image/webp" ? "webp" : "png";
  const safe =
    filenameHint
      .replace(/[^\w.\-]+/g, "_")
      .slice(0, 80) || "image";
  const path = `agent/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safe}.${ext}`;
  const { error: upErr } = await svc.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (upErr) {
    return { ok: false, error: `Supabase upload failed: ${upErr.message}` };
  }
  const { data: pub } = svc.storage.from(BUCKET).getPublicUrl(path);
  return { ok: true, url: pub.publicUrl };
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    accepts: ["POST"],
    body: {
      prompt: "string (required)",
      agentId: "string (optional — used by per-agent provider routing)",
      provider: "openai | gemini | midjourney | local | auto (optional)",
      size: "1024x1024 | 1536x1024 | 1024x1536 | landscape | portrait (optional)",
      quality: "auto | high | medium | low | hd | standard (optional, provider-specific)",
    },
  });
}

export async function POST(req: NextRequest) {
  let body: {
    prompt?: string;
    agentId?: string;
    provider?: ImageGenProvider;
    size?: string;
    quality?: string;
    filenameHint?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ ok: false, error: "prompt required" }, { status: 400 });
  }

  const result = await generateImage({
    prompt,
    agentId: body.agentId,
    provider: body.provider,
    size: body.size,
    quality: body.quality,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        providerUsed: result.providerUsed,
        notConfigured: result.notConfigured,
      },
      { status: result.notConfigured ? 503 : 502 }
    );
  }

  // Persist to Supabase Storage so the chat has a permanent URL.
  const hint = body.filenameHint || body.agentId || "agent";
  let bytes: Buffer;
  let mediaType: string;

  if (result.data.kind === "base64") {
    bytes = Buffer.from(result.data.base64, "base64");
    mediaType = result.data.mediaType;
  } else {
    // Provider returned a remote URL (e.g. dall-e-3). Re-fetch and re-host.
    try {
      const fetched = await fetch(result.data.url, {
        signal: AbortSignal.timeout(30_000),
      });
      if (!fetched.ok) {
        // Fall through and return the raw URL with a warning.
        return NextResponse.json({
          ok: true,
          url: result.data.url,
          providerUsed: result.providerUsed,
          latencyMs: result.latencyMs,
          warning: `couldn't re-host upstream URL (HTTP ${fetched.status}); returning the provider's expiring URL directly`,
        });
      }
      bytes = Buffer.from(await fetched.arrayBuffer());
      mediaType = fetched.headers.get("content-type") || "image/png";
    } catch (err) {
      return NextResponse.json({
        ok: true,
        url: result.data.url,
        providerUsed: result.providerUsed,
        latencyMs: result.latencyMs,
        warning: `couldn't re-host upstream URL: ${
          err instanceof Error ? err.message : String(err)
        }`,
      });
    }
  }

  const uploaded = await uploadToSupabase(bytes, mediaType, hint);
  if (!uploaded.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: uploaded.error,
        providerUsed: result.providerUsed,
        latencyMs: result.latencyMs,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    url: uploaded.url,
    providerUsed: result.providerUsed,
    latencyMs: result.latencyMs,
    mediaType,
  });
}
