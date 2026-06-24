// ════════════════════════════════════════════════════════════════════════
// apex-coach-token.ts.proposed — INERT until renamed to apex-coach-token.ts.
//
// Short-lived, HMAC-signed coach session token (Path B). Mirrors the existing
// oauth-credentials.ts pattern. Used so a server route can TRUST that the caller
// proved the org PIN server-side — instead of the browser merely asserting it.
//
// Requires a server-only secret (NOT NEXT_PUBLIC_):  APEX_SESSION_SECRET=<32+ random bytes>
// ════════════════════════════════════════════════════════════════════════
import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.APEX_SESSION_SECRET || "";
const TTL_MS = 12 * 60 * 60 * 1000; // 12h

interface CoachClaims {
  orgId: string;
  role: "coach";
  iat: number;
  exp: number;
}

/** Mint a signed `<base64url-payload>.<base64url-hmac>` token. Null if unconfigured. */
export function mintCoachToken(orgId: string): string | null {
  if (!SECRET) return null;
  const now = Date.now();
  const claims: CoachClaims = { orgId, role: "coach", iat: now, exp: now + TTL_MS };
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/** Verify signature, expiry, and that the token is bound to `orgId`. */
export function verifyCoachToken(token: string | undefined, orgId: string): boolean {
  if (!SECRET || !token) return false;
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const expected = createHmac("sha256", SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString()) as CoachClaims;
    return claims.role === "coach" && claims.orgId === orgId && Date.now() < claims.exp;
  } catch {
    return false;
  }
}
