/**
 * `?next=` validation for the Command Center sign-in redirect.
 *
 * Client-safe (no node imports): used by middleware (when building the login
 * redirect), the login page (when consuming it) — same function both sides.
 *
 * Accepts ONLY a same-origin internal path under /command-center. Everything
 * else (absolute URLs, protocol-relative `//host`, backslash tricks, encoded
 * variants of any of those, other app areas, the login page itself) collapses
 * to the default landing page. Never throws, never returns anything outside
 * the allowed set.
 */
export const COMMAND_CENTER_HOME = "/command-center";

const BASE = "http://cc-next.invalid";

function hasBadChars(v: string): boolean {
  // control chars, backslash, and whitespace tricks
  return /[\u0000-\u001f\u007f\\\s]/.test(v);
}

export function safeCommandCenterNext(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) return COMMAND_CENTER_HOME;

  // Examine the raw value AND every decoded form (up to 3 rounds) so that
  // %2F%2Fevil.com, %5Cevil.com, %252F etc. cannot sneak through.
  let candidate = raw;
  for (let i = 0; i < 4; i++) {
    if (hasBadChars(candidate)) return COMMAND_CENTER_HOME;
    if (!candidate.startsWith("/") || candidate.startsWith("//")) return COMMAND_CENTER_HOME;
    let decoded: string;
    try {
      decoded = decodeURIComponent(candidate);
    } catch {
      return COMMAND_CENTER_HOME;
    }
    if (decoded === candidate) break;
    candidate = decoded;
    if (i === 3) return COMMAND_CENTER_HOME; // still changing after 3 decodes: reject
  }

  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return COMMAND_CENTER_HOME;
  }
  if (url.origin !== BASE) return COMMAND_CENTER_HOME;

  const path = url.pathname;
  const inCC = path === COMMAND_CENTER_HOME || path.startsWith(`${COMMAND_CENTER_HOME}/`);
  if (!inCC) return COMMAND_CENTER_HOME;
  // Path traversal / dot segments are normalized by URL; re-check after normalization.
  if (path.split("/").some((seg) => seg === ".." || seg === ".")) return COMMAND_CENTER_HOME;

  return `${path}${url.search}`;
}
