/**
 * CC-SECURITY-COMPLETION-02: every privileged Command Center route must refuse an
 * unauthenticated caller BEFORE it can do anything, and must keep working exactly as
 * before while enforcement is off.
 *
 * "Before it can do anything" is asserted by spying on the modules that cause the side
 * effects (SMTP, the synthesis dispatcher, the gateway, the filesystem, the voice
 * provider) and requiring zero calls on a denied request. A 401 with a side effect behind
 * it would be the worst of both worlds, so that is the assertion that matters.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  sendMail: vi.fn(async () => ({ messageId: "test" })),
  createTransport: vi.fn(),
  approve: vi.fn(async () => ({ ok: true, dispatched: 0 })),
  approveStream: vi.fn(async () => new Response("stream")),
  gateway: vi.fn(async () => ({ ok: true })),
  readFile: vi.fn(async () => "{}"),
  writeFile: vi.fn(async () => undefined),
  placeCall: vi.fn(async () => ({ ok: true, id: "call" })),
  supabaseAdmin: vi.fn(() => null),
}));
m.createTransport.mockReturnValue({ sendMail: m.sendMail });

vi.mock("nodemailer", () => ({ default: { createTransport: m.createTransport } }));
vi.mock("@/lib/cc-approve-synthesis", () => ({
  approveSynthesisMessage: m.approve,
  approveSynthesisMessageStreamed: m.approveStream,
}));
vi.mock("@/lib/openclaw-gateway", () => ({
  gatewayToolsInvoke: m.gateway,
  isOpenClawGatewayConfigured: () => true,
}));
vi.mock("fs/promises", () => ({ readFile: m.readFile, writeFile: m.writeFile }));
vi.mock("@/lib/voice/voice-provider", () => ({
  placeVapiCall: m.placeCall,
  vapiConfigured: () => true,
  toE164: (value: string) => value,
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: m.supabaseAdmin }));

import { POST as gate } from "./gate/route";
import { POST as chatApprove } from "./chat/approve/route";
import { POST as chatApproveStream } from "./chat/approve/stream/route";
import { POST as voiceCall } from "./voice/call/route";
import { POST as leadsSend } from "./leads/send/route";
import { POST as agents } from "./agents/route";
import { POST as settings } from "./settings/route";
import { POST as yoloApprove } from "./yolo-approve/route";
import {
  FOUNDER_SESSION_COOKIE,
  signFounderSession,
} from "@/lib/server/founder-authority";

const SECRET = "q".repeat(48);
const HOST = "command.parallaxvinc.com";

const routes = [
  { key: "gate", handler: gate, body: { id: "g1", action: "approve" } },
  { key: "chat-approve", handler: chatApprove, body: { messageId: "m1" } },
  { key: "chat-approve-stream", handler: chatApproveStream, body: { messageId: "m1" } },
  { key: "voice-call", handler: voiceCall, body: { toNumber: "+15551234567" } },
  { key: "leads-send", handler: leadsSend, body: { leadId: "l1" } },
  { key: "agents", handler: agents, body: { agentId: "a1", model: "x" } },
  { key: "settings", handler: settings, body: { action: "run-doctor" } },
  { key: "yolo-approve", handler: yoloApprove, body: { folder: "f", name: "n", agent: "a", action: "reject" } },
] as const;

function post(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`https://${HOST}/api/command-center/route`, {
    method: "POST",
    headers: { "content-type": "application/json", host: HOST, ...headers },
    body: JSON.stringify(body),
  });
}

function validCookie(): string {
  return `${FOUNDER_SESSION_COOKIE}=${signFounderSession(SECRET, Date.now() + 60_000)}`;
}

function allSideEffectSpies() {
  return [m.sendMail, m.createTransport, m.approve, m.approveStream, m.gateway, m.readFile, m.writeFile, m.placeCall];
}

beforeEach(() => {
  for (const spy of allSideEffectSpies()) spy.mockClear();
  m.supabaseAdmin.mockClear();
  vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", SECRET);
  vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "");
  vi.stubEnv("COMMAND_CENTER_MACHINE_SECRET", "");
  vi.stubEnv("CC_MACHINE_ROUTES", "");
});

afterEach(() => vi.unstubAllEnvs());

describe.each(routes)("POST $key", ({ key, handler, body }) => {
  it("is unguarded by default and reaches its handler (no behavior change yet)", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "");
    const res = await handler(post(body));
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("401s a request with no session, and no side effect runs", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", key);
    const res = await handler(post(body));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("founder_authority_required");
    for (const spy of allSideEffectSpies()) expect(spy).not.toHaveBeenCalled();
    expect(m.supabaseAdmin).not.toHaveBeenCalled();
  });

  it("401s a forged cookie and no side effect runs", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await handler(
      post(body, {
        cookie: `${FOUNDER_SESSION_COOKIE}=${signFounderSession("z".repeat(48), Date.now() + 60_000)}`,
      }),
    );
    expect(res.status).toBe(401);
    for (const spy of allSideEffectSpies()) expect(spy).not.toHaveBeenCalled();
  });

  it("403s a valid session used cross-origin, and no side effect runs", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await handler(
      post(body, { cookie: validCookie(), origin: "https://evil.example" }),
    );
    expect(res.status).toBe(403);
    for (const spy of allSideEffectSpies()) expect(spy).not.toHaveBeenCalled();
  });

  it("proceeds for a same-origin request carrying a valid session", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await handler(
      post(body, { cookie: validCookie(), origin: `https://${HOST}` }),
    );
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("503s when enforcement is on but the signing secret is missing (fail closed)", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", "");
    const res = await handler(post(body, { cookie: validCookie() }));
    expect(res.status).toBe(503);
    for (const spy of allSideEffectSpies()) expect(spy).not.toHaveBeenCalled();
  });
});

describe("machine-to-machine callers", () => {
  it("are refused by default (no route is machine-enabled implicitly)", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    vi.stubEnv("COMMAND_CENTER_MACHINE_SECRET", "m".repeat(48));
    vi.stubEnv("CC_MACHINE_ROUTES", "");
    const res = await agents(post({ agentId: "a1" }, { authorization: `Bearer ${"m".repeat(48)}` }));
    expect(res.status).toBe(401);
    expect(m.writeFile).not.toHaveBeenCalled();
  });

  it("are accepted on a route the operator explicitly listed, with a verified secret", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    vi.stubEnv("COMMAND_CENTER_MACHINE_SECRET", "m".repeat(48));
    vi.stubEnv("CC_MACHINE_ROUTES", "agents");
    const res = await agents(post({ agentId: "a1" }, { authorization: `Bearer ${"m".repeat(48)}` }));
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});
