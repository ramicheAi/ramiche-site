import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

const WORKSPACE = process.env.OPENCLAW_WORKSPACE || "/Users/admin/.openclaw/workspace";
const DIRECTORY_PATH = join(WORKSPACE, "agents/directory.json");

/* ─── Read live agent directory from workspace ────────────────────────── */
async function loadDirectory(): Promise<Record<string, any> | null> {
  try {
    const raw = await readFile(DIRECTORY_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* ─── Read recent sessions to determine active/idle status ──────────── */
async function loadSessionStatus(): Promise<Record<string, string>> {
  // Try reading from bridge-sync output if available
  try {
    const raw = await readFile(join(WORKSPACE, "agents/session-status.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function GET() {
  const directory = await loadDirectory();
  if (!directory) {
    return NextResponse.json({ error: "Agent directory not found" }, { status: 500 });
  }

  const sessionStatus = await loadSessionStatus();
  const agents = directory.agents || {};

  const result = Object.entries(agents).map(([id, agent]: [string, any]) => ({
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    model: agent.model || "unknown",
    provider: agent.provider || "unknown",
    role: agent.role || "unassigned",
    capabilities: agent.capabilities || [],
    skills: agent.skills || [],
    escalationLevel: agent.escalation_level || "unknown",
    notes: agent.notes || null,
    status: sessionStatus[id] || "idle",
  }));

  return NextResponse.json({
    agents: result,
    count: result.length,
    updated: directory.updated || null,
    source: "workspace/agents/directory.json",
  });
}
