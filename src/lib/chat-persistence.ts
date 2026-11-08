/**
 * Chat persistence outcomes.
 *
 * WHY THIS EXISTS (CC-RECOVERY-01 evidence, 2026-11-06):
 * `/api/command-center/chat` used to log a Supabase insert error and then keep
 * going, returning HTTP 200 with an agent reply whose `messageId` was null. The
 * client rendered the text optimistically, so the reply looked delivered, then
 * vanished on reload because nothing had been written. A dead database therefore
 * looked like a working chat with disappearing messages.
 *
 * The rule this module enforces: a reply is only reported as a persisted message
 * when a row was actually written. Everything else carries `persisted: false`
 * plus the reason, and a turn where nothing persisted returns a non-2xx status.
 */

export type PersistenceFailure = {
  /** Agent short id ("atlas"), or "synthesis" for the Atlas synthesis card. */
  agent: string;
  /** PostgREST / driver error code when the client supplied one. */
  code?: string;
  /** Human-readable reason, redacted and truncated. Never contains credentials. */
  message: string;
};

export type PersistenceSummary = {
  /** How many writes were attempted (one per agent reply plus the synthesis card). */
  attempted: number;
  /** How many writes succeeded. */
  persisted: number;
  /** How many writes failed. */
  failed: number;
  /** False when at least one write was attempted and none succeeded. */
  ok: boolean;
  failures: PersistenceFailure[];
};

/** Secrets that must never reach a response body, even inside an error string. */
const REDACTIONS: Array<[RegExp, string]> = [
  [/postgres(?:ql)?:\/\/\S+/gi, "postgres://<redacted>"],
  [/sb_secret_[A-Za-z0-9_-]+/g, "sb_secret_<redacted>"],
  [/sb_publishable_[A-Za-z0-9_-]+/g, "sb_publishable_<redacted>"],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\b/g, "<jwt-redacted>"],
  // Strip the token itself before the generic `key=value` rule, which would
  // otherwise consume only the word "Bearer" and leave the secret behind.
  [/\b(bearer)\s+[A-Za-z0-9._\-]{6,}/gi, "$1 <redacted>"],
  [/(apikey|api_key|authorization|bearer|service_role_key)\s*[:=]\s*\S+/gi, "$1=<redacted>"],
  [/([?&](?:key|token|apikey)=)[^&\s]+/gi, "$1<redacted>"],
];

const MAX_MESSAGE = 200;

/** Keep a database error usable for debugging without leaking secrets. */
export function sanitizeDbError(err: unknown): { code?: string; message: string } {
  let code: string | undefined;
  let message = "unknown persistence error";

  if (typeof err === "string") {
    message = err;
  } else if (err && typeof err === "object") {
    const e = err as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
    if (typeof e.code === "string" && e.code.trim()) code = e.code.trim().slice(0, 40);
    const parts = [e.message, e.details, e.hint]
      .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
      .map((p) => p.trim());
    if (parts.length > 0) message = parts.join(" | ");
  }

  let out = message;
  for (const [pattern, replacement] of REDACTIONS) out = out.replace(pattern, replacement);
  out = out.replace(/[\r\n\t]+/g, " ").trim();
  if (out.length > MAX_MESSAGE) out = `${out.slice(0, MAX_MESSAGE)}…`;

  return code ? { code, message: out } : { message: out };
}

/**
 * Collapse write attempts into one verdict.
 *
 * `ok` is true when nothing was attempted (no Supabase configured for the turn,
 * which is a configuration choice, not a write failure) or when at least one
 * write landed. It is false only when every attempted write failed.
 */
export function summarizePersistence(
  attempted: number,
  failures: PersistenceFailure[]
): PersistenceSummary {
  const persisted = Math.max(0, attempted - failures.length);
  return {
    attempted,
    persisted,
    failed: failures.length,
    ok: attempted === 0 || persisted > 0,
    failures,
  };
}
