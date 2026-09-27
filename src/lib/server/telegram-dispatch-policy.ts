/**
 * Telegram policy.
 *
 * (1) TRANSPORT: the webhook secret is REQUIRED and fails closed when
 *     unconfigured. It authenticates the *transport* (something that knows the
 *     secret), NOT a human.
 *
 * (2) IDENTITY: there is NO verified binding from any Telegram user/chat to the
 *     canonical human principal in the supplied evidence. `from.id`,
 *     `chat.id`, usernames, and chat membership are payload labels — forgeable
 *     by anyone who can reach the webhook with the secret, and in no case a
 *     signed human principal (P01 §3).
 *
 * Therefore consequential dispatch from Telegram is DENIED unconditionally.
 * No env flag enables it; enabling requires a separately established binding
 * (see §8 of the implementation report) under its own Ramon gate.
 */
import { timingSafeEqual } from "node:crypto";

export const TELEGRAM_SECRET_ENV = "TELEGRAM_WEBHOOK_SECRET";
export const TELEGRAM_SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";

export type TelegramTransportDenialReason =
  | "telegram_secret_not_configured"
  | "telegram_secret_missing"
  | "telegram_secret_duplicate"
  | "telegram_secret_mismatch";

export type TelegramTransportResult =
  | { ok: true }
  | { ok: false; reason: TelegramTransportDenialReason; status: 401 | 503 };

function cleanEnv(
  env: Record<string, string | undefined>,
  name: string
): string | null {
  const raw = env[name];
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[\s\x00-\x1f\x7f]+$/u, "").replace(/^\s+/u, "");
  return cleaned || null;
}

/** Machine transport authentication only. Fails closed when unconfigured. */
export function requireTelegramTransport(
  req: { headers: Headers },
  env: Record<string, string | undefined> = process.env
): TelegramTransportResult {
  const expected = cleanEnv(env, TELEGRAM_SECRET_ENV);
  if (!expected) {
    return { ok: false, reason: "telegram_secret_not_configured", status: 503 };
  }
  const raw = req.headers.get(TELEGRAM_SECRET_HEADER);
  if (raw === null || raw.trim() === "") {
    return { ok: false, reason: "telegram_secret_missing", status: 401 };
  }
  if (raw.includes(",")) {
    return { ok: false, reason: "telegram_secret_duplicate", status: 401 };
  }
  const a = Buffer.from(raw, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "telegram_secret_mismatch", status: 401 };
  }
  return { ok: true };
}

/** Documented, machine-readable statement of the missing binding. */
export const TELEGRAM_HUMAN_BINDING = Object.freeze({
  verified: false as const,
  reason: "no_verified_telegram_to_canonical_human_binding",
  note: "Telegram transport auth is not authenticated Ramon identity.",
});

/**
 * Always denies. Takes the update (unused for the decision) so that call sites
 * cannot accidentally imply that some payload shape would be accepted.
 */
export function telegramConsequentialDispatchDecision(
  _update?: unknown
): { allowed: false; reason: "telegram_identity_unverified"; status: 403 } {
  return { allowed: false, reason: "telegram_identity_unverified", status: 403 };
}
