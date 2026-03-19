import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

const WORKSPACE = process.env.OPENCLAW_WORKSPACE || "/Users/admin/.openclaw/workspace";
const MEMORY_DIR = join(WORKSPACE, "memory");

/* ─── Seed data for production (Vercel has no local filesystem) ─────── */
const SEED_DAYS = [
  {
    date: "2026-03-19",
    day: "Wednesday",
    entries: [
      { time: "01:03", title: "YOLO Build: Relay Lineup Builder", content: "Interactive relay team builder — 5 events, drag-and-drop, auto-optimize (4 strategies), projected times + coaching insights. 25KB single HTML.", agent: "NOVA" },
      { time: "00:07", title: "Command Center Updated", content: "Quick links bug fixed (empty bridge response overwrote with truthy []). Activity log updated. Deployed.", agent: "Atlas" },
    ],
  },
  {
    date: "2026-03-18",
    day: "Tuesday",
    entries: [
      { time: "08:28", title: "System Wake", content: "Cron trigger: Autonomy Task Spawner. 0 tasks pending.", agent: "Atlas" },
      { time: "08:30", title: "YOLO Builds Fix", content: "SEED_BUILDS updated with 3 new builds (G-Code Surgeon, EKG Vitals, Agent Arena). Pushed to main, Vercel deployed.", agent: "Atlas" },
      { time: "12:00", title: "Resend Email Wired", content: "Resend API key added to Vercel for Power Challenge. Confirmation emails + admin notifications active on Stripe checkout.", agent: "Atlas" },
      { time: "12:20", title: "Echo Identity Lost", content: "Echo (qwen3:14b local) lost persona mid-conversation, responded as base Qwen model. Root cause: local model doesn't retain persona context. Fix: restarted on Kimi K2.5.", agent: "Atlas" },
      { time: "23:52", title: "Command Center Quick Links Fix", content: "Root cause: notifications guard missing length > 0 check. Empty bridge response overwrote with [] (truthy in JS). Fixed and deployed.", agent: "Atlas" },
    ],
  },
  {
    date: "2026-03-17",
    day: "Monday",
    entries: [
      { time: "03:20", title: "YOLO Build: Nerve Center — Agent War Room", content: "Real-time war room dashboard — 20 agent cards, live status simulation, YOLO leaderboard, operations feed, metrics bar. Monospace CRT aesthetic. Zero dependencies.", agent: "Atlas" },
      { time: "07:00", title: "Morning Brief Delivered", content: "Uncommitted work: BestTimesCard, ParentPreviewModal, yolo-approve API, nerve-center page, CC nav links. METTLE priority confirmed.", agent: "Atlas" },
      { time: "08:27", title: "Uncommitted Work Committed", content: "Commit 9328b75 → 5 files staged and pushed (BestTimesCard, ParentPreviewModal, yolo-approve, nerve-center, CC page.tsx).", agent: "Atlas" },
      { time: "09:39", title: "Power Challenge — Domain + Stripe", content: "Domain powerchallenge.org added to Vercel. Stripe secret key set. DNS instructions written for Jesse (GoDaddy A records). Ramon texted Jesse.", agent: "Atlas" },
      { time: "11:49", title: "Sandbox Allowlist Configured", content: "9 binaries allowlisted in exec-approvals.json: git, npm, node, vercel, npx, claude, python3. Routine commands no longer need /approve.", agent: "Atlas" },
      { time: "12:00", title: "YOLO SEED_BUILDS Source Fix", content: "Root cause: Firestore had stale 16 builds, skipped SEED_BUILDS. Fix: SEED_BUILDS always renders, Firestore overlays review status. All 34 builds visible.", agent: "Atlas" },
      { time: "12:15", title: "Post-Approval Tier Pipeline", content: "3 tiers built: T1 Internal Tool, T2 Feature Integration, T3 Standalone Product. Tier selector + promotion panel per tier.", agent: "Atlas" },
    ],
  },
  {
    date: "2026-03-16",
    day: "Sunday",
    entries: [
      { time: "07:30", title: "Intelligence Layer Integration", content: "5 Stanford AI tools integrated: Thompson Sampling YOLO Allocator, Pre-Spawn Gate, Seeded bandit (18 builds), overnight-builder update, integration guide. A/B: Thompson > UCB1 (31% lower regret).", agent: "Atlas" },
      { time: "09:25", title: "Morning Brief Actions", content: "Committed METTLE work (39f1f1d). OpenClaw updated 2026.3.12→2026.3.13. FileVault enabled. SwimCloud parsing fixed (7e7f35b). Dependabot vuln triaged.", agent: "Atlas" },
      { time: "12:31", title: "Skills Installation", content: "Installed from 5 repos: Composio (3), Superpowers (14), Anthropic (17), NotebookLM (1), Marketing (33). Runtime rule: Claude Code = no web, OpenClaw = all tools.", agent: "Atlas" },
      { time: "17:32", title: "Protocol Audit & Cleanup", content: "MEMORY.md: 337→180 lines. Removed dead systems (inbox.md, relay scripts). Fixed 5 contradictions. Zero contradictions remaining.", agent: "Atlas" },
    ],
  },
  {
    date: "2026-03-15",
    day: "Saturday",
    entries: [
      { time: "03:00", title: "Weekly Skill Auto-Update", content: "Failed — ClawHub API rate limit. Tried 3x with backoff, all 429'd. Retry manually during off-peak.", agent: "NOVA" },
      { time: "14:01", title: "Social Listening Scan", content: "Found coverage in Bloomberg, CNBC, Fortune. 5 engagement opportunities: Matthew Berman pipeline, security crisis discussions, Chinese adoption wave, AI Agent Store, Discord community.", agent: "Atlas" },
    ],
  },
  {
    date: "2026-03-14",
    day: "Friday",
    entries: [
      { time: "09:00", title: "YOLO Builds: 3 New", content: "Agent Margin Simulator, Apex Sales Dashboard, METTLE Practice Planner — all built and registered.", agent: "NOVA" },
      { time: "14:00", title: "METTLE Cognitive Load Audit", content: "Coach=4101 lines/81 useState (CRITICAL), Parent=2043/43, Athlete=2849/19, Admin=213/1. Coach portal needs refactor.", agent: "Atlas" },
    ],
  },
  {
    date: "2026-03-13",
    day: "Thursday",
    entries: [
      { time: "08:00", title: "YOLO Builds: Swim Analytics + ROI Calculator", content: "METTLE Swim Analytics dashboard and Verified Agent ROI Calculator built overnight.", agent: "NOVA" },
      { time: "10:00", title: "Event-Driven Triggers Designed", content: "Deploy→auto-verify, build fail→auto-fix, PR→auto-review, agent timeout→kill+respawn, YOLO complete→score.", agent: "Atlas" },
      { time: "12:00", title: "SOL Priority Queue", content: "P0 URGENT (immediate), P1 IMPORTANT (<1hr), P2 BACKGROUND (overnight). All YOLO=P2. Ramon requests=P1 default.", agent: "Atlas" },
    ],
  },
];

/* ─── Parse daily memory file into structured entries ───────────────── */
function parseMemoryFile(content: string, filename: string): any[] {
  const entries: any[] = [];
  const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : filename;

  const sections = content.split(/^## /m).filter(Boolean);
  for (const section of sections) {
    const lines = section.split("\n");
    const header = lines[0]?.trim() || "";
    const timeMatch = header.match(/\[(\d{1,2}:\d{2})\]/);
    const time = timeMatch ? timeMatch[1] : null;
    const title = header.replace(/\[\d{1,2}:\d{2}\]\s*/, "").replace(/^Task:\s*/i, "").trim();
    const body = lines.slice(1).join("\n").trim();

    const agentMatch = body.match(/(?:Agent|By|Owner):\s*(\w+)/i);
    const agent = agentMatch ? agentMatch[1] : null;

    if (title) {
      entries.push({ date, time, title, content: body, agent });
    }
  }
  return entries;
}

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get("days") || "7", 10);
  const limit = Math.min(Math.max(days, 1), 30);

  try {
    const files = await readdir(MEMORY_DIR);
    const mdFiles = files
      .filter((f: string) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort()
      .reverse()
      .slice(0, limit);

    const results = await Promise.all(
      mdFiles.map(async (f: string) => {
        const content = await readFile(join(MEMORY_DIR, f), "utf-8");
        const entries = parseMemoryFile(content, f);
        const dateMatch = f.match(/(\d{4}-\d{2}-\d{2})/);
        return {
          date: dateMatch ? dateMatch[1] : f,
          day: dateMatch ? new Date(dateMatch[1] + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" }) : "",
          entries,
          filename: f,
        };
      })
    );

    return NextResponse.json({
      days: results,
      count: results.length,
      source: "workspace/memory/*.md",
    });
  } catch {
    // Filesystem not available (production/Vercel) — return seed data
    const sliced = SEED_DAYS.slice(0, limit);
    return NextResponse.json({
      days: sliced,
      count: sliced.length,
      source: "seed",
    });
  }
}
