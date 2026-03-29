import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();

    switch (action) {
      case "restart-gateway": {
        const output = safe(
          () => execSync("openclaw gateway restart 2>&1", { encoding: "utf-8", timeout: 10000 }),
          "Gateway restart command not available on this host"
        );
        return NextResponse.json({ ok: true, output });
      }
      case "run-doctor": {
        const output = safe(
          () => execSync("openclaw doctor 2>&1", { encoding: "utf-8", timeout: 15000 }),
          "Doctor command not available on this host"
        );
        return NextResponse.json({ ok: true, output });
      }
      case "reload-crons": {
        const output = safe(
          () => execSync("openclaw cron reload 2>&1", { encoding: "utf-8", timeout: 10000 }),
          "Cron reload not available on this host"
        );
        return NextResponse.json({ ok: true, output });
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
