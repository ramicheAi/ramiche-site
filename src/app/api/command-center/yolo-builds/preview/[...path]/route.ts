import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WS = process.env.OPENCLAW_WORKSPACE ?? "/Users/admin/.openclaw/workspace";
const BUILDS_DIR_WS = join(WS, "builds");
const BUILDS_DIR_PUBLIC = join(process.cwd(), "public/yolo-builds");

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const relPath = segments.join("/");

  // Security: block path traversal
  if (relPath.includes("..")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Try workspace first, then public
  let filePath = join(BUILDS_DIR_WS, relPath);
  if (!existsSync(filePath)) {
    filePath = join(BUILDS_DIR_PUBLIC, relPath);
  }
  if (!existsSync(filePath)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = extname(filePath).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";

  const body = readFileSync(filePath);
  return new NextResponse(body, {
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=3600" },
  });
}
