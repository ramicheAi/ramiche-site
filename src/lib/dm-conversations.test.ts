/**
 * Multiple DM conversations per agent: the identity split, the session isolation, and the source guards.
 *
 * The defect this closes: a DM channel's id WAS the agent's identity uuid (`channels.id` = registry `dmUuid`
 * = `messages.sender_agent_id`). One value meant two things, so an agent could have exactly one conversation
 * and the UI reverse-mapped a channel id to decide who an agent was. Now the link is `channels.agent_id`.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  isLegacyDmChannel,
  conversationSlug,
  normalizeTitle,
  defaultConversationTitle,
  listAgentConversations,
  conversationLabel,
  agentUuidForChannel,
  MAX_TITLE_LENGTH,
  type ConversationChannel,
} from "./dm-conversations";
import { resolveChatSessionKey, conversationScopedSessionKey } from "./openclaw-gateway";
import { AGENT_DM_UUID } from "./cc-agent-dm-uuids";

const TRIAGE = AGENT_DM_UUID.triage;
const VEE = AGENT_DM_UUID.vee;
const C2 = "3fa1b2c3-d4e5-4f67-8901-234567890abc";
const C3 = "9c8b7a65-4321-4fed-ba98-765432109876";

const dm = (id: string, agentId: string, extra: Partial<ConversationChannel> = {}): ConversationChannel => ({
  id, agentId, type: "dm", ...extra,
});

/* ═══ 1. the identity split ══════════════════════════════════════════════ */
describe("agent identity vs conversation identity", () => {
  it("a legacy DM is the row where the two happen to be equal; a new one is not", () => {
    expect(isLegacyDmChannel(TRIAGE, TRIAGE)).toBe(true);
    expect(isLegacyDmChannel(TRIAGE.toUpperCase(), TRIAGE)).toBe(true);
    expect(isLegacyDmChannel(C2, TRIAGE)).toBe(false);
  });

  it("one agent, two conversations: distinct channel ids, one stable agent identity", () => {
    const channels = [dm(TRIAGE, TRIAGE, { createdAt: "2026-01-01" }), dm(C2, TRIAGE, { createdAt: "2026-02-01" })];
    const mine = listAgentConversations(channels, TRIAGE);
    expect(mine.map((c) => c.id)).toEqual([TRIAGE, C2]);
    expect(new Set(mine.map((c) => c.id)).size).toBe(2);
    // the agent is the same in both; only the conversation differs
    expect(new Set(mine.map((c) => c.agentId))).toEqual(new Set([TRIAGE]));
  });

  it("conversations are scoped per agent: Vee's never appear under Triage", () => {
    const channels = [dm(TRIAGE, TRIAGE), dm(C2, TRIAGE), dm(VEE, VEE), dm(C3, VEE)];
    expect(listAgentConversations(channels, TRIAGE).map((c) => c.id)).toEqual([TRIAGE, C2]);
    expect(listAgentConversations(channels, VEE).map((c) => c.id)).toEqual([VEE, C3]);
  });

  it("the legacy row sorts first, then by creation time, so labels are stable as conversations are added", () => {
    const channels = [
      dm(C3, TRIAGE, { createdAt: "2026-03-01" }),
      dm(C2, TRIAGE, { createdAt: "2026-02-01" }),
      dm(TRIAGE, TRIAGE, { createdAt: "2026-09-01" }),
    ];
    expect(listAgentConversations(channels, TRIAGE).map((c) => c.id)).toEqual([TRIAGE, C2, C3]);
  });

  it("group and project channels are never treated as conversations", () => {
    const channels: ConversationChannel[] = [
      { id: "bb000001-0000-0000-0000-000000000000", type: "group", agentId: null },
      { id: "cc000001-0000-0000-0000-000000000000", type: "project" },
      dm(TRIAGE, TRIAGE),
    ];
    expect(listAgentConversations(channels, TRIAGE).map((c) => c.id)).toEqual([TRIAGE]);
  });

  it("resolves a channel's agent ONLY through agent_id, never by assuming the id is the agent", () => {
    const channels = [dm(C2, TRIAGE), { id: VEE, type: "dm" as const, agentId: null }];
    expect(agentUuidForChannel(channels, C2)).toBe(TRIAGE);
    // a dm row with no agent_id yields null rather than silently reverse-mapping its own id
    expect(agentUuidForChannel(channels, VEE)).toBeNull();
    expect(agentUuidForChannel(channels, "no-such-channel")).toBeNull();
  });
});

/* ═══ 2. labels and slugs ════════════════════════════════════════════════ */
describe("labels and slugs", () => {
  it("the first conversation reads as the agent, later ones are numbered", () => {
    expect(defaultConversationTitle("Triage", 0)).toBe("Triage");
    expect(defaultConversationTitle("Triage", 1)).toBe("Triage 2");
    expect(conversationLabel(dm(TRIAGE, TRIAGE), "Triage", 0)).toBe("Triage");
    expect(conversationLabel(dm(C2, TRIAGE), "Triage", 1)).toBe("Triage 2");
  });

  it("an explicit title wins over the default", () => {
    expect(conversationLabel(dm(C2, TRIAGE, { title: "Clean control" }), "Triage", 1)).toBe("Clean control");
  });

  it("titles are trimmed, collapsed and bounded; blank becomes null", () => {
    expect(normalizeTitle("  spaced   out  ")).toBe("spaced out");
    expect(normalizeTitle("   ")).toBeNull();
    expect(normalizeTitle(null)).toBeNull();
    expect(normalizeTitle(42)).toBeNull();
    expect(normalizeTitle("x".repeat(200))?.length).toBe(MAX_TITLE_LENGTH);
  });

  it("slugs derive from the fresh channel uuid, so two conversations never collide", () => {
    expect(conversationSlug("triage", C2)).toBe("dm-triage-3fa1b2c3d4e5");
    expect(conversationSlug("triage", C2)).not.toBe(conversationSlug("triage", C3));
    expect(conversationSlug("triage", C2)).toMatch(/^dm-triage-[0-9a-f]{12}$/);
  });
});

/* ═══ 3. OpenClaw session isolation ══════════════════════════════════════ */
describe("OpenClaw session isolation", () => {
  beforeEach(() => {
    delete process.env.OPENCLAW_AGENT_SESSION_KEYS;
    delete process.env.OPENCLAW_CHAT_SESSION_KEY;
  });
  afterEach(() => {
    delete process.env.OPENCLAW_AGENT_SESSION_KEYS;
    delete process.env.OPENCLAW_CHAT_SESSION_KEY;
  });

  it("backward compatible: no conversation id, or the legacy DM, keeps the historical per-agent key", () => {
    const base = resolveChatSessionKey("triage");
    expect(resolveChatSessionKey("triage", TRIAGE)).toBe(base);
    expect(resolveChatSessionKey("triage", TRIAGE.toUpperCase())).toBe(base);
  });

  it("a new conversation gets its own session key, and two conversations never share one", () => {
    const base = resolveChatSessionKey("triage");
    const k2 = resolveChatSessionKey("triage", C2);
    const k3 = resolveChatSessionKey("triage", C3);
    expect(k2).not.toBe(base);
    expect(k3).not.toBe(base);
    expect(k2).not.toBe(k3);
  });

  it("the agent segment survives, so the Parallax agent is still legible in the key", () => {
    const base = resolveChatSessionKey("triage");
    const scoped = resolveChatSessionKey("triage", C2);
    const [bp, sp] = [base.split(":"), scoped.split(":")];
    expect(sp.length).toBe(bp.length);
    expect(sp.slice(0, -1)).toEqual(bp.slice(0, -1));
    expect(scoped).toContain("triage");
    expect(sp[sp.length - 1]).toMatch(/^c-[0-9a-f]{12}$/);
  });

  it("deterministic: the same conversation resolves to the same key every call", () => {
    expect(resolveChatSessionKey("triage", C2)).toBe(resolveChatSessionKey("triage", C2));
  });

  it("different agents in different conversations never collide", () => {
    const keys = [
      resolveChatSessionKey("triage", C2), resolveChatSessionKey("triage", C3),
      resolveChatSessionKey("vee", C2), resolveChatSessionKey("vee", C3),
      resolveChatSessionKey("triage"), resolveChatSessionKey("vee"),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("an operator override is honoured, and a non-standard shape is appended to rather than mangled", () => {
    process.env.OPENCLAW_AGENT_SESSION_KEYS = JSON.stringify({ triage: "triage-main" });
    expect(resolveChatSessionKey("triage")).toBe("triage-main");
    expect(resolveChatSessionKey("triage", TRIAGE)).toBe("triage-main");
    const scoped = resolveChatSessionKey("triage", C2);
    expect(scoped).toBe("triage-main:c-3fa1b2c3d4e5");
    expect(scoped.startsWith("triage-main")).toBe(true);
  });

  it("replaces only the session slot of a 3-segment key", () => {
    expect(conversationScopedSessionKey("agent:triage:main", C2)).toBe("agent:triage:c-3fa1b2c3d4e5");
    expect(conversationScopedSessionKey("a:b:c:d", C2)).toBe("a:b:c:c-3fa1b2c3d4e5");
  });
});

/* ═══ 4. source guards: the conflation must not come back ════════════════ */
describe("source guards", () => {
  const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
  const UI = "src/app/command-center/chat/page.tsx";

  it("the UI no longer carries a hand-copied duplicate of the registry DM uuid map", () => {
    const ui = read(UI);
    expect(ui).not.toContain("DM_CHANNEL_MAP");
    // the 20 literal uuids are gone from the UI; they live in the registry only
    expect(ui).not.toMatch(/aa0000(0[2-9]|1[0-9]|20)-0000-0000-0000-000000000000/);
    expect(ui).toContain('from "@/lib/cc-agent-dm-uuids"');
  });

  it("the UI has no channel-id to agent-id reverse-map left", () => {
    const ui = read(UI);
    expect(ui).not.toMatch(/\.find\(\(\[, ?u\]\) => u === cid\)/);
    expect(ui).toContain("agentUuidForChannel");
  });

  it("the open conversation drives load, realtime, polling, filtering and send (switching is wired)", () => {
    const ui = read(UI);
    // one derived value, and it honours the user's selection before the legacy fallback
    expect(ui).toContain("const activeDmId = viewMode === \"dm\" && activeAgent ? (activeDmChannelId ?? getDmChannelId(activeAgent.id)) : null;");
    // initial load, realtime subscription and the polling fallback all key off it
    expect((ui.match(/activeDmId \?\? activeChannel\?\.id/g) ?? []).length).toBe(3);
    // every effect that reads it re-runs when the conversation changes, so switching reloads and resubscribes
    expect((ui.match(/\}, \[activeChannel, activeAgent, viewMode, activeDmId\]\);/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(ui).not.toMatch(/\}, \[activeChannel, activeAgent, viewMode\]\);/);
    // the transcript filter and the send path use the same id
    expect(ui).toContain("if (msg.channelId !== (activeDmId ?? getDmChannelId(activeAgent.id))) return false;");
    expect(ui).toContain("const targetChannelId = isDM ? (activeDmId ?? getDmChannelId(activeAgent!.id))");
    // and the conversation id reaches the chat API so the gateway session is scoped
    expect(ui).toContain("conversationId: isDM ? targetChannelId : undefined,");
  });

  it("selecting an agent or a search hit opens a specific conversation", () => {
    const ui = read(UI);
    expect(ui).toContain("const handleAgentSelect = (agent: Agent, conversationId?: string) => {");
    expect(ui).toContain("setActiveDmChannelId(conversationId ?? defaultConversationId(agent.id));");
    expect(ui).toContain("handleAgentSelect(agent, cid)");
    expect(ui).toContain("handleAgentSelect(agent, ch.id)");
  });

  it("the create route resolves the agent server-side and never trusts a client uuid", () => {
    const route = read("src/app/api/command-center/chat/conversations/route.ts");
    expect(route).toContain("guardProtectedMutation");
    expect(route).toContain("getAgent(rawAgentId)");
    expect(route).toContain("agent_id: agent.dmUuid");
    expect(route).not.toMatch(/body\.agent_?[Uu]uid/);
  });

  it("both chat routes pass the conversation id into the session key", () => {
    for (const f of ["src/app/api/command-center/chat/route.ts", "src/app/api/command-center/chat/stream/route.ts"]) {
      expect(read(f), f).toContain("resolveChatSessionKey(target, conversationId)");
    }
  });

  it("the migration is additive, backfills only dm rows, and never touches messages or ids", () => {
    const sql = read("supabase/migrations/20261002110000_dm_conversations.sql");
    expect(sql).toContain("add column if not exists agent_id uuid");
    expect(sql).toContain("add column if not exists title text");
    expect(sql).toContain("channels_type_agent_id_idx");
    expect(sql).toMatch(/update public\.channels[\s\S]*set agent_id = id[\s\S]*where type = 'dm'/);
    expect(sql).not.toMatch(/\bdrop\s+(table|column)\b/i);
    expect(sql).not.toMatch(/\b(delete|truncate)\b/i);
    // no DML against messages anywhere (a prose mention of the column name is fine)
    expect(sql).not.toMatch(/(update|insert\s+into|delete\s+from|alter\s+table)\s+(public\.)?messages/i);
    // and the backfill never rewrites an id
    expect(sql).not.toMatch(/set\s+id\s*=/i);
    expect(read("supabase/rollbacks/20261002110000_dm_conversations.rollback.sql")).toContain("drop column if exists agent_id");
  });
});
