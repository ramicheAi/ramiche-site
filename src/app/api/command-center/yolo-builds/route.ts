import { NextResponse } from "next/server";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

const BUILDS_DIR = join(process.cwd(), "public/yolo-builds");

interface BuildMeta {
  date: string;
  name: string;
  idea: string;
  status: "working" | "partial" | "failed";
  takeaway: string;
  folder: string;
  agent: string;
  files: string[];
  verified?: boolean;
}

function extractAgentFromFolder(folder: string): string {
  // Pattern: 2026-03-18-nova-gcode-surgeon → "Nova"
  const match = folder.match(/^\d{4}-\d{2}-\d{2}-([a-z-]+?)-/);
  if (!match) return "Unknown";
  const raw = match[1];
  const agentMap: Record<string, string> = {
    nova: "Nova",
    proximon: "Proximon",
    simons: "Simons",
    mercury: "Mercury",
    triage: "Triage",
    atlas: "Atlas",
    themis: "Themis",
    shuri: "Shuri",
    aetherion: "Aetherion",
    echo: "Echo",
    "dr-strange": "Dr Strange",
  };
  return agentMap[raw] || raw.charAt(0).toUpperCase() + raw.slice(1);
}

function extractDateFromFolder(folder: string): string {
  const match = folder.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "unknown";
}

function slugToName(folder: string): string {
  // 2026-03-18-nova-gcode-surgeon → "Gcode Surgeon"
  const parts = folder.replace(/^\d{4}-\d{2}-\d{2}-[a-z-]+?-/, "").split("-");
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

export async function GET() {
  try {
    if (!existsSync(BUILDS_DIR)) {
      return NextResponse.json([], { status: 404 });
    }

    const entries = readdirSync(BUILDS_DIR, { withFileTypes: true });
    const builds: BuildMeta[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".")) continue;

      const dirPath = join(BUILDS_DIR, entry.name);
      const metaPath = join(dirPath, "meta.json");
      const indexPath = join(dirPath, "index.html");

      const hasIndex = existsSync(indexPath);
      if (!hasIndex) continue; // skip empty build dirs

      const files = readdirSync(dirPath).filter(f => !f.startsWith("."));

      if (existsSync(metaPath)) {
        // Use meta.json if available
        try {
          const raw = readFileSync(metaPath, "utf-8");
          const meta = JSON.parse(raw);
          builds.push({
            date: meta.date || extractDateFromFolder(entry.name),
            name: meta.name || slugToName(entry.name),
            idea: meta.idea || "",
            status: meta.status || "working",
            takeaway: meta.takeaway || "",
            folder: entry.name,
            agent: meta.agent || extractAgentFromFolder(entry.name),
            files,
            verified: meta.verified ?? true,
          });
        } catch {
          // meta.json parse failed, fall through to folder-name extraction
        }
      }

      // No meta.json or it failed — extract from folder name
      if (!builds.find(b => b.folder === entry.name)) {
        builds.push({
          date: extractDateFromFolder(entry.name),
          name: slugToName(entry.name),
          idea: "",
          status: hasIndex ? "working" : "failed",
          takeaway: "",
          folder: entry.name,
          agent: extractAgentFromFolder(entry.name),
          files,
          verified: hasIndex,
        });
      }
    }

    // Sort by date descending, then folder name descending
    builds.sort((a, b) => b.date.localeCompare(a.date) || b.folder.localeCompare(a.folder));

    return NextResponse.json(builds);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
