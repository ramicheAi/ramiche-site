/**
 * The selected Parallax agent's identity must survive provider routing and fallback.
 *
 * Incident (production Triage test, 2026-10-01): Ramon DM'd Triage `Reply exactly: PACKET3_OK`. Telemetry showed
 * OpenClaw (gateway error) then Claude Max (ok), and the reply came back as "I'm Claude Code, an agent made by
 * Anthropic. I can't pretend to be a different system or deny my identity". Cause: the chat route's identity lock told
 * the model `You do NOT identify as Claude, Anthropic ...`, the Claude Max proxy delivers system messages as `<system>`
 * text inside the USER turn of a full Claude Code CLI, and Claude refuses to deny what it is.
 *
 * What these tests pin: the identity frame is canonical (agent registry), provider-neutral, truthful (never denies the
 * model), identical across every backend and fallback step, specific to the selected agent, and not tied to Triage.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { NextRequest } from "next/server";

const gw = {
  configured: false,
  calls: [] as unknown[][],
  result: { ok: false, error: "gateway down" } as { ok: boolean; reply?: string; error?: string },
};
vi.mock("@/lib/openclaw-gateway", async () => {
  const actual = await vi.importActual<typeof import("@/lib/openclaw-gateway")>("@/lib/openclaw-gateway");
  return {
    ...actual,
    isOpenClawGatewayConfigured: () => gw.configured,
    gatewaySessionsSend: async (...a: unknown[]) => {
      gw.calls.push(a);
      return gw.result;
    },
  };
});

// Cockpit lineage: the routes sit behind the owner/CSRF/origin guards. This file tests identity, not the guards.
vi.mock("@/lib/server/protected-mutation", () => ({
  guardProtectedMutation: async () => ({ ok: true, uid: "test-owner", sessionCookie: "test-session" }),
  guardPrivateRead: async () => ({ ok: true, uid: "test-owner", sessionCookie: "test-session" }),
}));
vi.mock("@/lib/server/service-caller", async () => ({
  ...(await vi.importActual<typeof import("@/lib/server/service-caller")>("@/lib/server/service-caller")),
  guardServiceCaller: async () => ({ ok: true, principal: "service:bridge", kind: "service" }),
}));

import { agentIdentityFrame, getAgent, listAgents } from "@/lib/agent-registry";
import { chatAgentIds } from "@/lib/agent-registry-core";
import * as chatRoute from "@/app/api/command-center/chat/route";
import * as streamRoute from "@/app/api/command-center/chat/stream/route";

const CLAUDE_URL = "http://127.0.0.1:3456/v1/chat/completions";
const LM_URL = "http://127.0.0.1:1234/v1/chat/completions";
const EXACT = "Reply exactly: PACKET3_OK";
const DENIAL = /(do\s+not|don'?t|never)\s+(identify|admit|reveal)|not\s+identify\s+as\s+claude|never\s+break\s+(this\s+)?(persona|character)|you\s+are\s+not\s+claude/i;
const PROVIDER_WORDS = /claude|anthropic|openai|gpt|gemini|deepseek|openrouter|haiku|sonnet|opus|lm studio/i;

interface Rec { url: string; body: { model?: string; messages: { role: string; content: unknown }[]; [k: string]: unknown }; text: string }
let recs: Rec[] = [];
type Responder = (url: string) => Response | Error;
function mockFetch(responder: Responder) {
  recs = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const text = String(init?.body ?? "");
    let body = {} as Rec["body"];
    try { body = JSON.parse(text); } catch { /* not json */ }
    recs.push({ url: String(url), body, text });
    const r = responder(String(url));
    if (r instanceof Error) throw r;
    return r;
  });
}
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const ok = (content: string) => json({ choices: [{ message: { content }, finish_reason: "stop" }] });
const ENV_KEYS = /^(CLAUDE_MAX|LM_STUDIO|CC_CLAUDE|CC_LMSTUDIO|CC_STRICT|OPENCLAW_CHAT|GEMINI_API|DEEPSEEK_API|OPENROUTER_API)/;
function resetEnv(extra: Record<string, string> = {}) {
  for (const k of Object.keys(process.env)) if (ENV_KEYS.test(k)) delete process.env[k];
  Object.assign(process.env, extra);
}
async function postChat(body: object, env: Record<string, string> = {}, responder: Responder = () => ok("fine")) {
  resetEnv(env);
  mockFetch(responder);
  vi.spyOn(console, "error").mockImplementation(() => {});
  const res = await chatRoute.POST(new NextRequest("http://localhost/api/command-center/chat", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}
const systemOf = (r: Rec) => String(r.body.messages[0].content);

beforeEach(() => {
  resetEnv();
  gw.configured = false;
  gw.calls = [];
  gw.result = { ok: false, error: "gateway down" };
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetEnv();
});

/* ═══ 1. the canonical frame ═════════════════════════════════════════════ */
describe("agentIdentityFrame: canonical, provider-neutral, truthful", () => {
  const chat = () => listAgents({ channel: "cc-chat" });

  it("names the selected agent exactly as the registry does, with its registry role", () => {
    expect(chat().length).toBe(20);
    for (const a of chat()) {
      const f = agentIdentityFrame(a.id);
      expect(f, a.id).toContain(`operating as ${a.name},`);
      expect(f, a.id).toContain(`Your role there is ${a.description}.`);
      expect(f, a.id).toContain(`you are ${a.name} at Parallax`);
    }
  });

  it("never asks the model to deny, hide or replace what it is", () => {
    for (const a of chat()) expect(agentIdentityFrame(a.id), a.id).not.toMatch(DENIAL);
  });

  it("is truthful: separates identity from infrastructure and tells the model to answer a direct model question truthfully", () => {
    for (const a of chat()) {
      const f = agentIdentityFrame(a.id);
      expect(f, a.id).toMatch(/execution infrastructure/);
      expect(f, a.id).toMatch(/does not change which Parallax agent you are/);
      expect(f, a.id).toMatch(/explicitly asks which model or provider is powering you, answer truthfully/);
    }
  });

  it("carries no provider or model name, so provider/model metadata cannot become the agent's identity", () => {
    for (const a of chat()) {
      const f = agentIdentityFrame(a.id);
      expect(f, a.id).not.toMatch(PROVIDER_WORDS);
      for (const declared of [a.declared.model, a.declared.provider]) if (declared) expect(f, `${a.id}:${declared}`).not.toContain(declared);
    }
  });

  it("is a pure function of the selected agent: aliases and case resolve to the same frame", () => {
    expect(agentIdentityFrame("TRIAGE")).toBe(agentIdentityFrame("triage"));
    expect(agentIdentityFrame("  Triage ")).toBe(agentIdentityFrame("triage"));
    for (const a of chat()) for (const alias of a.aliases) expect(agentIdentityFrame(alias), alias).toBe(agentIdentityFrame(a.id));
  });

  it("each agent gets its own frame and mentions no other chat agent by name", () => {
    const frames = new Map(chat().map((a) => [a.id, agentIdentityFrame(a.id)]));
    expect(new Set(frames.values()).size).toBe(frames.size);
    for (const a of chat()) {
      for (const other of chat()) {
        if (other.id === a.id || a.description.toLowerCase().includes(other.name.toLowerCase())) continue;
        expect(frames.get(a.id), `${a.id} mentions ${other.id}`).not.toMatch(new RegExp(`\\b${other.name}\\b`, "i"));
      }
    }
  });

  it("an id the registry does not know keeps the old chat fallback and is still framed truthfully", () => {
    const f = agentIdentityFrame("zeta");
    expect(f).toContain("operating as Zeta,");
    expect(f).toContain("Your role there is AI Agent.");
    expect(f).not.toMatch(DENIAL);
    expect(agentIdentityFrame("")).toContain("operating as Agent,");
    expect(getAgent("zeta")).toBeUndefined();
  });
});

/* ═══ 2. the selected agent reaches the Claude Max proxy request intact ═══ */
describe("chat route: the selected agent's identity reaches the Claude Max request", () => {
  it("Triage DM: system message starts with Triage's canonical frame, carries its registry Role/Style, and the user text is verbatim", async () => {
    const r = await postChat({ message: EXACT, agentName: "triage" });
    expect(r.status).toBe(200);
    expect(recs.map((x) => x.url)).toEqual([CLAUDE_URL]);
    const [sys, usr] = recs[0].body.messages;
    expect([sys.role, usr.role]).toEqual(["system", "user"]);
    expect(String(sys.content).startsWith(agentIdentityFrame("triage"))).toBe(true);
    expect(sys.content).toContain("Role: Debugging & Log Analysis. Style: Methodical, detail-oriented. Asks clarifying questions.");
    expect(sys.content).not.toMatch(DENIAL);
    expect(usr.content).toBe(EXACT); // the harmless exact-response instruction is passed through untouched
    expect(recs[0].body.model).toBe("claude-haiku-4-5"); // Triage's requested model is unchanged
  });

  it("an exact-response request is not contradicted by anything in the system prompt", async () => {
    await postChat({ message: EXACT, agentName: "triage" });
    const sys = systemOf(recs[0]);
    expect(sys).not.toMatch(/never reply with|do not repeat|do not echo|refuse/i);
    expect(sys).not.toMatch(DENIAL);
  });

  it("the request to the proxy carries no session or user field, so no Claude session can be inherited across agents", async () => {
    await postChat({ message: EXACT, agentName: "triage" });
    const keys = Object.keys(recs[0].body);
    expect(keys.every((k) => ["model", "messages", "max_tokens", "temperature", "stream"].includes(k))).toBe(true);
    expect(recs[0].text).not.toMatch(/"user"\s*:|session_id|sessionId|conversation_id|"metadata"/);
  });

  it("EVERY chat agent (not just Triage) gets its own frame, Role and Style, with the user message verbatim", async () => {
    for (const a of listAgents({ channel: "cc-chat" })) {
      const r = await postChat({ message: EXACT, agentName: a.id });
      expect(r.status, a.id).toBe(200);
      const sys = systemOf(recs[0]);
      expect(sys.startsWith(agentIdentityFrame(a.id)), a.id).toBe(true);
      expect(sys, a.id).toContain(`Role: ${a.description}. Style: ${a.personaStyle}`);
      expect(sys, a.id).not.toMatch(DENIAL);
      expect(recs[0].body.messages[1].content, a.id).toBe(EXACT);
    }
    expect(chatAgentIds()).toHaveLength(20);
  });
});

/* ═══ 3. fallback preserves identity ════════════════════════════════════ */
describe("fallback preserves the selected agent's identity", () => {
  it("production path: OpenClaw (gateway error) then Claude Max. Both receive the SAME Triage system prompt", async () => {
    gw.configured = true;
    gw.result = { ok: false, error: "gateway error" };
    const r = await postChat({ message: EXACT, agentName: "triage" }, { OPENCLAW_CHAT_PRIMARY: "1" });
    expect(r.status).toBe(200);
    expect(gw.calls).toHaveLength(1); // OpenClaw was attempted first, as in production
    expect(gw.calls[0][0]).toBe("agent:triage:main");
    expect(recs.map((x) => x.url)).toEqual([CLAUDE_URL]); // then Claude Max answered
    const sys = systemOf(recs[0]);
    expect(sys.startsWith(agentIdentityFrame("triage"))).toBe(true);
    expect(String(gw.calls[0][1])).toContain(sys); // the exact same prompt was sent to OpenClaw: fallback did not drop or replace it
    expect(String(gw.calls[0][1])).toContain(EXACT);
  });

  it("Claude Max failing then LM Studio answering keeps the identical system prompt", async () => {
    await postChat({ message: EXACT, agentName: "triage" }, {}, (url) => (url === LM_URL ? ok("lm") : new Response("proxy exploded", { status: 500 })));
    expect(recs.map((x) => x.url)).toEqual([CLAUDE_URL, LM_URL]);
    expect(systemOf(recs[1])).toBe(systemOf(recs[0]));
    expect(systemOf(recs[1]).startsWith(agentIdentityFrame("triage"))).toBe(true);
  });

  it("switching the provider never switches the agent: the same system prompt for OpenClaw-success, Claude Max and LM Studio", async () => {
    gw.configured = true;
    gw.result = { ok: true, reply: "from openclaw" };
    await postChat({ message: EXACT, agentName: "vee" }, { OPENCLAW_CHAT_PRIMARY: "1" });
    const viaOpenClaw = String(gw.calls[0][1]);
    gw.configured = false; gw.calls = [];
    await postChat({ message: EXACT, agentName: "vee" });
    const viaClaude = systemOf(recs[0]);
    expect(viaOpenClaw).toContain(viaClaude);
    await postChat({ message: EXACT, agentName: "vee" }, {}, (url) => (url === LM_URL ? ok("lm") : new Error("down")));
    expect(systemOf(recs[1])).toBe(viaClaude);
    expect(viaClaude.startsWith(agentIdentityFrame("vee"))).toBe(true);
  });

  it("no cross-agent inheritance: Triage, then Vee, then Triage again each get only their own persona", async () => {
    await postChat({ message: EXACT, agentName: "triage" });
    const t1 = systemOf(recs[0]);
    await postChat({ message: EXACT, agentName: "vee" });
    const v = systemOf(recs[0]);
    await postChat({ message: EXACT, agentName: "triage" });
    const t2 = systemOf(recs[0]);
    expect(t2).toBe(t1);
    expect(v).not.toBe(t1);
    expect(v).toContain("operating as Vee,");
    expect(v).not.toContain("Triage");
    expect(v).not.toContain("Methodical, detail-oriented");
    expect(t1).toContain("operating as Triage,");
    expect(t1).not.toContain("operating as Vee,");
  });
});

/* ═══ 4. the streaming route uses the same canonical frame ═══════════════ */
describe("stream route: same canonical frame", () => {
  const gem = (t: string) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] })}\n\n`;
  async function postStream(body: object, env: Record<string, string>, responder: Responder) {
    resetEnv(env);
    mockFetch(responder);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await streamRoute.POST(new NextRequest("http://localhost/api/command-center/chat/stream", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
    return await res.text();
  }

  it("a streaming provider request for Triage carries Triage's frame and no denial", async () => {
    await postStream({ message: EXACT, agentName: "triage" }, { GEMINI_API_KEY: "gk" }, () => new Response(gem("ok"), { status: 200 }));
    const gemini = recs.find((r) => r.url.includes("generativelanguage"));
    expect(gemini).toBeDefined();
    const frame = agentIdentityFrame("triage");
    expect(JSON.stringify(gemini!.body)).toContain(JSON.stringify(frame).slice(1, -1));
    expect(gemini!.text).not.toMatch(DENIAL);
  });

  it("the OpenClaw attempt on the stream route gets the same frame as the chat route", async () => {
    gw.configured = true;
    gw.result = { ok: true, reply: "hi from claw" };
    await postStream({ message: EXACT, agentName: "shuri" }, {}, () => new Response("unused", { status: 500 }));
    expect(String(gw.calls[0][1])).toContain(agentIdentityFrame("shuri"));
  });
});

/* ═══ 5. guards against the denial coming back ═══════════════════════════ */
describe("source guards", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) ? [p] : [];
    });

  it("no production source tells a model to deny being Claude/Anthropic or to 'never break persona'", () => {
    for (const f of files(join(process.cwd(), "src"))) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/do\s+NOT\s+identify\s+as/i);
      expect(s, f).not.toMatch(/never\s+break\s+this\s+persona/i);
    }
  });

  it("both chat routes build identity through the canonical registry function, not their own copy", () => {
    for (const rel of ["src/app/api/command-center/chat/route.ts", "src/app/api/command-center/chat/stream/route.ts"]) {
      const s = readFileSync(join(process.cwd(), rel), "utf8");
      expect(s, rel).toContain("agentIdentityFrame(");
      expect(s, rel).toMatch(/import \{[^}]*agentIdentityFrame[^}]*\} from "@\/lib\/agent-registry"/);
      expect(s, rel).not.toMatch(/You ARE \$\{/);
    }
  });

  it("the identity frame lives server-side only (not in the client-safe core)", () => {
    expect(readFileSync(join(process.cwd(), "src/lib/agent-registry-core.ts"), "utf8")).not.toContain("agentIdentityFrame");
  });
});
