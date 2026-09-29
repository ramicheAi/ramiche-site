import { createHmac, timingSafeEqual } from "node:crypto";
/**
 * P05-B2: shared server-side helpers for the cockpit chat data routes.
 * Every caller is an owner-guarded route handler; this module uses the service
 * role (server only) so the browser never needs anon access to chat tables.
 */
import { NextResponse } from "next/server";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const CC_USER_ID = "00000000-0000-0000-0000-000000000001";
export const CC_TENANT_ID = "11111111-1111-1111-1111-111111111111";

export function noStoreJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export function clampInt(raw: string | null, def: number, min: number, max: number): number {
  const n = raw === null ? def : Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

/** Parse a comma-separated list of message UUIDs (max `max`); invalid entries are rejected, not ignored. */
export function parseUuidList(raw: string | null, max: number): string[] | null {
  if (!raw) return [];
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length > max) return null;
  if (!parts.every((p) => UUID_RE.test(p))) return null;
  return Array.from(new Set(parts));
}

export type AttachmentInput = { url: string; name?: string; type?: string; size?: number; mimeType?: string };

function isHttpsUrl(u: string): boolean {
  try { return new URL(u).protocol === "https:"; } catch { return false; }
}

/**
 * Attachments must be same-origin paths or our own Supabase Storage public URLs.
 * `allowHttps` (trusted machine callers only) also admits absolute https URLs on any host.
 * Always rejected: backslashes and control characters (browsers treat `/\host` as
 * `//host`), `..` segments, and every non-https scheme (javascript:, data:, http:).
 */
export function sanitizeAttachments(
  raw: unknown,
  supabaseUrl: string | undefined,
  opts: { allowHttps?: boolean } = {},
): AttachmentInput[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > 20) return null;
  const storagePrefix = supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/` : null;
  const out: AttachmentInput[] = [];
  for (const a of raw) {
    if (!a || typeof a !== "object") return null;
    const o = a as Record<string, unknown>;
    if (typeof o.url !== "string" || o.url.length > 2048) return null;
    if (/[\\\u0000-\u001f\u007f]/.test(o.url) || /(^|\/)\.\.(\/|$)/.test(o.url)) return null;
    // Encoded dot, slash or backslash could normalize outside the allowed prefix (Codex finding 6).
    if (/%(2e|2f|5c)/i.test(o.url)) return null;
    const okUrl = o.url.startsWith("/")
      ? !o.url.startsWith("//")
      : (storagePrefix !== null && o.url.startsWith(storagePrefix)) || (opts.allowHttps === true && isHttpsUrl(o.url));
    if (!okUrl) return null;
    const item: AttachmentInput = { url: o.url };
    if (typeof o.name === "string") item.name = o.name.slice(0, 256);
    if (typeof o.type === "string") item.type = o.type.slice(0, 128);
    if (typeof o.mimeType === "string") item.mimeType = o.mimeType.slice(0, 128);
    if (typeof o.size === "number" && Number.isFinite(o.size) && o.size >= 0) item.size = o.size;
    out.push(item);
  }
  return out;
}

/**
 * Server-side proof that an agent message came through /api/command-center/push
 * (Codex finding 1). Until B3 revokes anon writes, anyone holding the public anon
 * key can insert a message with metadata.speak = true; without this signature the
 * owner's toast would read that text aloud. Keyed by CC_PUSH_SECRET, which never
 * leaves the server. No secret configured means no push is ever relayed.
 */
function pushSigningKey(): string | null {
  const k = process.env.CC_PUSH_SECRET?.trim();
  return k && k.length >= 16 ? k : null;
}

/** Signed pushes older than this are not relayed. */
export const PUSH_MAX_AGE_MS = 2 * 60_000;

/**
 * The push route pre-allocates the message row id and signs it together with the
 * timestamp, channel, agent and content. A copy inserted with the anon key gets a
 * different primary key, so its signature cannot verify; the same row reaching several
 * owner streams verifies on each. No replay cache is needed.
 */
export function pushSignature(rowId: string, channelId: string, agentId: string, content: string, ts: number): string | null {
  const key = pushSigningKey();
  if (!key) return null;
  return createHmac("sha256", key).update(`cc-push\n${rowId}\n${ts}\n${channelId}\n${agentId}\n${content}`).digest("hex");
}

/** True only for a fresh signature minted by the push route for exactly this row. Never throws. */
export function verifyPushSignature(
  rowId: unknown, channelId: unknown, agentId: unknown, content: unknown, sig: unknown, ts: unknown, now: number = Date.now(),
): boolean {
  if (typeof rowId !== "string" || !UUID_RE.test(rowId)) return false;
  if (typeof channelId !== "string" || typeof agentId !== "string" || typeof content !== "string") return false;
  if (typeof sig !== "string" || !/^[0-9a-f]{64}$/.test(sig)) return false;
  if (typeof ts !== "number" || !Number.isSafeInteger(ts) || ts > now + 5_000 || now - ts > PUSH_MAX_AGE_MS) return false;
  const expected = pushSignature(rowId, channelId, agentId, content, ts);
  if (!expected) return false;
  return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
}
