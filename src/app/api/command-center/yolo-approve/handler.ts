import { NextResponse } from "next/server";
import { readFile, writeFile, appendFile } from "fs/promises";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { tmpdir } from "os";

function workspaceDir(): string | null {
  const w = process.env.OPENCLAW_WORKSPACE?.trim();
  return w && w.length > 0 ? w : null;
}

function memoryDir(): string {
  const ws = workspaceDir();
  return ws ? join(ws, "memory") : join(tmpdir(), "ramiche-cc-memory");
}

function tierOutputDir(): string {
  const ws = workspaceDir();
  if (ws) {
    const wsBuilds = join(ws, "builds");
    if (existsSync(wsBuilds)) return wsBuilds;
  }
  return join(tmpdir(), "ramiche-yolo-builds");
}

const TIER_STATUS: Record<string, string> = {
  internal: "queued_for_deploy",
  integrate: "queued_for_integration",
  product: "queued_for_launch",
};

type Tier = "internal" | "integrate" | "product";

const VALID_TIERS = new Set<string>(["internal", "integrate", "product"]);

interface ApproveBody {
  folder: string;
  name: string;
  tier?: Tier;
  agent: string;
  action: "approve" | "reject";
  reason?: string;
}

/**
 * Compute the approvals filename at runtime from the dynamic `tier` value.
 * The string is intentionally not resolvable to literals at build time so
 * NFT does not over-trace the workspace into the serverless bundle.
 */
function approvalsFilename(tier: string): string {
  const safe = tier.replace(/[^a-z]/g, "");
  return ["approved", safe].join("-") + ".json";
}

async function logToMemory(entry: string) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const dir = memoryDir();
    const memoryFile = join(dir, `${today}.md`);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    await appendFile(memoryFile, `\n${entry}\n`);
  } catch { /* non-critical */ }
}

export async function handleYoloApprove(request: Request) {
  try {
    const body = (await request.json()) as ApproveBody;
    const { folder, name, agent, action = "approve", tier, reason } = body;

    if (!folder || !name || !agent) {
      return NextResponse.json(
        { error: "Missing required fields: folder, name, agent" },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();

    if (action === "reject") {
      const rejectEntry = `## [${new Date().toLocaleTimeString()}] YOLO Reject — ${name}\n- **Build:** ${folder}\n- **Agent:** ${agent}\n- **Reason:** ${reason || "No reason provided"}\n- **Decision by:** Ramon\n- **Timestamp:** ${timestamp}\n`;
      await logToMemory(rejectEntry);

      return NextResponse.json({
        success: true,
        action: `${name} rejected — logged to memory`,
        reason,
      });
    }

    if (!tier || !VALID_TIERS.has(tier)) {
      return NextResponse.json(
        { error: `Tier required (one of internal, integrate, product); got ${tier ?? "undefined"}` },
        { status: 400 }
      );
    }

    const status = TIER_STATUS[tier];
    const outDir = tierOutputDir();
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    const filePath = join(outDir, approvalsFilename(tier));

    let entries: unknown[] = [];
    try {
      const raw = await readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) entries = parsed;
    } catch { /* empty list */ }

    entries.push({
      folder,
      name,
      agent,
      approvedAt: timestamp,
      status,
    });

    await writeFile(filePath, JSON.stringify(entries, null, 2), "utf-8");

    const approveEntry = `## [${new Date().toLocaleTimeString()}] YOLO Approved — ${name}\n- **Build:** ${folder}\n- **Agent:** ${agent}\n- **Tier:** ${tier} (${status.replaceAll("_", " ")})\n- **Decision by:** Ramon\n- **Timestamp:** ${timestamp}\n`;
    await logToMemory(approveEntry);

    let gateway: { ok: boolean; detail?: string } = { ok: false };
    const gatewayConfigured =
      !!process.env.OPENCLAW_GATEWAY_TOKEN?.trim() ||
      !!process.env.OPENCLAW_GATEWAY_PASSWORD?.trim();
    if (gatewayConfigured) {
      const { gatewaySessionsSpawn } = await import("@/lib/openclaw-gateway");
      const task = [
        `YOLO build promoted: ${name} (${folder})`,
        `Tier: ${tier} → ${status}`,
        `Assigned agent: ${agent}`,
        `Source path: builds/${folder}`,
        `Next: implement deployment / integration per tier playbook.`,
      ].join("\n");
      const spawn = await gatewaySessionsSpawn({
        task,
        label: `yolo-${folder.slice(0, 24)}`,
      });
      gateway = spawn.ok
        ? { ok: true, detail: "sessions_spawn accepted" }
        : { ok: false, detail: spawn.error };
    }

    return NextResponse.json({
      success: true,
      tier,
      action: `${name} approved for ${tier} — ${status.replaceAll("_", " ")}`,
      gateway,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to process action" },
      { status: 500 }
    );
  }
}
