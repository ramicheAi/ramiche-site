#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════
   E2E STACK BOOT

   Starts, from nothing:
     1. the synthetic Supabase (in-memory PostgREST subset)
     2. the synthetic OpenClaw gateway (fixed agent replies)
     3. the real Next app, with every external dependency pointed at 1 and 2

   Nothing here touches production. Before a single process starts, the
   environment is checked and the boot REFUSES if any of it could reach a real
   service. That refusal is the isolation guarantee: a harness that cannot prove
   isolation must fail closed, not run anyway.

   Usage: node e2e/boot.mjs [--print-env]
   It stays in the foreground and prints READY=<url> once the app answers.
   ══════════════════════════════════════════════════════════════ */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

const APP_PORT = Number(process.env.E2E_APP_PORT ?? 54331);
const SB_PORT = Number(process.env.E2E_FAKE_SUPABASE_PORT ?? 54329);
const GW_PORT = Number(process.env.E2E_FAKE_GATEWAY_PORT ?? 54330);
const BASE = `http://127.0.0.1:${APP_PORT}`;

const OWNER_UID = "e2e-owner";
const UNLOCK_SECRET = "e2e-unlock-signing-secret-0123456789abcdef";

/* ── 1. prove isolation before anything starts ─────────────────────────── */
function refuse(msg) {
  console.error(`[boot] REFUSING TO START: ${msg}`);
  process.exit(1);
}

for (const [k, v] of Object.entries(process.env)) {
  if (!v) continue;
  if (!/SUPABASE|OPENCLAW|FIREBASE|VERCEL|PARALLAX/i.test(k)) continue;
  if (/supabase\.co|supabase\.in|openclaw\.ai|firebaseio\.com|vercel\.app/i.test(v)) {
    refuse(`${k} points at a hosted service (${v}). Unset it: this harness must not reach production.`);
  }
}
if (process.env.VERCEL) refuse("VERCEL is set: this looks like a deployed environment, not a workstation.");
if (process.env.NODE_ENV === "production") refuse("NODE_ENV=production: the acceptance harness runs a dev build only.");

const env = {
  ...process.env,
  // Real app, fake externals.
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${SB_PORT}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "e2e-service-role-key",
  PARALLAX_OWNER_UID: OWNER_UID,
  CC_UNLOCK_SIGNING_SECRET: UNLOCK_SECRET,
  OPENCLAW_GATEWAY_URL: `http://127.0.0.1:${GW_PORT}`,
  OPENCLAW_GATEWAY_TOKEN: "e2e-gateway-token",
  OPENCLAW_CHAT_PRIMARY: "1",
  OPENCLAW_CHAT_STRICT: "1",
  E2E_FAKE_SUPABASE_PORT: String(SB_PORT),
  E2E_FAKE_GATEWAY_PORT: String(GW_PORT),
  // Keep the dev server quiet and local.
  NEXT_TELEMETRY_DISABLED: "1",
  SENTRY_DSN: "",
  NEXT_PUBLIC_SENTRY_DSN: "",
};
// Firebase admin must never initialise against a real project.
delete env.FIREBASE_SERVICE_ACCOUNT;

if (process.argv.includes("--print-env")) {
  console.log(JSON.stringify({ OWNER_UID, UNLOCK_SECRET, SB_PORT, GW_PORT, APP_PORT }, null, 2));
}

/* ── 1b. refuse if anything already owns our ports ──────────────────────
   A stale stack that still answers on the app port makes waitFor succeed against the WRONG build,
   which silently invalidates every result. Prove the ports are ours to take before starting. */
import { createServer } from "node:net";
const portFree = (port) =>
  new Promise((resolve) => {
    const srv = createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, "127.0.0.1");
  });
for (const [name, port] of [["fake-supabase", SB_PORT], ["fake-gateway", GW_PORT], ["app", APP_PORT]]) {
  if (!(await portFree(port))) refuse(`port ${port} (${name}) is already in use. Stop the stale stack first: pkill -f "e2e/support/fake-"; pkill -f "next start"`);
}

/* ── 2. start everything ──────────────────────────────────────────────── */
const procs = [];
function start(name, cmd, args, extraEnv = {}) {
  const child = spawn(cmd, args, {
    env: { ...env, ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (b) => process.stdout.write(`[${name}] ${b}`));
  child.stderr.on("data", (b) => process.stderr.write(`[${name}!] ${b}`));
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) console.error(`[${name}] exited with ${code}`);
  });
  procs.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const p of procs) {
    try { p.kill("SIGTERM"); } catch { /* already gone */ }
  }
  setTimeout(() => process.exit(code), 300);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

start("fake-supabase", process.execPath, ["e2e/support/fake-supabase.mjs"]);
start("fake-gateway", process.execPath, ["e2e/support/fake-gateway.mjs"]);
// Production build by default: `next dev` on this Node/Next combination never hydrates the client
// (server-rendered HTML only), which would make every browser journey meaningless. The build is
// produced separately by `npm run e2e:build`; this starts the built app.
const APP_MODE = process.env.E2E_APP_MODE ?? "prod";
start(
  "next",
  process.execPath,
  ["node_modules/next/dist/bin/next", APP_MODE === "dev" ? "dev" : "start", ...(APP_MODE === "dev" ? ["--webpack"] : []), "-p", String(APP_PORT)],
  {},
);

async function waitFor(url, label, timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return true;
    } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error(`${label} did not become reachable at ${url} within ${timeoutMs}ms`);
}

try {
  await waitFor(`http://127.0.0.1:${SB_PORT}/__e2e/state`, "fake-supabase", 10_000);
  await waitFor(`http://127.0.0.1:${GW_PORT}/__e2e/state`, "fake-gateway", 10_000);
  // The chat page is the surface under test; if it does not compile, the harness must not pretend
  // to be running.
  await waitFor(`${BASE}/command-center/chat`, "next app");
  console.log(`READY=${BASE}`);
  console.log(`OWNER_UID=${OWNER_UID}`);
  console.log(`UNLOCK_SECRET=${UNLOCK_SECRET}`);
} catch (e) {
  console.error(`[boot] ${e.message}`);
  shutdown(1);
}
