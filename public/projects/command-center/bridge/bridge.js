#!/usr/bin/env node
/**
 * Command Center Bridge Service
 * Polls OpenClaw CLI → writes to Firestore → UI reads via onSnapshot
 *
 * Collections written:
 *   command_center_agents   — per-agent status docs
 *   command_center_crons    — cron job list
 *   command_center_activity — last 100 events (ring buffer)
 *
 * Usage:
 *   node bridge.js          — continuous sync (every 30s)
 *   node bridge.js --once   — single sync then exit
 */

const { execSync } = require("child_process");
const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  doc,
  setDoc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  deleteDoc,
  serverTimestamp,
} = require("firebase/firestore");

// ── Firebase init ──
const app = initializeApp({
  projectId: "apex-athlete-73755",
  appId: "1:840367715029:web:ad98e8de737958fa76285c",
  apiKey: "AIzaSyCM-bxw5yIdrLYeAZ1PfUmnoy-9tBBhiVY",
  authDomain: "apex-athlete-73755.firebaseapp.com",
});
const db = getFirestore(app);

// ── Helpers ──
function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf-8", timeout: 15000 }).trim();
  } catch (e) {
    console.error(`CMD FAILED: ${cmd}\n${e.message}`);
    return null;
  }
}

function safeJson(str) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// ── Agent Status Sync ──
async function syncAgentStatus() {
  console.log("[bridge] Syncing agent status...");

  // Read directory.json for agent registry
  const fs = require("fs");
  const dirPath = "/Users/admin/.openclaw/workspace/agents/directory.json";
  let directory;
  try {
    directory = JSON.parse(fs.readFileSync(dirPath, "utf-8"));
  } catch (e) {
    console.error("Failed to read directory.json:", e.message);
    return 0;
  }

  const agents = directory.agents || {};
  let synced = 0;

  for (const [id, config] of Object.entries(agents)) {
    const agentDoc = {
      agentId: id,
      name: config.name || id,
      model: config.model || "unknown",
      role: config.role || "",
      status: config.killSwitch ? "killed" : "idle",
      guardrails: {
        maxSpend: config.guardrails?.maxDailySpend || null,
        killSwitch: config.killSwitch || false,
        approvalRequired: config.guardrails?.humanApprovalRequired || [],
      },
      skills: config.skills || [],
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, "command_center_agents", id), agentDoc, { merge: true });
    synced++;
  }

  // Also check for active sessions
  const sessionsRaw = run("openclaw sessions list --json 2>/dev/null");
  const sessions = safeJson(sessionsRaw);
  if (sessions && Array.isArray(sessions)) {
    for (const sess of sessions) {
      const agentId = sess.agent || sess.agentId;
      if (agentId && agents[agentId]) {
        await setDoc(
          doc(db, "command_center_agents", agentId),
          {
            status: sess.status === "running" ? "active" : "idle",
            activeSession: sess.id || null,
            lastActive: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    }
  }

  console.log(`[bridge] Synced ${synced} agents`);
  return synced;
}

// ── Cron Sync ──
async function syncCrons() {
  console.log("[bridge] Syncing crons...");

  const cronRaw = run("openclaw cron list --json 2>/dev/null");
  const cronData = safeJson(cronRaw);
  const crons = cronData?.jobs || (Array.isArray(cronData) ? cronData : null);
  if (!crons || !Array.isArray(crons)) {
    console.log("[bridge] No crons found or parse failed");
    return 0;
  }

  let synced = 0;
  for (const cron of crons) {
    const scheduleStr = cron.schedule?.kind === "every"
      ? `every ${Math.round((cron.schedule.everyMs || 0) / 60000)}m`
      : cron.schedule?.cron || JSON.stringify(cron.schedule || "");
    const cronDoc = {
      cronId: cron.id,
      name: cron.name || "unnamed",
      schedule: scheduleStr,
      agent: cron.payload?.agentId || "main",
      model: cron.payload?.model || "",
      enabled: cron.enabled !== false,
      status: cron.enabled ? "active" : "disabled",
      sessionTarget: cron.sessionTarget || "isolated",
      updatedAt: new Date().toISOString(),
    };

    const docId = (cron.id || cron.cronId || `cron-${synced}`).toString();
    await setDoc(doc(db, "command_center_crons", docId), cronDoc, { merge: true });
    synced++;
  }

  console.log(`[bridge] Synced ${synced} crons`);
  return synced;
}

// ── Activity Feed ──
const MAX_ACTIVITY = 100;

async function logActivity(type, data) {
  await addDoc(collection(db, "command_center_activity"), {
    type,
    data,
    timestamp: new Date().toISOString(),
    createdAt: serverTimestamp(),
  });

  // Trim to MAX_ACTIVITY
  const snap = await getDocs(
    query(collection(db, "command_center_activity"), orderBy("createdAt", "asc"))
  );
  if (snap.size > MAX_ACTIVITY) {
    const excess = snap.size - MAX_ACTIVITY;
    let deleted = 0;
    for (const d of snap.docs) {
      if (deleted >= excess) break;
      await deleteDoc(d.ref);
      deleted++;
    }
    console.log(`[bridge] Trimmed ${deleted} old activity entries`);
  }
}

// ── Main Sync ──
async function syncAll() {
  const start = Date.now();
  console.log(`\n[bridge] ─── Sync cycle @ ${new Date().toISOString()} ───`);

  const agentCount = await syncAgentStatus();
  const cronCount = await syncCrons();

  await logActivity("sync_complete", {
    agents: agentCount,
    crons: cronCount,
    durationMs: Date.now() - start,
  });

  console.log(`[bridge] Done in ${Date.now() - start}ms`);
}

// ── Entry ──
async function main() {
  const once = process.argv.includes("--once");

  console.log("[bridge] Command Center Bridge v1.0");
  console.log(`[bridge] Mode: ${once ? "single sync" : "continuous (30s interval)"}`);
  console.log("[bridge] Firestore: apex-athlete-73755");

  await syncAll();

  if (once) {
    console.log("[bridge] Single sync complete. Exiting.");
    process.exit(0);
  }

  // Continuous mode
  setInterval(syncAll, 30000);
  console.log("[bridge] Running. Ctrl+C to stop.");
}

main().catch((err) => {
  console.error("[bridge] Fatal:", err.message);
  process.exit(1);
});
