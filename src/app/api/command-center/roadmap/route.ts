import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireFounderAuthority } from "@/lib/server/founder-authority";

export const dynamic = "force-dynamic";

const DATA_PATH = path.join(
  process.env.HOME || "/Users/admin",
  ".openclaw/workspace-strange/multiverse/data.json"
);

// No route-level CORS headers: this previously set Access-Control-Allow-Origin: "*",
// open to any origin, on a handler that overwrites a file on the server's filesystem
// with attacker-supplied JSON. next.config.ts already applies
// Access-Control-Allow-Origin for /api/:path* scoped to this site's own origin; a
// second, wildcard value here would also have produced two ACAO header values on the
// wire, which browsers reject as invalid CORS. Removed rather than fixed in place.

export async function GET() {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    const items = JSON.parse(raw);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

export async function POST(request: Request) {
  const denied = requireFounderAuthority(request, "roadmap");
  if (denied) return denied;
  try {
    const body = await request.json();
    const items = body.items || [];
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, JSON.stringify(items, null, 2));
    return NextResponse.json({ ok: true, count: items.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
