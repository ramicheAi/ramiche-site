import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const DATA_PATH = path.join(
  process.env.HOME || "/Users/admin",
  ".openclaw/workspace-strange/multiverse/data.json"
);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    const items = JSON.parse(raw);
    return NextResponse.json({ items }, { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json({ items: [] }, { headers: CORS_HEADERS });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items = body.items || [];
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, JSON.stringify(items, null, 2));
    return NextResponse.json(
      { ok: true, count: items.length },
      { headers: CORS_HEADERS }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e) },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
