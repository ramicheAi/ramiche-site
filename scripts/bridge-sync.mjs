#!/usr/bin/env node
// ── Bridge Sync Service ─────────────────────────────────────────────
// Runs locally on iMac. Syncs OpenClaw state → Firestore every 60s.
// Listens for Firestore writes (cron CRUD, chat, task approval) and executes locally.
//
// Usage: node scripts/bridge-sync.mjs
// Or: BRIDGE_URL=https://ramiche-site.vercel.app/api/bridge node scripts/bridge-sync.mjs

import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
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

// Display metadata for agents (colors, icons, descriptions)
const AGENT_DISPLAY = {
  atlas:       { color: "#C9A84C", icon: "🧭", label: "Atlas", desc: "Operations Lead — orchestrates 19 agents, memory, mission control" },
  themaestro:  { color: "#f59e0b", icon: "🎵", label: "TheMAESTRO", desc: "Music Production — Ye + Quincy + Babyface creative direction" },
  simons:      { color: "#22d3ee", icon: "📊", label: "SIMONS", desc: "Data analysis, pattern recognition, pricing models" },
  "dr-strange":{ color: "#a855f7", icon: "🔮", label: "Dr. Strange", desc: "Scenario analysis, strategic foresight, risk assessment" },
  shuri:       { color: "#34d399", icon: "⚡", label: "SHURI", desc: "Creative coding, design systems, rapid builds" },
  widow:       { color: "#ef4444", icon: "🕷", label: "Widow", desc: "Cybersecurity, threat monitoring, security audits" },
  proximon:    { color: "#f97316", icon: "🏗", label: "PROXIMON", desc: "Systems architecture, infrastructure design" },
  vee:         { color: "#ec4899", icon: "📣", label: "Vee", desc: "Brand strategy, marketing, positioning" },
  aetherion:   { color: "#818cf8", icon: "🌀", label: "Aetherion", desc: "Creative Director — image gen, animation, visual identity" },
  michael:     { color: "#06b6d4", icon: "🏊", label: "MICHAEL", desc: "Swim coaching, race strategy, athlete development" },
  selah:       { color: "#fb923c", icon: "🧠", label: "SELAH", desc: "Psychology, mental performance, mindset coaching" },
  prophets:    { color: "#d4a574", icon: "📜", label: "Prophets", desc: "Spiritual counsel, wisdom, scripture" },
  mercury:     { color: "#fbbf24", icon: "💰", label: "MERCURY", desc: "Sales strategy, pricing, revenue modeling" },
  echo:        { color: "#14b8a6", icon: "📡", label: "ECHO", desc: "Community engagement, social interaction" },
  haven:       { color: "#a3e635", icon: "🏠", label: "HAVEN", desc: "Support automation, onboarding systems" },
  ink:         { color: "#f472b6", icon: "✍️", label: "INK", desc: "Copywriting, content generation" },
  kiyosaki:    { color: "#facc15", icon: "📈", label: "KIYOSAKI", desc: "Financial analysis, capital strategy" },
  nova:        { color: "#7dd3fc", icon: "🌟", label: "NOVA", desc: "Overnight builds, 3D design, fabrication" },
  triage:      { color: "#fb7185", icon: "🔍", label: "TRIAGE", desc: "Debugging, failure tracing, log analysis" },
  themis:      { color: "#c084fc", icon: "⚖️", label: "THEMIS", desc: "Governance, rule enforcement, token discipline" },
  archivist:   { color: "#94a3b8", icon: "📚", label: "Archivist", desc: "Workspace indexer, codebase queries" },
};

function getAgentStatus() {
  const dirPath = join(WORKSPACE, "agents/directory.json");
  if (!existsSync(dirPath)) return { directory: { agents: {} }, recentlyActive: "", display: [] };

  const dir = JSON.parse(readFileSync(dirPath, "utf8"));
  const recentlyActive = [];

  // Try to get active sessions
  const sessionOutput = run("openclaw sessions --json 2>/dev/null || echo '[]'");
  try {
    const parsed = JSON.parse(sessionOutput);
    const sessions = parsed.sessions || (Array.isArray(parsed) ? parsed : []);
    for (const s of sessions) {
      for (const agentName of Object.keys(dir.agents)) {
        if (
          s.agentId?.toLowerCase().includes(agentName) ||
          s.label?.toLowerCase().includes(agentName) ||
          s.key?.toLowerCase().includes(agentName)
        ) {
          if (s.status === "active" || s.status === "busy") {
            recentlyActive.push(agentName);
          }
        }
      }
    }
  } catch { /* sessions not available */ }

  const activeSet = new Set(recentlyActive);

  // Build display-ready agent array for the frontend
  const display = Object.entries(dir.agents).map(([name, a]) => {
    const d = AGENT_DISPLAY[name] || {};
    return {
      name: d.label || name.charAt(0).toUpperCase() + name.slice(1),
      key: name,
      model: a.model || "",
      role: a.role || "",
      status: activeSet.has(name) ? "active" : "idle",
      color: d.color || "#737373",
      icon: d.icon || "🤖",
      desc: d.desc || (Array.isArray(a.capabilities) ? a.capabilities.join(", ") : ""),
      skills: a.skills || [],
      connections: [],
      credits: { used: 0, limit: 5000 },
      activeTask: activeSet.has(name) ? "Working..." : "Standing by",
    };
  });

  return {
    directory: dir,
    recentlyActive: [...activeSet].join(","),
    display,
  };
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

      // Route to agent — try direct session first, fallback to mailbox
      let response = "";
      let newStatus = "delivered";
      const agentKey = targetAgent.toLowerCase().replace(/\s+/g, "-");
      const agentUpper = targetAgent.toUpperCase().replace(/\s+/g, " ");

      // Try direct session send first
      const sendResult = run(
        `openclaw sessions send --to "${agentKey}" --message "${message.replace(/"/g, '\\"')}" 2>&1`
      );

      if (sendResult && !sendResult.includes("not found") && !sendResult.includes("error") && !sendResult.includes("Error")) {
        response = sendResult || "Message delivered to agent session";
      } else {
        // Fallback: write to mailbox inbox
        const inboxPath = join(WORKSPACE, "agents/inbox.md");
        const timestamp = new Date().toISOString().replace("T", " ").slice(0, 16);
        const entry = `\n## [${timestamp}] FROM: ${sender} → TO: ${agentUpper}\nSTATUS: pending\nPRIORITY: normal\nSOURCE: command-center-chat\nMESSAGE: ${message}\n---\n`;

        try {
          const existing = existsSync(inboxPath) ? readFileSync(inboxPath, "utf8") : "";
          writeFileSync(inboxPath, existing + entry);
          response = `Agent ${agentUpper} has no active session. Message queued in mailbox — will be delivered on next run.`;
          newStatus = "queued";
        } catch (e) {
          response = `Delivery failed: ${e.message}`;
          newStatus = "failed";
        }
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

// ── Missions (with task progress) ────────────────────────────────────

function getMissions() {
  // Read from MEMORY.md for latest mission status
  const memPath = join(WORKSPACE, "MEMORY.md");
  const mem = existsSync(memPath) ? readFileSync(memPath, "utf8") : "";

  return [
    {
      name: "METTLE", accent: "#C9A84C", status: "beta", priority: "CRITICAL",
      desc: "Gamified athlete SaaS — BETA with Saint Andrew's Aquatics (240+ athletes)",
      completedTasks: 8, totalTasks: 10,
      link: "https://ramiche-site.vercel.app/apex-athlete",
    },
    {
      name: "Command Center", accent: "#7c3aed", status: "active", priority: "HIGH",
      desc: "Live operations dashboard — bridge API + real-time sync",
      completedTasks: 6, totalTasks: 8,
      link: "https://ramiche-site.vercel.app/command-center",
    },
    {
      name: "Parallax Site", accent: "#a855f7", status: "live", priority: "HIGH",
      desc: "Agent marketplace + Claude Skills — 19 routes LIVE",
      completedTasks: 5, totalTasks: 6,
      link: "https://parallax-site-ashen.vercel.app",
    },
    {
      name: "Parallax Publish", accent: "#38bdf8", status: "active", priority: "HIGH",
      desc: "Social media publishing — 3 platforms LIVE (Twitter, Bluesky, LinkedIn)",
      completedTasks: 4, totalTasks: 7,
      link: "https://parallax-publish.vercel.app",
    },
    {
      name: "Ramiche Studio", accent: "#e879f9", status: "blocked", priority: "HIGH",
      desc: "Creative services — $400/$1,500/$3,000/$6,000+",
      completedTasks: 4, totalTasks: 7,
      link: "https://ramiche-site.vercel.app",
    },
    {
      name: "Galactik Antics", accent: "#00f0ff", status: "blocked", priority: "MED",
      desc: "AI art + merch — @galactikantics on IG",
      completedTasks: 2, totalTasks: 4,
      link: "",
    },
    {
      name: "ClawGuard Pro", accent: "#22d3ee", status: "live", priority: "MED",
      desc: "Security scanner — $299/$799/$1,499 — LIVE",
      completedTasks: 2, totalTasks: 3,
      link: "https://parallax-site-ashen.vercel.app/clawguard",
    },
  ];
}

// ── Schedule ─────────────────────────────────────────────────────────

function getSchedule() {
  // Pull from cron list for accuracy
  const crons = getCronJobs();
  const schedule = [
    { time: "1:00 AM", event: "YOLO Overnight Builder (NOVA/Sonnet 4.5)", accent: "#14b8a6" },
    { time: "2:30 AM", event: "Night shift build (Atlas, isolated)", accent: "#C9A84C" },
    { time: "6:30 AM", event: "AI Self-Improvement Digest", accent: "#00f0ff" },
    { time: "7:00 AM", event: "Daily Scripture & Prayer (Prophets)", accent: "#d4a574" },
    { time: "7:15 AM", event: "Morning Brief (weather, git, calendar, priorities)", accent: "#a855f7" },
    { time: "8:00 AM", event: "Daily Content Coordination (VEE + INK + ECHO)", accent: "#ec4899" },
    { time: "8:00-12:15", event: "Intel scans (18 agents, staggered 15min)", accent: "#38bdf8" },
    { time: "1:00 PM", event: "Midday Checkpoint (pulse check, blockers)", accent: "#22d3ee" },
    { time: "2:00 PM", event: "Social Listening Scan (X, LinkedIn, mentions)", accent: "#38bdf8" },
    { time: "6:00 PM Fri", event: "Weekly Strategy Review", accent: "#f59e0b" },
    { time: "7:00 AM Mon", event: "Competitor Watch", accent: "#ef4444" },
    { time: "10:00 PM", event: "End of Day Recap", accent: "#C9A84C" },
  ];
  return schedule;
}

// ── Notifications ─────────────────────────────────────────────────────

function getNotifications() {
  // Read recent inbox and failed-tasks for real notifications
  const inboxPath = join(WORKSPACE, "agents/inbox.md");
  const failedPath = join(WORKSPACE, "agents/failed-tasks.md");

  const notifications = [];

  // Check inbox for pending items
  if (existsSync(inboxPath)) {
    const inbox = readFileSync(inboxPath, "utf8");
    const pendingCount = (inbox.match(/STATUS: pending/g) || []).length;
    if (pendingCount > 0) {
      notifications.push({ text: `${pendingCount} pending message(s) in agent inbox`, accent: "#f59e0b", icon: "⚠" });
    }
  }

  // Check failed tasks
  if (existsSync(failedPath)) {
    const failed = readFileSync(failedPath, "utf8");
    const lines = failed.trim().split("\n").filter(l => l.startsWith("| ") && !l.includes("---") && !l.includes("Agent"));
    if (lines.length > 0) {
      notifications.push({ text: `${lines.length} failed agent task(s) need attention`, accent: "#ef4444", icon: "⚠" });
    }
  }

  // Standard status notifications from workspace state
  notifications.push(
    { text: "Agent mailbox system LIVE — 60s relay cycle", accent: "#22d3ee", icon: "◈" },
    { text: "Bridge sync running — 7 collections every 60s", accent: "#059669", icon: "◈" },
    { text: "Content pipeline active — VEE/INK/ECHO daily coordination", accent: "#ec4899", icon: "◈" },
    { text: "19 agents upgraded with skills (Stitch, UI/UX Pro Max, Nano Banana Pro)", accent: "#a855f7", icon: "◈" },
  );

  return notifications;
}

// ── Opportunities ─────────────────────────────────────────────────────

function getOpportunities() {
  return [
    { title: "Ramiche Studio Sprint", rev: "$400", tag: "LIVE", accent: "#e879f9", desc: "48h Creative Direction Sprint" },
    { title: "Ramiche Studio Starter", rev: "$1,500", tag: "LIVE", accent: "#a855f7", desc: "Full brand kit + strategy" },
    { title: "Ramiche Studio Pro", rev: "$3,000", tag: "LIVE", accent: "#7c3aed", desc: "Complete brand transformation" },
    { title: "Ramiche Studio Elite", rev: "$6,000+", tag: "LIVE", accent: "#C9A84C", desc: "Enterprise-level creative ops" },
    { title: "ClawGuard Pro", rev: "$299-$1,499", tag: "LIVE", accent: "#22d3ee", desc: "Security scanning as a service" },
    { title: "Claude Skills", rev: "$149-$499", tag: "LIVE", accent: "#a855f7", desc: "Agent skills marketplace" },
    { title: "AI Agent Setup", rev: "$1-3K", tag: "SOON", accent: "#00f0ff", desc: "OpenClaw-style full setup" },
  ];
}

// ── Tasks ───────────────────────────────────────────────────────────

function getTasks() {
  const tasksPath = join(WORKSPACE, "agents/tasks.json");
  if (!existsSync(tasksPath)) return { backlog: [], "in-progress": [], review: [], done: [] };
  try {
    const raw = JSON.parse(readFileSync(tasksPath, "utf8"));
    return raw.tasks || { backlog: [], "in-progress": [], review: [], done: [] };
  } catch {
    return { backlog: [], "in-progress": [], review: [], done: [] };
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
  const missions = getMissions();
  const schedule = getSchedule();
  const notifications = getNotifications();
  const opportunities = getOpportunities();
  const tasks = getTasks();

  // Also write status.json locally for the secondary frontend fallback
  try {
    const statusPath = join(WORKSPACE, "../../ramiche-site/public/status.json");
    const recentlyActiveList = agents.recentlyActive ? agents.recentlyActive.split(",").filter(Boolean) : [];
    const statusData = {
      agents: Object.entries(agents.directory?.agents || {}).map(([name, a]) => ({
        name,
        model: a.model,
        role: a.role,
        status: recentlyActiveList.includes(name) ? "active" : "idle",
        task: "Standing by",
      })),
      lastSync: timestamp,
    };
    writeFileSync(statusPath, JSON.stringify(statusData, null, 2));
  } catch (e) {
    console.error("[bridge] status.json write error:", e.message);
  }

  const results = await Promise.all([
    pushToFirestore("agents", { ...agents, display: agents.display, lastSync: timestamp }),
    pushToFirestore("crons", { items: crons, count: crons.length, lastSync: timestamp }),
    pushToFirestore("activity", { items: activity, count: activity.length, lastSync: timestamp }),
    pushToFirestore("projects", { items: projects, count: projects.length, lastSync: timestamp }),
    pushToFirestore("links", { items: links, count: links.length, lastSync: timestamp }),
    pushToFirestore("missions", { items: missions, count: missions.length, lastSync: timestamp }),
    pushToFirestore("schedule", { items: schedule, count: schedule.length, lastSync: timestamp }),
    pushToFirestore("notifications", { items: notifications, count: notifications.length, lastSync: timestamp }),
    pushToFirestore("opportunities", { items: opportunities, count: opportunities.length, lastSync: timestamp }),
    pushToFirestore("tasks", { ...tasks, lastSync: timestamp }),
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
