import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

const REPO_DIR = process.env.REPO_DIR || "/Users/admin/ramiche-site";

/* ── Parse git log into activity events ────────────────────────────── */
function parseGitLog(raw: string) {
  const events: { hash: string; date: string; author: string; message: string; type: string }[] = [];
  const lines = raw.trim().split("\n").filter(Boolean);

  for (const line of lines) {
    const parts = line.split("|");
    if (parts.length < 4) continue;
    const [hash, dateStr, author, ...msgParts] = parts;
    const message = msgParts.join("|").trim();

    let type = "commit";
    if (/^feat/i.test(message)) type = "deploy";
    else if (/^fix/i.test(message)) type = "build";
    else if (/agent|spawn|relay/i.test(message)) type = "agent";
    else if (/milestone|launch|ship/i.test(message)) type = "milestone";
    else if (/security|vuln|alert/i.test(message)) type = "alert";

    events.push({
      hash: hash?.trim(),
      date: dateStr?.trim(),
      author: author?.trim(),
      message,
      type,
    });
  }
  return events;
}

/* ── Static fallback activity (recent highlights for Vercel) ───────── */
const STATIC_EVENTS = [
  { hash: "cf87e89", date: "2026-03-18T10:50:00-04:00", author: "Proximon", message: "feat: Signal Wire — live agent communication visualizer", type: "deploy" },
  { hash: "ae01b20", date: "2026-03-15T08:15:00-04:00", author: "Proximon", message: "fix: bulletproof cron retry + catch-up for missed meet result windows", type: "build" },
  { hash: "adca0ea", date: "2026-03-15T08:45:00-04:00", author: "Proximon", message: "feat: Meet Day Stats Bar — live clock, countdown, athlete/event counts", type: "deploy" },
  { hash: "d13ccb4", date: "2026-03-15T08:34:00-04:00", author: "Proximon", message: "feat: PB overlay in parent portal — celebration on new best times", type: "deploy" },
  { hash: "2587349", date: "2026-03-15T08:28:00-04:00", author: "Proximon", message: "feat: PB notification overlay in athlete portal — Solo Leveling moment", type: "deploy" },
  { hash: "40bd8f2", date: "2026-03-15T08:21:00-04:00", author: "Proximon", message: "feat: wire onMeetScore handler — auto-award XP on meet results", type: "deploy" },
  { hash: "b218391", date: "2026-03-15T07:54:00-04:00", author: "Proximon", message: "feat: cron worker for automated meet results pipeline", type: "deploy" },
  { hash: "fd78ddb", date: "2026-03-15T07:49:00-04:00", author: "Proximon", message: "feat: auto-schedule meet result fetches on meet creation", type: "deploy" },
  { hash: "49e3406", date: "2026-03-15T07:42:00-04:00", author: "Proximon", message: "feat: automated meet results API — SwimCloud fetch + PB detection", type: "deploy" },
  { hash: "a0e8270", date: "2026-03-15T07:33:00-04:00", author: "Proximon", message: "feat: meet-scoring engine — PB detection, XP calc, placement bonuses", type: "deploy" },
  { hash: "41c3cd8", date: "2026-03-15T07:39:00-04:00", author: "Proximon", message: "feat: bestTimes field + auto-score on finalTime entry", type: "deploy" },
  { hash: "da1e1a8", date: "2026-03-15T16:49:00-04:00", author: "Proximon", message: "fix: CsvImport TypeScript error in MeetsView", type: "build" },
  { hash: "ed49a7d", date: "2026-03-13T20:22:00-04:00", author: "Proximon", message: "fix: zero-XP guard on syncSaveRoster — prevent seed data overwrite", type: "build" },
  { hash: "9adf62a", date: "2026-03-14T21:38:00-04:00", author: "Proximon", message: "feat: agents API wired to live workspace directory.json", type: "deploy" },
  { hash: "0c5af06", date: "2026-03-13T00:00:00-04:00", author: "Atlas", message: "feat: extract MeetsView, CommsView, ScheduleView from coach page", type: "deploy" },
  { hash: "a60735f", date: "2026-03-10T00:00:00-04:00", author: "Atlas", message: "feat: Supabase real-time chat integration for Command Center", type: "deploy" },
  { hash: "df7d56c", date: "2026-03-11T00:00:00-04:00", author: "Atlas", message: "feat: Command Center chat API — 3-tier model fallback", type: "deploy" },
  { hash: "dce7163", date: "2026-03-12T00:00:00-04:00", author: "Atlas", message: "feat: direct Gemini/DeepSeek API routing — cut OpenRouter spend 80-90%", type: "deploy" },
  { hash: "b096304", date: "2026-03-09T00:00:00-04:00", author: "Atlas", message: "feat: Command Center v4 — holographic mission control", type: "milestone" },
];

export async function GET(req: NextRequest) {
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50", 10);
  const safeLimit = Math.min(Math.max(limit, 1), 200);

  // Try live git log first (works when self-hosted / local dev)
  try {
    const raw = execSync(
      `git log --format="%h|%ci|%an|%s" -n ${safeLimit}`,
      { cwd: REPO_DIR, encoding: "utf-8", timeout: 5000 }
    );
    const events = parseGitLog(raw);
    if (events.length > 0) {
      return NextResponse.json({ events, count: events.length, source: "git-log" });
    }
  } catch {
    // Git not available (Vercel) — fall through to static
  }

  // Fallback to embedded static data
  const events = STATIC_EVENTS.slice(0, safeLimit);
  return NextResponse.json({ events, count: events.length, source: "static" });
}
