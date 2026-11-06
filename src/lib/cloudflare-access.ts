/**
 * Cloudflare Access service-token auth for server-to-server provider calls.
 *
 * WHY THIS EXISTS (CC-RECOVERY-01 evidence, 2026-11-06):
 * `openclaw.parallaxvinc.com` and `claude.parallaxvinc.com` sit behind a
 * Cloudflare Access application. A request that carries only the app's own
 * `Authorization: Bearer <provider token>` is intercepted at the edge and
 * answered with `302 -> https://<team>.cloudflareaccess.com/cdn-cgi/access/login/...`.
 * Because `fetch` follows redirects by default, the caller then receives HTTP
 * 200 with an HTML login page instead of JSON. The old code parsed that to `{}`
 * and reported a misleading "no reply text" / "invalid JSON".
 *
 * Cloudflare Access authenticates machine callers with a Service Token, sent as
 * a header pair:
 *   CF-Access-Client-Id:     <token client id>
 *   CF-Access-Client-Secret: <token client secret>
 * The Service Token must also be allowed by a "Service Auth" policy on the
 * Access application. Without that policy the headers are ignored and the 302
 * remains.
 *
 * SECURITY CONTRACT (enforced by cloudflare-access.test.ts):
 * - Credentials are read from `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`
 *   which are server-only. There is no `NEXT_PUBLIC_` variant, by design: a
 *   `NEXT_PUBLIC_` value is inlined into the browser bundle.
 * - The values are never logged, never returned in an API response, and never
 *   embedded in an error string. Only presence/absence is ever reported.
 * - This module must never be imported from client code.
 */

export const CF_ACCESS_CLIENT_ID_ENV = "CF_ACCESS_CLIENT_ID";
export const CF_ACCESS_CLIENT_SECRET_ENV = "CF_ACCESS_CLIENT_SECRET";
export const CF_ACCESS_HEADER_ID = "CF-Access-Client-Id";
export const CF_ACCESS_HEADER_SECRET = "CF-Access-Client-Secret";

/** Shape we need from a `Response`. Narrowed so tests can pass plain objects. */
export type ResponseFacts = {
  status?: number;
  url?: string;
  headers?: { get(name: string): string | null } | null;
  redirected?: boolean;
};

export type AccessCredentialState =
  | { configured: true; headers: Record<string, string> }
  | { configured: false; reason: "missing" | "incomplete" };

export type AccessBlockVerdict =
  | { blocked: false }
  | { blocked: true; kind: "access-login" | "html-response" | "redirect"; detail: string };

function readEnv(name: string): string {
  const raw = process.env[name];
  if (!raw) return "";
  // Mirror cleanEnv(): strip surrounding whitespace and trailing control chars.
  return raw.replace(/^\s+/, "").replace(/[\s\x00-\x1f\x7f]+$/u, "");
}

/**
 * Build the Service Token header pair.
 *
 * Returns `configured: false` when neither value is set ("missing") or only one
 * is ("incomplete"). Callers must NOT throw on this: a host that is not behind
 * Access (e.g. `127.0.0.1` during local development) needs no headers at all.
 * When Access IS in front of the host, the absence surfaces as an explicit
 * access-block error from {@link detectAccessBlock} rather than a silent 200.
 */
export function cloudflareAccessHeaders(): AccessCredentialState {
  const id = readEnv(CF_ACCESS_CLIENT_ID_ENV);
  const secret = readEnv(CF_ACCESS_CLIENT_SECRET_ENV);
  if (!id && !secret) return { configured: false, reason: "missing" };
  if (!id || !secret) return { configured: false, reason: "incomplete" };
  return {
    configured: true,
    headers: { [CF_ACCESS_HEADER_ID]: id, [CF_ACCESS_HEADER_SECRET]: secret },
  };
}

/** Host label for error text. Never includes credentials or query strings. */
export function hostLabel(target: string): string {
  try {
    return new URL(target).host;
  } catch {
    return "provider";
  }
}

function header(facts: ResponseFacts, name: string): string {
  try {
    return (facts.headers?.get(name) || "").toLowerCase();
  } catch {
    return "";
  }
}

function safeUrl(facts: ResponseFacts): string {
  const raw = typeof facts.url === "string" ? facts.url : "";
  if (!raw) return "";
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return "";
  }
}

/**
 * Distinguish "the provider answered" from "something intercepted the request".
 *
 * Detects three shapes, all observed or modelled from the live incident:
 *  - access-login: the request was redirected to `*.cloudflareaccess.com`
 *    (either visible in the final URL, or as a 3xx whose Location points there).
 *  - html-response: HTTP 2xx/3xx with `content-type: text/html` from an endpoint
 *    that must return JSON. A login page or proxy error page arrives this way.
 *  - redirect: any other 3xx, which a JSON API call must not receive.
 *
 * Returns `{ blocked: false }` for anything that looks like a normal API reply,
 * including every `Response` produced by the existing unit-test mocks, which
 * carry no `url`/`headers`.
 */
export function detectAccessBlock(facts: ResponseFacts, host: string): AccessBlockVerdict {
  const location = header(facts, "location");
  const finalUrl = safeUrl(facts);
  const contentType = header(facts, "content-type");
  const status = typeof facts.status === "number" ? facts.status : 200;

  const looksLikeAccess =
    finalUrl.includes("cloudflareaccess.com") || location.includes("cloudflareaccess.com");

  if (looksLikeAccess) {
    return {
      blocked: true,
      kind: "access-login",
      detail:
        `Cloudflare Access intercepted the request to ${host} and redirected it to ` +
        `cloudflareaccess.com (status ${status}). The request never reached the provider. ` +
        `Set ${CF_ACCESS_CLIENT_ID_ENV} and ${CF_ACCESS_CLIENT_SECRET_ENV} from a Cloudflare ` +
        `Service Token allowed by a Service Auth policy on this hostname, or move the hostname ` +
        `out of Cloudflare Access.`,
    };
  }

  if (status >= 300 && status < 400) {
    return {
      blocked: true,
      kind: "redirect",
      detail:
        `Unexpected HTTP ${status} redirect from ${host}. A JSON API endpoint must answer ` +
        `directly; a redirect usually means an edge proxy or login page is in front of it.`,
    };
  }

  if (contentType.includes("text/html")) {
    return {
      blocked: true,
      kind: "html-response",
      detail:
        `Expected JSON from ${host} but received an HTML page (status ${status}). An edge ` +
        `proxy or login page intercepted the request instead of the provider answering.`,
    };
  }

  return { blocked: false };
}
