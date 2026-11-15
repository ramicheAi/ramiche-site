import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { ownerOnly } from "@/lib/server/command-center-guard";

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

async function OPTIONS_handler() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

async function GET_handler() {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    const items = JSON.parse(raw);
    return NextResponse.json({ items }, { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json({ items: [] }, { headers: CORS_HEADERS });
  }
}

async function POST_handler(request: Request) {
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

// Owner-only: enforced in the handler itself (CC-SECURITY-RECONCILIATION-02).
export const OPTIONS = ownerOnly(OPTIONS_handler);
export const GET = ownerOnly(GET_handler);
export const POST = ownerOnly(POST_handler);
