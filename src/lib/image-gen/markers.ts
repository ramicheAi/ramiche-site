/**
 * Shared image-marker processor.
 *
 * Agents are instructed to embed `[GENERATE_IMAGE: <prompt>]` markers inline
 * anywhere they want a rendered image to appear. This module:
 *   1. Extracts every marker from a piece of agent text
 *   2. Generates each image in parallel (server-side, no HTTP round-trip)
 *   3. Uploads to Supabase Storage bucket `agent-output`
 *   4. Replaces each marker in the text with a short stub
 *   5. Returns the rewritten text + an array of attachments
 *
 * Why direct calls instead of fetching /api/command-center/image-gen:
 *   Vercel's Deployment Protection returns 401 on internal HTTPS calls between
 *   functions in the same deployment (preview URLs require auth). Calling the
 *   image-gen route via fetch from inside the chat route produced
 *   "[image-gen failed: HTTP 401]" stubs everywhere. Skipping HTTP and going
 *   straight to the library + Supabase Storage avoids that entirely AND is
 *   noticeably faster (no JSON serialize → HTTPS → deserialize round-trip).
 *
 * The HTTP route /api/command-center/image-gen still exists for EXTERNAL
 * callers (UI components, scripts) that want to dispatch a generation
 * without re-implementing the upload step.
 *
 * Used by both Phase A (chat/route.ts, regular agent replies) and Phase C
 * (cc-approve-synthesis.ts, approved-deliverable dispatches). Living here
 * means a single update reaches every path that persists agent text.
 *
 * Cap at MAX_IMAGES_PER_REPLY to bound cost from a runaway agent.
 */

import { createClient } from "@supabase/supabase-js";
import { generateImage } from "./index";

const GENERATE_IMAGE_RE = /\[GENERATE_IMAGE:\s*([^\]]+?)\]/g;
const MAX_IMAGES_PER_REPLY = 8;
const BUCKET = "agent-output";

export type GeneratedAttachment = { url: string; name: string; type: string };

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
async function uploadBytes(
  bytes: Buffer,
  contentType: string,
  filenameHint: string
): Promise<string | null> {
  const svc = getSupabaseService();
  if (!svc) return null;
  const ext =
    contentType === "image/jpeg" ? "jpg" : contentType === "image/webp" ? "webp" : "png";
  const safe = filenameHint.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "image";
  const path = `agent/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safe}.${ext}`;
  const { error } = await svc.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (error) {
    console.warn("[markers] supabase upload failed:", error.message);
    return null;
  }
  const { data: pub } = svc.storage.from(BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}

/** Derive a short, filesystem-safe slug from the prompt so generated assets
 *  are findable later. "dark gradient, single glowing cyan node, 1:1 square"
 *  becomes "dark-gradient-single-glowing-cyan-node". Filler words are stripped
 *  so the slug stays readable at a glance. */
function slugFromPrompt(prompt: string): string {
  const stop = new Set([
    "a", "an", "the", "and", "or", "of", "in", "on", "at", "to", "for",
    "with", "by", "from", "as", "is", "are", "be", "this", "that", "it",
    "px", "1x1", "1080x1080", "square", "minimal",
  ]);
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stop.has(w));
  const slug = words.slice(0, 5).join("-").slice(0, 60);
  return slug || "image";
}

/** Generate + upload one prompt. Returns the public URL + chosen filename. */
async function generateAndUpload(
  prompt: string,
  ownerHint: string,
  index: number
): Promise<{ url: string; name: string; via: string } | { error: string }> {
  try {
    const result = await generateImage({
      prompt,
      agentId: ownerHint,
    });
    if (!result.ok) {
      return { error: result.error };
    }
    let bytes: Buffer;
    let mediaType: string;
    if (result.data.kind === "base64") {
      bytes = Buffer.from(result.data.base64, "base64");
      mediaType = result.data.mediaType;
    } else {
      // Re-fetch the provider's URL so we can host it permanently.
      const fetched = await fetch(result.data.url, {
        signal: AbortSignal.timeout(30_000),
      });
      if (!fetched.ok) {
        return { error: `couldn't re-host provider url (HTTP ${fetched.status})` };
      }
      bytes = Buffer.from(await fetched.arrayBuffer());
      mediaType = fetched.headers.get("content-type") || "image/png";
    }
    // Filename format: <agent>-<YYYY-MM-DD>-<slug>[-<idx>].png
    // The slug makes the file findable later when Ramon needs to dig back
    // through Supabase Storage or his Downloads folder. Index suffix only
    // appears when an agent ships multiple images in one reply.
    const today = new Date().toISOString().slice(0, 10);
    const slug = slugFromPrompt(prompt);
    const suffix = index === 0 ? "" : `-${index + 1}`;
    const friendlyName = `${ownerHint}-${today}-${slug}${suffix}`;
    const url = await uploadBytes(bytes, mediaType, friendlyName);
    if (!url) return { error: "supabase storage upload failed" };
    const ext =
      mediaType === "image/jpeg" ? "jpg" : mediaType === "image/webp" ? "webp" : "png";
    return { url, name: `${friendlyName}.${ext}`, via: result.providerUsed };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Extract markers from `text`, render each one, and return the rewritten
 * text + attachments. Safe to call even if there are no markers (returns
 * the text unchanged with an empty attachments array).
 */
export async function processImageMarkers(
  text: string,
  ownerHint: string
): Promise<{ text: string; attachments: GeneratedAttachment[] }> {
  const matches: Array<{ full: string; prompt: string }> = [];
  let m: RegExpExecArray | null;
  GENERATE_IMAGE_RE.lastIndex = 0;
  while ((m = GENERATE_IMAGE_RE.exec(text)) !== null) {
    matches.push({ full: m[0], prompt: m[1].trim() });
    if (matches.length >= MAX_IMAGES_PER_REPLY) break;
  }
  if (matches.length === 0) return { text, attachments: [] };

  const results = await Promise.all(
    matches.map(async (match, idx) => {
      const r = await generateAndUpload(match.prompt, ownerHint, idx);
      if ("error" in r) {
        return { ok: false as const, marker: match.full, error: r.error };
      }
      return {
        ok: true as const,
        marker: match.full,
        url: r.url,
        name: r.name, // friendly name from generateAndUpload (agent-date-slug.png)
      };
    })
  );

  let out = text;
  const attachments: GeneratedAttachment[] = [];
  for (const r of results) {
    if (r.ok) {
      out = out.replace(r.marker, `*(rendered: ${r.name})*`);
      attachments.push({ url: r.url, name: r.name, type: "image/png" });
    } else {
      out = out.replace(
        r.marker,
        `*[image-gen failed: ${r.error.slice(0, 180)}]*`
      );
    }
  }
  return { text: out, attachments };
}
