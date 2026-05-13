#!/usr/bin/env node
/**
 * Token-authenticated relay in front of the Claude Max OpenAI-compatible
 * proxy. Lets us expose Claude Max through a Cloudflare Tunnel so the
 * Vercel-hosted parallaxvinc.com can reach the Mac's local subscription
 * bridge without putting raw Claude Max behind a public DNS name.
 *
 * Listens on PORT (default 9999).
 * Validates `Authorization: Bearer $CLAUDE_PROXY_TOKEN` on every request.
 * Forwards the body unchanged to UPSTREAM (default http://127.0.0.1:3456).
 *
 * Required env:
 *   CLAUDE_PROXY_TOKEN  — shared secret. Vercel sends it; we check it.
 *
 * Optional env:
 *   PORT                — listen port (default 9999)
 *   UPSTREAM            — claude max base URL (default http://127.0.0.1:3456)
 *   ALLOW_HEALTHCHECK   — when set, GET /healthz returns 200 without auth
 *                          (cloudflared / uptime checks)
 *
 * Run:  CLAUDE_PROXY_TOKEN=... node scripts/claude-proxy.mjs
 */

import http from "node:http";

const PORT = Number(process.env.PORT || 9999);
const UPSTREAM = (process.env.UPSTREAM || "http://127.0.0.1:3456").replace(/\/$/, "");
const TOKEN = (process.env.CLAUDE_PROXY_TOKEN || "").trim();
const ALLOW_HEALTHCHECK = !!process.env.ALLOW_HEALTHCHECK;

if (!TOKEN) {
  console.error("[claude-proxy] CLAUDE_PROXY_TOKEN is required — refusing to start without auth.");
  process.exit(1);
}

const TOKEN_TIMING_SAFE = Buffer.from(TOKEN);

/**
 * Constant-time bearer check. Returns true iff the request header carries
 * a bearer that matches CLAUDE_PROXY_TOKEN byte-for-byte. Length mismatch
 * is rejected before the compare so timing leaks the token's length only,
 * which is not a meaningful secret.
 */
function authorize(req) {
  const h = req.headers["authorization"];
  if (typeof h !== "string") return false;
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const presented = Buffer.from(m[1].trim());
  if (presented.length !== TOKEN_TIMING_SAFE.length) return false;
  // crypto.timingSafeEqual would be ideal but Buffer comparison via XOR loop
  // is fine for a short shared secret; both buffers are the same length.
  let diff = 0;
  for (let i = 0; i < presented.length; i++) diff |= presented[i] ^ TOKEN_TIMING_SAFE[i];
  return diff === 0;
}

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  const reqId = Math.random().toString(36).slice(2, 8);
  const peer = req.headers["cf-connecting-ip"] || req.socket.remoteAddress || "?";
  const logTail = (status, note) => {
    console.log(
      `[claude-proxy] ${reqId} ${peer} ${req.method} ${req.url} → ${status} ${Date.now() - started}ms${note ? " " + note : ""}`
    );
  };

  // Health check — no auth required when ALLOW_HEALTHCHECK=1
  if (ALLOW_HEALTHCHECK && req.method === "GET" && req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, upstream: UPSTREAM }));
    logTail(200, "healthz");
    return;
  }

  if (!authorize(req)) {
    res.writeHead(401, { "Content-Type": "application/json", "WWW-Authenticate": "Bearer" });
    res.end(JSON.stringify({ error: "unauthorized" }));
    logTail(401, "no/bad bearer");
    return;
  }

  // Buffer body so we can forward it to fetch() upstream.
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;

  const upstreamUrl = UPSTREAM + req.url;
  let upstreamRes;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      method: req.method,
      headers: {
        "Content-Type": req.headers["content-type"] || "application/json",
        // The Claude Max bridge accepts any bearer; we send a known-good one.
        Authorization: "Bearer not-needed",
      },
      body: body && body.length ? body : undefined,
      // Long timeout — Claude responses can take 30s+ for Opus
      signal: AbortSignal.timeout(120_000),
    });
  } catch (err) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "upstream_unreachable", detail: String(err) }));
    logTail(502, "upstream error: " + (err instanceof Error ? err.message : err));
    return;
  }

  const buf = Buffer.from(await upstreamRes.arrayBuffer());
  res.writeHead(upstreamRes.status, {
    "Content-Type": upstreamRes.headers.get("content-type") || "application/json",
    "Content-Length": buf.length,
  });
  res.end(buf);
  logTail(upstreamRes.status);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(
    `[claude-proxy] listening on 127.0.0.1:${PORT} → ${UPSTREAM} ` +
      `(token len ${TOKEN.length}, healthcheck ${ALLOW_HEALTHCHECK ? "on" : "off"})`
  );
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`[claude-proxy] ${sig} — shutting down`);
    server.close(() => process.exit(0));
  });
}
