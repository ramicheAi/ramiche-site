import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  CF_ACCESS_CLIENT_ID_ENV,
  CF_ACCESS_CLIENT_SECRET_ENV,
  CF_ACCESS_HEADER_ID,
  CF_ACCESS_HEADER_SECRET,
  cloudflareAccessHeaders,
  detectAccessBlock,
  hostLabel,
} from "./cloudflare-access";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

beforeEach(() => {
  vi.stubEnv(CF_ACCESS_CLIENT_ID_ENV, "");
  vi.stubEnv(CF_ACCESS_CLIENT_SECRET_ENV, "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/* ── 1. header construction ──────────────────────────────────────────── */
describe("cloudflareAccessHeaders", () => {
  it("returns missing when no service token is configured", () => {
    expect(cloudflareAccessHeaders()).toEqual({ configured: false, reason: "missing" });
  });

  it("returns incomplete when only one half is set", () => {
    vi.stubEnv(CF_ACCESS_CLIENT_ID_ENV, "id.access");
    expect(cloudflareAccessHeaders()).toEqual({ configured: false, reason: "incomplete" });
    vi.stubEnv(CF_ACCESS_CLIENT_ID_ENV, "");
    vi.stubEnv(CF_ACCESS_CLIENT_SECRET_ENV, "secret");
    expect(cloudflareAccessHeaders()).toEqual({ configured: false, reason: "incomplete" });
  });

  it("emits the exact CF-Access header pair Cloudflare expects", () => {
    vi.stubEnv(CF_ACCESS_CLIENT_ID_ENV, "id.access");
    vi.stubEnv(CF_ACCESS_CLIENT_SECRET_ENV, "s3cr3t-value");
    const state = cloudflareAccessHeaders();
    expect(state.configured).toBe(true);
    if (!state.configured) throw new Error("unreachable");
    expect(state.headers).toEqual({
      [CF_ACCESS_HEADER_ID]: "id.access",
      [CF_ACCESS_HEADER_SECRET]: "s3cr3t-value",
    });
    expect(CF_ACCESS_HEADER_ID).toBe("CF-Access-Client-Id");
    expect(CF_ACCESS_HEADER_SECRET).toBe("CF-Access-Client-Secret");
  });

  it("trims surrounding whitespace and trailing newlines from a pasted secret", () => {
    vi.stubEnv(CF_ACCESS_CLIENT_ID_ENV, "  id.access\n");
    vi.stubEnv(CF_ACCESS_CLIENT_SECRET_ENV, "\ts3cr3t \r\n");
    const state = cloudflareAccessHeaders();
    expect(state.configured).toBe(true);
    if (!state.configured) throw new Error("unreachable");
    expect(state.headers[CF_ACCESS_HEADER_ID]).toBe("id.access");
    expect(state.headers[CF_ACCESS_HEADER_SECRET]).toBe("s3cr3t");
  });
});

/* ── 2. server-only boundary ─────────────────────────────────────────── */
describe("server-only credential contract", () => {
  it("has no NEXT_PUBLIC variant anywhere in the module", () => {
    const src = read("src/lib/cloudflare-access.ts");
    // Doc comments may name the anti-pattern; code must never use it.
    expect(src).not.toMatch(/process\.env\.NEXT_PUBLIC/);
    expect(src).not.toMatch(/NEXT_PUBLIC_CF_ACCESS/);
    expect(src).toContain('"CF_ACCESS_CLIENT_ID"');
    expect(src).toContain('"CF_ACCESS_CLIENT_SECRET"');
  });

  it("is only imported by server-side provider code", () => {
    const route = read("src/app/api/command-center/chat/route.ts");
    expect(route).not.toMatch(/NEXT_PUBLIC_CF_ACCESS/);
    for (const file of ["src/lib/openclaw-gateway.ts", "src/lib/provider-adapter.ts"]) {
      expect(read(file), file).toContain("@/lib/cloudflare-access");
    }
  });
});

/* ── 3. interception detection ───────────────────────────────────────── */
describe("detectAccessBlock", () => {
  it("flags a final URL on cloudflareaccess.com", () => {
    const res = new Response("login", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
    Object.defineProperty(res, "url", {
      value: "https://calm-firefly-c94b.cloudflareaccess.com/cdn-cgi/access/login/openclaw.parallaxvinc.com",
      configurable: true,
    });
    const verdict = detectAccessBlock(res, "openclaw.parallaxvinc.com");
    expect(verdict.blocked).toBe(true);
    if (!verdict.blocked) throw new Error("unreachable");
    expect(verdict.kind).toBe("access-login");
    expect(verdict.detail).toContain("Cloudflare Access");
    expect(verdict.detail).toContain("CF_ACCESS_CLIENT_ID");
  });

  it("flags a 302 whose Location points at the Access login", () => {
    const res = new Response(null, {
      status: 302,
      headers: { location: "https://calm-firefly-c94b.cloudflareaccess.com/cdn-cgi/access/login/claude.parallaxvinc.com" },
    });
    const verdict = detectAccessBlock(res, "claude.parallaxvinc.com");
    expect(verdict.blocked).toBe(true);
    if (!verdict.blocked) throw new Error("unreachable");
    expect(verdict.kind).toBe("access-login");
  });

  it("flags any other 3xx as an unexpected redirect", () => {
    const res = new Response(null, { status: 307, headers: { location: "https://elsewhere.example/login" } });
    const verdict = detectAccessBlock(res, "provider.example");
    expect(verdict.blocked).toBe(true);
    if (!verdict.blocked) throw new Error("unreachable");
    expect(verdict.kind).toBe("redirect");
    expect(verdict.detail).toContain("307");
  });

  it("flags a 200 HTML page, which is what an Access block looks like after fetch follows the redirect", () => {
    const res = new Response("<!doctype html><title>Sign in</title>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
    const verdict = detectAccessBlock(res, "openclaw.parallaxvinc.com");
    expect(verdict.blocked).toBe(true);
    if (!verdict.blocked) throw new Error("unreachable");
    expect(verdict.kind).toBe("html-response");
  });

  it("does not flag a normal JSON reply", () => {
    const res = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    expect(detectAccessBlock(res, "provider.example")).toEqual({ blocked: false });
  });

  it("does not flag a plain-object mock with no url or headers (legacy unit tests)", () => {
    expect(detectAccessBlock({ status: 200 }, "provider.example")).toEqual({ blocked: false });
    expect(detectAccessBlock({ status: 500 }, "provider.example")).toEqual({ blocked: false });
  });

  it("never includes the credential values in a block detail", () => {
    vi.stubEnv(CF_ACCESS_CLIENT_ID_ENV, "id.super-secret-id");
    vi.stubEnv(CF_ACCESS_CLIENT_SECRET_ENV, "super-secret-value");
    const state = cloudflareAccessHeaders();
    expect(state.configured).toBe(true);
    const verdict = detectAccessBlock(
      new Response("login", { status: 200, headers: { "content-type": "text/html" } }),
      "openclaw.parallaxvinc.com"
    );
    expect(verdict.blocked).toBe(true);
    if (!verdict.blocked) throw new Error("unreachable");
    expect(verdict.detail).not.toContain("super-secret-id");
    expect(verdict.detail).not.toContain("super-secret-value");
  });
});

/* ── 4. host labels for error text ───────────────────────────────────── */
describe("hostLabel", () => {
  it("returns the host and drops path/query/credentials", () => {
    expect(hostLabel("https://user:pass@openclaw.parallaxvinc.com/tools/invoke?token=abc")).toBe(
      "openclaw.parallaxvinc.com"
    );
  });

  it("falls back to a neutral label for an unparseable URL", () => {
    expect(hostLabel("not a url")).toBe("provider");
  });
});
