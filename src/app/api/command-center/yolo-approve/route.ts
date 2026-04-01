import { NextResponse } from "next/server";
import { readFile, writeFile, appendFile } from "fs/promises";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { gatewaySessionsSpawn, isOpenClawGatewayConfigured } from "@/lib/openclaw-gateway";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WS = process.env.OPENCLAW_WORKSPACE ?? "/Users/admin/.openclaw/workspace";
const BUILDS_DIR_WS = join(WS, "builds");
const BUILDS_DIR_PUBLIC = join(process.cwd(), "public/builds");
const MEMORY_DIR = join(WS, "memory");

function tierOutputDir(): string {
  if (existsSync(BUILDS_DIR_WS)) return BUILDS_DIR_WS;
  return BUILDS_DIR_PUBLIC;
}

const TIER_CONFIG = {
  internal: { file: "approved-internal.json", status: "queued_for_deploy" },
  integrate: { file: "approved-integrate.json", status: "queued_for_integration" },
  product: { file: "approved-product.json", status: "queued_for_launch" },
} as const;

type Tier = keyof typeof TIER_CONFIG;

interface ApproveBody {
  folder: string;
  name: string;
  tier?: Tier;
  agent: string;
  action: "approve" | "reject";
  reason?: string;
}

async function loadEntries(filePath: string): Promise<unknown[]> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function logToMemory(entry: string) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const memoryFile = join(MEMORY_DIR, `${today}.md`);
    if (!existsSync(MEMORY_DIR)) mkdirSync(MEMORY_DIR, { recursive: true });
    await appendFile(memoryFile, `\n${entry}\n`);
  } catch { /* non-critical */ }
}

export async function POST(request: Request) {
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

    if (!tier) {
      return NextResponse.json(
        { error: "Tier required for approval (internal, integrate, product)" },
        { status: 400 }
      );
    }

    const config = TIER_CONFIG[tier];
    if (!config) {
      return NextResponse.json(
        { error: `Invalid tier: ${tier}. Must be internal, integrate, or product` },
        { status: 400 }
      );
    }

    const outDir = tierOutputDir();
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    const filePath = join(outDir, config.file);
    const entries = await loadEntries(filePath);

    entries.push({
      folder,
      name,
      agent,
      approvedAt: timestamp,
      status: config.status,
    });

    await writeFile(filePath, JSON.stringify(entries, null, 2), "utf-8");

    const approveEntry = `## [${new Date().toLocaleTimeString()}] YOLO Approved — ${name}\n- **Build:** ${folder}\n- **Agent:** ${agent}\n- **Tier:** ${tier} (${config.status.replaceAll("_", " ")})\n- **Decision by:** Ramon\n- **Timestamp:** ${timestamp}\n`;
    await logToMemory(approveEntry);

    let gateway: { ok: boolean; detail?: string } = { ok: false };
    if (isOpenClawGatewayConfigured()) {
      const task = [
        `YOLO build promoted: ${name} (${folder})`,
        `Tier: ${tier} → ${config.status}`,
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
      action: `${name} approved for ${tier} — ${config.status.replaceAll("_", " ")}`,
      gateway,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to process action" },
      { status: 500 }
    );
  }
}
