import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { NextRequest } from "next/server";
import { clientFiles, clientFilesReaching } from "./client-boundary.test-helper";

// Controllable OpenClaw gateway shared by the adapter and the routes under test.
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

import {
  cleanEnv,
  claudeModelForAgent,
  claudeModelForTier,
  lmStudioModel,
  executeCompletion,
  streamCompletion,
  executeOpenClaw,
  usageFromOpenAi,
  usageFromGemini,
  STREAM_MODELS,
} from "./provider-adapter";
import * as chatRoute from "@/app/api/command-center/chat/route";
import * as streamRoute from "@/app/api/command-center/chat/stream/route";
import { chatAgentIds } from "./agent-registry-core";

const CLAUDE_URL = "http://127.0.0.1:3456/v1/chat/completions";
const LM_URL = "http://127.0.0.1:1234/v1/chat/completions";
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

/* ── fetch recorder ─────────────────────────────────────────────────── */
interface ReqBody {
  model?: string;
  messages: { role: string; content: unknown }[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}
type Rec = { url: string; method?: string; headers: Record<string, string>; bodyText: string; body: ReqBody; timeoutMs: number | null };
let recs: Rec[] = [];
let lastTimeout: number | null = null;
const origTimeout = AbortSignal.timeout.bind(AbortSignal);
type Responder = (url: string, n: number) => Response | Error;

function mockFetch(responder: Responder) {
  recs = [];
  let n = 0;
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
    lastTimeout = ms;
    return origTimeout(ms);
  });
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const bodyText = String(init?.body ?? "");
    let body = bodyText as unknown as ReqBody;
    try {
      body = JSON.parse(bodyText) as ReqBody;
    } catch {
      /* raw */
    }
    recs.push({ url: String(url), method: init?.method, headers: (init?.headers ?? {}) as Record<string, string>, bodyText, body, timeoutMs: lastTimeout });
    const r = responder(String(url), n++);
    if (r instanceof Error) throw r;
    return r;
  });
}
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const ok = (content: string, extra: object = {}) => json({ choices: [{ message: { content }, finish_reason: "stop" }], ...extra });

const ENV_KEYS = /^(CLAUDE_MAX|LM_STUDIO|CC_CLAUDE|CC_LMSTUDIO|CC_STRICT|OPENCLAW_CHAT|GEMINI_API|DEEPSEEK_API|OPENROUTER_API)/;
function resetEnv(extra: Record<string, string> = {}) {
  for (const k of Object.keys(process.env)) if (ENV_KEYS.test(k)) delete process.env[k];
  Object.assign(process.env, extra);
}

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

/* ── 1-3. agent -> tier -> model ─────────────────────────────────────── */
describe("model resolution (byte-for-byte with the old modelForAgent)", () => {
  // Independent spec of the behavior that existed before the adapter: Atlas and Simons on Opus,
  // Triage on Haiku, every other chat agent on Sonnet.
  const OPUS = ["atlas", "simons"];
  const HAIKU = ["triage"];

  it("every chat agent resolves to the same model the old code produced", () => {
    expect(chatAgentIds()).toHaveLength(20);
    for (const id of chatAgentIds()) {
      const expected = OPUS.includes(id) ? "claude-opus-4-6" : HAIKU.includes(id) ? "claude-haiku-4-5" : "claude-sonnet-4-6";
      expect(claudeModelForAgent(id), id).toBe(expected);
    }
  });

  it("agent id lookup is case-insensitive", () => {
    expect(claudeModelForAgent("ATLAS")).toBe("claude-opus-4-6");
    expect(claudeModelForAgent("Triage")).toBe("claude-haiku-4-5");
  });

  it("unknown agents (and archivist, whose tier is unknown) fall back to sonnet, as before", () => {
    for (const id of ["notanagent", "archivist", "", "dr-strange"]) expect(claudeModelForAgent(id), id).toBe("claude-sonnet-4-6");
  });

  it("env overrides apply per tier, are trimmed, and are read at call time", () => {
    expect(claudeModelForTier("opus")).toBe("claude-opus-4-6");
    process.env.CC_CLAUDE_MODEL_OPUS = "opus-X\n";
    process.env.CC_CLAUDE_MODEL_SONNET = "  son-X";
    process.env.CC_CLAUDE_MODEL_HAIKU = "hai-X\t";
    expect(claudeModelForTier("opus")).toBe("opus-X");
    expect(claudeModelForTier("sonnet")).toBe("son-X");
    expect(claudeModelForTier("haiku")).toBe("hai-X");
    expect(claudeModelForAgent("atlas")).toBe("opus-X");
    expect(claudeModelForAgent("nova")).toBe("son-X");
    expect(claudeModelForAgent("triage")).toBe("hai-X");
    expect(claudeModelForAgent("notanagent")).toBe("son-X");
  });

  it("empty / whitespace-only overrides are ignored", () => {
    process.env.CC_CLAUDE_MODEL_SONNET = "   \n";
    expect(claudeModelForTier("sonnet")).toBe("claude-sonnet-4-6");
    expect(cleanEnv("CC_CLAUDE_MODEL_SONNET")).toBeUndefined();
  });

  it("LM Studio model is only pinned when CC_LMSTUDIO_MODEL is set", () => {
    expect(lmStudioModel()).toBeUndefined();
    process.env.CC_LMSTUDIO_MODEL = "qwen-local\n";
    expect(lmStudioModel()).toBe("qwen-local");
  });
});

/* ── 4, 8, 9. executeCompletion ──────────────────────────────────────── */
describe("executeCompletion", () => {
  const msgs = [
    { role: "system" as const, content: "SYS" },
    { role: "user" as const, content: "hello" },
  ];

  it("claude-max: default URL, bearer 'not-needed', body key order, timeout", async () => {
    mockFetch(() => ok("hi"));
    const r = await executeCompletion({ provider: "claude-max", model: "claude-opus-4-6", messages: msgs, maxTokens: 300, temperature: 0.7, timeoutMs: 45_000 });
    expect(recs).toHaveLength(1);
    expect(recs[0].url).toBe(CLAUDE_URL);
    expect(recs[0].method).toBe("POST");
    expect(recs[0].headers).toEqual({ "Content-Type": "application/json", Authorization: "Bearer not-needed" });
    expect(recs[0].bodyText).toBe(JSON.stringify({ model: "claude-opus-4-6", messages: msgs, max_tokens: 300, temperature: 0.7 }));
    expect(recs[0].timeoutMs).toBe(45_000);
    expect(r).toMatchObject({ ok: true, provider: "claude-max", model: "claude-opus-4-6", text: "hi", finishReason: "stop", httpStatus: 200 });
  });

  it("claude-max: custom URL and token are cleaned and used", async () => {
    resetEnv({ CLAUDE_MAX_PROXY_URL: "https://claude.test/v1/chat/completions\n", CLAUDE_MAX_PROXY_TOKEN: "tok-123 " });
    mockFetch(() => ok("hi"));
    await executeCompletion({ provider: "claude-max", model: "m", messages: msgs, maxTokens: 1, temperature: 0, timeoutMs: 1000 });
    expect(recs[0].url).toBe("https://claude.test/v1/chat/completions");
    expect(recs[0].headers.Authorization).toBe("Bearer tok-123");
  });

  it("lm-studio: no auth header, model appended LAST and only when pinned", async () => {
    mockFetch(() => ok("hi"));
    await executeCompletion({ provider: "lm-studio", messages: msgs, maxTokens: 300, temperature: 0.7, timeoutMs: 60_000 });
    expect(recs[0].url).toBe(LM_URL);
    expect(recs[0].headers).toEqual({ "Content-Type": "application/json" });
    expect(recs[0].bodyText).toBe(JSON.stringify({ messages: msgs, max_tokens: 300, temperature: 0.7 }));
    await executeCompletion({ provider: "lm-studio", model: "qwen-local", messages: msgs, maxTokens: 300, temperature: 0.7, timeoutMs: 60_000 });
    expect(recs[1].bodyText).toBe(JSON.stringify({ messages: msgs, max_tokens: 300, temperature: 0.7, model: "qwen-local" }));
    expect(recs[1].timeoutMs).toBe(60_000);
  });

  it("passes content-part arrays (images) through untouched", async () => {
    mockFetch(() => ok("hi"));
    const content = [{ type: "text", text: "look" }, { type: "image_url", image_url: { url: "https://x/y.png" } }];
    await executeCompletion({ provider: "claude-max", model: "m", messages: [{ role: "user", content }], maxTokens: 1, temperature: 0, timeoutMs: 1000 });
    expect(recs[0].body.messages[0].content).toEqual(content);
  });

  it("captures usage when the provider supplies it, and never fabricates it", async () => {
    mockFetch(() => ok("hi", { usage: { prompt_tokens: 11, completion_tokens: 5, total_tokens: 16 } }));
    const withUsage = await executeCompletion({ provider: "claude-max", model: "m", messages: msgs, maxTokens: 1, temperature: 0, timeoutMs: 1000 });
    expect(withUsage.ok && withUsage.usage).toEqual({ promptTokens: 11, completionTokens: 5, totalTokens: 16 });

    // Partial counts are kept as-is: the total is NOT computed from the parts.
    mockFetch(() => ok("hi", { usage: { prompt_tokens: 11 } }));
    const partial = await executeCompletion({ provider: "claude-max", model: "m", messages: msgs, maxTokens: 1, temperature: 0, timeoutMs: 1000 });
    expect(partial.ok && partial.usage).toEqual({ promptTokens: 11, completionTokens: undefined, totalTokens: undefined });

    for (const usage of [undefined, {}, { prompt_tokens: "11" }, { total_tokens: null }, "lots", 5]) {
      mockFetch(() => ok("hi", usage === undefined ? {} : { usage }));
      const r = await executeCompletion({ provider: "claude-max", model: "m", messages: msgs, maxTokens: 1, temperature: 0, timeoutMs: 1000 });
      expect(r.ok && "usage" in r ? r.usage : undefined, JSON.stringify(usage)).toBeUndefined();
    }
    expect(usageFromOpenAi(null)).toBeUndefined();
    expect(usageFromGemini({})).toBeUndefined();
    expect(usageFromGemini({ promptTokenCount: 3, candidatesTokenCount: 4, totalTokenCount: 7 })).toEqual({ promptTokens: 3, completionTokens: 4, totalTokens: 7 });
  });

  it("empty or missing content is text: null (callers decide), not an error", async () => {
    for (const payload of [{ choices: [] }, { choices: [{ message: { content: "" } }] }, {}]) {
      mockFetch(() => json(payload));
      const r = await executeCompletion({ provider: "claude-max", model: "m", messages: msgs, maxTokens: 1, temperature: 0, timeoutMs: 1000 });
      expect(r).toMatchObject({ ok: true, text: null });
    }
  });

  it("a literal JSON `null` body is an exception (TypeError), exactly as before the adapter", async () => {
    mockFetch(() => new Response("null", { status: 200 }));
    const r = await executeCompletion({ provider: "claude-max", model: "m", messages: msgs, maxTokens: 1, temperature: 0, timeoutMs: 1000 });
    expect(r).toMatchObject({ ok: false, kind: "exception" });
    const err = r.ok === false ? r.error : undefined;
    expect(err).toBeInstanceOf(TypeError);
    expect((err as TypeError).message).toContain("Cannot read properties of null");
    mockFetch(() => new Response("null", { status: 200 }));
    const lm = await executeCompletion({ provider: "lm-studio", messages: msgs, maxTokens: 1, temperature: 0, timeoutMs: 1000 });
    expect(lm).toMatchObject({ ok: false, kind: "exception" });
  });

  it("other JSON shapes keep their old meaning: {} [] 0 \"str\" true are empty replies, not errors", async () => {
    for (const body of ["{}", "[]", "0", '"str"', "true", '{"choices":null}', '{"choices":"x"}']) {
      mockFetch(() => new Response(body, { status: 200 }));
      const r = await executeCompletion({ provider: "claude-max", model: "m", messages: msgs, maxTokens: 1, temperature: 0, timeoutMs: 1000 });
      expect(r, body).toMatchObject({ ok: true, text: null });
    }
    mockFetch(() => ok("real reply", { usage: { total_tokens: 4 } }));
    const good = await executeCompletion({ provider: "claude-max", model: "m", messages: msgs, maxTokens: 1, temperature: 0, timeoutMs: 1000 });
    expect(good).toMatchObject({ ok: true, text: "real reply", finishReason: "stop", usage: { totalTokens: 4 } });
  });

  it("non-2xx: http failure with status; body only read when asked, truncated to 200 chars", async () => {
    mockFetch(() => new Response("x".repeat(500), { status: 502 }));
    const plain = await executeCompletion({ provider: "claude-max", model: "m", messages: msgs, maxTokens: 1, temperature: 0, timeoutMs: 1000 });
    expect(plain).toMatchObject({ ok: false, kind: "http", httpStatus: 502 });
    expect("bodySnippet" in plain).toBe(false);
    const withBody = await executeCompletion({ provider: "claude-max", model: "m", messages: msgs, maxTokens: 1, temperature: 0, timeoutMs: 1000, captureErrorBody: true });
    expect(withBody.ok === false && withBody.bodySnippet).toBe("x".repeat(200));
  });

  it("thrown errors and unparseable bodies are exceptions carrying the original error", async () => {
    const boom = new Error("socket hang up");
    mockFetch(() => boom);
    const thrown = await executeCompletion({ provider: "lm-studio", messages: msgs, maxTokens: 1, temperature: 0, timeoutMs: 1000 });
    expect(thrown).toMatchObject({ ok: false, kind: "exception" });
    expect(thrown.ok === false && thrown.error).toBe(boom);
    mockFetch(() => new Response("<html>", { status: 200 }));
    const badJson = await executeCompletion({ provider: "claude-max", model: "m", messages: msgs, maxTokens: 1, temperature: 0, timeoutMs: 1000 });
    expect(badJson).toMatchObject({ ok: false, kind: "exception" });
  });
});

/* ── 6. streaming stays streaming ────────────────────────────────────── */
const enc = new TextEncoder();
const gem = (text: string, usage?: object) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }], ...(usage ? { usageMetadata: usage } : {}) })}\n\n`;
const oai = (text: string, usage?: object) => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }], ...(usage ? { usage } : {}) })}\n\n`;

/** A response whose chunks are released one at a time, so tests can prove deltas arrive before the stream ends. */
function gatedSse() {
  let ctrl!: ReadableStreamDefaultController<Uint8Array>;
  const res = new Response(new ReadableStream<Uint8Array>({ start: (c) => void (ctrl = c) }), { status: 200 });
  return { res, push: (s: string) => ctrl.enqueue(enc.encode(s)), end: () => ctrl.close() };
}

describe("streamCompletion", () => {
  const req = (provider: "gemini" | "deepseek" | "openrouter") => ({ provider, apiKey: "KEY", systemPrompt: "SYS", userMessage: "hi" });

  it("gemini request shape (URL with key, body, headers, 45s timeout)", async () => {
    mockFetch(() => new Response(gem("a"), { status: 200 }));
    const h = streamCompletion(req("gemini"));
    for await (const d of h.deltas) void d;
    expect(recs[0].url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=KEY");
    expect(recs[0].headers).toEqual({ "Content-Type": "application/json" });
    expect(recs[0].bodyText).toBe(
      JSON.stringify({
        system_instruction: { parts: [{ text: "SYS" }] },
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
        generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
      }),
    );
    expect(recs[0].timeoutMs).toBe(45_000);
  });

  it("deepseek and openrouter request shapes", async () => {
    mockFetch(() => new Response(oai("a"), { status: 200 }));
    for await (const d of streamCompletion(req("deepseek")).deltas) void d;
    expect(recs[0].url).toBe("https://api.deepseek.com/chat/completions");
    expect(recs[0].headers).toEqual({ "Content-Type": "application/json", Authorization: "Bearer KEY" });
    expect(recs[0].bodyText).toBe(
      JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "system", content: "SYS" }, { role: "user", content: "hi" }],
        max_tokens: 500,
        temperature: 0.7,
        stream: true,
      }),
    );
    for await (const d of streamCompletion(req("openrouter")).deltas) void d;
    expect(recs[1].url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(recs[1].headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer KEY",
      "HTTP-Referer": "https://ramiche-site.vercel.app",
      "X-Title": "Parallax Command Center",
    });
    expect(recs[1].body.model).toBe("anthropic/claude-sonnet-4");
    expect(recs[1].body.stream).toBe(true);
    expect(recs[1].timeoutMs).toBe(45_000);
    expect(STREAM_MODELS).toEqual({ gemini: "gemini-2.0-flash", deepseek: "deepseek-chat", openrouter: "anthropic/claude-sonnet-4" });
  });

  it("yields deltas incrementally, before the upstream stream ends", async () => {
    const g = gatedSse();
    mockFetch(() => g.res);
    const h = streamCompletion(req("deepseek"));
    const it = h.deltas[Symbol.asyncIterator]();
    g.push(oai("Hel"));
    expect(await it.next()).toEqual({ value: "Hel", done: false }); // arrives while upstream is still open
    g.push(oai("lo"));
    expect(await it.next()).toEqual({ value: "lo", done: false });
    g.push("data: [DONE]\n\n");
    g.end();
    expect((await it.next()).done).toBe(true);
  });

  it("captures usage only when a chunk carried it, with model and status recorded", async () => {
    mockFetch(() => new Response(gem("a") + gem("b", { promptTokenCount: 5, candidatesTokenCount: 2, totalTokenCount: 7 }), { status: 200 }));
    const withUsage = streamCompletion(req("gemini"));
    for await (const d of withUsage.deltas) void d;
    expect(withUsage.outcome).toMatchObject({ provider: "gemini", model: "gemini-2.0-flash", httpStatus: 200, usage: { promptTokens: 5, completionTokens: 2, totalTokens: 7 } });
    expect(typeof withUsage.outcome.latencyMs).toBe("number");

    mockFetch(() => new Response(oai("a") + oai("b"), { status: 200 }));
    const noUsage = streamCompletion(req("deepseek"));
    for await (const d of noUsage.deltas) void d;
    expect(noUsage.outcome.usage).toBeUndefined();
  });

  it("non-2xx yields nothing (status recorded); network errors throw to the caller", async () => {
    mockFetch(() => new Response("no", { status: 500 }));
    const h = streamCompletion(req("gemini"));
    const got: string[] = [];
    for await (const d of h.deltas) got.push(d);
    expect(got).toEqual([]);
    expect(h.outcome.httpStatus).toBe(500);
    mockFetch(() => new Error("dns"));
    await expect((async () => { for await (const d of streamCompletion(req("deepseek")).deltas) void d; })()).rejects.toThrow("dns");
  });

  it("ignores malformed chunks and [DONE]", async () => {
    mockFetch(() => new Response("data: {oops\n\n" + oai("ok") + "data: [DONE]\n\n", { status: 200 }));
    const got: string[] = [];
    for await (const d of streamCompletion(req("openrouter")).deltas) got.push(d);
    expect(got).toEqual(["ok"]);
  });
});

/* ── OpenClaw as a backend target ────────────────────────────────────── */
describe("executeOpenClaw", () => {
  it("forwards session, message and timeout unchanged; model is always 'unknown'", async () => {
    gw.result = { ok: true, reply: "from claw" };
    const r = await executeOpenClaw({ sessionKey: "agent:main:main", message: "M", timeoutSeconds: 25 });
    expect(gw.calls).toEqual([["agent:main:main", "M", 25]]);
    expect(r).toMatchObject({ ok: true, provider: "openclaw", model: "unknown", text: "from claw" });
  });

  it("reports gateway failures with the gateway's own message", async () => {
    gw.result = { ok: false, error: "ws timeout" };
    const r = await executeOpenClaw({ sessionKey: "k", message: "M", timeoutSeconds: 90 });
    expect(r).toMatchObject({ ok: false, provider: "openclaw", model: "unknown", error: "ws timeout" });
  });
});

/* ── 5, 6, 7, 9. route-level behavior through the adapter ─────────────── */
async function postChat(body: object, env: Record<string, string>, responder: Responder) {
  resetEnv(env);
  mockFetch(responder);
  const errs: string[] = [];
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => void errs.push(a.map(String).join(" ")));
  const res = await chatRoute.POST(new NextRequest("http://localhost/api/command-center/chat", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
  return { status: res.status, ctype: res.headers.get("content-type"), json: (await res.json()) as Record<string, unknown>, errs };
}
const byHost = (claude: () => Response | Error, lm: () => Response | Error): Responder => (url) => (url === LM_URL || url.includes("1234") ? lm() : claude());

describe("chat route (non-streaming) through the adapter", () => {
  it("DM: claude-max first with the agent's tier model and the reply params, then nothing else on success", async () => {
    const r = await postChat({ message: "hi", agentName: "atlas" }, {}, byHost(() => ok("hello there"), () => ok("lm")));
    expect(r.status).toBe(200);
    expect(r.ctype).toContain("application/json"); // non-streaming stays non-streaming
    expect(recs.map((x) => x.url)).toEqual([CLAUDE_URL]);
    expect(recs[0].body.model).toBe("claude-opus-4-6");
    expect(recs[0].body).toMatchObject({ max_tokens: 300, temperature: 0.7 });
    expect(recs[0].headers.Authorization).toBe("Bearer not-needed");
    expect(recs[0].timeoutMs).toBe(45_000);
    expect(recs[0].body.messages.map((m) => m.role)).toEqual(["system", "user"]);
    expect(recs[0].body.messages[1].content).toBe("hi");
  });

  it("fallback order on failure: claude-max then LM Studio (no model pinned, 60s), never reversed", async () => {
    const r = await postChat({ message: "hi", agentName: "echo" }, {}, byHost(() => new Response("proxy exploded", { status: 500 }), () => ok("lm text")));
    expect(recs.map((x) => x.url)).toEqual([CLAUDE_URL, LM_URL]);
    expect(recs[0].body.model).toBe("claude-sonnet-4-6");
    expect(recs[1].body).not.toHaveProperty("model");
    expect(recs[1].headers).toEqual({ "Content-Type": "application/json" });
    expect(recs[1].body).toMatchObject({ max_tokens: 300, temperature: 0.7 });
    expect(recs[1].timeoutMs).toBe(60_000);
    expect(r.status).toBe(200); // LM Studio answered, so the turn succeeds
  });

  it("pinned LM Studio model and env model overrides are honoured", async () => {
    await postChat({ message: "hi", agentName: "triage" }, { CC_CLAUDE_MODEL_HAIKU: "hai-X", CC_LMSTUDIO_MODEL: "qwen-local" }, byHost(() => new Error("down"), () => ok("lm")));
    expect(recs[0].body.model).toBe("hai-X");
    expect(recs[1].body.model).toBe("qwen-local");
  });

  it("all backends failing still surfaces the attempt log with a 502, not a fake reply", async () => {
    const r = await postChat({ message: "hi", agentName: "atlas" }, {}, byHost(() => new Response("bad gateway", { status: 500 }), () => new Error("fetch failed")));
    expect(r.status).toBe(502);
    const attempts = JSON.stringify(r.json);
    expect(attempts).toContain("HTTP 500 — bad gateway");
    expect(attempts).toContain("LM Studio Local Server not running");
  });

  it("a `null` JSON reply from claude-max logs and falls back exactly like the old exception path", async () => {
    const nullBody = () => new Response("null", { status: 200 });
    const r = await postChat({ message: "hi", agentName: "atlas" }, {}, byHost(nullBody, () => ok("lm text")));
    expect(r.status).toBe(200);
    expect(recs.map((x) => x.url)).toEqual([CLAUDE_URL, LM_URL]); // fell through to LM Studio
    expect(r.errs).toContain("[chat] Claude Max proxy error: TypeError: Cannot read properties of null (reading 'choices')");
    // Both backends returning null: the attempt log carries the exception text, as it did at base.
    const both = await postChat({ message: "hi", agentName: "atlas" }, {}, byHost(nullBody, nullBody));
    expect(both.status).toBe(502);
    expect(JSON.stringify(both.json)).toContain("exception: Cannot read properties of null (reading 'choices')");
  });

  it("a `null` JSON reply in synthesis logs the pass label and still falls back", async () => {
    const nullBody = () => new Response("null", { status: 200 });
    const g = await postChat({ message: "team update", channelMembers: ["atlas", "simons"] }, {}, byHost(nullBody, () => ok("lm take")));
    const labels = [
      "[chat] Claude Max proxy error: TypeError: Cannot read properties of null (reading 'choices')",
      "[chat/synthesis] Claude Max proxy error: TypeError: Cannot read properties of null (reading 'choices')",
    ];
    for (const l of labels) expect(g.errs, l).toContain(l);
  });

  it("OpenClaw is skipped by default and only tried first when OPENCLAW_CHAT_PRIMARY is set", async () => {
    gw.configured = true;
    await postChat({ message: "hi", agentName: "shuri" }, {}, byHost(() => ok("c"), () => ok("lm")));
    expect(gw.calls).toEqual([]);
    gw.calls = [];
    gw.result = { ok: true, reply: "from openclaw" };
    const r = await postChat({ message: "hi", agentName: "shuri" }, { OPENCLAW_CHAT_PRIMARY: "1" }, byHost(() => ok("c"), () => ok("lm")));
    expect(gw.calls).toHaveLength(1);
    expect(gw.calls[0][0]).toBe("agent:shuri:main");
    expect(gw.calls[0][2]).toBe(25);
    expect(recs).toHaveLength(0); // OpenClaw answered; no other backend was called
    expect(JSON.stringify(r.json)).toContain("from openclaw");
  });

  it("OpenClaw failure falls through to claude-max; strict mode returns 502 instead", async () => {
    gw.configured = true;
    gw.result = { ok: false, error: "ws timeout" };
    await postChat({ message: "hi", agentName: "shuri" }, { OPENCLAW_CHAT_PRIMARY: "1" }, byHost(() => ok("c"), () => ok("lm")));
    expect(recs.map((x) => x.url)).toEqual([CLAUDE_URL]);
    const strict = await postChat({ message: "hi", agentName: "shuri" }, { OPENCLAW_CHAT_PRIMARY: "1", OPENCLAW_CHAT_STRICT: "1" }, byHost(() => ok("c"), () => ok("lm")));
    expect(recs).toHaveLength(0);
    expect(strict.status).toBe(502);
    expect(JSON.stringify(strict.json)).toContain("ws timeout");
  });

  it("group fan-out: every agent runs on its own tier, then synthesis runs on atlas's tier", async () => {
    await postChat({ message: "team update", channelMembers: ["atlas", "simons", "triage"] }, {}, byHost(() => ok("take"), () => ok("lm")));
    const perAgent = recs.slice(0, 3).map((x) => x.body.model).sort();
    expect(perAgent).toEqual(["claude-haiku-4-5", "claude-opus-4-6", "claude-opus-4-6"]);
    expect(recs.slice(3).every((x) => x.body.model === "claude-opus-4-6")).toBe(true); // synthesis / critic
    expect(recs.slice(3)[0].body).toMatchObject({ max_tokens: 800, temperature: 0.4 });
    expect(recs.slice(3)[0].timeoutMs).toBe(60_000);
  });
});

async function postStream(body: object, env: Record<string, string>, responder: Responder) {
  resetEnv(env);
  mockFetch(responder);
  vi.spyOn(console, "error").mockImplementation(() => {});
  const res = await streamRoute.POST(new NextRequest("http://localhost/api/command-center/chat/stream", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
  return { ctype: res.headers.get("content-type"), text: await res.text() };
}
const host = (m: { g?: () => Response | Error; d?: () => Response | Error; o?: () => Response | Error }): Responder => (url) => {
  const f = url.includes("generativelanguage") ? m.g : url.includes("deepseek") ? m.d : m.o;
  return f ? f() : new Response("unexpected", { status: 404 });
};

describe("stream route through the adapter", () => {
  const ALL = { GEMINI_API_KEY: "gk", DEEPSEEK_API_KEY: "dk", OPENROUTER_API_KEY: "ok" };

  it("stays a server-sent-event stream with one chunk event per delta", async () => {
    const r = await postStream({ message: "hi", agentName: "atlas" }, ALL, host({ g: () => new Response(gem("Hel") + gem("lo"), { status: 200 }) }));
    expect(r.ctype).toContain("text/event-stream");
    expect(r.text.match(/event: chunk/g)).toHaveLength(2);
    expect(r.text).toContain('"delta":"Hel"');
    expect(r.text).toContain("event: done");
    expect(r.text).toContain('"source":"gemini"');
  });

  it("fallback order is gemini -> deepseek -> openrouter, each once, then an error event", async () => {
    const r = await postStream({ message: "hi", agentName: "vee" }, ALL, host({ g: () => new Response("x", { status: 500 }), d: () => new Error("e"), o: () => new Response("x", { status: 429 }) }));
    expect(recs.map((x) => new URL(x.url).host)).toEqual(["generativelanguage.googleapis.com", "api.deepseek.com", "openrouter.ai"]);
    expect(r.text).toContain("event: error");
    expect(r.text).toContain("All chat providers failed or are not configured");
    expect(r.text).not.toContain("event: done");
  });

  it("a provider is skipped when its key is unset; openrouter still answers", async () => {
    const r = await postStream({ message: "hi", agentName: "nova" }, { OPENROUTER_API_KEY: "ok" }, host({ o: () => new Response(oai("via router"), { status: 200 }) }));
    expect(recs.map((x) => new URL(x.url).host)).toEqual(["openrouter.ai"]);
    expect(r.text).toContain('"source":"openrouter"');
  });

  it("OpenClaw is attempted first whenever the gateway is configured (not gated by OPENCLAW_CHAT_PRIMARY), 90s", async () => {
    gw.configured = true;
    gw.result = { ok: true, reply: "claw" };
    const r = await postStream({ message: "hi", agentName: "shuri" }, ALL, host({ g: () => new Response(gem("no"), { status: 200 }) }));
    expect(gw.calls).toHaveLength(1);
    expect(gw.calls[0][2]).toBe(90);
    expect(recs).toHaveLength(0);
    expect(r.text).toContain('"source":"openclaw"');
  });

  it("strict OpenClaw failure ends with an error event and calls no cloud provider", async () => {
    gw.configured = true;
    gw.result = { ok: false, error: "ws" };
    const r = await postStream({ message: "hi", agentName: "shuri" }, { ...ALL, OPENCLAW_CHAT_STRICT: "1" }, host({ g: () => new Response(gem("no"), { status: 200 }) }));
    expect(recs).toHaveLength(0);
    expect(r.text).toContain("event: error");
    expect(r.text).toContain('"error":"ws"');
  });
});

/* ── 10. server-only boundary + single execution layer ────────────────── */
describe("boundary and hygiene", () => {
  it("no 'use client' file can transitively reach the provider adapter", () => {
    expect(clientFiles().length).toBeGreaterThan(10);
    expect(clientFilesReaching("src/lib/provider-adapter.ts")).toEqual([]);
  });

  it("migrated files make no direct provider HTTP calls and define no tier->model logic", () => {
    for (const f of ["src/app/api/command-center/chat/route.ts", "src/app/api/command-center/chat/stream/route.ts", "src/lib/cc-approve-synthesis.ts"]) {
      // Code only: doc comments may still mention the default URLs.
      const src = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");
      expect(src, `${f}: direct fetch`).not.toMatch(/\bfetch\(/);
      expect(src, `${f}: model literal`).not.toMatch(/claude-(opus|sonnet|haiku)-\d/);
      expect(src, `${f}: model env override`).not.toMatch(/CC_CLAUDE_MODEL_/);
      expect(src, `${f}: local modelForAgent`).not.toMatch(/function modelForAgent|function modelForLMStudio/);
      expect(src, `${f}: provider URL`).not.toMatch(/api\.deepseek\.com|openrouter\.ai|generativelanguage|127\.0\.0\.1:(3456|1234)\/v1/);
      expect(read(f), `${f}: imports the adapter`).toMatch(/@\/lib\/provider-adapter"/);
    }
  });

  it("the adapter reads tiers from the registry and keeps no agent table of its own", () => {
    const src = read("src/lib/provider-adapter.ts");
    expect(src).toMatch(/claudeTierMap\(\)/);
    expect(src).not.toMatch(/\b(shuri|proximon|kiyosaki|themaestro|prophets)\b/);
  });
});
