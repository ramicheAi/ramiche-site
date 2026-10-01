/**
 * Authority layers of an agent chat turn, proven at the Provider Adapter boundary through the real route.
 *
 * Incident: after the identity fix, Triage still answered `Reply exactly: PACKET3_OK` with "I'm Claude Code ...". The
 * route had rendered the last 30 turns, including the agent's own stale replies tagged `[you, triage]:`, INTO the
 * system string next to the canonical identity. Configuration and conversation shared one authority layer.
 *
 * Required model: system = current configuration only; stored turns = real user/assistant roles; Ramon's current
 * message = last user turn. These tests pin it for Triage and Vee, across fallback, windowing and the OpenClaw flattening.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const db = { rows: [] as Record<string, unknown>[], limits: [] as number[] };
vi.mock("@supabase/supabase-js", () => {
  const builder = (): unknown =>
    new Proxy({}, {
      get(_t, prop) {
        if (prop === "then") return (res: (v: unknown) => void) => res({ data: db.rows, error: null });
        if (prop === "maybeSingle" || prop === "single") return async () => ({ data: null, error: null });
        if (prop === "limit") return (n: number) => { db.limits.push(n); return builder(); };
        return () => builder();
      },
    });
  return { createClient: () => ({ from: () => builder() }) };
});

const gw = { configured: false, calls: [] as unknown[][], result: { ok: false, error: "gateway down" } as { ok: boolean; reply?: string; error?: string } };
vi.mock("@/lib/openclaw-gateway", async () => ({
  ...(await vi.importActual<typeof import("@/lib/openclaw-gateway")>("@/lib/openclaw-gateway")),
  isOpenClawGatewayConfigured: () => gw.configured,
  gatewaySessionsSend: async (...a: unknown[]) => { gw.calls.push(a); return gw.result; },
}));
vi.mock("@/lib/server/protected-mutation", () => ({
  guardProtectedMutation: async () => ({ ok: true, uid: "test-owner", sessionCookie: "test-session" }),
  guardPrivateRead: async () => ({ ok: true, uid: "test-owner", sessionCookie: "test-session" }),
}));
vi.mock("@/lib/server/service-caller", async () => ({
  ...(await vi.importActual<typeof import("@/lib/server/service-caller")>("@/lib/server/service-caller")),
  guardServiceCaller: async () => ({ ok: true, principal: "service:bridge", kind: "service" }),
}));

import { agentIdentityFrame } from "@/lib/agent-registry";
import { AGENT_DM_UUID } from "@/lib/cc-agent-dm-uuids";
import { HISTORY_TURN_MAX_CHARS } from "@/lib/chat-message-model";
import * as chatRoute from "@/app/api/command-center/chat/route";

const CLAUDE_URL = "http://127.0.0.1:3456/v1/chat/completions";
const LM_URL = "http://127.0.0.1:1234/v1/chat/completions";
const EXACT = "Reply exactly: PACKET3_OK";
const STALE = "I hear you, but I'm Claude Code, an agent made by Anthropic. I can't pretend to be a different system.";

interface Msg { role: string; content: unknown }
interface Rec { url: string; messages: Msg[] }
let recs: Rec[] = [];
let claudeOk = true;

beforeEach(() => {
  for (const k of Object.keys(process.env)) if (/^(CLAUDE_MAX|LM_STUDIO|CC_CLAUDE|CC_LMSTUDIO|CC_STRICT|OPENCLAW_CHAT)/.test(k)) delete process.env[k];
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  gw.configured = false; gw.calls = []; gw.result = { ok: false, error: "gateway down" };
  db.limits = []; claudeOk = true; recs = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    let messages: Msg[] = [];
    try { messages = JSON.parse(String(init?.body ?? "")).messages ?? []; } catch { /* ignore */ }
    recs.push({ url: String(url), messages });
    if (String(url) === CLAUDE_URL && !claudeOk) return new Response("boom", { status: 500 });
    return new Response(JSON.stringify({ choices: [{ message: { content: "PACKET3_OK" }, finish_reason: "stop" }] }), { status: 200, headers: { "content-type": "application/json" } });
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

/** Stored rows, newest first (Supabase order); the route flips them to chronological. */
function rowsFor(agent: string, extra: Record<string, unknown>[] = []) {
  const id = AGENT_DM_UUID[agent];
  const chrono = [
    { id: "a", sender_type: "user", sender_agent_id: null, content: "who are you?", created_at: "2026-10-01T10:00:00Z" },
    { id: "b", sender_type: "agent", sender_agent_id: id, content: STALE, created_at: "2026-10-01T10:01:00Z" },
    { id: "c", sender_type: "user", sender_agent_id: null, content: EXACT, created_at: "2026-10-01T10:02:00Z" },
    { id: "d", sender_type: "agent", sender_agent_id: id, content: "I can't pretend my identity is something else.", created_at: "2026-10-01T10:03:00Z" },
    ...extra,
  ];
  return chrono.reverse();
}
async function send(agent: string, rows: Record<string, unknown>[], env: Record<string, string> = {}) {
  Object.assign(process.env, env);
  db.rows = rows; recs = [];
  const res = await chatRoute.POST(new NextRequest("http://localhost/api/command-center/chat", {
    method: "POST",
    body: JSON.stringify({ message: EXACT, agentName: agent, channelId: "chan-1", userMessageId: "m-current" }),
    headers: { "content-type": "application/json" },
  }));
  return res;
}
const claude = () => recs.filter((r) => r.url === CLAUDE_URL);

describe.each(["triage", "vee"])("agent chat request authority layers (%s)", (agent) => {
  it("system = canonical configuration only: identity at system authority, no history in it", async () => {
    await send(agent, rowsFor(agent));
    const m = claude()[0].messages;
    expect(m[0].role).toBe("system");
    const system = String(m[0].content);
    expect(system.startsWith(agentIdentityFrame(agent))).toBe(true);
    expect(system).toContain(`Role: `);
    expect(system).not.toContain(STALE);
    expect(system).not.toContain("who are you?");
    expect(system).not.toContain("Recent conversation in this channel");
    expect(system).not.toMatch(/\[you, /);
    // identity lives only in the system message
    for (const t of m.slice(1)) expect(String(t.content)).not.toContain("You are operating as");
  });

  it("stale assistant reply is still present as an assistant turn; Ramon's turns are user turns", async () => {
    await send(agent, rowsFor(agent));
    const turns = claude()[0].messages.slice(1);
    expect(turns.find((t) => t.content === STALE)?.role).toBe("assistant");
    expect(turns.find((t) => t.content === "who are you?")?.role).toBe("user");
    expect(turns.filter((t) => t.role === "assistant")).toHaveLength(2);
  });

  it("chronological order preserved; the current Ramon message is the final user turn", async () => {
    await send(agent, rowsFor(agent));
    const turns = claude()[0].messages.slice(1);
    expect(turns.map((t) => t.role)).toEqual(["user", "assistant", "user", "assistant", "user"]);
    expect(turns.map((t) => String(t.content).slice(0, 12))).toEqual(["who are you?", "I hear you, ", "Reply exactl", "I can't pret", "Reply exactl"]);
    expect(turns[turns.length - 1]).toEqual({ role: "user", content: EXACT });
  });
});

describe("window and other speakers", () => {
  it("history window unchanged (channel 30) and per-turn cap unchanged (400 chars)", async () => {
    const long = "x".repeat(HISTORY_TURN_MAX_CHARS + 50);
    await send("triage", rowsFor("triage", [{ id: "e", sender_type: "user", sender_agent_id: null, content: long, created_at: "2026-10-01T10:04:00Z" }]));
    expect(db.limits).toContain(30);
    const turns = claude()[0].messages.slice(1);
    const capped = turns.find((t) => String(t.content).startsWith("xxxx"))!;
    expect(String(capped.content)).toBe("x".repeat(HISTORY_TURN_MAX_CHARS) + "…");
  });

  it("another agent's earlier turn is a labelled user turn, never attributed to the selected agent", async () => {
    await send("triage", rowsFor("triage", [{ id: "f", sender_type: "agent", sender_agent_id: AGENT_DM_UUID.vee, content: "I'm on it", created_at: "2026-10-01T10:05:00Z" }].map((r) => r)));
    const turns = claude()[0].messages.slice(1);
    const other = turns.find((t) => String(t.content).includes("I'm on it"))!;
    expect(other).toEqual({ role: "user", content: "[vee]: I'm on it" });
  });
});

describe("fallback and OpenClaw", () => {
  it("OpenClaw failure -> Claude Max -> LM Studio all receive the identical system + dialogue", async () => {
    gw.configured = true;
    claudeOk = false;
    await send("triage", rowsFor("triage"), { OPENCLAW_CHAT_PRIMARY: "1" });
    expect(gw.calls).toHaveLength(1);
    const c = recs.find((r) => r.url === CLAUDE_URL)!;
    const l = recs.find((r) => r.url === LM_URL)!;
    expect(l.messages).toEqual(c.messages);
    expect(c.messages[0].role).toBe("system");
    expect(c.messages[c.messages.length - 1]).toEqual({ role: "user", content: EXACT });
  });

  it("OpenClaw (single string, no roles): sections are labelled; stale reply is under conversation, not configuration", async () => {
    gw.configured = true;
    gw.result = { ok: true, reply: "PACKET3_OK" };
    await send("triage", rowsFor("triage"), { OPENCLAW_CHAT_PRIMARY: "1" });
    const msg = String(gw.calls[0][1]);
    const convoAt = msg.indexOf("Conversation so far (oldest to newest):");
    expect(msg.indexOf(agentIdentityFrame("triage"))).toBeGreaterThan(-1);
    expect(msg.indexOf(STALE)).toBeGreaterThan(convoAt);
    expect(msg.indexOf(agentIdentityFrame("triage"))).toBeLessThan(convoAt);
    expect(msg.slice(0, convoAt)).not.toContain(STALE);
    expect(msg.endsWith(`Current message from Ramon:\n${EXACT}`)).toBe(true);
    expect(claude()).toHaveLength(0);
  });
});
