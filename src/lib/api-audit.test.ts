import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { auditLog, withAudit } from "./api-audit";

describe("api-audit", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("auditLog writes JSON", () => {
    auditLog(
      new Request("http://x", { headers: { "x-forwarded-for": "1.1.1.1" } }),
      "/r",
      200,
      Date.now()
    );
    expect(logSpy.mock.calls[0][0]).toMatch(/\[AUDIT\]/);
  });

  it("auditLog uses unknown ip when x-forwarded-for absent", () => {
    auditLog(new Request("http://x"), "/r", 200, Date.now());
    const line = String(logSpy.mock.calls[0][0]);
    const entry = JSON.parse(line.replace(/^\[AUDIT\]\s*/, "")) as { ip: string };
    expect(entry.ip).toBe("unknown");
  });

  it("auditLog trims first x-forwarded-for segment", () => {
    auditLog(
      new Request("http://x", {
        headers: { "x-forwarded-for": "  9.9.9.9 , 8.8.8.8" },
      }),
      "/r",
      200,
      Date.now()
    );
    const line = String(logSpy.mock.calls[0][0]);
    const entry = JSON.parse(line.replace(/^\[AUDIT\]\s*/, "")) as { ip: string };
    expect(entry.ip).toBe("9.9.9.9");
  });

  it("auditLog records method and truncates user-agent", () => {
    const ua = "U".repeat(250);
    auditLog(
      new Request("http://x", {
        method: "POST",
        headers: { "user-agent": ua },
      }),
      "/api/x",
      201,
      Date.now()
    );
    const line = String(logSpy.mock.calls[0][0]);
    const entry = JSON.parse(line.replace(/^\[AUDIT\]\s*/, "")) as {
      method: string;
      userAgent: string;
    };
    expect(entry.method).toBe("POST");
    expect(entry.userAgent).toHaveLength(200);
    expect(entry.userAgent.startsWith("UU")).toBe(true);
  });

  it("withAudit wraps handler", async () => {
    const w = withAudit("/api/x", async () => new Response("ok", { status: 200 }));
    const res = await w(new Request("http://x"));
    expect(await res.text()).toBe("ok");
  });

  it("withAudit logs 500 and rethrows when handler throws", async () => {
    const w = withAudit("/api/boom", async () => {
      throw new Error("handler-fail");
    });
    await expect(w(new Request("http://x"))).rejects.toThrow("handler-fail");
    const line = String(logSpy.mock.calls.at(-1)?.[0]);
    expect(line).toContain('"status":500');
  });

  it("withAudit logs non-2xx response status", async () => {
    const w = withAudit("/api/miss", async () => new Response("n", { status: 404 }));
    const res = await w(new Request("http://x"));
    expect(res.status).toBe(404);
    const line = String(logSpy.mock.calls.at(-1)?.[0]);
    expect(line).toContain('"status":404');
  });
});
