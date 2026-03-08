import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

const WORKSPACE = process.env.OPENCLAW_WORKSPACE || "/Users/admin/.openclaw/workspace";
const MEMORY_DIR = join(WORKSPACE, "memory");

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

    // Try to extract agent name from body
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
    return NextResponse.json({ error: "Memory directory not found" }, { status: 500 });
  }
}
