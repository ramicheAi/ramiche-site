import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

const DATA_PATH = join(
  process.env.HOME || "/Users/admin",
  ".openclaw/workspace/shared/artifacts/quantitative/dashboard_api.json"
);

export async function GET() {
  try {
    const raw = await readFile(DATA_PATH, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "MERIDIAN data not available" },
      { status: 503 }
    );
  }
}
