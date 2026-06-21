#!/usr/bin/env node
/**
 * Firestore Sync — MERIDIAN / SIMONS quant snapshot (standalone cron entry)
 *
 * Run nightly by the system crontab (3:05 AM):
 *   cd /Users/admin/ramiche-site && node scripts/firestore-sync-rest.mjs
 *
 * Standalone replica of `syncMeridian()` in
 * src/app/api/command-center/firestore-sync/route.ts — so the nightly push
 * works without the Next.js server running or a tunnel open. Reads the SIMONS
 * pipeline output `dashboard_api.json` from the shared workspace and writes it
 * verbatim (as a `snapshot` string) to Firestore doc `command-center/meridian`,
 * the exact same shape `GET /api/command-center/meridian` and
 * `fetchMeridianDashboardFromFirestore()` read back.
 *
 * Auth: Firebase Admin via FIREBASE_SERVICE_ACCOUNT (JSON string), the same
 * credential `src/lib/firebase-admin.ts` uses. Loaded from .env.local the same
 * way the other bridge scripts do (scripts/chat-bridge.mjs).
 *
 * Exit codes: 0 on success, non-zero on any failure. Fails LOUD — never
 * reports success it didn't achieve.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));

/* ── Logging ────────────────────────────────────────────────────────── */

function log(msg) {
  console.log(`[firestore-sync-rest] ${new Date().toISOString()} ${msg}`);
}
function fail(msg, err) {
  console.error(`[firestore-sync-rest] ${new Date().toISOString()} ERROR: ${msg}`);
  if (err) console.error(err instanceof Error ? err.stack || err.message : String(err));
  process.exit(1);
}

/* ── Load .env.local (same approach as scripts/chat-bridge.mjs) ──────── */
// Only fills vars that aren't already set, so a real shell/CI env wins.

function loadEnv() {
  const envPath = resolve(__dirname, "../.env.local");
  if (!existsSync(envPath)) {
    log(`no .env.local at ${envPath} (relying on process env)`);
    return;
  }
  try {
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (!match) continue;
      const key = match[1].trim();
      let val = match[2].trim();
      // strip a single layer of surrounding quotes if present
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
    log(`loaded env from ${envPath}`);
  } catch (e) {
    // env load failure is not fatal on its own; the missing-var check below is.
    log(`could not read ${envPath}: ${String(e)}`);
  }
}

/* ── Resolve the MERIDIAN snapshot path (mirrors the route) ──────────── */
// route.ts: WS = OPENCLAW_WORKSPACE ?? "/Users/admin/.openclaw/workspace",
//           MERIDIAN_JSON_PATH = WS/shared/artifacts/quantitative/dashboard_api.json

function meridianPath() {
  const ws = process.env.OPENCLAW_WORKSPACE?.trim() || "/Users/admin/.openclaw/workspace";
  return join(ws, "shared", "artifacts", "quantitative", "dashboard_api.json");
}

/* ── Firebase Admin (same credential as src/lib/firebase-admin.ts) ───── */

function getDb() {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) {
    fail(
      "FIREBASE_SERVICE_ACCOUNT not set. Add it to ramiche-site/.env.local " +
        "(the same JSON service-account string the app uses) or export it in the cron environment."
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(sa);
  } catch (e) {
    fail("FIREBASE_SERVICE_ACCOUNT is not valid JSON.", e);
  }
  try {
    const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(parsed) });
    return getFirestore(app);
  } catch (e) {
    fail("Firebase Admin init failed.", e);
  }
}

/* ── Sync ───────────────────────────────────────────────────────────── */
// Byte-for-byte the same write `syncMeridian()` performs.

async function main() {
  loadEnv();

  const path = meridianPath();
  log(`reading MERIDIAN snapshot from ${path}`);
  if (!existsSync(path)) {
    fail(
      `MERIDIAN snapshot not found at ${path}. ` +
        "The SIMONS pipeline must write dashboard_api.json before this sync runs " +
        "(or set OPENCLAW_WORKSPACE to the correct workspace)."
    );
  }

  let rawFile;
  try {
    rawFile = readFileSync(path, "utf-8");
  } catch (e) {
    fail(`could not read ${path}`, e);
  }

  // The SIMONS pipeline (Python json.dump, allow_nan=True default) emits the
  // bareword tokens Infinity / -Infinity / NaN — valid for Python's json but
  // NOT valid JSON, so both JSON.parse here AND the read-back in
  // meridian/route.ts reject the file. Normalize those tokens to null so the
  // stored snapshot is real, parseable JSON (e.g. risk.expected_remaining_days:
  // Infinity -> null). Only rewrites bareword tokens in value position; never
  // touches string contents like "Infinity Loop".
  const raw = rawFile.replace(/(:\s*)(-?Infinity|NaN)(\s*[,}\]])/g, "$1null$3");
  if (raw !== rawFile) {
    log("normalized non-standard JSON tokens (Infinity/NaN -> null) from the pipeline output");
  }

  // sanity check it parses + has the expected shape (don't push garbage)
  try {
    const parsed = JSON.parse(raw);
    const equity = parsed?.portfolio?.equity;
    if (typeof equity !== "number") {
      fail(`snapshot at ${path} is missing portfolio.equity (got ${typeof equity}); refusing to sync.`);
    }
    log(
      `snapshot ok: equity=${equity} return=${parsed?.portfolio?.total_return_pct ?? "?"}% ` +
        `positions=${parsed?.portfolio?.position_count ?? parsed?.portfolio?.positions?.length ?? "?"} ` +
        `generated_at=${parsed?.generated_at ?? "?"}`
    );
  } catch (e) {
    fail(`snapshot at ${path} is not valid JSON; refusing to sync.`, e);
  }

  // Firestore enforces a 1 MiB max document size; refuse before write (same guard as the route).
  const FIRESTORE_DOC_LIMIT = 900_000;
  const bytes = Buffer.byteLength(raw, "utf-8");
  if (bytes > FIRESTORE_DOC_LIMIT) {
    fail(`meridian snapshot is ${bytes} bytes, over the ${FIRESTORE_DOC_LIMIT}-byte Firestore doc limit; refusing to sync.`);
  }
  log(`snapshot size ${bytes} bytes (under ${FIRESTORE_DOC_LIMIT} limit)`);

  const db = getDb();
  log("writing to Firestore doc command-center/meridian ...");
  try {
    await db.collection("command-center").doc("meridian").set(
      {
        snapshot: raw,
        _syncedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    fail("Firestore write to command-center/meridian failed.", e);
  }

  log("SUCCESS — command-center/meridian updated.");
  process.exit(0);
}

main().catch((e) => fail("unexpected failure", e));
