import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isOpenClawGatewayConfigured,
  resolveChatSessionKey,
  gatewayToolsInvoke,
  gatewaySessionsSend,
  gatewaySessionsSpawn,
} from "./openclaw-gateway";

describe("openclaw-gateway", () => {
  beforeEach(() => {
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", "");
    vi.stubEnv("OPENCLAW_GATEWAY_PASSWORD", "");
    vi.stubEnv("OPENCLAW_GATEWAY_URL", "");
    vi.stubEnv("OPENCLAW_CHAT_SESSION_KEY", "");
    vi.stubEnv("OPENCLAW_AGENT_SESSION_KEYS", "");
    vi.stubEnv("CF_ACCESS_CLIENT_ID", "");
    vi.stubEnv("CF_ACCESS_CLIENT_SECRET", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("isOpenClawGatewayConfigured is false without credentials", () => {
    expect(isOpenClawGatewayConfigured()).toBe(false);
  });

  it("isOpenClawGatewayConfigured is true with token or password", () => {
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", "t");
    expect(isOpenClawGatewayConfigured()).toBe(true);
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", "");
    vi.stubEnv("OPENCLAW_GATEWAY_PASSWORD", "p");
    expect(isOpenClawGatewayConfigured()).toBe(true);
  });

  it("resolveChatSessionKey defaults to main", () => {
    expect(resolveChatSessionKey("atlas")).toBe("agent:main:main");
  });

  it("resolveChatSessionKey uses OPENCLAW_CHAT_SESSION_KEY", () => {
    vi.stubEnv("OPENCLAW_CHAT_SESSION_KEY", "custom");
    expect(resolveChatSessionKey("any")).toBe("custom");
  });

  it("resolveChatSessionKey parses agent JSON map and wildcard", () => {
    vi.stubEnv("OPENCLAW_AGENT_SESSION_KEYS", '{"atlas":"sess-a","*":"fallback"}');
    expect(resolveChatSessionKey("atlas")).toBe("sess-a");
    expect(resolveChatSessionKey("other")).toBe("fallback");
  });

  it("resolveChatSessionKey defaults when agent JSON invalid", () => {
    vi.stubEnv("OPENCLAW_AGENT_SESSION_KEYS", "{not-json");
    expect(resolveChatSessionKey("atlas")).toBe("agent:main:main");
  });

  it("gatewayToolsInvoke fails fast without auth", async () => {
    const r = await gatewayToolsInvoke({ tool: "t" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/TOKEN|PASSWORD/);
  });

  it("gatewayToolsInvoke posts JSON and returns result on HTTP 200", async () => {
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", "tok");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { reply: "hello" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const r = await gatewayToolsInvoke({ tool: "sessions_send", args: { x: 1 } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toEqual({ reply: "hello" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain("/tools/invoke");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("gatewayToolsInvoke uses password when token unset", async () => {
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", "");
    vi.stubEnv("OPENCLAW_GATEWAY_PASSWORD", "secret");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: {} }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await gatewayToolsInvoke({ tool: "t" });
    expect(r.ok).toBe(true);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret");
  });

  it("gatewayToolsInvoke strips trailing slash from OPENCLAW_GATEWAY_URL", async () => {
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", "tok");
    vi.stubEnv("OPENCLAW_GATEWAY_URL", "http://gw.example.com/");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: {} }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await gatewayToolsInvoke({ tool: "ping" });
    expect(fetchMock.mock.calls[0][0]).toBe("http://gw.example.com/tools/invoke");
  });

  it("gatewayToolsInvoke returns error when fetch throws", async () => {
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", "tok");
    vi.stubGlobal("fetch", () => Promise.reject(new Error("network down")));
    const r = await gatewayToolsInvoke({ tool: "t" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("network down");
  });

  it("gatewayToolsInvoke maps HTTP error body", async () => {
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", "tok");
    vi.stubGlobal("fetch", () =>
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: "Err",
        json: async () => ({ error: { message: "boom" } }),
      })
    );
    const r = await gatewayToolsInvoke({ tool: "t" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("boom");
  });

  it("gatewayToolsInvoke handles data.ok === false", async () => {
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", "tok");
    vi.stubGlobal("fetch", () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ ok: false, error: { message: "denied" } }),
      })
    );
    const r = await gatewayToolsInvoke({ tool: "t" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("denied");
  });

  it("gatewaySessionsSend returns trimmed reply", async () => {
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", "tok");
    vi.stubGlobal("fetch", () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { reply: "  done  " } }),
      })
    );
    const r = await gatewaySessionsSend("main", "hi");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reply).toBe("done");
  });

  it("gatewaySessionsSend accepts string result payload", async () => {
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", "tok");
    vi.stubGlobal("fetch", () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: "  plain  " }),
      })
    );
    const r = await gatewaySessionsSend("main", "hi");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reply).toBe("plain");
  });

  it("gatewaySessionsSend extracts nested reply.reply.text", async () => {
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", "tok");
    vi.stubGlobal("fetch", () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          result: { reply: { text: "nested" } },
        }),
      })
    );
    const r = await gatewaySessionsSend("main", "hi");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reply).toBe("nested");
  });

  it("gatewaySessionsSend extracts reply.reply.content", async () => {
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", "tok");
    vi.stubGlobal("fetch", () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          result: { reply: { content: "via-content" } },
        }),
      })
    );
    const r = await gatewaySessionsSend("main", "hi");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reply).toBe("via-content");
  });

  it("gatewaySessionsSend extracts top-level message", async () => {
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", "tok");
    vi.stubGlobal("fetch", () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          result: { message: "via-message" },
        }),
      })
    );
    const r = await gatewaySessionsSend("main", "hi");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reply).toBe("via-message");
  });

  it("gatewaySessionsSend errors when no reply text", async () => {
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", "tok");
    vi.stubGlobal("fetch", () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: {} }),
      })
    );
    const r = await gatewaySessionsSend("main", "hi");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no reply/);
  });

  it("gatewaySessionsSpawn returns result on success", async () => {
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", "tok");
    vi.stubGlobal("fetch", () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { id: "run-1" } }),
      })
    );
    const r = await gatewaySessionsSpawn({ task: "do thing" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toEqual({ id: "run-1" });
  });

  it("gatewaySessionsSpawn forwards invoke failure", async () => {
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", "tok");
    vi.stubGlobal("fetch", () =>
      Promise.resolve({
        ok: false,
        status: 503,
        statusText: "Unavailable",
        json: async () => ({ error: { message: "spawn blocked" } }),
      })
    );
    const r = await gatewaySessionsSpawn({ task: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("spawn blocked");
  });

  /* ── Cloudflare Access service token ──────────────────────────────── */
  it("sends the CF-Access header pair when the service token is configured", async () => {
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", "tok");
    vi.stubEnv("OPENCLAW_GATEWAY_URL", "https://openclaw.parallaxvinc.com");
    vi.stubEnv("CF_ACCESS_CLIENT_ID", "id.access");
    vi.stubEnv("CF_ACCESS_CLIENT_SECRET", "secret-value");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ ok: true, result: {} }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await gatewayToolsInvoke({ tool: "ping" });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["CF-Access-Client-Id"]).toBe("id.access");
    expect(headers["CF-Access-Client-Secret"]).toBe("secret-value");
    // The gateway's own auth header is still present and separate.
    expect(headers.Authorization).toBe("Bearer tok");
  });

  it("sends no CF-Access headers when the token is absent (local gateway)", async () => {
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", "tok");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: {} }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await gatewayToolsInvoke({ tool: "ping" });
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers).not.toHaveProperty("CF-Access-Client-Id");
    expect(headers).not.toHaveProperty("CF-Access-Client-Secret");
  });

  it("sends no CF-Access headers when only half the token is configured", async () => {
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", "tok");
    vi.stubEnv("CF_ACCESS_CLIENT_ID", "id.access");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: {} }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await gatewayToolsInvoke({ tool: "ping" });
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers).not.toHaveProperty("CF-Access-Client-Id");
  });

  it("reports an Access login 302 as interception instead of parsing the login page", async () => {
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", "tok");
    vi.stubEnv("OPENCLAW_GATEWAY_URL", "https://openclaw.parallaxvinc.com");
    const jsonSpy = vi.fn();
    vi.stubGlobal("fetch", () =>
      Promise.resolve({
        ok: false,
        status: 302,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "location"
              ? "https://calm-firefly-c94b.cloudflareaccess.com/cdn-cgi/access/login/openclaw.parallaxvinc.com"
              : null,
        },
        json: jsonSpy,
      })
    );
    const r = await gatewayToolsInvoke({ tool: "t" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("Cloudflare Access");
      expect(r.error).toContain("CF_ACCESS_CLIENT_ID");
      // The old bug: parsing the HTML page yielded {} and surfaced as "no reply text".
      expect(r.error).not.toMatch(/no reply text/i);
    }
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it("reports a 200 HTML login page as interception, not as a missing reply", async () => {
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", "tok");
    vi.stubEnv("OPENCLAW_GATEWAY_URL", "https://openclaw.parallaxvinc.com");
    vi.stubGlobal("fetch", () =>
      Promise.resolve({
        ok: true,
        status: 200,
        url: "",
        headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? "text/html" : null) },
        json: async () => {
          throw new SyntaxError("Unexpected token '<'");
        },
      })
    );
    const r = await gatewayToolsInvoke({ tool: "t" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/HTML page/);
      expect(r.error).not.toMatch(/no reply text/i);
    }
  });

  it("leaves a genuine provider error untouched", async () => {
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", "tok");
    vi.stubGlobal("fetch", () =>
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: "Err",
        headers: { get: () => "application/json" },
        json: async () => ({ error: { message: "model overloaded" } }),
      })
    );
    const r = await gatewayToolsInvoke({ tool: "t" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("model overloaded");
  });
});
