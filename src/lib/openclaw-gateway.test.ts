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
    expect(resolveChatSessionKey("atlas")).toBe("main");
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
    expect(resolveChatSessionKey("atlas")).toBe("main");
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
});
