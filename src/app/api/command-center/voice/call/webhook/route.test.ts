import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const SECRET = "a".repeat(32);

function req(body: Record<string, unknown>, headers: Record<string, string> = {}): Request {
  return new Request("https://example.test/api/command-center/voice/call/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("voice/call/webhook authorization (CC-SECURITY-RELEASE-GATE-03A)", () => {
  const original = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    delete process.env.COMMAND_CENTER_MACHINE_SECRET;
    delete process.env.CC_MACHINE_ROUTES;
    delete process.env.CC_FOUNDER_GUARD_ENFORCE;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("is unguarded by default: no secret, no route list, request proceeds to the handler", async () => {
    const { POST } = await import("./route");
    // No leadId/transcript -> short-circuits to captured:false, but WITHOUT the "unauthorized" reason:
    // proof it reached the handler body, not the guard's early return.
    const res = await POST(req({ message: { type: "end-of-call-report" } }));
    const body = await res.json();
    expect(body.reason).not.toBe("unauthorized");
  });

  it("enforced, no x-vapi-secret header: rejected, still 200, never a retry-storm status", async () => {
    process.env.COMMAND_CENTER_MACHINE_SECRET = SECRET;
    process.env.CC_MACHINE_ROUTES = "voice-call-webhook";
    process.env.CC_FOUNDER_GUARD_ENFORCE = "voice-call-webhook";
    const { POST } = await import("./route");
    const res = await POST(req({ message: { type: "end-of-call-report" } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, captured: false, reason: "unauthorized" });
  });

  it("enforced, wrong x-vapi-secret: rejected the same way", async () => {
    process.env.COMMAND_CENTER_MACHINE_SECRET = SECRET;
    process.env.CC_MACHINE_ROUTES = "voice-call-webhook";
    process.env.CC_FOUNDER_GUARD_ENFORCE = "voice-call-webhook";
    const { POST } = await import("./route");
    const res = await POST(req({ message: { type: "end-of-call-report" } }, { "x-vapi-secret": "b".repeat(32) }));
    expect(await res.json()).toMatchObject({ reason: "unauthorized" });
  });

  it("enforced, correct x-vapi-secret: proceeds to the handler (not rejected)", async () => {
    process.env.COMMAND_CENTER_MACHINE_SECRET = SECRET;
    process.env.CC_MACHINE_ROUTES = "voice-call-webhook";
    process.env.CC_FOUNDER_GUARD_ENFORCE = "voice-call-webhook";
    const { POST } = await import("./route");
    const res = await POST(req({ message: { type: "end-of-call-report" } }, { "x-vapi-secret": SECRET }));
    const body = await res.json();
    expect(body.reason).not.toBe("unauthorized");
  });

  it("enforced here, but the machine-route allowlist names other routes: rejected anyway", async () => {
    process.env.COMMAND_CENTER_MACHINE_SECRET = SECRET;
    process.env.CC_MACHINE_ROUTES = "gate,settings";
    process.env.CC_FOUNDER_GUARD_ENFORCE = "voice-call-webhook";
    const { POST } = await import("./route");
    const res = await POST(req({ message: { type: "end-of-call-report" } }, { "x-vapi-secret": SECRET }));
    const body = await res.json();
    expect(body.reason).toBe("unauthorized");
  });

  it("CC_FOUNDER_GUARD_ENFORCE names a different route: this one stays open", async () => {
    process.env.COMMAND_CENTER_MACHINE_SECRET = SECRET;
    process.env.CC_MACHINE_ROUTES = "voice-call-webhook";
    process.env.CC_FOUNDER_GUARD_ENFORCE = "gate,settings";
    const { POST } = await import("./route");
    const res = await POST(req({ message: { type: "end-of-call-report" } }));
    const body = await res.json();
    expect(body.reason).not.toBe("unauthorized");
  });

  it("enforced, secret shorter than 32 chars: fails closed like every other not-configured case here", async () => {
    process.env.COMMAND_CENTER_MACHINE_SECRET = "short";
    process.env.CC_MACHINE_ROUTES = "voice-call-webhook";
    process.env.CC_FOUNDER_GUARD_ENFORCE = "voice-call-webhook";
    const { POST } = await import("./route");
    const res = await POST(req({ message: { type: "end-of-call-report" } }));
    const body = await res.json();
    expect(body.reason).toBe("unauthorized");
  });

  it("non end-of-call-report messages are still acked without the guard touching them", async () => {
    process.env.COMMAND_CENTER_MACHINE_SECRET = SECRET;
    process.env.CC_MACHINE_ROUTES = "voice-call-webhook";
    process.env.CC_FOUNDER_GUARD_ENFORCE = "voice-call-webhook";
    const { POST } = await import("./route");
    const res = await POST(req({ message: { type: "status-update" } }));
    expect(await res.json()).toEqual({ ok: true });
  });
});
