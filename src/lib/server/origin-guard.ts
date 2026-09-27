/**
 * Exact-origin verification for protected browser mutations.
 *
 * Deliberately NOT supported (each is a known bypass):
 *   - Referer fallback
 *   - startsWith()/prefix matching (allows `https://good.com.evil.com`)
 *   - x-forwarded-host / host-derived trust
 *   - wildcard or suffix matching
 *   - the opaque `Origin: null` value
 *
 * Missing configuration DENIES.
 */
export const TRUSTED_ORIGINS_ENV = "PARALLAX_TRUSTED_ORIGINS";

export type OriginDenialReason =
  | "origin_not_configured"
  | "origin_missing"
  | "origin_duplicate"
  | "origin_malformed"
  | "origin_untrusted";

export type OriginResult =
  | { ok: true; origin: string }
  | { ok: false; reason: OriginDenialReason; status: 403 | 503 };

/** Normalised, exact trusted origins (scheme + host + explicit non-default port). */
export function trustedOrigins(
  env: Record<string, string | undefined> = process.env
): string[] {
  const raw = env[TRUSTED_ORIGINS_ENV];
  if (typeof raw !== "string") return [];
  const out: string[] = [];
  for (const entry of raw.split(",")) {
    const candidate = entry.trim();
    if (!candidate) return [];
    try {
      const u = new URL(candidate);
      if ((u.protocol !== "https:" && u.protocol !== "http:") || candidate !== u.origin) return [];
      if (!out.includes(u.origin)) out.push(u.origin);
    } catch {
      return [];
    }
  }
  return out;
}

export function verifyExactOrigin(
  req: { headers: Headers },
  env: Record<string, string | undefined> = process.env
): OriginResult {
  const allowed = trustedOrigins(env);
  if (allowed.length === 0) {
    return { ok: false, reason: "origin_not_configured", status: 503 };
  }

  const raw = req.headers.get("origin");
  if (raw === null) return { ok: false, reason: "origin_missing", status: 403 };

  const value = raw.trim();
  if (!value) return { ok: false, reason: "origin_missing", status: 403 };
  // Node/undici collapses duplicate headers into "a, b".
  if (value.includes(",")) return { ok: false, reason: "origin_duplicate", status: 403 };
  if (value === "null") return { ok: false, reason: "origin_malformed", status: 403 };

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, reason: "origin_malformed", status: 403 };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, reason: "origin_malformed", status: 403 };
  }
  // A real Origin header is scheme://host[:port] with no path/query/fragment.
  if (value !== parsed.origin) {
    return { ok: false, reason: "origin_malformed", status: 403 };
  }
  if (!allowed.includes(parsed.origin)) {
    return { ok: false, reason: "origin_untrusted", status: 403 };
  }
  return { ok: true, origin: parsed.origin };
}
