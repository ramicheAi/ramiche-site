#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════
   SYNTHETIC OPENCLAW GATEWAY (POST /tools/invoke)

   The product dispatches agent turns to an OpenClaw gateway. A test must never
   reach a real agent: this stub answers sessions_send with a fixed reply and
   records every invocation, so a test can prove the app really dispatched (and
   how many times) without an agent executing anything.

   It refuses to start if OPENCLAW_GATEWAY_URL looks like a real gateway host.
   ══════════════════════════════════════════════════════════════ */
import { createServer } from "node:http";

const PORT = Number(process.env.E2E_FAKE_GATEWAY_PORT ?? 54330);
const real = process.env.OPENCLAW_GATEWAY_URL ?? "";
if (real && !/127\.0\.0\.1|localhost/.test(real)) {
  console.error(`[fake-gateway] REFUSING: OPENCLAW_GATEWAY_URL points elsewhere (${real})`);
  process.exit(1);
}

const invocations = [];
/* Behaviour switch so a journey can drive a real failure through the real route:
   ok (default) | slow (E2E_GATEWAY_DELAY_MS) | error (HTTP 500) | noreply (accepted, no text) */
let mode = "ok";
let delayMs = Number(process.env.E2E_GATEWAY_DELAY_MS ?? 0);
const server = createServer((req, res) => {
  if (req.url === "/__e2e/state") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ invocations, mode, delayMs }));
    return;
  }
  if (req.url === "/__e2e/mode" && req.method === "POST") {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        const b = JSON.parse(raw || "{}");
        if (typeof b.mode === "string") mode = b.mode;
        if (typeof b.delayMs === "number") delayMs = b.delayMs;
      } catch { /* keep previous */ }
      res.writeHead(204).end();
    });
    return;
  }
  if (req.url === "/__e2e/reset" && req.method === "POST") {
    invocations.length = 0;
    mode = "ok";
    delayMs = Number(process.env.E2E_GATEWAY_DELAY_MS ?? 0);
    res.writeHead(204).end();
    return;
  }
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    let body = {};
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      /* ignore */
    }
    invocations.push({ at: Date.now(), tool: body.tool, args: body.args ?? null });
    if (mode === "error") {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "e2e injected gateway failure" }));
      return;
    }
    setTimeout(() => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          result: {
            /* Shape the app's extractSessionsSendReply understands. */
            reply:
              mode === "noreply"
                ? ""
                : process.env.E2E_AGENT_REPLY ?? "Synthetic agent reply from the e2e gateway.",
          },
        }),
      );
    }, delayMs);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[fake-gateway] listening on http://127.0.0.1:${PORT}`);
});
