/**
 * P06 M6G: the executor's GitHub machine identity. Read only, one repository per token, checked not trusted, bounded,
 * fail closed, and the token never leaks into a result, an error, Claude's environment or git.
 */
import { createVerify, generateKeyPairSync } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { appJwt, EXECUTOR_PERMISSIONS, GITHUB_APP_ENV, githubAppConfig, githubBranchTip, GithubAuthUnavailable } from "./github-app";
import { executionEnv } from "./policy";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PEM = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
const ENV = { [GITHUB_APP_ENV.appId]: "123456", [GITHUB_APP_ENV.installationId]: "987654", [GITHUB_APP_ENV.privateKey]: Buffer.from(PEM).toString("base64") };
const TOKEN = "ghs_FIXTURE_TOKEN_must_never_leak_0123456789";
const SHA = "a".repeat(40);

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
function github(over: { mint?: (c: Call) => Response; ref?: (c: Call) => Response } = {}) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
    const c: Call = { url, method: init.method ?? "GET", headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : null };
    calls.push(c);
    if (url.endsWith("/access_tokens")) return over.mint ? over.mint(c) : new Response(JSON.stringify({ token: TOKEN, expires_at: "2026-10-06T20:00:00Z", permissions: { contents: "read", metadata: "read" }, repository_selection: "selected", repositories: [{ full_name: "ramicheAi/mettle" }] }), { status: 201 });
    if (url.includes("/git/ref/heads/")) return over.ref ? over.ref(c) : new Response(JSON.stringify({ ref: "refs/heads/main", object: { sha: SHA, type: "commit" } }), { status: 200 });
    if (url.endsWith("/installation/token")) return new Response(null, { status: 204 });
    return new Response("{}", { status: 500 });
  });
  return { calls, fetch: fetchImpl as unknown as typeof fetch };
}

describe("machine identity: configuration and JWT", () => {
  it("needs all three settings; a malformed key or id is no configuration", () => {
    expect(githubAppConfig(ENV)).toMatchObject({ appId: "123456", installationId: "987654" });
    expect(githubAppConfig({ ...ENV, [GITHUB_APP_ENV.privateKey]: Buffer.from("not a key").toString("base64") })).toBeNull();
    expect(githubAppConfig({ ...ENV, [GITHUB_APP_ENV.appId]: "12; rm -rf" })).toBeNull();
    expect(githubAppConfig({})).toBeNull();
  });
  it("signs an RS256 JWT for the App, issued 60 s back and valid under 10 minutes", () => {
    const now = Date.parse("2026-10-06T18:00:00Z");
    const [h, b, s] = appJwt({ appId: "123456", privateKeyPem: PEM }, now).split(".");
    const claims = JSON.parse(Buffer.from(b, "base64url").toString());
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    expect(claims).toEqual({ iss: "123456", iat: now / 1000 - 60, exp: now / 1000 - 60 + 540 });
    expect(createVerify("RSA-SHA256").update(`${h}.${b}`).verify(publicKey, Buffer.from(s, "base64url"))).toBe(true);
  });
});

describe("remote head read: one repository, read only, revoked after use", () => {
  it("mints a token limited to the one repository with contents/metadata read, reads the tip, then revokes the token", async () => {
    const gh = github();
    expect(await githubBranchTip("ramicheAi/mettle", "main", { fetch: gh.fetch, env: ENV })).toBe(SHA);
    expect(gh.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST https://api.github.com/app/installations/987654/access_tokens",
      "GET https://api.github.com/repos/ramicheAi/mettle/git/ref/heads/main",
      "DELETE https://api.github.com/installation/token",
    ]);
    expect(gh.calls[0].body).toEqual({ repositories: ["mettle"], permissions: EXECUTOR_PERMISSIONS });
    expect(gh.calls[0].headers.Authorization).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);   // the JWT, not the key
    expect(gh.calls[1].headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });
  it("a token granted with ANY extra permission or another repository is refused (and revoked) before use", async () => {
    for (const grant of [
      { permissions: { contents: "write", metadata: "read" }, repositories: [{ full_name: "ramicheAi/mettle" }] },
      { permissions: { contents: "read", metadata: "read", pull_requests: "write" }, repositories: [{ full_name: "ramicheAi/mettle" }] },
      { permissions: { contents: "read", metadata: "read", administration: "read" }, repositories: [{ full_name: "ramicheAi/mettle" }] },
      { permissions: { contents: "read", metadata: "read" }, repositories: [{ full_name: "ramicheAi/mettle" }, { full_name: "ramicheAi/ramiche-site" }] },
      { permissions: { contents: "read", metadata: "read" }, repositories: [{ full_name: "someone/else" }] },
      { permissions: {}, repositories: [{ full_name: "ramicheAi/mettle" }] },
    ]) {
      const gh = github({ mint: () => new Response(JSON.stringify({ token: TOKEN, ...grant }), { status: 201 }) });
      await expect(githubBranchTip("ramicheAi/mettle", "main", { fetch: gh.fetch, env: ENV })).rejects.toBeInstanceOf(GithubAuthUnavailable);
      expect(gh.calls.some((c) => c.url.includes("/git/ref/"))).toBe(false);   // never used
      expect(gh.calls.at(-1)!.method).toBe("DELETE");
    }
  });
  it("a missing branch is null; every auth or transport failure is BLOCKED, never a guess", async () => {
    expect(await githubBranchTip("ramicheAi/mettle", "nope", { fetch: github({ ref: () => new Response("{}", { status: 404 }) }).fetch, env: ENV })).toBeNull();
    for (const mint of [401, 403, 404, 422, 500]) {
      const gh = github({ mint: () => new Response(JSON.stringify({ message: "x" }), { status: mint }) });
      await expect(githubBranchTip("ramicheAi/mettle", "main", { fetch: gh.fetch, env: ENV })).rejects.toThrow(/BLOCKED · GitHub machine authentication unavailable/);
    }
    await expect(githubBranchTip("ramicheAi/mettle", "main", { fetch: github({ ref: () => new Response("{}", { status: 403 }) }).fetch, env: ENV })).rejects.toBeInstanceOf(GithubAuthUnavailable);
    await expect(githubBranchTip("ramicheAi/mettle", "main", { fetch: github().fetch, env: {} })).rejects.toThrow(/not configured/);
    await expect(githubBranchTip("../evil", "main", { fetch: github().fetch, env: ENV })).rejects.toBeInstanceOf(GithubAuthUnavailable);
    await expect(githubBranchTip("ramicheAi/mettle", "../x", { fetch: github().fetch, env: ENV })).rejects.toBeInstanceOf(GithubAuthUnavailable);
  });
  it("is bounded: a GitHub that never answers is BLOCKED within the timeout, no hang, no prompt", async () => {
    const hang = ((_u: string, init: RequestInit) => new Promise((_r, rej) => init.signal?.addEventListener("abort", () => rej(Object.assign(new Error("t"), { name: "TimeoutError" }))))) as unknown as typeof fetch;
    const t0 = Date.now();
    await expect(githubBranchTip("ramicheAi/mettle", "main", { fetch: hang, env: ENV, timeoutMs: 300 })).rejects.toThrow(/did not answer in time/);
    expect(Date.now() - t0).toBeLessThan(2_000);
  });
});

describe("the token and the App key never leak", () => {
  it("not into a result, an error message, or a failure path", async () => {
    const seen: string[] = [];
    const tip = await githubBranchTip("ramicheAi/mettle", "main", { fetch: github().fetch, env: ENV });
    seen.push(JSON.stringify(tip));
    for (const mint of [() => new Response(JSON.stringify({ token: TOKEN, permissions: { contents: "write" }, repositories: [] }), { status: 201 }), () => new Response(JSON.stringify({ message: TOKEN }), { status: 403 })]) {
      try { await githubBranchTip("ramicheAi/mettle", "main", { fetch: github({ mint }).fetch, env: ENV }); } catch (e) { seen.push(String(e), JSON.stringify(e), (e as Error).stack ?? ""); }
    }
    for (const s of seen) { expect(s).not.toContain(TOKEN); expect(s).not.toContain("PRIVATE KEY"); expect(s).not.toContain(ENV[GITHUB_APP_ENV.privateKey]); }
  });
  it("Claude Code's environment never carries the App settings (allowlist), and no git credential path exists", () => {
    const env = executionEnv({ ...process.env, ...ENV, GITHUB_TOKEN: TOKEN, GH_TOKEN: TOKEN } as Record<string, string>);
    expect(Object.keys(env).filter((k) => /GITHUB|GH_|PARALLAX/.test(k))).toEqual([]);
    expect(JSON.stringify(env)).not.toContain(TOKEN);
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
    const src = walk(join(process.cwd(), "src/lib/execution")).filter((f) => /\.ts$/.test(f) && !/\.test\.ts$/.test(f));
    for (const f of src) {
      const text = readFileSync(f, "utf8");
      expect(text, f).not.toMatch(/"ls-remote"|credential\.helper=osxkeychain|extraheader|x-access-token/);
    }
  });
});

describe("executor and prepare fail closed without the machine identity (no fallback, nothing recorded or run)", () => {
  it("prepare answers BLOCKED; the executor refuses before any record, worktree or CLI", async () => {
    vi.stubEnv(GITHUB_APP_ENV.appId, ""); vi.stubEnv(GITHUB_APP_ENV.installationId, ""); vi.stubEnv(GITHUB_APP_ENV.privateKey, "");
    const { prepareExecution } = await import("./service");
    const { routeCommand } = await import("@/lib/command/router");
    const record = { id: "9e000000-0000-4000-8000-0000000000c1", command: "Claude Code, review the METTLE roster logic", routedAt: "t", routerVersion: "m5-rules-1", shadow: true as const, executed: false as const, missionContext: null, supersedes: null, decision: routeCommand({ text: "Claude Code, review the METTLE roster logic" }), linkedMissions: [] };
    const remoteTip = async () => githubBranchTip("ramicheAi/mettle", "main");   // the real default, no App configured
    expect(await prepareExecution({ record, founderUid: "o" }, { remoteTip, surface: "harness" })).toMatchObject({ ok: false, code: "github_auth_unavailable", message: "BLOCKED · GitHub machine authentication unavailable" });
    vi.unstubAllEnvs();
  });
});

it("execution modules use no TypeScript parameter properties (the host scripts load them with Node type stripping)", () => {
  const dir = join(process.cwd(), "src/lib/execution");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))) {
    expect(readFileSync(join(dir, f), "utf8"), f).not.toMatch(/constructor\s*\([^)]*\b(private|public|protected|readonly)\s+\w+\s*:/);
  }
});
