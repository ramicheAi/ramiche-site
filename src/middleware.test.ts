import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { verifySessionCookie } = vi.hoisted(() => ({ verifySessionCookie: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({ verifySessionCookie }));

import { middleware } from "./middleware";
import { OWNER_UID_ENV } from "@/lib/server/command-center-auth";

const OWNER = "the-real-owner-uid";
const COOKIE = { cookie: "__session=" + "x".repeat(40) };

function req(url: string, init: { method?: string; headers?: Record<string, string> } = {}): NextRequest {
  return new NextRequest(url, { method: init.method ?? "GET", headers: init.headers });
}
const passes = (res: Response) => res.headers.get("x-middleware-next") === "1";

describe("middleware — Command Center owner gate (direct verification, no self-fetch)", () => {
  const original = process.env[OWNER_UID_ENV];
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env[OWNER_UID_ENV] = OWNER;
    verifySessionCookie.mockReset();
    fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
  });
  afterEach(() => {
    process.env[OWNER_UID_ENV] = original;
  });

  it("never performs an internal self-fetch for Command Center requests", async () => {
    verifySessionCookie.mockResolvedValue({ uid: OWNER, signInProvider: "password" });
    await middleware(req("http://localhost/api/command-center/revenue", { headers: COOKIE }));
    await middleware(req("http://localhost/command-center/leads"));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("denies an unauthenticated API request with 401 JSON", async () => {
    const res = await middleware(req("http://localhost/api/command-center/revenue"));
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("denies authenticated-but-not-owner API with 403", async () => {
    verifySessionCookie.mockResolvedValue({ uid: "someone-else", signInProvider: "password" });
    const res = await middleware(req("http://localhost/api/command-center/revenue", { headers: COOKIE }));
    expect(res.status).toBe(403);
  });

  it("denies anonymous/custom-provider identities even with the owner uid", async () => {
    for (const p of ["anonymous", "custom"]) {
      verifySessionCookie.mockResolvedValue({ uid: OWNER, signInProvider: p });
      const res = await middleware(req("http://localhost/api/command-center/revenue", { headers: COOKIE }));
      expect(res.status).toBe(401);
    }
  });

  it("denies expired/revoked sessions (verifier returns null) and verifier throws", async () => {
    verifySessionCookie.mockResolvedValue(null);
    expect((await middleware(req("http://localhost/api/command-center/revenue", { headers: COOKIE }))).status).toBe(401);
    verifySessionCookie.mockRejectedValue(new Error("admin sdk down"));
    expect((await middleware(req("http://localhost/api/command-center/revenue", { headers: COOKIE }))).status).toBe(401);
  });

  it("fails closed (503) with no owner configured, even for a 'valid' session", async () => {
    delete process.env[OWNER_UID_ENV];
    verifySessionCookie.mockResolvedValue({ uid: OWNER, signInProvider: "password" });
    const res = await middleware(req("http://localhost/api/command-center/revenue", { headers: COOKIE }));
    expect(res.status).toBe(503);
    expect(verifySessionCookie).not.toHaveBeenCalled();
    const page = await middleware(req("http://localhost/command-center"));
    expect(page.status).toBe(503); // not a redirect: no login loop on misconfiguration
  });

  it("allows the exact owner through with no-store", async () => {
    verifySessionCookie.mockResolvedValue({ uid: OWNER, signInProvider: "password" });
    const res = await middleware(req("http://localhost/api/command-center/revenue", { headers: COOKIE }));
    expect(passes(res)).toBe(true);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("forged Host/X-Forwarded-Host/.ts.net headers grant nothing", async () => {
    for (const host of ["command.parallaxvinc.com", "localhost", "127.0.0.1", "whatever.tail59e3bd.ts.net"]) {
      const res = await middleware(
        req("http://localhost/api/command-center/revenue", { headers: { "x-forwarded-host": host, host } })
      );
      expect(res.status).toBe(401);
    }
  });

  it("missing cookie never reaches the verifier", async () => {
    await middleware(req("http://localhost/api/command-center/revenue"));
    expect(verifySessionCookie).not.toHaveBeenCalled();
  });

  it("redirects an unauthenticated, never-enrolled page to /command-center/bootstrap with a relative, validated ?next= (founder correction: never straight to Firebase)", async () => {
    const res = await middleware(req("http://localhost/command-center/leads?x=1"));
    expect(res.status).toBe(307);
    const loc = res.headers.get("location") ?? "";
    expect(loc.startsWith("http://localhost/command-center/bootstrap?next=")).toBe(true); // absolute (Next requires it)
    expect(decodeURIComponent(loc.split("next=")[1])).toBe("/command-center/leads?x=1");
  });

  it("redirect origin comes from Host + x-forwarded-proto, never from X-Forwarded-Host", async () => {
    const res = await middleware(
      req("http://localhost/command-center/leads", {
        headers: { host: "command.parallaxvinc.com", "x-forwarded-proto": "https", "x-forwarded-host": "evil.example.com" },
      })
    );
    expect(res.headers.get("location")?.startsWith("https://command.parallaxvinc.com/command-center/bootstrap?next=")).toBe(true);
  });

  it("a device with a cc_device cookie goes to /command-center/unlock, not bootstrap or Firebase", async () => {
    const res = await middleware(
      req("http://localhost/command-center/leads", {
        headers: { cookie: "cc_device=11111111-1111-1111-1111-111111111111.deadbeef" },
      })
    );
    const loc = res.headers.get("location") ?? "";
    expect(loc.startsWith("http://localhost/command-center/unlock?next=")).toBe(true);
  });

  it("a hostile-looking path cannot poison the login redirect target", async () => {
    const res = await middleware(req("http://localhost/command-center//evil.example.com"));
    const loc = res.headers.get("location") ?? "";
    const next = decodeURIComponent(loc.split("next=")[1] ?? "");
    expect(next.startsWith("/command-center")).toBe(true);
    expect(next.startsWith("//")).toBe(false);
  });

  it("login page itself is never gated (no redirect loop)", async () => {
    const res = await middleware(req("http://localhost/command-login"));
    expect(passes(res)).toBe(true);
  });

  it("cross-site cookie-bearing mutation → 403 before verification", async () => {
    const res = await middleware(
      req("http://localhost/api/command-center/leads/send", { method: "POST", headers: { ...COOKIE, "sec-fetch-site": "cross-site" } })
    );
    expect(res.status).toBe(403);
    expect(verifySessionCookie).not.toHaveBeenCalled();
  });

  it("Origin≠Host and missing-origin cookie-bearing mutations → 403", async () => {
    const bad = await middleware(
      req("http://localhost/api/command-center/leads/send", { method: "POST", headers: { ...COOKIE, origin: "https://evil.example.com", host: "localhost" } })
    );
    expect(bad.status).toBe(403);
    const none = await middleware(req("http://localhost/api/command-center/leads/send", { method: "POST", headers: COOKIE }));
    expect(none.status).toBe(403);
  });

  it("same-origin owner mutation passes", async () => {
    verifySessionCookie.mockResolvedValue({ uid: OWNER, signInProvider: "password" });
    const res = await middleware(
      req("http://localhost/api/command-center/leads/send", { method: "POST", headers: { ...COOKIE, origin: "http://localhost", host: "localhost" } })
    );
    expect(passes(res)).toBe(true);
  });

  it("machine routes (exact paths only) pass through to their own secret check", async () => {
    for (const path of [
      "/api/command-center/chat/webhook",
      "/api/command-center/push",
      "/api/command-center/telegram/webhook",
      "/api/command-center/voice/call/webhook",
      "/api/command-center/prospector/cron",
    ]) {
      expect(passes(await middleware(req(`http://localhost${path}`, { method: "POST" })))).toBe(true);
    }
    expect(verifySessionCookie).not.toHaveBeenCalled();
  });

  it("machine-route exemption does not leak to prefixes, siblings or traversal lookalikes", async () => {
    for (const path of [
      "/api/command-center/push/extra",
      "/api/command-center/pushx",
      "/api/command-center/chat/webhook/../settings",
      "/api/command-center/chat",
      "/api/command-center/voice/call",
    ]) {
      const res = await middleware(req(`http://localhost${path}`, { method: "POST" }));
      expect(passes(res)).toBe(false);
    }
  });
});
