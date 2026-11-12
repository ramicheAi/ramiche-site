import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync, realpathSync } from "fs";
import { join, extname, sep } from "path";
import { ownerOnly } from "@/lib/server/command-center-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WS = process.env.OPENCLAW_WORKSPACE ?? "/Users/admin/.openclaw/workspace";
const BUILDS_DIR_WS = join(WS, "builds");

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

async function GET_handler(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const relPath = segments.join("/");

  // Security: block path traversal
  if (relPath.includes("..")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Workspace only. Builds must never live under public/: Next serves public/ files
  // statically with the global CSP (no sandbox), reachable via encoded paths.
  const filePath = join(BUILDS_DIR_WS, relPath);
  if (!existsSync(filePath)) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Contain symlinks: the resolved file must stay inside the builds directory.
  try {
    const base = realpathSync(BUILDS_DIR_WS);
    const real = realpathSync(filePath);
    if (real !== base && !real.startsWith(base + sep)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = extname(filePath).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";

  const body = readFileSync(filePath);
  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      // Agent-generated content is untrusted. Never cacheable by shared caches (it is owner-only).
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // Opaque-origin sandbox: scripts may run for previewing, but with no access to the
      // Command Center origin (cookies, storage, same-origin fetch), no top navigation,
      // no forms/popups, and no network egress beyond images/fonts/media from https or data.
      "Content-Security-Policy":
        "sandbox allow-scripts; default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data: https:; media-src 'self' data: blob: https:; connect-src 'none'; form-action 'none'; frame-ancestors 'self'; base-uri 'none'",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Referrer-Policy": "no-referrer",
    },
  });
}

// Owner-only: enforced in the handler itself (CC-SECURITY-RECONCILIATION-02).
export const GET = ownerOnly(GET_handler);
