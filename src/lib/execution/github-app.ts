/**
 * P06 M6G: the executor's own GitHub identity (a GitHub App), so remote checks never depend on a person's credential,
 * the macOS Keychain or a GUI prompt.
 *
 *   App private key (server env, from pvault) -> 9-minute JWT -> installation token scoped by request to ONE repository
 *   with contents:read + metadata:read -> one REST read (the branch tip) -> token revoked.
 *
 * Fails closed: no configuration, a slow or failing GitHub, a token granted with any extra permission or repository,
 * all end in GithubAuthUnavailable ("BLOCKED · GitHub machine authentication unavailable"). There is no fallback to any
 * other credential. The token never touches git, a URL, a file, a child process, a log line or an error message.
 * Server only (node:crypto). Claude Code never sees any of this: its environment is an allowlist (policy executionEnv).
 */
import { createSign } from "node:crypto";

export const GITHUB_AUTH_BLOCKED = "BLOCKED · GitHub machine authentication unavailable";

export class GithubAuthUnavailable extends Error {
  readonly code = "github_auth_unavailable";
  readonly reason: string;
  // No TypeScript parameter properties: the host scripts run this file with Node's type stripping.
  constructor(reason: string) { super(`${GITHUB_AUTH_BLOCKED} (${reason})`); this.name = "GithubAuthUnavailable"; this.reason = reason; }
}

export interface GithubAppConfig { appId: string; installationId: string; privateKeyPem: string }
type Env = Record<string, string | undefined>;

/** Env names (values come from pvault into the cockpit's 0600 env file; never committed, never logged). */
export const GITHUB_APP_ENV = { appId: "PARALLAX_GITHUB_APP_ID", installationId: "PARALLAX_GITHUB_APP_INSTALLATION_ID", privateKey: "PARALLAX_GITHUB_APP_PRIVATE_KEY_B64" } as const;

export function githubAppConfig(env: Env = process.env): GithubAppConfig | null {
  const appId = env[GITHUB_APP_ENV.appId]?.trim(), installationId = env[GITHUB_APP_ENV.installationId]?.trim(), b64 = env[GITHUB_APP_ENV.privateKey]?.trim();
  if (!appId || !/^\d{1,12}$/.test(appId) || !installationId || !/^\d{1,15}$/.test(installationId) || !b64) return null;
  const pem = Buffer.from(b64, "base64").toString("utf8");
  if (!/^-----BEGIN (RSA )?PRIVATE KEY-----/.test(pem.trim())) return null;
  return { appId, installationId, privateKeyPem: pem };
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

/** The App's JWT (RS256): issued 60 s in the past for clock skew, valid 9 minutes (GitHub's maximum is 10). */
export function appJwt(cfg: Pick<GithubAppConfig, "appId" | "privateKeyPem">, nowMs = Date.now()): string {
  const iat = Math.floor(nowMs / 1000) - 60;
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ iat, exp: iat + 540, iss: cfg.appId }));
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(cfg.privateKeyPem);
  return `${head}.${body}.${b64url(sig)}`;
}

/** The only permissions the executor ever requests or accepts (L0/L1: read the code, nothing else). */
export const EXECUTOR_PERMISSIONS = { contents: "read", metadata: "read" } as const;

export interface GithubDeps { fetch?: typeof fetch; env?: Env; timeoutMs?: number; now?: () => number }
const API = "https://api.github.com";
const DEFAULT_TIMEOUT_MS = 10_000;

function split(origin: string): { owner: string; repo: string } | null {
  const m = origin.match(/^([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})$/);
  return m && !m[2].includes("..") ? { owner: m[1], repo: m[2] } : null;
}

async function call(deps: GithubDeps, url: string, init: RequestInit): Promise<Response> {
  const f = deps.fetch ?? fetch;
  try {
    return await f(url, { ...init, redirect: "error", signal: AbortSignal.timeout(deps.timeoutMs ?? DEFAULT_TIMEOUT_MS) });
  } catch (e) {
    // Only the error's kind: a network error message could echo request details.
    throw new GithubAuthUnavailable((e as Error)?.name === "TimeoutError" ? "GitHub did not answer in time" : "GitHub could not be reached");
  }
}

/**
 * A short-lived installation token for exactly one repository, read only. The response is checked, not trusted: any
 * permission other than contents/metadata read, or any other repository, is refused and the token revoked.
 */
async function mintReadToken(origin: string, deps: GithubDeps): Promise<{ token: string }> {
  const cfg = githubAppConfig(deps.env ?? process.env);
  if (!cfg) throw new GithubAuthUnavailable("the executor's GitHub App is not configured on this host");
  const parts = split(origin);
  if (!parts) throw new GithubAuthUnavailable("the repository name is invalid");
  let jwt: string;
  try { jwt = appJwt(cfg, (deps.now ?? Date.now)()); } catch { throw new GithubAuthUnavailable("the App key could not sign"); }
  const res = await call(deps, `${API}/app/installations/${cfg.installationId}/access_tokens`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
    body: JSON.stringify({ repositories: [parts.repo], permissions: EXECUTOR_PERMISSIONS }),
  });
  if (res.status !== 201) throw new GithubAuthUnavailable(`GitHub refused a read token for ${origin} (HTTP ${res.status})`);
  let body: unknown;
  try { body = await res.json(); } catch { throw new GithubAuthUnavailable("GitHub's token response was unreadable"); }
  const b = (body && typeof body === "object" ? body : {}) as { token?: unknown; permissions?: unknown; repositories?: unknown };
  const token = typeof b.token === "string" ? b.token : "";
  if (!token) throw new GithubAuthUnavailable("GitHub returned no token");
  // Checked defensively: a malformed grant is a refusal (and its token is revoked), never an exception.
  let exactPerms = false, exactRepo = false;
  try {
    const perms = (b.permissions && typeof b.permissions === "object" ? b.permissions : {}) as Record<string, unknown>;
    const repos = Array.isArray(b.repositories) ? b.repositories.map((r) => (r && typeof r === "object" && typeof (r as { full_name?: unknown }).full_name === "string" ? (r as { full_name: string }).full_name.toLowerCase() : "")) : [];
    exactPerms = Object.keys(perms).length > 0 && Object.entries(perms).every(([k, v]) => Object.hasOwn(EXECUTOR_PERMISSIONS, k) && v === "read");
    exactRepo = repos.length === 1 && repos[0] === origin.toLowerCase();
  } catch { /* refused below */ }
  if (!exactPerms || !exactRepo) {
    await revoke(token, deps);
    throw new GithubAuthUnavailable(!exactPerms ? "the token carried more than read access; refused" : "the token was not limited to this repository; refused");
  }
  return { token };
}

async function revoke(token: string, deps: GithubDeps): Promise<void> {
  try { await call(deps, `${API}/installation/token`, { method: "DELETE", headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } }); } catch { /* it expires within the hour anyway */ }
}

/**
 * The current tip of `branch` on `origin` (owner/repo), read with the executor's own read-only identity. Returns null
 * when the branch does not exist; throws GithubAuthUnavailable when GitHub cannot be asked safely. Bounded by the
 * timeout on each request.
 */
export async function githubBranchTip(origin: string, branch: string, deps: GithubDeps = {}): Promise<string | null> {
  if (!/^[A-Za-z0-9._/-]{1,200}$/.test(branch) || branch.includes("..")) throw new GithubAuthUnavailable("the branch name is invalid");
  const { token } = await mintReadToken(origin, deps);
  try {
    const ref = branch.split("/").map(encodeURIComponent).join("/");
    const res = await call(deps, `${API}/repos/${origin}/git/ref/heads/${ref}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    });
    if (res.status === 404) return null;
    if (res.status !== 200) throw new GithubAuthUnavailable(`GitHub refused the branch read (HTTP ${res.status})`);
    let body: { ref?: unknown; object?: { sha?: unknown; type?: unknown } };
    try { body = await res.json(); } catch { throw new GithubAuthUnavailable("GitHub's branch response was unreadable"); }
    const sha = typeof body.object?.sha === "string" ? body.object.sha : "";
    if (body.ref !== `refs/heads/${branch}` || body.object?.type !== "commit" || !/^[0-9a-f]{40}$/.test(sha)) return null;
    return sha;
  } finally {
    await revoke(token, deps);
  }
}
