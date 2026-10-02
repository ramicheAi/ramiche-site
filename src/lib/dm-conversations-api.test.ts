/**
 * The conversation-create route, and the chat route driven across TWO conversations with the same agent.
 *
 * Proves at the route boundary: a new conversation starts empty, loads only its own history, gets its own
 * OpenClaw session, still attributes replies to the right agent, and leaves the other conversation alone.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { AGENT_DM_UUID } from "@/lib/cc-agent-dm-uuids";

const TRIAGE = AGENT_DM_UUID.triage;
const CONV_B = "3fa1b2c3-d4e5-4f67-8901-234567890abc";

/* ── supabase stub: per-channel rows, recorded inserts ─────────────────── */
type Row = Record<string, unknown>;
const db = {
  configured: true,
  rowsByChannel: {} as Record<string, Row[]>,
  dmChannels: [] as Row[],
  inserts: [] as { table: string; row: Row }[],
  insertErrors: [] as (null | { code: string })[],
};
function builder(table: string) {
  const eqs: Record<string, unknown> = {};
  // Fidelity: the route queries channel history newest-first and reverses it, so the stub must order the
  // same way Supabase would rather than handing back insertion order.
  let ascending = true;
  const self: Record<string, unknown> = {};
  const api = new Proxy(self, {
    get(_t, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => {
          const cid = eqs.channel_id as string | undefined;
          const rows = table === "messages" ? (cid ? db.rowsByChannel[cid] ?? [] : []) : db.dmChannels;
          const sorted = [...rows].sort((a, b) =>
            String(a.created_at ?? "") < String(b.created_at ?? "") ? -1 : 1,
          );
          resolve({ data: ascending ? sorted : sorted.reverse(), error: null });
        };
      }
      if (prop === "eq") return (col: string, val: unknown) => { eqs[col] = val; return api; };
      if (prop === "order") return (_col: string, opts?: { ascending?: boolean }) => { ascending = opts?.ascending !== false; return api; };
      if (prop === "maybeSingle" || prop === "single") {
        return async () => {
          if (table === "channels" && db.inserts.length > 0) {
            const err = db.insertErrors.shift() ?? null;
            if (err) return { data: null, error: err };
            return { data: db.inserts[db.inserts.length - 1].row, error: null };
          }
          return { data: null, error: null };
        };
      }
      if (prop === "insert") return (row: Row) => { db.inserts.push({ table, row }); return api; };
      return () => api;
    },
  });
  return api;
}
const client = { from: (table: string) => builder(table) };
vi.mock("@supabase/supabase-js", () => ({ createClient: () => client }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => (db.configured ? client : null) }));

const guard = { ok: true };
vi.mock("@/lib/server/protected-mutation", () => ({
  guardProtectedMutation: async () =>
    guard.ok
      ? { ok: true, uid: "owner", sessionCookie: "s" }
      : { ok: false, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) },
  guardPrivateRead: async () => ({ ok: true, uid: "owner", sessionCookie: "s" }),
}));
vi.mock("@/lib/server/service-caller", async () => ({
  ...(await vi.importActual<typeof import("@/lib/server/service-caller")>("@/lib/server/service-caller")),
  guardServiceCaller: async () => ({ ok: true, principal: "svc", kind: "service" }),
}));
const gw = { configured: false, calls: [] as unknown[][] };
vi.mock("@/lib/openclaw-gateway", async () => ({
  ...(await vi.importActual<typeof import("@/lib/openclaw-gateway")>("@/lib/openclaw-gateway")),
  isOpenClawGatewayConfigured: () => gw.configured,
  gatewaySessionsSend: async (...a: unknown[]) => { gw.calls.push(a); return { ok: false, error: "gateway down" }; },
}));

import * as conversations from "@/app/api/command-center/chat/conversations/route";
import * as chatRoute from "@/app/api/command-center/chat/route";

const CLAUDE_URL = "http://127.0.0.1:3456/v1/chat/completions";
let recs: { url: string; messages: { role: string; content: unknown }[] }[] = [];

beforeEach(() => {
  for (const k of Object.keys(process.env)) if (/^(CLAUDE_MAX|LM_STUDIO|CC_|OPENCLAW_)/.test(k)) delete process.env[k];
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  db.configured = true; db.rowsByChannel = {}; db.dmChannels = []; db.inserts = []; db.insertErrors = [];
  guard.ok = true; gw.configured = false; gw.calls = []; recs = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    let messages: { role: string; content: unknown }[] = [];
    try { messages = JSON.parse(String(init?.body ?? "")).messages ?? []; } catch { /* ignore */ }
    recs.push({ url: String(url), messages });
    return new Response(JSON.stringify({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }), { status: 200, headers: { "content-type": "application/json" } });
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

const post = (body: unknown) =>
  conversations.POST(new NextRequest("http://localhost/api/command-center/chat/conversations", {
    method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" },
  }));

/* ═══ create ═════════════════════════════════════════════════════════════ */
describe("POST /chat/conversations", () => {
  it("creates a dm channel with a fresh id, the agent's uuid, and a derived slug", async () => {
    const res = await post({ agentId: "triage" });
    expect(res.status).toBe(201);
    expect(db.inserts).toHaveLength(1);
    const row = db.inserts[0].row;
    expect(db.inserts[0].table).toBe("channels");
    expect(row.type).toBe("dm");
    expect(row.agent_id).toBe(TRIAGE);
    expect(row.id).not.toBe(TRIAGE);
    expect(String(row.id)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(row.slug).toBe(`dm-triage-${String(row.id).replace(/-/g, "").slice(0, 12)}`);
    expect(row.is_private).toBe(true);
    expect(row.tenant_id).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("inserts ONLY the channel row: a new conversation is empty by construction", async () => {
    await post({ agentId: "triage" });
    expect(db.inserts.every((i) => i.table === "channels")).toBe(true);
    expect(db.inserts.filter((i) => i.table === "messages")).toHaveLength(0);
  });

  it("labels the first conversation as the agent and later ones numbered", async () => {
    await post({ agentId: "triage" });
    expect(db.inserts[0].row.title).toBe("Triage");
    db.dmChannels = [{ id: TRIAGE, agent_id: TRIAGE, title: "Triage", type: "dm", created_at: "2026-01-01" }];
    db.inserts = [];
    await post({ agentId: "triage" });
    expect(db.inserts[0].row.title).toBe("Triage 2");
  });

  it("honours an explicit title and normalizes it", async () => {
    await post({ agentId: "triage", title: "  Clean   control  " });
    expect(db.inserts[0].row.title).toBe("Clean control");
  });

  it("retries with a new id when the slug loses the unique race", async () => {
    db.insertErrors = [{ code: "23505" }];
    const res = await post({ agentId: "triage" });
    expect(res.status).toBe(201);
    expect(db.inserts).toHaveLength(2);
    expect(db.inserts[0].row.id).not.toBe(db.inserts[1].row.id);
    expect(db.inserts[0].row.slug).not.toBe(db.inserts[1].row.slug);
  });

  it("gives up after bounded retries instead of looping", async () => {
    db.insertErrors = [{ code: "23505" }, { code: "23505" }, { code: "23505" }];
    const res = await post({ agentId: "triage" });
    expect(res.status).toBe(502);
    expect(db.inserts.length).toBeLessThanOrEqual(3);
  });

  it("is gated by the owner/CSRF/origin mutation guard", async () => {
    guard.ok = false;
    const res = await post({ agentId: "triage" });
    expect(res.status).toBe(403);
    expect(db.inserts).toHaveLength(0);
  });

  it("rejects an unknown agent, a non-chat agent and a raw uuid, and never trusts a client agent uuid", async () => {
    for (const body of [{ agentId: "nope" }, { agentId: "" }, {}, { agentId: TRIAGE }, { agentId: "ramon" }]) {
      const res = await post(body);
      expect([400]).toContain(res.status);
    }
    expect(db.inserts).toHaveLength(0);
  });

  it("rejects a malformed body", async () => {
    const res = await conversations.POST(new NextRequest("http://localhost/api/command-center/chat/conversations", {
      method: "POST", body: "not json", headers: { "content-type": "application/json" },
    }));
    expect(res.status).toBe(400);
    expect(db.inserts).toHaveLength(0);
  });

  it("reports 503 when Supabase is unconfigured rather than pretending success", async () => {
    db.configured = false;
    expect((await post({ agentId: "triage" })).status).toBe(503);
  });
});

/* ═══ two conversations, one agent ═══════════════════════════════════════ */
describe("the chat route across two conversations with one agent", () => {
  const send = async (channelId: string, message: string) => {
    recs = [];
    const res = await chatRoute.POST(new NextRequest("http://localhost/api/command-center/chat", {
      method: "POST",
      body: JSON.stringify({ message, agentName: "triage", channelId, conversationId: channelId, userMessageId: "m-cur" }),
      headers: { "content-type": "application/json" },
    }));
    expect(res.status).toBe(200);
    const c = recs.filter((r) => r.url === CLAUDE_URL);
    expect(c).toHaveLength(1);
    return c[0].messages;
  };

  beforeEach(() => {
    // the old conversation carries the stale refusal; the new one is empty
    db.rowsByChannel[TRIAGE] = [
      { id: "old-1", sender_type: "user", sender_agent_id: null, content: "who are you?", created_at: "2026-10-01T10:00:00Z" },
      { id: "old-2", sender_type: "agent", sender_agent_id: TRIAGE, content: "I'm Claude Code, made by Anthropic.", created_at: "2026-10-01T10:01:00Z" },
    ];
    db.rowsByChannel[CONV_B] = [];
  });

  it("a new conversation sends ZERO history: just the system layer and the current message", async () => {
    const m = await send(CONV_B, "Reply exactly: PACKET3_OK");
    expect(m).toHaveLength(2);
    expect(m[0].role).toBe("system");
    expect(m[1]).toEqual({ role: "user", content: "Reply exactly: PACKET3_OK" });
    expect(JSON.stringify(m)).not.toContain("Claude Code");
  });

  it("the old conversation still loads its own history, unchanged", async () => {
    const m = await send(TRIAGE, "hello again");
    const turns = m.slice(1);
    expect(turns.map((t) => t.role)).toEqual(["user", "assistant", "user"]);
    expect(turns[1].content).toContain("Claude Code");
    expect(turns[turns.length - 1]).toEqual({ role: "user", content: "hello again" });
  });

  it("neither conversation leaks into the other", async () => {
    const neu = await send(CONV_B, "fresh");
    const old = await send(TRIAGE, "old");
    expect(JSON.stringify(neu)).not.toContain("who are you?");
    expect(JSON.stringify(old)).toContain("who are you?");
  });

  it("the canonical agent identity is identical in both conversations", async () => {
    const neu = await send(CONV_B, "x");
    const old = await send(TRIAGE, "x");
    expect(String(neu[0].content)).toBe(String(old[0].content));
    expect(String(neu[0].content)).toContain("You are operating as Triage");
  });

  it("OpenClaw gets a DIFFERENT session key per conversation, and the legacy key for the legacy DM", async () => {
    gw.configured = true;
    process.env.OPENCLAW_CHAT_PRIMARY = "1";
    await send(TRIAGE, "a");
    const legacyKey = gw.calls[0][0];
    gw.calls = [];
    await send(CONV_B, "b");
    const newKey = gw.calls[0][0];
    expect(newKey).not.toBe(legacyKey);
    expect(String(legacyKey)).toContain("triage");
    expect(String(newKey)).toContain("triage");
    expect(String(newKey)).toMatch(/c-[0-9a-f]{12}$/);
  });

  it("the agent's reply is still attributed to the agent, in the new conversation's channel", async () => {
    await send(CONV_B, "x");
    const replies = db.inserts.filter((i) => i.table === "messages" && i.row.sender_type === "agent");
    expect(replies.length).toBeGreaterThan(0);
    for (const r of replies) {
      expect(r.row.sender_agent_id).toBe(TRIAGE);
      expect(r.row.channel_id).toBe(CONV_B);
    }
  });
});
