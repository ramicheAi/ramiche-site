import { NextRequest, NextResponse } from "next/server";
import {
  gatewayToolsInvoke,
  isOpenClawGatewayConfigured,
} from "@/lib/openclaw-gateway";
import { requireCommandCenterOwner, ownerDenialResponse } from "@/lib/server/command-center-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Settings → OpenClaw gateway control surface.
 *
 * Replaces the old `execSync("openclaw …")` shelling — that only worked when
 * the Next.js server lived on the same machine as OpenClaw, which is never
 * true on Vercel. Every action now goes through `gatewayToolsInvoke` which
 * speaks the gateway HTTP API at `OPENCLAW_GATEWAY_URL` (default
 * 127.0.0.1:24511, matches openclaw.json on Mac) using the bearer in
 * `OPENCLAW_GATEWAY_TOKEN` / `OPENCLAW_GATEWAY_PASSWORD`.
 *
 * Action surface (POST body { action }):
 *   - "gateway-status"   → status snapshot
 *   - "restart-gateway"  → tool: gateway, action: restart
 *   - "reload-crons"     → tool: cron, action: reload
 *   - "run-doctor"       → tool: gateway, action: doctor (best-effort)
 *   - "sessions-list"    → tool: sessions_list
 *   - "sessions-history" → tool: sessions_history
 *   - "agents-list"      → tool: agents_list
 *   - "cron-list"        → tool: cron, action: list
 *   - "cron-enable"      → tool: cron, action: enable, args: { name }
 *   - "cron-disable"     → tool: cron, action: disable, args: { name }
 *
 * Auth: now requireCommandCenterOwner() in-handler, in addition to
 * middleware.ts (CC-P06-SECURITY-RECONCILIATION-01) — this surface can
 * restart the OpenClaw gateway and enable/disable crons, so it must not
 * depend on the page-boundary PIN or on middleware alone.
 *
 * Rate limiting: lightweight in-memory "last restart" gate so we can't
 * inadvertently hammer `gateway restart`.
 */

const RESTART_COOLDOWN_MS = 60_000;
let lastRestartAt = 0;

interface GatewayActionBody {
  action?: string;
  args?: Record<string, unknown>;
}

function gatewayConfigError() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "OpenClaw gateway not configured. Set OPENCLAW_GATEWAY_URL and OPENCLAW_GATEWAY_TOKEN (or OPENCLAW_GATEWAY_PASSWORD) on the server.",
    },
    { status: 503 }
  );
}

function badAction(action: string | undefined) {
  return NextResponse.json(
    { ok: false, error: `Unknown action: ${action ?? "(missing)"}` },
    { status: 400 }
  );
}

export async function GET(req: NextRequest) {
  const guard = await requireCommandCenterOwner(req);
  if (!guard.ok) return ownerDenialResponse(guard);

  if (!isOpenClawGatewayConfigured()) {
    return NextResponse.json({ ok: false, configured: false, reachable: false });
  }
  // Probe via `agents_list` — a known-cheap, side-effect-free tool that every
  // gateway exposes. We're not parsing the result; a successful 200 + ok=true
  // is enough to call the gateway "reachable".
  const inv = await gatewayToolsInvoke({ tool: "agents_list", args: {} });
  if (!inv.ok) {
    return NextResponse.json(
      { ok: false, configured: true, reachable: false, error: inv.error },
      { status: 200 }
    );
  }
  return NextResponse.json({ ok: true, configured: true, reachable: true, status: inv.result });
}

export async function POST(req: NextRequest) {
  const guard = await requireCommandCenterOwner(req);
  if (!guard.ok) return ownerDenialResponse(guard);

  let body: GatewayActionBody = {};
  try {
    body = (await req.json()) as GatewayActionBody;
  } catch {
    /* empty body is fine for status etc. */
  }
  const action = body.action;

  if (!isOpenClawGatewayConfigured()) {
    return gatewayConfigError();
  }

  switch (action) {
    case "gateway-status": {
      const inv = await gatewayToolsInvoke({ tool: "gateway", action: "status", args: {} });
      if (!inv.ok) return NextResponse.json({ ok: false, error: inv.error }, { status: 502 });
      return NextResponse.json({ ok: true, status: inv.result });
    }

    case "restart-gateway": {
      const now = Date.now();
      if (now - lastRestartAt < RESTART_COOLDOWN_MS) {
        const wait = Math.ceil((RESTART_COOLDOWN_MS - (now - lastRestartAt)) / 1000);
        return NextResponse.json(
          { ok: false, error: `Cooldown active. Try again in ${wait}s.` },
          { status: 429 }
        );
      }
      const inv = await gatewayToolsInvoke({ tool: "gateway", action: "restart", args: {} });
      if (!inv.ok) return NextResponse.json({ ok: false, error: inv.error }, { status: 502 });
      lastRestartAt = now;
      return NextResponse.json({ ok: true, output: inv.result });
    }

    case "reload-crons": {
      const inv = await gatewayToolsInvoke({ tool: "cron", action: "reload", args: {} });
      if (!inv.ok) return NextResponse.json({ ok: false, error: inv.error }, { status: 502 });
      return NextResponse.json({ ok: true, output: inv.result });
    }

    case "run-doctor": {
      const inv = await gatewayToolsInvoke({ tool: "gateway", action: "doctor", args: {} });
      if (!inv.ok) {
        return NextResponse.json(
          { ok: false, error: inv.error || "doctor not supported by this gateway" },
          { status: 502 }
        );
      }
      return NextResponse.json({ ok: true, output: inv.result });
    }

    case "sessions-list": {
      const inv = await gatewayToolsInvoke({ tool: "sessions_list", args: {} });
      if (!inv.ok) return NextResponse.json({ ok: false, error: inv.error }, { status: 502 });
      return NextResponse.json({ ok: true, sessions: inv.result });
    }

    case "sessions-history": {
      const inv = await gatewayToolsInvoke({
        tool: "sessions_history",
        args: body.args ?? {},
      });
      if (!inv.ok) return NextResponse.json({ ok: false, error: inv.error }, { status: 502 });
      return NextResponse.json({ ok: true, history: inv.result });
    }

    case "agents-list": {
      const inv = await gatewayToolsInvoke({ tool: "agents_list", args: {} });
      if (!inv.ok) return NextResponse.json({ ok: false, error: inv.error }, { status: 502 });
      return NextResponse.json({ ok: true, agents: inv.result });
    }

    case "cron-list": {
      const inv = await gatewayToolsInvoke({ tool: "cron", action: "list", args: {} });
      if (!inv.ok) return NextResponse.json({ ok: false, error: inv.error }, { status: 502 });
      return NextResponse.json({ ok: true, crons: inv.result });
    }

    case "cron-enable":
    case "cron-disable": {
      const name = typeof body.args?.name === "string" ? (body.args!.name as string) : "";
      if (!name) {
        return NextResponse.json({ ok: false, error: "args.name required" }, { status: 400 });
      }
      const inv = await gatewayToolsInvoke({
        tool: "cron",
        action: action === "cron-enable" ? "enable" : "disable",
        args: { name },
      });
      if (!inv.ok) return NextResponse.json({ ok: false, error: inv.error }, { status: 502 });
      return NextResponse.json({ ok: true, output: inv.result });
    }

    default:
      return badAction(action);
  }
}
