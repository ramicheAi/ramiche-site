// @vitest-environment node
/**
 * Boundary test for the Claude Max proxy system-prompt transport patch
 * (ops/claude-max-proxy). Applies the patcher to a pristine copy of the proxy
 * files, then drives the real adapter + subprocess manager against a fake CLI
 * that records the argv and stdin it receives.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { agentIdentityFrame } from "./agent-registry";

const OPS = path.resolve(__dirname, "../../ops/claude-max-proxy");
const FAKE = path.join(OPS, "fixtures/fake-claude.mjs");
const NEXT_FRAME = (id: string) => `${agentIdentityFrame(id)}\n\nRole: test. Style: test.`;

type Msg = { role: string; content: unknown };
interface Mods {
  openaiToCli: (r: { model: string; messages: Msg[]; user?: string }) => {
    prompt: string; systemPrompt?: string; model: string; sessionId?: string; streamJson?: boolean;
  };
  ClaudeSubprocess: new () => {
    start(prompt: string, o: Record<string, unknown>): Promise<void>;
    on(e: string, f: (...a: unknown[]) => void): void;
  };
}
let patchedDir = "";
let pristineDir = "";
let patchedMods: Mods;
let pristineMods: Mods;
let tmp = "";

async function load(dir: string): Promise<Mods> {
  const imp = (p: string) => import(/* @vite-ignore */ pathToFileURL(path.join(dir, p)).href);
  const [a, m] = await Promise.all([imp("adapter/openai-to-cli.js"), imp("subprocess/manager.js")]);
  return { openaiToCli: a.openaiToCli, ClaudeSubprocess: m.ClaudeSubprocess };
}

function copyDir(src: string, dst: string) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "proxy-transport-"));
  pristineDir = path.join(tmp, "pristine");
  patchedDir = path.join(tmp, "patched");
  copyDir(path.join(OPS, "fixtures/pristine"), pristineDir);
  copyDir(path.join(OPS, "fixtures/pristine"), patchedDir);
  fs.writeFileSync(path.join(tmp, "package.json"), '{"type":"module"}');
  const { patchFiles, MARKER } = await import(/* @vite-ignore */ pathToFileURL(path.join(OPS, "apply-system-prompt-transport.mjs")).href);
  const rel = ["adapter/openai-to-cli.js", "subprocess/manager.js", "server/routes.js"];
  const files = Object.fromEntries(rel.map((p) => [p, fs.readFileSync(path.join(patchedDir, p), "utf8")]));
  const out = patchFiles(files);
  for (const p of rel) {
    expect(out[p]).toContain(MARKER);
    fs.writeFileSync(path.join(patchedDir, p), out[p]);
  }
  // Drop dangling sourcemap comments so vite does not log missing .map files.
  for (const d of [pristineDir, patchedDir]) {
    for (const p of [...rel, "types/claude-cli.js"]) {
      const f = path.join(d, p);
      fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace(/^\/\/# sourceMappingURL=.*$/m, ""));
    }
  }
  patchedMods = await load(patchedDir);
  pristineMods = await load(pristineDir);
});

let outFile = "";
beforeEach(() => {
  outFile = path.join(tmp, `out-${Math.random().toString(36).slice(2)}.json`);
  process.env.CLAUDE_BIN = FAKE;
  process.env.FAKE_CLI_OUT = outFile;
  delete process.env.PROXY_SYSTEM_TRANSPORT;
  delete process.env.PROXY_SYSTEM_ARG_MAX_BYTES;
});
afterEach(() => {
  delete process.env.CLAUDE_BIN;
  delete process.env.FAKE_CLI_OUT;
});

async function run(mods: Mods, req: { model: string; messages: Msg[]; user?: string }) {
  const cli = mods.openaiToCli(req);
  const sp = new mods.ClaudeSubprocess();
  const closed = new Promise<void>((r) => sp.on("close", () => r()));
  await sp.start(cli.prompt, {
    model: cli.model, sessionId: cli.sessionId, streamJson: cli.streamJson, systemPrompt: cli.systemPrompt,
  });
  await closed;
  const rec = JSON.parse(fs.readFileSync(outFile, "utf8")) as { argv: string[]; stdin: string };
  const i = rec.argv.indexOf("--append-system-prompt");
  return { ...rec, cli, appended: i >= 0 ? rec.argv[i + 1] : undefined, flagCount: rec.argv.filter((a) => a === "--append-system-prompt").length };
}

const req = (id: string, user = "Reply exactly: PACKET3_OK") => ({
  model: "claude-haiku-4-5",
  messages: [{ role: "system", content: NEXT_FRAME(id) }, { role: "user", content: user }],
});

describe("claude-max proxy system-prompt transport", () => {
  it("pristine proxy puts the system text inside the user prompt (the defect)", async () => {
    const r = await run(pristineMods, req("triage"));
    expect(r.stdin).toContain("<system>");
    expect(r.stdin).toContain("operating as Triage");
    expect(r.appended).not.toContain("operating as Triage");
  });

  it("patched: system content reaches --append-system-prompt, user stays user", async () => {
    const r = await run(patchedMods, req("triage"));
    expect(r.appended).toContain("You are operating as Triage");
    expect(r.appended).toContain("Role: test. Style: test.");
    expect(r.stdin).toBe("Reply exactly: PACKET3_OK");
  });

  it("patched: no <system> block and no system text in the user prompt", async () => {
    const r = await run(patchedMods, req("triage"));
    expect(r.stdin).not.toContain("<system>");
    expect(r.stdin).not.toContain("operating as");
    expect(r.cli.prompt).toBe("Reply exactly: PACKET3_OK");
  });

  it("patched: a single --append-system-prompt, never --system-prompt, keeps tool mapping", async () => {
    const r = await run(patchedMods, req("triage"));
    expect(r.flagCount).toBe(1);
    expect(r.argv).not.toContain("--system-prompt");
    const base = (await run(pristineMods, req("triage"))).appended as string;
    expect((r.appended as string).startsWith(base)).toBe(true);
  });

  it("patched: Vee and Triage each get only their own frame (no cross-agent leakage)", async () => {
    const t = await run(patchedMods, req("triage"));
    const v = await run(patchedMods, req("vee"));
    const t2 = await run(patchedMods, req("triage"));
    expect(v.appended).toContain("operating as Vee");
    expect(v.appended).not.toContain("operating as Triage");
    expect(t.appended).not.toContain("operating as Vee");
    expect(t2.appended).toBe(t.appended);
  });

  it("patched: fallback path carries the identical canonical context", async () => {
    // Same OpenAI messages the chat route sends after an OpenClaw failure.
    const a = await run(patchedMods, req("triage", "first"));
    const b = await run(patchedMods, req("triage", "second"));
    expect(a.appended).toBe(b.appended);
    expect(a.appended).toContain(agentIdentityFrame("triage"));
  });

  it("patched: no session reuse and no user/session flag added", async () => {
    const r = await run(patchedMods, req("triage"));
    expect(r.argv).not.toContain("--session-id");
    expect(r.argv).toContain("--no-session-persistence");
  });

  it("patched: model/provider can still be disclosed truthfully (no denial text added)", async () => {
    const r = await run(patchedMods, req("triage"));
    expect(r.appended).toMatch(/answer truthfully/);
    expect(r.appended).not.toMatch(/do not (identify|say)|never (break|reveal)/i);
  });

  it("patched: multiple system messages join into the channel; assistant turns stay in the prompt", async () => {
    const r = await run(patchedMods, {
      model: "haiku",
      messages: [
        { role: "system", content: "SYS-ONE" },
        { role: "system", content: [{ type: "text", text: "SYS-TWO" }] },
        { role: "user", content: "hi" },
        { role: "assistant", content: "prior" },
        { role: "user", content: "again" },
      ],
    });
    expect(r.appended).toContain("SYS-ONE\n\nSYS-TWO");
    expect(r.stdin).not.toContain("SYS-");
    expect(r.stdin).toContain("<previous_response>\nprior\n</previous_response>");
    expect(r.stdin).toContain("again");
  });

  it("patched: request with no system message appends only the tool mapping", async () => {
    const r = await run(patchedMods, { model: "haiku", messages: [{ role: "user", content: "hi" }] });
    const base = (await run(pristineMods, { model: "haiku", messages: [{ role: "user", content: "hi" }] })).appended;
    expect(r.appended).toBe(base);
    expect(r.cli.systemPrompt).toBeUndefined();
  });

  it("patched: image requests keep stream-json input; system text is not in the user message", async () => {
    const r = await run(patchedMods, {
      model: "haiku",
      messages: [
        { role: "system", content: "IMG-SYS" },
        { role: "user", content: [{ type: "text", text: "look" }, { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } }] },
      ],
    });
    expect(r.argv).toContain("--input-format");
    expect(r.appended).toContain("IMG-SYS");
    const line = JSON.parse(r.stdin.trim());
    const blocks = line.message.content;
    expect(blocks[0].text).toBe("look");
    expect(blocks[1].type).toBe("image");
    expect(r.stdin).not.toContain("IMG-SYS");
  });

  it("patched: OpenClaw tooling sections are still stripped from the system text", async () => {
    const r = await run(patchedMods, {
      model: "haiku",
      messages: [{ role: "system", content: "KEEP-ME\n\n## Tooling\nexec stuff\n\n## Other\nKEEP-TOO" }, { role: "user", content: "x" }],
    });
    expect(r.appended).toContain("KEEP-ME");
    expect(r.appended).toContain("KEEP-TOO");
    expect(r.appended).not.toContain("exec stuff");
  });

  it("kill switch PROXY_SYSTEM_TRANSPORT=legacy restores the old in-prompt behaviour", async () => {
    process.env.PROXY_SYSTEM_TRANSPORT = "legacy";
    const r = await run(patchedMods, req("triage"));
    expect(r.stdin).toContain("<system>");
    expect(r.appended).not.toContain("operating as Triage");
  });

  it("oversize system prompt falls back to legacy loudly instead of overflowing argv", async () => {
    process.env.PROXY_SYSTEM_ARG_MAX_BYTES = "50";
    // limit is read at module load; re-load a fresh copy under the env.
    const fresh = await import(/* @vite-ignore */ pathToFileURL(path.join(patchedDir, "adapter/openai-to-cli.js")).href + "?big=1");
    const cli = fresh.openaiToCli(req("triage"));
    expect(cli.systemPrompt).toBeUndefined();
    expect(cli.prompt).toContain("<system>");
  });

  it("patcher refuses on anchor drift and on double-apply", async () => {
    const { patchFiles } = await import(/* @vite-ignore */ pathToFileURL(path.join(OPS, "apply-system-prompt-transport.mjs")).href);
    const rel = ["adapter/openai-to-cli.js", "subprocess/manager.js", "server/routes.js"];
    const files = Object.fromEntries(rel.map((p) => [p, fs.readFileSync(path.join(pristineDir, p), "utf8")]));
    expect(() => patchFiles({ ...files, "subprocess/manager.js": files["subprocess/manager.js"].replace("--append-system-prompt", "--x") })).toThrow(/anchor/);
    expect(() => patchFiles(patchFiles(files))).toThrow(/already patched/);
  });

  it("routes.js passes systemPrompt at both subprocess.start call sites", () => {
    const r = fs.readFileSync(path.join(patchedDir, "server/routes.js"), "utf8");
    expect((r.match(/systemPrompt: cliInput\.systemPrompt/g) ?? []).length).toBe(2);
  });
});
