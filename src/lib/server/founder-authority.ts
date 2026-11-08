import { createHmac, timingSafeEqual } from "crypto";

/**
 * Founder authority for privileged Command Center actions (CC-FOUNDER-AUTHORITY-GUARD-01).
 *
 * The only thing that establishes founder authority is a cookie the SERVER
 * minted after a correct PIN (`/api/command-center/auth/pin`) and signed with
 * `COMMAND_CENTER_SESSION_SECRET`. Request bodies, custom headers, query
 * strings, `decided_by` fields and browser `sessionStorage` are never consulted.
 *
 * Token format (cookie value): `v1.<expiresAtMs>.<base64url(HMAC-SHA256)>`
 * where the MAC covers `cc-founder.v1.<expiresAtMs>`. Nothing sensitive is
 * stored in the token; it only proves "the server issued this before <exp>".
 * Rotating the secret revokes every outstanding session.
 *
 * See docs/CC-FOUNDER-AUTHORITY-GUARD-01.md.
 */

export const FOUNDER_SESSION_COOKIE = "cc_founder_session";
export const FOUNDER_SESSION_SECRET_ENV = "COMMAND_CENTER_SESSION_SECRET";
export const FOUNDER_GUARD_ENFORCE_ENV = "CC_FOUNDER_GUARD_ENFORCE";
/** Absolute lifetime. No sliding refresh: re-enter the PIN after this. */
export const FOUNDER_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
/** Cookie is only sent to Command Center API routes. */
export const FOUNDER_SESSION_COOKIE_PATH = "/api/command-center";
const MIN_SECRET_LENGTH = 32;
const TOKEN_VERSION = "v1";
const MAC_CONTEXT = "cc-founder.v1.";

export type FounderAuthorityResult =
  | { authorized: true; expiresAt: number }
  | {
      authorized: false;
      reason: "not_configured" | "missing" | "malformed" | "bad_signature" | "expired";
    };

/** Returns the signing secret, or null when unset / too short to be safe. */
export function getFounderSessionSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const s = env[FOUNDER_SESSION_SECRET_ENV]?.trim();
  return s && s.length >= MIN_SECRET_LENGTH ? s : null;
}

function mac(secret: string, expiresAt: number): string {
  return createHmac("sha256", secret).update(`${MAC_CONTEXT}${expiresAt}`, "utf8").digest("base64url");
}

export function signFounderSession(secret: string, expiresAt: number): string {
  return `${TOKEN_VERSION}.${expiresAt}.${mac(secret, expiresAt)}`;
}

export function mintFounderSession(
  secret: string,
  now: number = Date.now(),
): { value: string; expiresAt: number } {
  const expiresAt = now + FOUNDER_SESSION_TTL_MS;
  return { value: signFounderSession(secret, expiresAt), expiresAt };
}

/** Pure verification of a token string against a secret. */
export function verifyFounderSessionToken(
  token: string | null | undefined,
  secret: string | null,
  now: number = Date.now(),
): FounderAuthorityResult {
  if (!secret) return { authorized: false, reason: "not_configured" };
  if (!token) return { authorized: false, reason: "missing" };
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION || !/^\d{1,16}$/.test(parts[1])) {
    return { authorized: false, reason: "malformed" };
  }
  const expiresAt = Number(parts[1]);
  const expected = Buffer.from(mac(secret, expiresAt), "utf8");
  const given = Buffer.from(parts[2], "utf8");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { authorized: false, reason: "bad_signature" };
  }
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) {
    return { authorized: false, reason: "expired" };
  }
  return { authorized: true, expiresAt };
}

/** Reads one cookie from a raw `Cookie` header (works with plain `Request`). */
export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      const raw = part.slice(eq + 1).trim();
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return null;
}

/**
 * Verify founder authority for an incoming request. Only the signed session
 * cookie is read; no other request field can substitute for it.
 */
export function verifyFounderAuthority(
  request: Request,
  opts: { env?: NodeJS.ProcessEnv; now?: number } = {},
): FounderAuthorityResult {
  const secret = getFounderSessionSecret(opts.env);
  const token = readCookie(request.headers.get("cookie"), FOUNDER_SESSION_COOKIE);
  return verifyFounderSessionToken(token, secret, opts.now);
}

/**
 * Is enforcement switched on for this route key? Default OFF so wiring the
 * guard into a route changes nothing until a human sets
 * `CC_FOUNDER_GUARD_ENFORCE` to `all` or a comma list containing the key.
 */
export function isFounderGuardEnforced(
  routeKey: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env[FOUNDER_GUARD_ENFORCE_ENV]?.trim().toLowerCase();
  if (!raw) return false;
  const keys = raw.split(",").map((k) => k.trim()).filter(Boolean);
  return keys.includes("all") || keys.includes(routeKey.toLowerCase());
}

/**
 * One-call guard for route handlers:
 *
 *   const denied = requireFounderAuthority(request, "yolo-approve");
 *   if (denied) return denied;
 *
 * Returns null when the request may proceed: either enforcement is off for
 * this route (today's behavior) or the signed cookie verified. Returns a 401
 * (no/invalid/expired session) or 503 (enforced but secret missing: fail
 * closed) response otherwise.
 */
export function requireFounderAuthority(
  request: Request,
  routeKey: string,
  opts: { env?: NodeJS.ProcessEnv; now?: number } = {},
): Response | null {
  const env = opts.env ?? process.env;
  if (!isFounderGuardEnforced(routeKey, env)) return null;
  const result = verifyFounderAuthority(request, { env, now: opts.now });
  if (result.authorized) return null;
  if (result.reason === "not_configured") {
    console.error(
      `[founder-authority] ${routeKey}: enforcement on but ${FOUNDER_SESSION_SECRET_ENV} missing or shorter than ${MIN_SECRET_LENGTH} chars; denying`,
    );
    return Response.json(
      { error: "Founder authority is not configured on the server", code: "founder_authority_not_configured" },
      { status: 503 },
    );
  }
  return Response.json(
    { error: "Founder authority required. Unlock the Command Center with the PIN.", code: "founder_authority_required", reason: result.reason },
    { status: 401 },
  );
}

/** Cookie attributes used when the PIN route issues a session. */
export function founderSessionCookieOptions(expiresAt: number, env: NodeJS.ProcessEnv = process.env) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV !== "development",
    sameSite: "strict" as const,
    path: FOUNDER_SESSION_COOKIE_PATH,
    expires: new Date(expiresAt),
  };
}
