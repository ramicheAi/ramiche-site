import { createHmac, timingSafeEqual } from "crypto";

/**
 * Founder authority for privileged Command Center actions (CC-FOUNDER-AUTHORITY-GUARD-01,
 * completed by CC-SECURITY-COMPLETION-02).
 *
 * The only things that establish founder authority are:
 *   1. a cookie the SERVER minted after a correct PIN (`/api/command-center/auth/pin`) and
 *      signed with `COMMAND_CENTER_SESSION_SECRET`, sent same-origin; or
 *   2. for a named machine caller, a bearer token compared in constant time against
 *      `COMMAND_CENTER_MACHINE_SECRET`, and only on routes explicitly listed in
 *      `CC_MACHINE_ROUTES`.
 * Request bodies, custom headers, query strings, `decided_by` fields and browser
 * `sessionStorage` are never consulted.
 *
 * Token format (cookie value): `ccf2.<issuedAtMs>.<expiresAtMs>.<base64url(HMAC-SHA256)>`
 * where the MAC covers `cc-founder.v2.<issuedAtMs>.<expiresAtMs>`. Nothing sensitive is
 * stored in the token; it only proves "the server issued this, and when".
 *
 * Revocation:
 *   - Set `CC_FOUNDER_REVOKE_BEFORE` to an epoch-ms value (or ISO timestamp) to reject every
 *     session issued at or before that instant. This is the cheap, stateless kill switch.
 *   - Rotating `COMMAND_CENTER_SESSION_SECRET` revokes every outstanding session at once.
 * Per-device revocation needs a stored session id and is deliberately not pretended here.
 *
 * See docs/CC-FOUNDER-AUTHORITY-GUARD-01.md.
 */

export const FOUNDER_SESSION_COOKIE = "cc_founder_session";
export const FOUNDER_SESSION_SECRET_ENV = "COMMAND_CENTER_SESSION_SECRET";
export const FOUNDER_GUARD_ENFORCE_ENV = "CC_FOUNDER_GUARD_ENFORCE";
export const FOUNDER_REVOKE_BEFORE_ENV = "CC_FOUNDER_REVOKE_BEFORE";
export const MACHINE_SECRET_ENV = "COMMAND_CENTER_MACHINE_SECRET";
export const MACHINE_ROUTES_ENV = "CC_MACHINE_ROUTES";
/** Absolute lifetime. No sliding refresh: re-enter the PIN after this. */
export const FOUNDER_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
/** Cookie is only sent to Command Center API routes. */
export const FOUNDER_SESSION_COOKIE_PATH = "/api/command-center";
/** Tolerance for a small clock difference between the minting and verifying instance. */
export const CLOCK_SKEW_MS = 60 * 1000;
const MIN_SECRET_LENGTH = 32;
export const TOKEN_VERSION = "ccf2";
const MAC_CONTEXT = "cc-founder.v2.";

export type FounderSessionRejection =
  | "not_configured"
  | "missing"
  | "malformed"
  | "bad_signature"
  | "expired"
  | "revoked";

export type FounderAuthorityResult =
  | { authorized: true; expiresAt: number; issuedAt: number }
  | { authorized: false; reason: FounderSessionRejection };

/** Returns the signing secret, or null when unset / too short to be safe. */
export function getFounderSessionSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const s = env[FOUNDER_SESSION_SECRET_ENV]?.trim();
  return s && s.length >= MIN_SECRET_LENGTH ? s : null;
}

/**
 * Reads the revocation cut-off. Accepts epoch milliseconds or any ISO-8601 timestamp.
 * Missing or empty means "nothing revoked" -- no incident, no change from today.
 *
 * A value that IS set but fails to parse is a different situation: the only reason to
 * set this env var at all is to revoke sessions during an incident, so a typo here is
 * far more likely to mean "the operator tried to lock everyone out and fat-fingered the
 * timestamp" than "nothing is wrong." Treating that as "nothing revoked" would silently
 * defeat the kill switch at the exact moment it's needed. Fail closed instead: revoke
 * every session until the value is fixed. The cost is a forced re-entry of the PIN; the
 * alternative is a believed-revoked session that still works.
 */
export function getFounderRevokeBefore(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env[FOUNDER_REVOKE_BEFORE_ENV]?.trim();
  if (!raw) return 0;
  if (/^\d{1,16}$/.test(raw)) return Number(raw);
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) {
    console.error(
      `[founder-authority] ${FOUNDER_REVOKE_BEFORE_ENV} is set but not a valid timestamp ("${raw}"); ` +
        `failing closed -- revoking every session until this is fixed`,
    );
    return Number.POSITIVE_INFINITY;
  }
  return parsed;
}

function mac(secret: string, issuedAt: number, expiresAt: number): string {
  return createHmac("sha256", secret)
    .update(`${MAC_CONTEXT}${issuedAt}.${expiresAt}`, "utf8")
    .digest("base64url");
}

/**
 * Signs a session that expires at `expiresAt`. `issuedAt` defaults to now; tests pin it
 * to exercise the revocation cut-off.
 */
export function signFounderSession(
  secret: string,
  expiresAt: number,
  issuedAt: number = Date.now(),
): string {
  return `${TOKEN_VERSION}.${issuedAt}.${expiresAt}.${mac(secret, issuedAt, expiresAt)}`;
}

export function mintFounderSession(
  secret: string,
  now: number = Date.now(),
): { value: string; expiresAt: number; issuedAt: number } {
  const expiresAt = now + FOUNDER_SESSION_TTL_MS;
  return { value: signFounderSession(secret, expiresAt, now), expiresAt, issuedAt: now };
}

/** Pure verification of a token string against a secret. */
export function verifyFounderSessionToken(
  token: string | null | undefined,
  secret: string | null,
  now: number = Date.now(),
  revokeBefore: number = 0,
): FounderAuthorityResult {
  if (!secret) return { authorized: false, reason: "not_configured" };
  if (token == null) return { authorized: false, reason: "missing" };
  // An empty string is a cookie that is present and wrong, not an absent one.
  if (token === "") return { authorized: false, reason: "malformed" };
  const parts = token.split(".");
  if (
    parts.length !== 4 ||
    parts[0] !== TOKEN_VERSION ||
    !/^\d{1,16}$/.test(parts[1]) ||
    !/^\d{1,16}$/.test(parts[2])
  ) {
    return { authorized: false, reason: "malformed" };
  }
  const issuedAt = Number(parts[1]);
  const expiresAt = Number(parts[2]);
  if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt) || issuedAt > expiresAt) {
    return { authorized: false, reason: "malformed" };
  }
  const expected = Buffer.from(mac(secret, issuedAt, expiresAt), "utf8");
  const given = Buffer.from(parts[3], "utf8");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { authorized: false, reason: "bad_signature" };
  }
  // Revocation is checked before expiry so the audit reason is the true cause.
  if (revokeBefore > 0 && issuedAt <= revokeBefore) return { authorized: false, reason: "revoked" };
  if (issuedAt > now + CLOCK_SKEW_MS) return { authorized: false, reason: "malformed" };
  if (expiresAt <= now) return { authorized: false, reason: "expired" };
  if (now - issuedAt > FOUNDER_SESSION_TTL_MS + CLOCK_SKEW_MS) {
    return { authorized: false, reason: "expired" };
  }
  return { authorized: true, expiresAt, issuedAt };
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
 * Verify founder authority from the signed session cookie. Only that cookie is read;
 * no other request field can substitute for it.
 */
export function verifyFounderAuthority(
  request: Request,
  opts: { env?: NodeJS.ProcessEnv; now?: number } = {},
): FounderAuthorityResult {
  const env = opts.env ?? process.env;
  const secret = getFounderSessionSecret(env);
  const token = readCookie(request.headers.get("cookie"), FOUNDER_SESSION_COOKIE);
  return verifyFounderSessionToken(token, secret, opts.now, getFounderRevokeBefore(env));
}

/** Request methods that cannot cause a state change, so origin does not matter. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Same-origin check for cookie-authenticated mutations (CSRF defense in depth on top of
 * `SameSite=Strict`). Compares the `Origin` host, falling back to `Referer`, against the
 * request host as seen by the app behind the proxy. Missing both headers on a mutation
 * is a rejection: a browser form POST always carries at least one of them.
 */
export function isSameOriginRequest(request: Request): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
  const hostHeader = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!hostHeader) return false;
  const expected = hostHeader.split(",")[0].trim().toLowerCase();
  if (!expected) return false;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const candidate = origin || referer;
  if (!candidate) return false;
  try {
    return new URL(candidate).host.toLowerCase() === expected;
  } catch {
    return false;
  }
}

function machineRouteAllowed(routeKey: string, env: NodeJS.ProcessEnv): boolean {
  const raw = env[MACHINE_ROUTES_ENV]?.trim().toLowerCase();
  if (!raw) return false;
  const keys = raw.split(",").map((k) => k.trim()).filter(Boolean);
  return keys.includes("all") || keys.includes(routeKey.toLowerCase());
}

/**
 * Constant-time check of the machine bearer credential. Two conditions, both required:
 * a secret of at least 32 chars is configured, and this route is explicitly listed in
 * `CC_MACHINE_ROUTES`. Default is no route, so enabling the guard never silently opens a
 * route to machine callers.
 */
export function verifyMachineCredential(
  request: Request,
  routeKey: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const secret = env[MACHINE_SECRET_ENV]?.trim();
  if (!secret || secret.length < MIN_SECRET_LENGTH) return false;
  if (!machineRouteAllowed(routeKey, env)) return false;
  const header = request.headers.get("authorization");
  if (!header || !/^bearer /i.test(header)) return false;
  const given = Buffer.from(header.slice(7).trim(), "utf8");
  const expected = Buffer.from(secret, "utf8");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Is enforcement switched on for this route key? Default OFF so wiring the guard into a
 * route changes nothing until a human sets `CC_FOUNDER_GUARD_ENFORCE` to `all` or a
 * comma list containing the key.
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

function reject(status: number, payload: Record<string, unknown>, headers: Record<string, string> = {}) {
  return Response.json(payload, { status, headers });
}

/**
 * One-call guard for route handlers:
 *
 *   const denied = requireFounderAuthority(request, "yolo-approve");
 *   if (denied) return denied;
 *
 * Returns null when the request may proceed: enforcement is off for this route, the
 * caller presented a verified machine credential, or the signed cookie verified and the
 * mutation was same-origin. Returns a 401 (no/invalid/expired/revoked session), 403
 * (cross-origin mutation) or 503 (enforced but no signing secret: fail closed).
 */
export function requireFounderAuthority(
  request: Request,
  routeKey: string,
  opts: { env?: NodeJS.ProcessEnv; now?: number } = {},
): Response | null {
  const env = opts.env ?? process.env;
  if (!isFounderGuardEnforced(routeKey, env)) return null;
  if (verifyMachineCredential(request, routeKey, env)) return null;
  const result = verifyFounderAuthority(request, { env, now: opts.now });
  if (result.authorized) {
    if (!isSameOriginRequest(request)) {
      console.error(`[founder-authority] ${routeKey}: cross-origin mutation rejected`);
      return reject(403, {
        error: "Cross-origin request rejected for a cookie-authenticated action",
        code: "founder_authority_cross_origin",
      });
    }
    return null;
  }
  if (result.reason === "not_configured") {
    console.error(
      `[founder-authority] ${routeKey}: enforcement on but ${FOUNDER_SESSION_SECRET_ENV} missing or shorter than ${MIN_SECRET_LENGTH} chars; denying`,
    );
    return reject(503, {
      error: "Founder authority is not configured on the server",
      code: "founder_authority_not_configured",
    });
  }
  const status = result.reason === "revoked" ? 401 : 401;
  return reject(status, {
    error: "Founder authority required. Unlock the Command Center with the PIN.",
    code: "founder_authority_required",
    reason: result.reason,
  });
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
