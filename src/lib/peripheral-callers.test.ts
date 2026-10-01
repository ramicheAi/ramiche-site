/**
 * Contract tests for the four peripheral Claude Max callers (P06 Packet 2b): lead-gen, jobs, voice/atlas, verse.
 * Each expectation below is the behavior these callers had BEFORE they moved onto the provider adapter
 * (verified against commit ceb8c73 with a scenario-by-scenario differential run). The contracts are deliberately
 * different per caller: auth or none, timeout or none, stream:false or not, when the environment is read.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Cockpit lineage: these routes sit behind the owner/CSRF/origin guards (P03). This file tests the Provider Adapter
// behavior, not the guards (src/lib/server/*.test.ts covers those), so the guards are stubbed to "owner present".
vi.mock("@/lib/server/protected-mutation", () => ({
  guardProtectedMutation: async () => ({ ok: true, uid: "test-owner", sessionCookie: "test-session" }),
  guardPrivateRead: async () => ({ ok: true, uid: "test-owner", sessionCookie: "test-session" }),
}));
vi.mock("@/lib/server/service-caller", async () => ({
  ...(await vi.importActual<typeof import("@/lib/server/service-caller")>("@/lib/server/service-caller")),
  guardServiceCaller: async () => ({ ok: true, principal: "service:bridge", kind: "service" }),
}));


const sb: { admin: unknown; log: unknown[] } = { admin: null, log: [] };
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => sb.admin }));

const DEFAULT_URL = "http://127.0.0.1:3456/v1/chat/completions";
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

/* ── recorder ─────────────────────────────────────────────────────────── */
interface Body {
  model?: string;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  messages: { role: string; content: string }[];
}
type Call = { url: string; headers: Record<string, string>; body: Body; hasSignal: boolean };
let calls: Call[] = [];
let timers: number[] = [];
let sigTimeouts: number[] = [];
type Reply = Response | Error | "hang";
type Handler = (url: string, n: number) => Reply;

function install(handler: Handler, fake = false) {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  calls = [];
  timers = [];
  sigTimeouts = [];
  if (fake) vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const realST = globalThis.setTimeout;
  vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void, ms?: number, ...a: unknown[]) => {
    if (typeof ms === "number" && ms >= 10_000) timers.push(ms);
    return realST(fn, ms, ...a);
  }) as unknown as typeof setTimeout);
  const origSig = AbortSignal.timeout.bind(AbortSignal);
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
    sigTimeouts.push(ms);
    return origSig(ms);
  });
  let n = 0;
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries((init?.headers ?? {}) as Record<string, string>)) headers[k.toLowerCase()] = v;
    let body = init?.body as unknown as Body;
    try {
      body = JSON.parse(String(init?.body)) as Body;
    } catch {
      /* raw */
    }
    calls.push({ url: String(url), headers, body, hasSignal: init?.signal !== undefined });
    const r = handler(String(url), n++);
    if (r === "hang") {
      return new Promise((_res, rej) => {
        const s = init?.signal;
        if (s) s.addEventListener("abort", () => rej(s.reason));
      });
    }
    if (r instanceof Error) throw r;
    return r;
  });
}
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const okc = (content: unknown, extra: object = {}) => json({ choices: [{ message: { content }, finish_reason: "stop" }], ...extra });
const ENV = ["CLAUDE_MAX_PROXY_URL", "CLAUDE_MAX_PROXY_TOKEN", "CC_JOBS_MODEL", "ATLAS_MODEL", "CC_VERSE_MODEL"];
const setEnv = (e: Record<string, string> = {}) => {
  for (const k of ENV) delete process.env[k];
  Object.assign(process.env, e);
};
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setEnv();
});

/* ═══ lead-gen ═══════════════════════════════════════════════════════════ */
describe("lead-gen callProxyJSON contract", () => {
  const load = async () => {
    vi.resetModules();
    return (await import("@/lib/lead-gen")).callProxyJSON;
  };
  const valid = '{"a":1}';

  it("request: bearer auth, model default, stream:false, NO temperature/max_tokens, 180s abort-controller timer", async () => {
    setEnv();
    const call = await load();
    install(() => okc(valid));
    expect(await call("sys", "usr")).toEqual({ a: 1 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(DEFAULT_URL);
    expect(calls[0].headers).toEqual({ "content-type": "application/json", authorization: "Bearer not-needed" });
    expect(calls[0].body).toEqual({ model: "claude-sonnet-4-5", stream: false, messages: [{ role: "system", content: "sys" }, { role: "user", content: "usr" }] });
    expect(calls[0].hasSignal).toBe(true);
    expect(timers).toEqual([180_000]);
    expect(sigTimeouts).toEqual([]);
  });

  it("model and timeout options are honoured", async () => {
    const call = await load();
    install(() => okc(valid));
    await call("s", "u", { model: "claude-opus-4-6", timeoutMs: 170_000 });
    expect(calls[0].body.model).toBe("claude-opus-4-6");
    expect(timers).toEqual([170_000]);
  });

  it("env is read at CALL time and stripped of quotes and whitespace", async () => {
    setEnv({ CLAUDE_MAX_PROXY_TOKEN: "before" });
    const call = await load();
    setEnv({ CLAUDE_MAX_PROXY_URL: ' "http://late.test/x" ', CLAUDE_MAX_PROXY_TOKEN: " 'tok-2' " });
    install(() => okc(valid));
    await call("s", "u");
    expect(calls[0].url).toBe("http://late.test/x");
    expect(calls[0].headers.authorization).toBe("Bearer tok-2");
  });

  it("HTTP failure throws 'agent proxy HTTP n' and is NOT retried", async () => {
    const call = await load();
    install(() => new Response("boom", { status: 500 }));
    await expect(call("s", "u")).rejects.toThrow("agent proxy HTTP 500");
    expect(calls).toHaveLength(1);
  });

  it("network errors surface as-is and are NOT retried", async () => {
    const call = await load();
    install(() => new Error("ECONNREFUSED"));
    await expect(call("s", "u")).rejects.toThrow("ECONNREFUSED");
    expect(calls).toHaveLength(1);
  });

  it("retries exactly once, and only on a JSON SyntaxError", async () => {
    const call = await load();
    install((_u, n) => okc(n === 0 ? "{oops" : valid));
    expect(await call("s", "u")).toEqual({ a: 1 });
    expect(calls).toHaveLength(2);
    install(() => okc("{oops"));
    await expect(call("s", "u")).rejects.toBeInstanceOf(SyntaxError);
    expect(calls).toHaveLength(2); // one retry, then give up
    install(() => okc(""));
    await expect(call("s", "u")).rejects.toBeInstanceOf(SyntaxError);
    expect(calls).toHaveLength(2);
  });

  it("parses fenced JSON and JSON surrounded by prose", async () => {
    const call = await load();
    install(() => okc("```json\n" + valid + "\n```"));
    expect(await call("s", "u")).toEqual({ a: 1 });
    install(() => okc("Here: " + valid + " done"));
    expect(await call("s", "u")).toEqual({ a: 1 });
  });

  it("a literal null body is a TypeError (as before), array content is a 'trim is not a function' TypeError", async () => {
    const call = await load();
    install(() => new Response("null", { status: 200 }));
    await expect(call("s", "u")).rejects.toThrow("Cannot read properties of null (reading 'choices')");
    install(() => okc([{ type: "text", text: valid }]));
    await expect(call("s", "u")).rejects.toThrow('((intermediate value) || "").trim is not a function');
    expect(calls).toHaveLength(1);
  });

  it("times out with an AbortError at the deadline (not a TimeoutError) and does not retry", async () => {
    const call = await load();
    install(() => "hang", true);
    const p = call("s", "u", { timeoutMs: 170_000 }).catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(170_000);
    const e = (await p) as Error;
    expect(e.name).toBe("AbortError");
    expect(calls).toHaveLength(1);
  });
});

/* ═══ jobs ═══════════════════════════════════════════════════════════════ */
const scrub = (o: unknown) => JSON.parse(JSON.stringify(o, (k, v) => (/_at$/.test(k) ? "T" : v)));
function fakeJobAdmin(job: unknown) {
  return {
    from: (table: string) => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: job, error: null }) }) }),
      update: (payload: unknown) => ({ eq: async () => void sb.log.push([table, "update", scrub(payload)]) }),
      insert: async (row: unknown) => void sb.log.push([table, "insert", scrub(row)]),
    }),
  };
}
describe("jobs runJob contract", () => {
  const job = (input: object = {}) => ({ id: "j1", status: "queued", kind: "dev", title: "Build it", input });
  const runIt = async (j: unknown, handler: Handler, env: Record<string, string> = {}, fake = false) => {
    vi.resetModules();
    setEnv(env);
    const { runJob } = await import("@/lib/jobs");
    sb.admin = fakeJobAdmin(j);
    sb.log = [];
    install(handler, fake);
    return (id: string) => runJob(id, new Request("http://localhost/api/command-center/jobs", { method: "POST" }));
  };
  type Row = [string, string, { status?: string; result?: string; error?: string; progress?: string }];
  const statusOf = () => (sb.log as Row[]).find((l) => l[0] === "jobs" && l[2].status && l[2].status !== "running")?.[2];

  it("request: NO Authorization header even when a token env exists, stream:false, no temperature/max_tokens, 15-minute timer", async () => {
    const run = await runIt(job(), () => okc("done"), { CLAUDE_MAX_PROXY_TOKEN: "must-not-be-sent" });
    await run("j1");
    expect(calls[0].url).toBe(DEFAULT_URL);
    expect(calls[0].headers).toEqual({ "content-type": "application/json" });
    expect(Object.keys(calls[0].body).sort()).toEqual(["messages", "model", "stream"]);
    expect(calls[0].body.stream).toBe(false);
    expect(calls[0].body.model).toBe("claude-sonnet-4-5");
    expect(calls[0].body.messages).toHaveLength(1);
    expect(calls[0].body.messages[0].role).toBe("user");
    expect(timers).toEqual([900_000]);
    expect(sigTimeouts).toEqual([]);
    expect(statusOf()).toMatchObject({ status: "done", result: "done", progress: "complete" });
  });

  it("model: job input wins, else CC_JOBS_MODEL read at MODULE LOAD, else the default", async () => {
    let run = await runIt(job({ model: "claude-opus-4-6" }), () => okc("r"), { CC_JOBS_MODEL: "env-model" });
    await run("j1");
    expect(calls[0].body.model).toBe("claude-opus-4-6");
    run = await runIt(job(), () => okc("r"), { CC_JOBS_MODEL: "env-model" });
    setEnv({ CC_JOBS_MODEL: "changed-later", CLAUDE_MAX_PROXY_URL: "http://late.test/x" });
    await run("j1");
    expect(calls[0].body.model).toBe("env-model");
    expect(calls[0].url).toBe(DEFAULT_URL); // URL also frozen at module load
  });

  it("content: string trimmed, part-array joined, empty or literal-null body -> 'empty result from agent'", async () => {
    let run = await runIt(job(), () => okc([{ type: "text", text: "a" }, "b", { text: "c" }]));
    await run("j1");
    expect(statusOf()).toMatchObject({ status: "done", result: "abc" });
    for (const reply of [okc(""), okc("   "), json({ choices: [] }), new Response("null", { status: 200 })]) {
      run = await runIt(job(), () => reply.clone());
      await run("j1");
      expect(statusOf()).toMatchObject({ status: "failed", error: "empty result from agent" });
    }
  });

  it("failures: HTTP error carries the first 300 chars of the body; network errors keep their message", async () => {
    let run = await runIt(job(), () => new Response("x".repeat(500), { status: 500 }));
    await run("j1");
    expect(statusOf()?.error).toBe("proxy HTTP 500: " + "x".repeat(300));
    run = await runIt(job(), () => new Response("", { status: 502 }));
    await run("j1");
    expect(statusOf()?.error).toBe("proxy HTTP 502: ");
    run = await runIt(job(), () => new Error("ECONNREFUSED"));
    await run("j1");
    expect(statusOf()?.error).toBe("ECONNREFUSED");
  });

  it("aborts at exactly 15 minutes with the 'timed out' message, not a minute earlier", async () => {
    let run = await runIt(job(), () => "hang", {}, true);
    let p = run("j1");
    await vi.advanceTimersByTimeAsync(899_999);
    expect(statusOf()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(statusOf()).toMatchObject({ status: "failed", error: "timed out after 900000ms" });
    run = await runIt(job({ model: "m" }), () => "hang", {}, true);
    p = run("j1");
    await vi.advanceTimersByTimeAsync(900_000);
    await p;
    expect(statusOf()?.error).toContain("timed out after 900000ms");
  });

  it("skips jobs that are not queued and does nothing without a database", async () => {
    let run = await runIt({ ...job(), status: "running" }, () => okc("r"));
    await run("j1");
    expect(calls).toHaveLength(0);
    run = await runIt(job(), () => okc("r"));
    sb.admin = null;
    await run("j1");
    expect(calls).toHaveLength(0);
  });
});

/* ═══ voice/atlas ════════════════════════════════════════════════════════ */
describe("voice/atlas POST contract", () => {
  const post = async (body: unknown, handler: Handler, env: Record<string, string> = {}, fake = false, after?: Record<string, string>) => {
    vi.resetModules();
    setEnv(env);
    const mod = await import("@/app/api/command-center/voice/atlas/route");
    if (after) setEnv(after);
    install(handler, fake);
    const p = mod.POST(new Request("http://localhost/x", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) })).then(async (r) => ({ status: r.status, json: await r.json() }));
    return { p, fake };
  };

  it("request: NO Authorization header (token env ignored), stream:false, temperature 0.7, NO max_tokens, 45s abort-controller timer", async () => {
    const { p } = await post({ text: "hello" }, () => okc("  Hi Ramon.  "), { CLAUDE_MAX_PROXY_TOKEN: "must-not-be-sent" });
    expect(await p).toEqual({ status: 200, json: { reply: "Hi Ramon." } });
    expect(calls[0].url).toBe(DEFAULT_URL);
    expect(calls[0].headers).toEqual({ "content-type": "application/json" });
    expect(Object.keys(calls[0].body).sort()).toEqual(["messages", "model", "stream", "temperature"]);
    expect(calls[0].body).toMatchObject({ model: "claude-sonnet-4-5", stream: false, temperature: 0.7 });
    expect(calls[0].body.messages[0].role).toBe("system");
    expect(calls[0].body.messages.at(-1)).toEqual({ role: "user", content: "hello" });
    expect(timers).toEqual([45_000]);
    expect(sigTimeouts).toEqual([]);
  });

  it("ATLAS_MODEL is read per request; the proxy URL is frozen at module load", async () => {
    const { p } = await post({ text: "hi" }, () => okc("ok"), { ATLAS_MODEL: "before", CLAUDE_MAX_PROXY_URL: "http://early.test/x" }, false, { ATLAS_MODEL: "after", CLAUDE_MAX_PROXY_URL: "http://late.test/x" });
    await p;
    expect(calls[0].body.model).toBe("after");
    expect(calls[0].url).toBe("http://early.test/x");
  });

  it("history: last 8 turns, each cut to 2000 chars, unknown roles become user, text cut to 2000", async () => {
    const history = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "m" + i + "y".repeat(2100) }));
    const { p } = await post({ text: "x".repeat(2500), history }, () => okc("ok"));
    await p;
    const msgs = calls[0].body.messages;
    expect(msgs).toHaveLength(1 + 8 + 1);
    expect(msgs[1].content.startsWith("m4")).toBe(true);
    expect(msgs.slice(1, 9).every((m) => m.content.length === 2000)).toBe(true);
    expect(msgs.at(-1)?.content).toHaveLength(2000);
  });

  it("HTTP mapping: no text 400, upstream error 502, empty reply 502, garbage 500, timeout 504", async () => {
    expect(await (await post({ text: " " }, () => okc("x"))).p).toEqual({ status: 400, json: { error: "no text" } });
    expect(calls).toHaveLength(0);
    expect(await (await post("{not json", () => okc("x"))).p).toEqual({ status: 400, json: { error: "no text" } });
    expect(await (await post({ text: "hi" }, () => new Response("no", { status: 401 }))).p).toEqual({ status: 502, json: { error: "atlas upstream 401" } });
    expect(await (await post({ text: "hi" }, () => okc("   "))).p).toEqual({ status: 502, json: { error: "empty reply" } });
    for (const r of [new Response("null", { status: 200 }), new Response("<html>", { status: 200 }), okc([{ text: "x" }])]) {
      expect(await (await post({ text: "hi" }, () => r.clone())).p).toEqual({ status: 500, json: { error: "atlas failed" } });
    }
    expect(await (await post({ text: "hi" }, () => new Error("ECONNREFUSED"))).p).toEqual({ status: 500, json: { error: "atlas failed" } });
    const { p } = await post({ text: "hi" }, () => "hang", {}, true);
    await vi.advanceTimersByTimeAsync(45_000);
    expect(await p).toEqual({ status: 504, json: { error: "timeout" } });
  });
});

/* ═══ verse ══════════════════════════════════════════════════════════════ */
describe("wellness/verse contract", () => {
  const good = JSON.stringify({ reference: "Psalm 23:1", verse_text: "The Lord is my shepherd.", reflection: "Rest." });
  const bibleApi = (url: string) => (url.includes("bible-api.com") ? json({ reference: "John 3:16", text: " For God so loved. " }) : null);
  const get = async (claude: (n: number) => Reply, env: Record<string, string> = {}, after?: Record<string, string>) => {
    vi.resetModules();
    setEnv(env);
    sb.admin = null;
    const mod = await import("@/app/api/command-center/wellness/verse/route");
    if (after) setEnv(after);
    let n = 0;
    install((url) => bibleApi(url) ?? claude(n++));
    const r = await mod.GET(new Request("http://localhost/api/command-center/wellness/verse"));
    return { status: r.status, json: await r.json() };
  };
  const claudeCalls = () => calls.filter((c) => !c.url.includes("bible-api.com"));

  it("request: bearer auth, model default, temperature 0.85, max_tokens 500, NO stream field", async () => {
    const r = await get(() => okc(good));
    expect(r.json).toMatchObject({ reference: "Psalm 23:1", source: "claude" });
    const c = claudeCalls();
    expect(c).toHaveLength(1);
    expect(c[0].url).toBe(DEFAULT_URL);
    expect(c[0].headers).toEqual({ "content-type": "application/json", authorization: "Bearer not-needed" });
    expect(Object.keys(c[0].body).sort()).toEqual(["max_tokens", "messages", "model", "temperature"]);
    expect(c[0].body).toMatchObject({ model: "claude-sonnet-4-6", temperature: 0.85, max_tokens: 500 });
  });

  it("has NO timeout: no signal, no AbortSignal.timeout, no timer", async () => {
    await get(() => okc(good));
    expect(claudeCalls()[0].hasSignal).toBe(false);
    expect(sigTimeouts).toEqual([]);
    expect(timers).toEqual([]);
  });

  it("url, token and model are read at MODULE LOAD", async () => {
    await get(() => okc(good), { CC_VERSE_MODEL: "verse-x", CLAUDE_MAX_PROXY_URL: "http://early.test/x", CLAUDE_MAX_PROXY_TOKEN: "tok-early" }, { CC_VERSE_MODEL: "late", CLAUDE_MAX_PROXY_URL: "http://late.test/x", CLAUDE_MAX_PROXY_TOKEN: "tok-late" });
    const c = claudeCalls()[0];
    expect(c.url).toBe("http://early.test/x");
    expect(c.headers.authorization).toBe("Bearer tok-early");
    expect(c.body.model).toBe("verse-x");
  });

  it("extracts JSON from prose/fences; every failure falls back to a public verse without throwing", async () => {
    expect((await get(() => okc("Sure!\n```json\n" + good + "\n```"))).json.source).toBe("claude");
    for (const reply of [okc('{"verse_text":"x"}'), okc("no braces"), okc(""), okc([{ text: good }]), new Response("null", { status: 200 }), new Response("bad", { status: 500 }), new Response("<html>", { status: 200 }), new Error("ECONNREFUSED")]) {
      const r = await get(() => (reply instanceof Response ? reply.clone() : reply));
      expect(r.json).toMatchObject({ reference: "John 3:16", source: "fallback" });
    }
  });
});

/* ═══ shared hygiene ═════════════════════════════════════════════════════ */
describe("the four peripheral callers go through the adapter", () => {
  const files = ["src/lib/lead-gen.ts", "src/lib/jobs.ts", "src/app/api/command-center/voice/atlas/route.ts", "src/app/api/command-center/wellness/verse/route.ts"];
  it("no direct proxy call and no local default-URL literal remains", () => {
    for (const f of files) {
      const code = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");
      expect(code, `${f}: literal proxy URL`).not.toMatch(/127\.0\.0\.1:3456/);
      expect(code, `${f}: imports adapter`).toMatch(/@\/lib\/provider-adapter"/);
      expect(code, `${f}: setTimeout/AbortController for the model call`).not.toMatch(/new AbortController\(\)/);
    }
    // verse still calls a non-LLM public API (bible-api.com) directly; that is the only fetch left in these files.
    for (const f of files.filter((x) => !x.includes("verse"))) expect(read(f), f).not.toMatch(/\bfetch\(/);
    expect(read(files[3]).match(/\bfetch\(/g)).toHaveLength(1);
  });
});
