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
