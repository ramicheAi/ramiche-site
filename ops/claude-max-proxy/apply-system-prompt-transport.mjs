#!/usr/bin/env node
// Offline patcher for claude-max-api-proxy (v1.0.0 + local vision patch).
// Delivers OpenAI "system" messages through the Claude Code CLI's real system
// prompt channel (--append-system-prompt) instead of <system> text in the user
// prompt. Usage: node apply-system-prompt-transport.mjs <dist-dir> [--check]
// Never touches a live install unless you point it at one. Fails loud when an
// anchor is missing (proxy version drift) and is idempotent via MARKER.
import fs from "node:fs";
import path from "node:path";

export const MARKER = "[parallax-system-transport]";

const NEW_OPENAI_TO_CLI = `export function openaiToCli(request) {
    // ${MARKER} system messages travel on the CLI system-prompt channel.
    const images = extractImages(request.messages);
    const model = extractModel(request.model);
    const split = splitSystemTransport(request.messages);
    const textPrompt = messagesToPrompt(split.messages);
    const systemPrompt = split.systemPrompt;
    if (images.length > 0) {
        const streamMsg = {
            type: "user",
            message: { role: "user", content: [{ type: "text", text: textPrompt }, ...images] },
        };
        return {
            prompt: JSON.stringify(streamMsg) + "\\n",
            ...(systemPrompt ? { systemPrompt } : {}),
            model,
            sessionId: request.user,
            streamJson: true,
        };
    }
    return {
        prompt: textPrompt,
        ...(systemPrompt ? { systemPrompt } : {}),
        model,
        sessionId: request.user, // Use OpenAI's user field for session mapping
    };
}
`;

const HELPERS = `// ${MARKER}
// Max bytes of system text passed as a single argv entry. Linux caps one arg at
// 128 KiB; macOS ARG_MAX is 1 MiB total (argv + env). Over the cap the request
// FAILS CLOSED (explicit error, nothing is sent to Claude): embedding system text
// in the user prompt would silently reintroduce the identity defect.
const SYSTEM_ARG_MAX_BYTES = Number(process.env.PROXY_SYSTEM_ARG_MAX_BYTES) || 100000;
/**
 * Split system messages out of the conversation. Returns the remaining
 * messages (user/assistant only) and the joined, tooling-stripped system text.
 * Only the explicit emergency switch PROXY_SYSTEM_TRANSPORT=legacy keeps the old
 * in-prompt behaviour. An oversize system prompt throws (never downgrades).
 */
export function splitSystemTransport(messages) {
    if (process.env.PROXY_SYSTEM_TRANSPORT === "legacy") {
        return { systemPrompt: "", messages };
    }
    const systemTexts = [];
    const rest = [];
    for (const msg of messages) {
        if (msg.role === "system") {
            const t = stripOpenClawTooling(extractText(msg.content));
            if (t) systemTexts.push(t);
        }
        else {
            rest.push(msg);
        }
    }
    const systemPrompt = systemTexts.join("\\n\\n");
    if (Buffer.byteLength(systemPrompt, "utf8") > SYSTEM_ARG_MAX_BYTES) {
        const err = new Error("system_prompt_too_large: system context is " + Buffer.byteLength(systemPrompt, "utf8") +
            " bytes, limit " + SYSTEM_ARG_MAX_BYTES + "; request refused (no legacy fallback)");
        err.code = "system_prompt_too_large";
        throw err;
    }
    return { systemPrompt, messages: rest };
}
`;

function replaceOnce(src, from, to, label) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`anchor "${label}" matched ${n} times (expected 1): proxy version drift, refusing to patch`);
  return src.replace(from, () => to);
}

export function patchFiles(files) {
  const out = { ...files };
  for (const [k, v] of Object.entries(files)) {
    if (v.includes(MARKER)) throw new Error(`${k} already patched`);
  }
  // 1. openai-to-cli.js
  let a = files["adapter/openai-to-cli.js"];
  const start = a.indexOf("export function openaiToCli(request) {");
  const mapAt = a.indexOf("//# sourceMappingURL");
  const end = mapAt < 0 ? a.length : mapAt;
  if (start < 0 || end < start) throw new Error("openaiToCli anchor missing");
  a = a.slice(0, start) + HELPERS + "/**\n * Convert OpenAI chat request to CLI input (system text separated). " + MARKER + "\n */\n" + NEW_OPENAI_TO_CLI + a.slice(end);
  out["adapter/openai-to-cli.js"] = a;
  // 2. manager.js
  out["subprocess/manager.js"] = replaceOnce(
    files["subprocess/manager.js"],
    `            "--append-system-prompt",\n            OPENCLAW_TOOL_MAPPING_PROMPT,\n`,
    `            "--append-system-prompt", // ${MARKER} single flag: tool mapping + caller system text\n            options.systemPrompt\n                ? OPENCLAW_TOOL_MAPPING_PROMPT + "\\n\\n" + options.systemPrompt\n                : OPENCLAW_TOOL_MAPPING_PROMPT,\n`,
    "manager append-system-prompt",
  );
  out["subprocess/manager.js"] = replaceOnce(
    out["subprocess/manager.js"],
    `        if (options.streamJson) {\n`,
    `        // ${MARKER} isolate this invocation from host personalization (CLAUDE.md, hooks,\n        // MCP, user skills/commands). Auth and built-in system prompt are unaffected.\n        // Emergency off-switch: PROXY_CLI_ISOLATION=off.\n        if (process.env.PROXY_CLI_ISOLATION !== "off") {\n            args.push("--safe-mode");\n        }\n        if (options.streamJson) {\n`,
    "manager streamJson block",
  );
  // 3. routes.js (two call sites)
  let r = files["server/routes.js"];
  const from = `sessionId: cliInput.sessionId,\n            streamJson: cliInput.streamJson,`;
  const n = r.split(from).length - 1;
  if (n !== 2) throw new Error(`routes call sites matched ${n} (expected 2)`);
  r = r.split(from).join(`systemPrompt: cliInput.systemPrompt, // ${MARKER}\n            ${from}`);
  out["server/routes.js"] = r;
  return out;
}

const REL = ["adapter/openai-to-cli.js", "subprocess/manager.js", "server/routes.js"];

if (import.meta.url === `file://${process.argv[1]}`) {
  const dist = process.argv[2];
  if (!dist) { console.error("usage: apply-system-prompt-transport.mjs <dist-dir> [--check]"); process.exit(2); }
  const files = Object.fromEntries(REL.map((p) => [p, fs.readFileSync(path.join(dist, p), "utf8")]));
  if (process.argv.includes("--check")) {
    const patched = REL.every((p) => files[p].includes(MARKER));
    console.log(patched ? "patched" : "not patched");
    process.exit(patched ? 0 : 1);
  }
  const out = patchFiles(files);
  for (const p of REL) {
    fs.writeFileSync(path.join(dist, p + ".pre-system-transport.bak"), files[p]);
    fs.writeFileSync(path.join(dist, p), out[p]);
  }
  console.log("patched " + REL.length + " files in " + dist);
}
