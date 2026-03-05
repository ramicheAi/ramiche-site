#!/usr/bin/env node
// ── Bridge Sync Service ─────────────────────────────────────────────
// Runs locally on iMac. Syncs OpenClaw state → Firestore every 60s.
// Listens for Firestore writes (cron CRUD, chat, task approval) and executes locally.
//
// Usage: node scripts/bridge-sync.mjs
// Or: BRIDGE_URL=https://ramiche-site.vercel.app/api/bridge node scripts/bridge-sync.mjs

import { execSync } from "child_process";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const BRIDGE_URL = process.env.BRIDGE_URL || "https://ramiche-site.vercel.app/api/bridge";
const BRIDGE_SECRET = process.env.BRIDGE_API_SECRET || "parallax-bridge-2026";
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || "/Users/admin/.openclaw/workspace";
const SYNC_INTERVAL = 60_000; // 60 seconds

// ── Helpers ──────────────────────────────────────────────────────────

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", timeout: 15_000 }).trim();
  } catch {
    return "";
  }
}

async function pushToFirestore(type, data) {
  try {
    const res = await fetch(BRIDGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bridge-secret": BRIDGE_SECRET,
      },
      body: JSON.stringify({ type, data }),
    });
    if (!res.ok) {
      console.error(`[bridge] push ${type} failed: ${res.status}`);
    }
    return res.ok;
  } catch (e) {
    console.error(`[bridge] push ${type} error:`, e.message);
    return false;
  }
}

// ── Agent Status ─────────────────────────────────────────────────────

function getAgentStatus() {
  // Read directory.json for agent list
  const dirPath = join(WORKSPACE, "agents/directory.json");
  if (!existsSync(dirPath)) return [];

  const dir = JSON.parse(readFileSync(dirPath, "utf8"));
  const agents = Object.entries(dir.agents).map(([name, info]) => ({
    name,
    model: info.model,
    provider: info.provider,
    role: info.role,
    capabilities: (info.capabilities || []).join(", "),
    status: "idle", // Default — will be enriched by session check
  }));

  // Try to get active sessions
  const sessionOutput = run("openclaw sessions list --format json 2>/dev/null || echo '[]'");
  try {
    const sessions = JSON.parse(sessionOutput);
    if (Array.isArray(sessions)) {
      for (const s of sessions) {
        const agent = agents.find(a =>
          s.agentId?.toLowerCase().includes(a.name) ||
          s.label?.toLowerCase().includes(a.name)
        );
        if (agent) {
          agent.status = s.status || "active";
          agent.lastActive = s.lastActive || new Date().toISOString();
        }
      }
    }
  } catch { /* sessions not available */ }

  return agents;
}

// ── Cron Jobs ────────────────────────────────────────────────────────

function getCronJobs() {
  const cronOutput = run("openclaw cron list --json 2>/dev/null || echo '[]'");
  try {
    const parsed = JSON.parse(cronOutput);
    const jobs = parsed.jobs || (Array.isArray(parsed) ? parsed : []);
    return jobs.map(j => ({
      id: j.id,
      name: j.name,
      enabled: j.enabled,
      agent: j.agentId || "atlas",
      schedule: j.schedule?.expr || (j.schedule?.everyMs ? `every ${Math.round(j.schedule.everyMs / 60000)}m` : ""),
      lastRun: j.state?.lastRunStatus || "unknown",
      nextRun: j.state?.nextRunAtMs ? new Date(j.state.nextRunAtMs).toISOString() : "",
    }));
  } catch {
    return [];
  }
}

// ── Activity Feed ────────────────────────────────────────────────────

function getRecentActivity() {
  // Read today's and yesterday's memory logs
  const today = new Date();
  const dates = [
    today.toISOString().slice(0, 10),
    new Date(today - 86400000).toISOString().slice(0, 10),
  ];

  const activities = [];
  for (const date of dates) {
    const logPath = join(WORKSPACE, `memory/${date}.md`);
    if (!existsSync(logPath)) continue;

    const content = readFileSync(logPath, "utf8");
    const entries = content.split(/^## /m).slice(1); // Split by ## headers

    for (const entry of entries.slice(-20)) { // Last 20 entries
      const lines = entry.trim().split("\n");
      const header = lines[0] || "";
      const body = lines.slice(1).join("\n").trim();

      // Extract time from header like "[14:30] Task: ..."
      const timeMatch = header.match(/\[(\d{1,2}:\d{2})\]/);
      activities.push({
        date,
        time: timeMatch ? timeMatch[1] : "",
        title: header.replace(/\[\d{1,2}:\d{2}\]\s*/, ""),
        body: body.slice(0, 200), // Truncate
      });
    }
  }

  return activities.slice(-30); // Last 30 items
}

// ── Projects ─────────────────────────────────────────────────────────

function getProjectStatus() {
  return [
    {
      name: "METTLE",
      status: "beta",
      priority: 1,
      url: "https://ramiche-site.vercel.app/apex-athlete",
      description: "Gamified athlete SaaS - beta with Saint Andrew's Aquatics",
    },
    {
      name: "Parallax Site",
      status: "live",
      priority: 2,
      url: "https://parallax-site-ashen.vercel.app",
      description: "Agent marketplace + Claude Skills",
    },
    {
      name: "Parallax Publish",
      status: "active",
      priority: 3,
      url: "https://parallax-publish.vercel.app",
      description: "Social media publishing - 3 platforms live",
    },
    {
      name: "Ramiche Studio",
      status: "blocked",
      priority: 4,
      url: "https://ramiche-site.vercel.app",
      description: "Creative services - blocked on Stripe key",
    },
    {
      name: "Galactik Antics",
      status: "blocked",
      priority: 5,
      url: "",
      description: "AI art + merch - blocked on Shopify API + art assets",
    },
    {
      name: "ClawGuard Pro",
      status: "live",
      priority: 6,
      url: "https://parallax-site-ashen.vercel.app/clawguard",
      description: "Security scanner - $299/$799/$1499",
    },
    {
      name: "Command Center",
      status: "active",
      priority: 7,
      url: "https://ramiche-site.vercel.app/command-center",
      description: "Operations dashboard - building live data bridge",
    },
  ];
}

// ── Quick Links ──────────────────────────────────────────────────────

function getQuickLinks() {
  return [
    { label: "METTLE", url: "https://ramiche-site.vercel.app/apex-athlete", icon: "trophy" },
    { label: "Parallax Site", url: "https://parallax-site-ashen.vercel.app", icon: "globe" },
    { label: "Parallax Publish", url: "https://parallax-publish.vercel.app", icon: "send" },
    { label: "Command Center", url: "https://ramiche-site.vercel.app/command-center", icon: "terminal" },
    { label: "ClawGuard", url: "https://parallax-site-ashen.vercel.app/clawguard", icon: "shield" },
    { label: "Vercel", url: "https://vercel.com/dashboard", icon: "cloud" },
    { label: "GitHub", url: "https://github.com/ramicheAi", icon: "code" },
    { label: "Firebase", url: "https://console.firebase.google.com/project/apex-athlete-73755", icon: "database" },
  ];
}

// ── Chat Listener ───────────────────────────────────────────────────

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/apex-athlete-73755/databases/(default)/documents`;

async function pollPendingMessages() {
  try {
    // Fetch pending messages from Firestore
    const res = await fetch(
      `${FIRESTORE_BASE}/command-center-chat?pageSize=20`,
      { cache: "no-store" }
    );
    if (!res.ok) return;

    const data = await res.json();
    const docs = data.documents || [];

    for (const doc of docs) {
      const f = doc.fields || {};
      const status = f.status?.stringValue;
      if (status !== "pending") continue;

      const id = f.id?.stringValue;
      const targetAgent = f.targetAgent?.stringValue;
      const message = f.message?.stringValue;
      const sender = f.sender?.stringValue || "ramon";

      if (!targetAgent || !message) continue;

      console.log(`[chat] Routing message ${id} → ${targetAgent}`);

      // Route to agent via OpenClaw sessions send
      let response = "";
      let newStatus = "delivered";
      try {
        const agentKey = targetAgent.toLowerCase().replace(/\s+/g, "-");
        const sendResult = run(
          `openclaw sessions send --to "${agentKey}" --message "${message.replace(/"/g, '\\"')}" 2>&1`
        );
        response = sendResult || "Message delivered to agent session";
      } catch (e) {
        response = `Delivery failed: ${e.message}`;
        newStatus = "failed";
      }

      // Update message status in Firestore
      const updateData = {
        fields: {
          ...Object.fromEntries(
            Object.entries(f).map(([k, v]) => [k, v])
          ),
          status: { stringValue: newStatus },
          response: { stringValue: response },
          deliveredAt: { stringValue: new Date().toISOString() },
        },
      };

      await fetch(`${FIRESTORE_BASE}/command-center-chat/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      console.log(`[chat] ${id} → ${newStatus}`);
    }
  } catch (e) {
    console.error("[chat] poll error:", e.message);
  }
}

// ── Main Sync Loop ───────────────────────────────────────────────────

async function syncAll() {
  const timestamp = new Date().toISOString();
  console.log(`[bridge] sync started at ${timestamp}`);

  const agents = getAgentStatus();
  const crons = getCronJobs();
  const activity = getRecentActivity();
  const projects = getProjectStatus();
  const links = getQuickLinks();

  const results = await Promise.all([
    pushToFirestore("agents", { items: agents, count: agents.length, lastSync: timestamp }),
    pushToFirestore("crons", { items: crons, count: crons.length, lastSync: timestamp }),
    pushToFirestore("activity", { items: activity, count: activity.length, lastSync: timestamp }),
    pushToFirestore("projects", { items: projects, count: projects.length, lastSync: timestamp }),
    pushToFirestore("links", { items: links, count: links.length, lastSync: timestamp }),
  ]);

  const ok = results.filter(Boolean).length;
  console.log(`[bridge] synced ${ok}/${results.length} collections`);

  // Poll for pending chat messages and route to agents
  await pollPendingMessages();
}

// ── Start ────────────────────────────────────────────────────────────

console.log("[bridge] Command Center Bridge Sync starting...");
console.log(`[bridge] URL: ${BRIDGE_URL}`);
console.log(`[bridge] Workspace: ${WORKSPACE}`);
console.log(`[bridge] Interval: ${SYNC_INTERVAL / 1000}s`);

// Initial sync
await syncAll();

// Periodic sync
setInterval(syncAll, SYNC_INTERVAL);

console.log("[bridge] Running. Press Ctrl+C to stop.");
