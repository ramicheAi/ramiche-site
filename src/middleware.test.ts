import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

function req(
  url: string,
  init: { method?: string; headers?: Record<string, string> } = {}
): NextRequest {
  return new NextRequest(url, { method: init.method ?? "GET", headers: init.headers });
}

function mockSessionEndpoint(body: { authenticated?: boolean; isOwner?: boolean } | null, ok = true) {
  global.fetch = vi.fn(async () =>
    body === null
      ? new Response("", { status: 500 })
      : new Response(JSON.stringify(body), { status: ok ? 200 : 401 })
  ) as unknown as typeof fetch;
}

describe("middleware — Command Center owner gate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("denies an unauthenticated API request with 401, never redirects to a login page", async () => {
    mockSessionEndpoint({ authenticated: false });
    const res = await middleware(req("http://localhost/api/command-center/revenue"));
    expect(res.status).toBe(401);
  });

  it("denies an authenticated-but-not-owner request with 401 (not 200)", async () => {
    mockSessionEndpoint({ authenticated: true, isOwner: false });
    const res = await middleware(req("http://localhost/api/command-center/revenue", { headers: { cookie: "__session=" + "x".repeat(40) } }));
    expect(res.status).toBe(401);
  });

  it("allows the exact owner through", async () => {
    mockSessionEndpoint({ authenticated: true, isOwner: true });
    const res = await middleware(req("http://localhost/api/command-center/revenue", { headers: { cookie: "__session=" + "x".repeat(40) } }));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("fails closed when the session-verification fetch itself errors", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const res = await middleware(req("http://localhost/api/command-center/revenue", { headers: { cookie: "__session=" + "x".repeat(40) } }));
    expect(res.status).toBe(401);
  });

  it("a forged X-Forwarded-Host/Host/.ts.net value grants nothing on its own", async () => {
    mockSessionEndpoint({ authenticated: false });
    for (const host of ["command.parallaxvinc.com", "localhost", "127.0.0.1", "whatever.tail59e3bd.ts.net"]) {
      const res = await middleware(
        req("http://localhost/api/command-center/revenue", {
          headers: { "x-forwarded-host": host, host },
        })
      );
      expect(res.status).toBe(401);
    }
  });

  it("redirects an unauthenticated page request to /command-login with ?next=", async () => {
    mockSessionEndpoint({ authenticated: false });
    const res = await middleware(req("http://localhost/command-center/leads"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/command-login");
    expect(location).toContain("next=%2Fcommand-center%2Fleads");
  });

  it("rejects a cross-site mutating request before any session check (CSRF)", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const res = await middleware(
      req("http://localhost/api/command-center/leads/send", {
        method: "POST",
        headers: { "sec-fetch-site": "cross-site", cookie: "__session=" + "x".repeat(40) },
      })
    );
    expect(res.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a mutating request whose Origin host does not match the request host", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const res = await middleware(
      req("http://localhost/api/command-center/leads/send", {
        method: "POST",
        headers: { origin: "https://evil.example.com", host: "localhost", cookie: "__session=" + "x".repeat(40) },
      })
    );
    expect(res.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("allows a same-origin mutating request through to the owner check", async () => {
    mockSessionEndpoint({ authenticated: true, isOwner: true });
    const res = await middleware(
      req("http://localhost/api/command-center/leads/send", {
        method: "POST",
        headers: { origin: "http://localhost", host: "localhost", cookie: "__session=" + "x".repeat(40) },
      })
    );
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("lets the bearer-authenticated webhook/push routes through untouched, even unauthenticated", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    for (const path of ["/api/command-center/chat/webhook", "/api/command-center/push"]) {
      const res = await middleware(req(`http://localhost${path}`, { method: "POST" }));
      expect(res.headers.get("x-middleware-next")).toBe("1");
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
