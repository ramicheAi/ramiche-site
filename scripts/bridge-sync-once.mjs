#!/usr/bin/env node
// One-shot bridge sync — runs syncAll() once and exits.
// Usage: BRIDGE_API_SECRET=xxx node scripts/bridge-sync-once.mjs

import { execSync, execFileSync } from "child_process";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

const BRIDGE_URL = process.env.BRIDGE_URL || "https://ramiche-site.vercel.app/api/bridge";
const BRIDGE_SECRET = process.env.BRIDGE_API_SECRET || "";
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || "/Users/admin/.openclaw/workspace";

function run(cmd) {
  try { return execSync(cmd, { encoding: "utf8", timeout: 15_000 }).trim(); }
  catch { return ""; }
}

async function pushToFirestore(type, data) {
  try {
    const res = await fetch(BRIDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bridge-secret": BRIDGE_SECRET },
      body: JSON.stringify({ type, data }),
    });
    const ok = res.ok;
    if (!ok) console.error(`[bridge] push ${type} failed: ${res.status} ${await res.text()}`);
    else console.log(`[bridge] ✅ ${type}`);
    return ok;
  } catch (e) {
    console.error(`[bridge] push ${type} error:`, e.message);
    return false;
  }
}

const AGENT_DISPLAY = {
  atlas: { color: "#C9A84C", icon: "🧭", label: "Atlas", desc: "Operations Lead" },
  themaestro: { color: "#f59e0b", icon: "🎵", label: "TheMAESTRO", desc: "Music Production" },
  simons: { color: "#22d3ee", icon: "📊", label: "SIMONS", desc: "Data analysis" },
  "dr-strange": { color: "#a855f7", icon: "🔮", label: "Dr. Strange", desc: "Scenario analysis" },
  shuri: { color: "#34d399", icon: "⚡", label: "SHURI", desc: "Creative coding" },
  widow: { color: "#ef4444", icon: "🕷", label: "Widow", desc: "Cybersecurity" },
  proximon: { color: "#f97316", icon: "🏗", label: "PROXIMON", desc: "Systems architecture" },
  vee: { color: "#ec4899", icon: "📣", label: "Vee", desc: "Brand strategy" },
  aetherion: { color: "#818cf8", icon: "🌀", label: "Aetherion", desc: "Creative Director" },
  michael: { color: "#06b6d4", icon: "🏊", label: "MICHAEL", desc: "Swim coaching" },
  selah: { color: "#fb923c", icon: "🧠", label: "SELAH", desc: "Psychology" },
  prophets: { color: "#d4a574", icon: "📜", label: "Prophets", desc: "Spiritual counsel" },
  mercury: { color: "#fbbf24", icon: "💰", label: "MERCURY", desc: "Sales strategy" },
  echo: { color: "#14b8a6", icon: "📡", label: "ECHO", desc: "Community engagement" },
  haven: { color: "#a3e635", icon: "🏠", label: "HAVEN", desc: "Support automation" },
  ink: { color: "#f472b6", icon: "✍️", label: "INK", desc: "Copywriting" },
  kiyosaki: { color: "#facc15", icon: "📈", label: "KIYOSAKI", desc: "Financial analysis" },
  nova: { color: "#7dd3fc", icon: "🌟", label: "NOVA", desc: "Overnight builds" },
  triage: { color: "#fb7185", icon: "🔍", label: "TRIAGE", desc: "Debugging" },
  themis: { color: "#c084fc", icon: "⚖️", label: "THEMIS", desc: "Governance" },
};

function getAgentStatus() {
  const dirPath = join(WORKSPACE, "agents/directory.json");
  if (!existsSync(dirPath)) return { directory: { agents: {} }, recentlyActive: "", display: [] };
  const dir = JSON.parse(readFileSync(dirPath, "utf8"));
  const recentlyActive = [];
  const sessionOutput = run("/usr/local/bin/openclaw sessions --json 2>/dev/null || echo '[]'");
  try {
    const parsed = JSON.parse(sessionOutput);
    const sessions = parsed.sessions || (Array.isArray(parsed) ? parsed : []);
    for (const s of sessions) {
      for (const agentName of Object.keys(dir.agents)) {
        if (s.agentId?.toLowerCase().includes(agentName) || s.label?.toLowerCase().includes(agentName) || s.key?.toLowerCase().includes(agentName)) {
          if (s.status === "active" || s.status === "busy") recentlyActive.push(agentName);
        }
      }
    }
  } catch {}
  const activeSet = new Set(recentlyActive);
  const display = Object.entries(dir.agents).map(([name, a]) => {
    const d = AGENT_DISPLAY[name] || {};
    return {
      name: d.label || name.charAt(0).toUpperCase() + name.slice(1),
      key: name, model: a.model || "", role: a.role || "",
      status: activeSet.has(name) ? "active" : "idle",
      color: d.color || "#737373", icon: d.icon || "🤖",
      desc: d.desc || "", skills: a.skills || [], connections: [],
      credits: { used: 0, limit: 5000 },
      activeTask: activeSet.has(name) ? "Working..." : "Standing by",
    };
  });
  return { directory: dir, recentlyActive: [...activeSet].join(","), display };
}

function getCronJobs() {
  let jobs = [];
  const cronOutput = run("/usr/local/bin/openclaw cron list --json 2>/dev/null");
  try {
    const jsonStart = cronOutput.indexOf('{');
    if (jsonStart !== -1) { const parsed = JSON.parse(cronOutput.slice(jsonStart)); jobs = parsed.jobs || (Array.isArray(parsed) ? parsed : []); }
  } catch {}
  if (jobs.length === 0) {
    const cronFile = join(process.env.HOME || "/Users/admin", ".openclaw/cron/jobs.json");
    if (existsSync(cronFile)) { try { const raw = JSON.parse(readFileSync(cronFile, "utf8")); jobs = raw.jobs || (Array.isArray(raw) ? raw : []); } catch {} }
  }
  return jobs.map(j => ({ id: j.id, name: j.name, enabled: j.enabled, agent: j.agentId || "atlas", schedule: j.schedule?.expr || (j.schedule?.everyMs ? `every ${Math.round(j.schedule.everyMs / 60000)}m` : ""), lastRun: j.state?.lastRunStatus || "unknown", nextRun: j.state?.nextRunAtMs ? new Date(j.state.nextRunAtMs).toISOString() : "" }));
}

function getRecentActivity() {
  const today = new Date();
  const dates = [today.toISOString().slice(0, 10), new Date(today - 86400000).toISOString().slice(0, 10)];
  const activities = [];
  for (const date of dates) {
    const logPath = join(WORKSPACE, `memory/${date}.md`);
    if (!existsSync(logPath)) continue;
    const content = readFileSync(logPath, "utf8");
    const entries = content.split(/^## /m).slice(1);
    for (const entry of entries.slice(-20)) {
      const lines = entry.trim().split("\n");
      const header = lines[0] || "";
      const body = lines.slice(1).join("\n").trim();
      const timeMatch = header.match(/\[(\d{1,2}:\d{2})\]/);
      activities.push({ date, time: timeMatch ? timeMatch[1] : "", title: header.replace(/\[\d{1,2}:\d{2}\]\s*/, ""), body: body.slice(0, 200) });
    }
  }
  return activities.slice(-30);
}

function parseTasks(content) {
  const tasks = [];
  for (const line of content.split("\n")) {
    const doneMatch = line.match(/^-\s*\[x\]\s+(.+)/i);
    const todoMatch = line.match(/^-\s*\[\s\]\s+(.+)/);
    if (doneMatch) tasks.push({ t: doneMatch[1].trim(), done: true });
    else if (todoMatch) tasks.push({ t: todoMatch[1].trim(), done: false });
  }
  return tasks;
}

function getProjectStatus() {
  const projectsDir = join(WORKSPACE, "projects");
  if (!existsSync(projectsDir)) return [];
  const entries = readdirSync(projectsDir);
  const projects = [];
  for (const entry of entries) {
    if (entry.startsWith(".") || entry === "PRE-BUILD-CHECKLIST.md") continue;
    const dir = join(projectsDir, entry);
    try { if (!statSync(dir).isDirectory()) continue; } catch { continue; }
    const metaPath = join(dir, "META.json");
    let meta = {};
    if (existsSync(metaPath)) { try { meta = JSON.parse(readFileSync(metaPath, "utf8")); } catch {} }
    const tasksPath = join(dir, "TASKS.md");
    let tasks = [];
    if (existsSync(tasksPath)) { try { tasks = parseTasks(readFileSync(tasksPath, "utf8")); } catch {} }
    const allFiles = readdirSync(dir);
    const docs = allFiles.filter(f => ["ARCHITECTURE.md", "DECISIONS.md", "MEMORY.md", "PIPELINE.md", "TASKS.md"].includes(f));
    projects.push({ name: meta.name || entry, slug: meta.slug || entry, accent: meta.accent || "#737373", status: meta.status || "active", desc: meta.desc || "", priority: meta.priority || 99, priorityLabel: meta.priorityLabel || "MED", agents: meta.agents || [], lead: meta.lead || "Atlas", tasks, blockers: meta.blockers || [], link: meta.link || null, docs });
  }
  projects.sort((a, b) => a.priority - b.priority);
  return projects;
}

function getQuickLinks() {
  return [
    { label: "METTLE", url: "https://ramiche-site.vercel.app/apex-athlete/coach", icon: "trophy" },
    { label: "METTLE Demo", url: "https://ramiche-site.vercel.app/apex-athlete/demo", icon: "demo" },
    { label: "Parallax Site", url: "https://parallax-site-ashen.vercel.app", icon: "globe" },
    { label: "Parallax Publish", url: "https://parallax-publish.vercel.app", icon: "send" },
    { label: "ClawGuard Pro", url: "https://parallax-site-ashen.vercel.app/clawguard", icon: "shield" },
    { label: "YOLO Builds", url: "https://ramiche-site.vercel.app/command-center/yolo", icon: "rocket" },
    { label: "Vercel", url: "https://vercel.com/dashboard", icon: "cloud" },
    { label: "GitHub", url: "https://github.com/ramicheAi", icon: "code" },
    { label: "Firebase", url: "https://console.firebase.google.com/project/apex-athlete-73755", icon: "database" },
    { label: "Shopify", url: "https://admin.shopify.com", icon: "shop" },
    { label: "GoMotion", url: "https://www.gomotionapp.com", icon: "swim" },
  ];
}

function getMissions() {
  const projects = getProjectStatus();
  return projects.map(p => ({ name: p.name, accent: p.accent, status: p.status, priority: p.priorityLabel, desc: p.desc, tasks: p.tasks, link: p.link || null, blockers: p.blockers || [], lead: p.lead || "Atlas", agents: p.agents || [] }));
}

function getSchedule() {
  return [
    { time: "1:00 AM", event: "YOLO Overnight Builder (NOVA/Sonnet 4.5)", accent: "#14b8a6" },
    { time: "6:30 AM", event: "AI Self-Improvement Digest", accent: "#00f0ff" },
    { time: "7:00 AM", event: "Daily Scripture & Prayer (Prophets)", accent: "#d4a574" },
    { time: "7:15 AM", event: "Morning Brief", accent: "#a855f7" },
    { time: "8:00 AM", event: "Daily Content Coordination", accent: "#ec4899" },
    { time: "8:00-12:15", event: "Intel scans (staggered 15min)", accent: "#38bdf8" },
    { time: "1:00 PM", event: "Midday Checkpoint", accent: "#22d3ee" },
    { time: "2:00 PM", event: "Social Listening Scan", accent: "#38bdf8" },
    { time: "6:00 PM Fri", event: "Weekly Strategy Review", accent: "#f59e0b" },
    { time: "10:00 PM", event: "End of Day Recap", accent: "#C9A84C" },
  ];
}

function getNotifications() {
  const notifications = [];
  const inboxPath = join(WORKSPACE, "agents/inbox.md");
  if (existsSync(inboxPath)) {
    const inbox = readFileSync(inboxPath, "utf8");
    const pendingCount = (inbox.match(/STATUS: pending/g) || []).length;
    if (pendingCount > 0) notifications.push({ text: `${pendingCount} pending message(s) in agent inbox`, accent: "#f59e0b", icon: "⚠" });
  }
  const failedPath = join(WORKSPACE, "agents/failed-tasks.md");
  if (existsSync(failedPath)) {
    const failed = readFileSync(failedPath, "utf8");
    const lines = failed.trim().split("\n").filter(l => l.startsWith("| ") && !l.includes("---") && !l.includes("Agent"));
    if (lines.length > 0) notifications.push({ text: `${lines.length} failed agent task(s) need attention`, accent: "#ef4444", icon: "⚠" });
  }
  notifications.push(
    { text: "Bridge sync active — all collections live", accent: "#059669", icon: "◈" },
    { text: "19 agents online", accent: "#a855f7", icon: "◈" },
  );
  return notifications;
}

function getOpportunities() {
  return [
    { title: "Ramiche Studio Sprint", rev: "$400", tag: "LIVE", accent: "#e879f9", desc: "48h Creative Direction Sprint" },
    { title: "Ramiche Studio Starter", rev: "$1,500", tag: "LIVE", accent: "#a855f7", desc: "Full brand kit + strategy" },
    { title: "Ramiche Studio Pro", rev: "$3,000", tag: "LIVE", accent: "#7c3aed", desc: "Complete brand transformation" },
    { title: "Ramiche Studio Elite", rev: "$6,000+", tag: "LIVE", accent: "#C9A84C", desc: "Enterprise-level creative ops" },
    { title: "ClawGuard Pro", rev: "$299-$1,499", tag: "LIVE", accent: "#22d3ee", desc: "Security scanning as a service" },
    { title: "Claude Skills", rev: "$149-$499", tag: "LIVE", accent: "#a855f7", desc: "Agent skills marketplace" },
  ];
}

function getTasks() {
  const tasksPath = join(WORKSPACE, "agents/tasks.json");
  if (!existsSync(tasksPath)) return { backlog: [], "in-progress": [], review: [], done: [] };
  try { const raw = JSON.parse(readFileSync(tasksPath, "utf8")); return raw.tasks || { backlog: [], "in-progress": [], review: [], done: [] }; }
  catch { return { backlog: [], "in-progress": [], review: [], done: [] }; }
}

// ── Run once ──
const timestamp = new Date().toISOString();
console.log(`[bridge] one-shot sync at ${timestamp}`);

const agents = getAgentStatus();
const crons = getCronJobs();
const activity = getRecentActivity();
const links = getQuickLinks();
const missions = getMissions();
const schedule = getSchedule();
const notifications = getNotifications();
const opportunities = getOpportunities();
const tasks = getTasks();

const results = await Promise.all([
  pushToFirestore("agents", { ...agents, display: agents.display, lastSync: timestamp }),
  pushToFirestore("crons", { items: crons, count: crons.length, lastSync: timestamp }),
  pushToFirestore("activity", { items: activity, count: activity.length, lastSync: timestamp }),
  pushToFirestore("links", { items: links, count: links.length, lastSync: timestamp }),
  pushToFirestore("missions", { items: missions, count: missions.length, lastSync: timestamp }),
  pushToFirestore("schedule", { items: schedule, count: schedule.length, lastSync: timestamp }),
  pushToFirestore("notifications", { items: notifications, count: notifications.length, lastSync: timestamp }),
  pushToFirestore("opportunities", { items: opportunities, count: opportunities.length, lastSync: timestamp }),
  pushToFirestore("tasks", { ...tasks, lastSync: timestamp }),
]);

const ok = results.filter(Boolean).length;
console.log(`[bridge] done: ${ok}/${results.length} collections synced`);
process.exit(ok === results.length ? 0 : 1);
