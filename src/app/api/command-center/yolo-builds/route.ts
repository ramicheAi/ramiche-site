import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

const WORKSPACE = process.env.OPENCLAW_WORKSPACE || "/Users/admin/.openclaw/workspace";
const BUILDS_PATH = join(WORKSPACE, "yolo-builds/builds.json");

export async function GET() {
  try {
    const raw = readFileSync(BUILDS_PATH, "utf-8");
    const builds = JSON.parse(raw);
    return NextResponse.json(builds);
  } catch {
    return NextResponse.json([], { status: 404 });
  }
}
