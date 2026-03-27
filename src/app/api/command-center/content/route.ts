import { NextResponse } from "next/server";
import { readdirSync, readFileSync, existsSync, statSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

const CONTENT_PIPELINE_DIR = "/Users/admin/.openclaw/workspace/content-pipeline/";

interface ContentItem {
  id: string;
  title: string;
  content: string;
  platform: "Instagram" | "X" | "LinkedIn" | "All";
  stage: "draft" | "reviewed" | "approved" | "posted";
  assignee: string;
  dueDate: string;
  createdAt: string;
  source?: string;
}

function extractContentFromDirectory(dir: string): ContentItem[] {
  const items: ContentItem[] = [];

  try {
    if (!existsSync(dir)) return items;

    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subItems = extractContentFromDirectory(join(dir, entry.name));
        items.push(...subItems);
        continue;
      }

      if (!entry.name.endsWith(".md") && !entry.name.endsWith(".txt")) continue;

      const filePath = join(dir, entry.name);
      try {
        const content = readFileSync(filePath, "utf-8");
        const stat = statSync(filePath);

        const lines = content.split("\n").filter(l => l.trim());
        const title = lines[0]?.replace(/^#\s*/, "").slice(0, 100) || entry.name.replace(/\.(md|txt)$/, "");

        let stage: ContentItem["stage"] = "draft";
        const pathLower = dir.toLowerCase();
        if (pathLower.includes("approved") || pathLower.includes("ready")) stage = "approved";
        else if (pathLower.includes("review")) stage = "reviewed";
        else if (pathLower.includes("posted") || pathLower.includes("published")) stage = "posted";

        let platform: ContentItem["platform"] = "All";
        const nameLower = entry.name.toLowerCase();
        if (nameLower.includes("instagram") || nameLower.includes("ig")) platform = "Instagram";
        else if (nameLower.includes("twitter") || nameLower.includes("x-")) platform = "X";
        else if (nameLower.includes("linkedin") || nameLower.includes("li")) platform = "LinkedIn";

        let assignee = "INK";
        if (pathLower.includes("echo")) assignee = "ECHO";
        else if (pathLower.includes("vee")) assignee = "VEE";

        items.push({
          id: `${stat.ino}-${stat.mtimeMs}`,
          title,
          content: content.slice(0, 300),
          platform,
          stage,
          assignee,
          dueDate: stat.mtime.toISOString().split("T")[0],
          createdAt: stat.birthtime.toISOString().split("T")[0],
          source: filePath.replace(CONTENT_PIPELINE_DIR, ""),
        });
      } catch {
        continue;
      }
    }
  } catch {
    return items;
  }

  return items;
}

export async function GET() {
  try {
    if (!existsSync(CONTENT_PIPELINE_DIR)) {
      return NextResponse.json({
        items: [],
        source: "empty-state",
        message: "Content pipeline directory does not exist",
      });
    }

    const items = extractContentFromDirectory(CONTENT_PIPELINE_DIR);
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      items,
      source: "content-pipeline",
      count: items.length,
    });
  } catch (error) {
    return NextResponse.json({
      items: [],
      source: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
