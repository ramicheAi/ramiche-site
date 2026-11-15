/**
 * Browser-session mutation (CSRF) evaluation for Command Center.
 *
 * Applies to state-changing methods that carry a session cookie. Policy:
 *  - `Sec-Fetch-Site` (browser-set, not forgeable by page script) must be
 *    `same-origin` when present. `same-site`, `cross-site`, `none` are rejected.
 *  - `Origin`, when present, must be the request's own origin. "Own origin" is
 *    the `Host` header (a browser always sends the true Host) or an origin
 *    listed in CC_ALLOWED_ORIGINS. `X-Forwarded-Host`/`Forwarded` are NEVER
 *    consulted: they are client-suppliable and are not evidence of anything.
 *  - Conflicting evidence (e.g. Sec-Fetch-Site same-origin but a foreign
 *    Origin) is rejected.
 *  - Neither header present = ambiguous = rejected. Every real browser sends
 *    at least one on a cross- or same-origin POST/PUT/PATCH/DELETE.
 *
 * Machine-to-machine routes are exempt (see command-center-routes.ts): they
 * carry no cookie and authenticate with their own secret.
 */

export type CsrfResult = { ok: true } | { ok: false; reason: "cross_site" | "origin_mismatch" | "missing_origin" };

export function isMutatingMethod(method: string): boolean {
  const m = method.toUpperCase();
  return m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";
}

function allowedOrigins(env: Record<string, string | undefined>): string[] {
  const raw = env.CC_ALLOWED_ORIGINS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^https?:\/\/[a-z0-9.-]+(:\d+)?$/.test(s));
}

export function checkBrowserMutation(
  method: string,
  headers: Headers,
  env: Record<string, string | undefined> = process.env
): CsrfResult {
  if (!isMutatingMethod(method)) return { ok: true };

  const sfs = headers.get("sec-fetch-site")?.trim().toLowerCase() ?? null;
  const origin = headers.get("origin")?.trim() ?? null;

  if (sfs !== null && sfs !== "same-origin") return { ok: false, reason: "cross_site" };

  if (origin !== null) {
    let originUrl: URL;
    try {
      originUrl = new URL(origin);
    } catch {
      return { ok: false, reason: "origin_mismatch" }; // includes the literal "null" origin
    }
    const host = headers.get("host")?.trim().toLowerCase() ?? "";
    const sameHost = host !== "" && originUrl.host.toLowerCase() === host;
    const allowlisted = allowedOrigins(env).includes(originUrl.origin.toLowerCase());
    if (!sameHost && !allowlisted) return { ok: false, reason: "origin_mismatch" };
    return { ok: true };
  }

  if (sfs === "same-origin") return { ok: true };
  return { ok: false, reason: "missing_origin" };
}
