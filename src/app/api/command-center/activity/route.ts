import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { join } from "path";

export const dynamic = "force-dynamic";

const REPO_DIR = process.env.REPO_DIR || "/Users/admin/ramiche-site";

/* ─── Parse git log into activity events ────────────────────────────── */
function parseGitLog(raw: string): any[] {
  const events: any[] = [];
  const lines = raw.trim().split("\n").filter(Boolean);

  for (const line of lines) {
    const parts = line.split("|");
    if (parts.length < 4) continue;
    const [hash, dateStr, author, ...msgParts] = parts;
    const message = msgParts.join("|").trim();

    // Classify event type from commit message
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

export async function GET(req: NextRequest) {
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50", 10);
  const safeLimit = Math.min(Math.max(limit, 1), 200);

  try {
    const raw = execSync(
      `git log --format="%h|%ci|%an|%s" -n ${safeLimit}`,
      { cwd: REPO_DIR, encoding: "utf-8", timeout: 5000 }
    );
    const events = parseGitLog(raw);

    return NextResponse.json({
      events,
      count: events.length,
      source: "git-log",
    });
  } catch (err: any) {
    return NextResponse.json({
      error: "Failed to read git log",
      detail: err?.message,
    }, { status: 500 });
  }
}
