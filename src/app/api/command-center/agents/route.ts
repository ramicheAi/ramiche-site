import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

const WORKSPACE_DIR = join(
  process.env.OPENCLAW_WORKSPACE ?? "/Users/admin/.openclaw/workspace",
  "agents"
);
const DIRECTORY_PATH = join(WORKSPACE_DIR, "directory.json");

interface DirectoryAgent {
  model: string;
  provider: string;
  role: string;
  capabilities?: string[];
  skills?: string[];
  escalation_level?: string;
  default_stance?: string;
  provider_note?: string;
}

function mapAgent(id: string, a: DirectoryAgent) {
  return {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    model: `${a.provider}/${a.model}`,
    role: a.role,
    capabilities: a.capabilities ?? [],
    skills: a.skills ?? [],
    escalation_level: a.escalation_level ?? "executor",
    default_stance: a.default_stance ?? "",
    status: "idle",
  };
}

export async function GET() {
  try {
    const raw = await readFile(DIRECTORY_PATH, "utf-8");
    const dir = JSON.parse(raw);
    const agents = Object.entries(dir.agents as Record<string, DirectoryAgent>).map(
      ([id, a]) => mapAgent(id, a)
    );
    return NextResponse.json({
      agents,
      count: agents.length,
      updated: dir.updated ?? new Date().toISOString(),
      source: "live",
      version: dir.version,
    });
  } catch {
    return NextResponse.json(
      { error: "directory.json not found", source: "error" },
      { status: 503 }
    );
  }
}
