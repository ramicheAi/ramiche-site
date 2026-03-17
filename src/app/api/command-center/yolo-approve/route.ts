import { NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

const BUILDS_DIR = join(process.cwd(), "public/yolo-builds");

const TIER_CONFIG = {
  internal: { file: "approved-internal.json", status: "queued_for_deploy" },
  integrate: { file: "approved-integrate.json", status: "queued_for_integration" },
  product: { file: "approved-product.json", status: "queued_for_launch" },
} as const;

type Tier = keyof typeof TIER_CONFIG;

interface ApproveBody {
  folder: string;
  name: string;
  tier: Tier;
  agent: string;
}

async function loadEntries(filePath: string): Promise<unknown[]> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ApproveBody;
    const { folder, name, tier, agent } = body;

    if (!folder || !name || !tier || !agent) {
      return NextResponse.json(
        { error: "Missing required fields: folder, name, tier, agent" },
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

    const filePath = join(BUILDS_DIR, config.file);
    const entries = await loadEntries(filePath);

    entries.push({
      folder,
      name,
      agent,
      approvedAt: new Date().toISOString(),
      status: config.status,
    });

    await writeFile(filePath, JSON.stringify(entries, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      tier,
      action: `${name} approved for ${tier} — ${config.status.replaceAll("_", " ")}`,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to process approval" },
      { status: 500 }
    );
  }
}
