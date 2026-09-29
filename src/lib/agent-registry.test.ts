import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  AGENT_REGISTRY,
  getAgent,
  listAgents,
  chatAgentIds,
  agentDmUuidMap,
  openclawSessionKeyMap,
  claudeTierMap,
  personaMap,
  directoryAgents,
  declaredVsRuntime,
} from "./agent-registry";
import { KNOWN_AGENT_IDS, parseMentions, resolveChatTargets } from "./chat-routing";
import { AGENT_DM_UUID, AGENT_UUID_TO_SHORT_ID } from "./cc-agent-dm-uuids";
import { resolveChatSessionKey } from "./openclaw-gateway";
import { AGENT_ORBIT_IDS } from "@/app/command-center/dashboard-agents";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("registry integrity", () => {
  it("every agent id and directoryId is unique", () => {
    const ids = AGENT_REGISTRY.map((a) => a.id);
    const dirs = AGENT_REGISTRY.map((a) => a.directoryId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(dirs).size).toBe(dirs.length);
  });

  it("no id, directoryId or alias collides with another agent's keys", () => {
    const seen = new Map<string, string>();
    for (const a of AGENT_REGISTRY) {
      for (const k of new Set([a.id, a.directoryId, ...a.aliases].map((s) => s.toLowerCase()))) {
        const owner = seen.get(k);
        expect(owner === undefined || owner === a.id, `key "${k}" claimed by ${owner} and ${a.id}`).toBe(true);
        seen.set(k, a.id);
      }
    }
  });

  it("required fields are present and non-empty", () => {
    for (const a of AGENT_REGISTRY) {
      for (const f of ["id", "directoryId", "name", "role", "description"] as const) {
        expect(a[f].trim().length, `${a.id}.${f}`).toBeGreaterThan(0);
      }
      expect(["active", "inactive"]).toContain(a.status);
      expect(a.declared.provider.length).toBeGreaterThan(0);
      expect(a.declared.model.length).toBeGreaterThan(0);
      expect(a.declared.capabilities.length).toBeGreaterThan(0);
      expect(["opus", "sonnet", "haiku", "unknown"]).toContain(a.runtime.claudeTier);
    }
  });

  it("chat-addressable agents have a DM uuid, session key and known tier; others say so explicitly", () => {
    for (const a of AGENT_REGISTRY) {
      if (a.channels.includes("cc-chat")) {
        expect(a.dmUuid, a.id).toMatch(/^aa\d{6}-0000-0000-0000-000000000000$/);
        expect(a.openclawSessionKey, a.id).toMatch(/^agent:[a-z]+:main$/);
        expect(a.runtime.claudeTier, a.id).not.toBe("unknown");
        expect(a.personaStyle, a.id).toBeTruthy();
      } else {
        expect(a.dmUuid).toBeNull();
        expect(a.openclawSessionKey).toBeNull();
        expect(a.runtime.claudeTier).toBe("unknown");
      }
    }
  });

  it("DM uuids are unique", () => {
    const u = Object.values(agentDmUuidMap());
    expect(new Set(u).size).toBe(u.length);
  });
});

describe("lookups resolve from the registry", () => {
  it("getAgent resolves ids, directory ids and aliases case-insensitively", () => {
    expect(getAgent("ATLAS")?.id).toBe("atlas");
    expect(getAgent("dr-strange")?.id).toBe("drstrange");
    expect(getAgent(" DrStrange ")?.directoryId).toBe("dr-strange");
  });

  it("unknown ids stay unknown (no silent default agent)", () => {
    expect(getAgent("notanagent")).toBeUndefined();
    expect(getAgent("")).toBeUndefined();
  });

  it("every dashboard orbit id resolves to a registry agent under its directory id", () => {
    for (const id of AGENT_ORBIT_IDS) {
      const a = getAgent(id);
      expect(a, id).toBeDefined();
      expect(a!.directoryId, id).toBe(id);
    }
  });

  it("the roster API static fallback is exactly the registry's directory view", async () => {
    vi.stubEnv("OPENCLAW_WORKSPACE", join(process.cwd(), ".no-such-openclaw-workspace"));
    vi.resetModules();
    const { GET } = await import("@/app/api/command-center/agents/route");
    const body = (await (await GET()).json()) as { source: string; agents: { id: string; model: string; role: string }[] };
    expect(body.source).toBe("static");
    const dir = directoryAgents();
    expect(body.agents.map((a) => a.id)).toEqual(Object.keys(dir));
    for (const a of body.agents) {
      expect(a.model).toBe(`${dir[a.id].provider}/${dir[a.id].model}`);
      expect(a.role).toBe(dir[a.id].role);
    }
  });
});

describe("routing-facing lookups agree with the registry", () => {
  it("chat routing knows exactly the chat agents, in registry order", () => {
    expect([...KNOWN_AGENT_IDS]).toEqual(chatAgentIds());
    expect(chatAgentIds()).not.toContain("archivist");
  });

  it("chat routing behavior is unchanged for aliases (only canonical ids route)", () => {
    expect(parseMentions("@dr-strange @drstrange")).toEqual(["drstrange"]);
    expect(resolveChatTargets({ agentName: "archivist" })).toEqual(["atlas"]);
  });

  it("DM uuid maps are the registry's, and invert cleanly", () => {
    expect(AGENT_DM_UUID).toEqual(agentDmUuidMap());
    for (const [id, uuid] of Object.entries(AGENT_DM_UUID)) expect(AGENT_UUID_TO_SHORT_ID[uuid]).toBe(id);
  });

  it("OpenClaw session keys come from the registry", () => {
    vi.unstubAllEnvs();
    for (const [id, key] of Object.entries(openclawSessionKeyMap())) {
      expect(resolveChatSessionKey(id)).toBe(key);
    }
    expect(resolveChatSessionKey("atlas")).toBe("agent:main:main");
    expect(resolveChatSessionKey("drstrange")).toBe("agent:strange:main");
  });

  it("claude tiers and personas cover exactly the chat agents", () => {
    expect(Object.keys(claudeTierMap()).sort()).toEqual([...chatAgentIds()].sort());
    expect(Object.keys(personaMap()).sort()).toEqual([...chatAgentIds()].sort());
    expect(claudeTierMap().atlas).toBe("opus");
    expect(claudeTierMap().triage).toBe("haiku");
  });
});

describe("truth gap is explicit, not hidden", () => {
  it("archivist runtime is unknown and it is not chat-addressable", () => {
    const r = declaredVsRuntime().find((x) => x.id === "archivist")!;
    expect(r.runtimeTier).toBe("unknown");
    expect(r.sameClaudeFamily).toBe("unknown");
    expect(listAgents({ channel: "cc-chat" }).some((a) => a.id === "archivist")).toBe(false);
  });

  it("declared directory model vs claude-max chat tier: known disagreement set is pinned", () => {
    // Change-detector: this list is the documented UI/runtime gap. If a tier or
    // declared model changes, update it consciously (or fix the gap).
    const disagree = declaredVsRuntime().filter((x) => x.sameClaudeFamily === false).map((x) => x.id).sort();
    expect(disagree).toEqual(
      ["aetherion", "echo", "michael", "prophets", "selah", "themaestro", "triage", "vee", "widow"].sort(),
    );
  });
});

describe("migrated surfaces contain no hand-written agent rosters", () => {
  const MIGRATED = [
    "src/lib/chat-routing.ts",
    "src/lib/cc-agent-dm-uuids.ts",
    "src/lib/openclaw-gateway.ts",
    "src/lib/cc-approve-synthesis.ts",
    "src/app/api/command-center/chat/route.ts",
    "src/app/api/command-center/chat/webhook/route.ts",
    "src/app/api/command-center/agents/route.ts",
    "src/app/api/command-center/export/handler.ts",
  ];

  it("no DM uuid literals, session-key literals, or per-agent id/tier/model tables outside the registry", () => {
    for (const f of MIGRATED) {
      const src = read(f);
      expect(src, `${f}: DM uuid literal`).not.toMatch(/aa\d{6}-0000-0000-0000-000000000000/);
      expect(src, `${f}: session key table entry`).not.toMatch(/\w+:\s*"agent:[a-z]+:main"/);
      expect(src, `${f}: tier table entry`).not.toMatch(/\b(?:shuri|proximon|kiyosaki|themaestro|prophets)\s*:\s*"(?:opus|sonnet|haiku)"/);
      expect(src, `${f}: directory entry`).not.toMatch(/\bmodel:\s*"(?:claude-|qwen3|kimi|gemini-)[^"]*",\s*provider:/);
      expect(src, `${f}: id array`).not.toMatch(/"shuri",\s*\n?\s*"proximon"/);
    }
  });

  it("migrated files import from the registry", () => {
    const viaRegistry = [
      "src/lib/chat-routing.ts",
      "src/lib/cc-agent-dm-uuids.ts",
      "src/lib/openclaw-gateway.ts",
      "src/lib/cc-approve-synthesis.ts",
      "src/app/api/command-center/chat/route.ts",
      "src/app/api/command-center/agents/route.ts",
      "src/app/api/command-center/export/handler.ts",
    ];
    for (const f of viaRegistry) expect(read(f), f).toMatch(/@\/lib\/agent-registry/);
    expect(read("src/app/api/command-center/chat/webhook/route.ts")).toMatch(/@\/lib\/cc-agent-dm-uuids/);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});
