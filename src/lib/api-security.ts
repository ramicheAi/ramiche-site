/**
 * API security utilities — input validation, sanitization, and request verification.
 * No external dependencies. Works with Next.js API routes.
 */

import { NextResponse } from "next/server";

// ── Input Sanitization ──────────────────────────────────────────

/** Strip HTML tags and limit string length */
export function sanitize(input: unknown, maxLen = 500): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/<[^>]*>/g, "")       // strip HTML tags
    .replace(/[<>"'`;]/g, "")      // strip dangerous chars
    .trim()
    .slice(0, maxLen);
}

/** Validate email format */
export function isValidEmail(email: unknown): boolean {
  if (typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

/** Validate that a value is one of allowed options */
export function isOneOf<T extends string>(value: unknown, allowed: T[]): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

// ── Request Validation ──────────────────────────────────────────

/** Parse JSON body safely with size limit */
export async function parseBody<T = Record<string, unknown>>(
  req: Request,
  maxSizeBytes = 10_000
): Promise<{ data: T | null; error: string | null }> {
  try {
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > maxSizeBytes) {
      return { data: null, error: "Request body too large" };
    }

    const text = await req.text();
    if (text.length > maxSizeBytes) {
      return { data: null, error: "Request body too large" };
    }

    const data = JSON.parse(text) as T;
    return { data, error: null };
  } catch {
    return { data: null, error: "Invalid JSON body" };
  }
}

/** Verify request origin matches allowed domains */
export function verifyOrigin(req: Request, allowedOrigins: string[]): boolean {
  const origin = req.headers.get("origin") || "";
  const referer = req.headers.get("referer") || "";
  return allowedOrigins.some(
    (allowed) => origin.startsWith(allowed) || referer.startsWith(allowed)
  );
}

// ── Nonce Generation ────────────────────────────────────────────

/** Generate a random nonce for request deduplication */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ── API Key Authentication ──────────────────────────────────
// HMAC-SHA256 request signing for marketplace API consumers
// Keys stored in Firestore: organizations/default/apikeys/{keyId}

/** Verify an API key from the Authorization header */
export function extractApiKey(req: Request): string | null {
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  if (auth.startsWith("Apikey ")) return auth.slice(7).trim();
  return req.headers.get("x-api-key") || null;
}

/** Verify HMAC-SHA256 request signature */
export async function verifyRequestSignature(
  req: Request,
  secretKey: string,
  maxAgeMs = 300_000 // 5 min window
): Promise<{ valid: boolean; reason?: string }> {
  const signature = req.headers.get("x-signature") || "";
  const timestamp = req.headers.get("x-timestamp") || "";
  const nonce = req.headers.get("x-nonce") || "";

  if (!signature || !timestamp || !nonce) {
    return { valid: false, reason: "Missing signature headers (x-signature, x-timestamp, x-nonce)" };
  }

  // Check timestamp freshness (prevent replay attacks)
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(Date.now() - ts) > maxAgeMs) {
    return { valid: false, reason: "Request timestamp expired or invalid" };
  }

  // Build signing string: timestamp + nonce + method + path
  const url = new URL(req.url);
  const signingString = `${timestamp}:${nonce}:${req.method}:${url.pathname}`;

  // Compute HMAC-SHA256
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signingString));
  const expected = Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");

  if (expected !== signature) {
    return { valid: false, reason: "Invalid signature" };
  }

  return { valid: true };
}

/** Generate an API key pair (call server-side only) */
export function generateApiKeyPair(): { keyId: string; secretKey: string } {
  const keyId = `pk_${generateNonce()}`;
  const secretKey = `sk_${generateNonce()}${generateNonce()}`;
  return { keyId, secretKey };
}

// ── Encryption at Rest ──────────────────────────────────────────
// AES-256-GCM encryption for API keys stored in Firestore

const ENCRYPTION_KEY_ENV = "API_KEY_ENCRYPTION_SECRET";

async function getEncryptionKey(): Promise<CryptoKey> {
  const secret = process.env[ENCRYPTION_KEY_ENV] || "default-dev-key-change-in-production";
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", encoder.encode(secret).slice(0, 32).buffer as ArrayBuffer,
    { name: "PBKDF2" }, false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: encoder.encode("mettle-api-keys"), iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Encrypt a secret key before storing in Firestore */
export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

/** Decrypt a secret key retrieved from Firestore */
export async function decryptSecret(encrypted: string): Promise<string> {
  const key = await getEncryptionKey();
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}

// ── Error Responses ─────────────────────────────────────────────

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function forbidden(message = "Forbidden"): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function serverError(message = "Internal server error"): NextResponse {
  return NextResponse.json({ error: message }, { status: 500 });
}
