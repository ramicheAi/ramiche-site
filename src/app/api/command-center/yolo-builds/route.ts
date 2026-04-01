import { NextResponse } from "next/server";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { fetchCommandCenterYoloManifest } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WS = process.env.OPENCLAW_WORKSPACE ?? "/Users/admin/.openclaw/workspace";
const BUILDS_DIR_WS = join(WS, "builds");
const BUILDS_DIR_PUBLIC = join(process.cwd(), "public/builds");

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

function normalizeStatus(s: unknown): BuildMeta["status"] {
  if (s === "partial" || s === "failed") return s;
  return "working";
}

function manifestRowToBuild(row: Record<string, unknown>): BuildMeta | null {
  const folder = typeof row.folder === "string" ? row.folder : "";
  if (!folder) return null;
  const files = Array.isArray(row.files)
    ? row.files.map((f) => String(f))
    : [];
  return {
    date: typeof row.date === "string" ? row.date : "unknown",
    name: typeof row.name === "string" ? row.name : slugToName(folder),
    idea: typeof row.idea === "string" ? row.idea : "",
    status: normalizeStatus(row.status),
    takeaway: typeof row.takeaway === "string" ? row.takeaway : "",
    folder,
    agent: typeof row.agent === "string" ? row.agent : extractAgentFromFolder(folder),
    files,
    verified: typeof row.verified === "boolean" ? row.verified : true,
  };
}

function loadBuildsFromDir(buildsDir: string): BuildMeta[] {
  if (!existsSync(buildsDir)) return [];

  const entries = readdirSync(buildsDir, { withFileTypes: true });
  const builds: BuildMeta[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;

    const dirPath = join(buildsDir, entry.name);
    const metaPath = join(dirPath, "meta.json");
    const indexPath = join(dirPath, "index.html");

    const hasIndex = existsSync(indexPath);

    const files = readdirSync(dirPath).filter(f => !f.startsWith("."));

    if (existsSync(metaPath)) {
      try {
        const raw = readFileSync(metaPath, "utf-8");
        const meta = JSON.parse(raw);
        builds.push({
          date: meta.date || extractDateFromFolder(entry.name),
          name: meta.name || slugToName(entry.name),
          idea: meta.idea || "",
          status: normalizeStatus(meta.status),
          takeaway: meta.takeaway || "",
          folder: entry.name,
          agent: meta.agent || extractAgentFromFolder(entry.name),
          files,
          verified: meta.verified ?? true,
        });
      } catch {
        /* fall through */
      }
    }

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

  builds.sort((a, b) => b.date.localeCompare(a.date) || b.folder.localeCompare(a.folder));
  return builds;
}

export async function GET() {
  try {
    let source: "workspace" | "firestore" | "public" | "empty" = "empty";
    let builds: BuildMeta[] = [];

    if (existsSync(BUILDS_DIR_WS)) {
      builds = loadBuildsFromDir(BUILDS_DIR_WS);
      source = "workspace";
    } else {
      const manifest = await fetchCommandCenterYoloManifest();
      if (manifest?.builds?.length) {
        const fromFs = manifest.builds
          .map((row) => manifestRowToBuild(row))
          .filter((b): b is BuildMeta => b !== null);
        if (fromFs.length > 0) {
          builds = fromFs;
          source = "firestore";
        }
      }
      if (builds.length === 0 && existsSync(BUILDS_DIR_PUBLIC)) {
        builds = loadBuildsFromDir(BUILDS_DIR_PUBLIC);
        source = builds.length ? "public" : "empty";
      }
    }

    builds.sort((a, b) => b.date.localeCompare(a.date) || b.folder.localeCompare(a.folder));

    return NextResponse.json(builds, { headers: { "X-CC-YOLO-Source": source } });
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
