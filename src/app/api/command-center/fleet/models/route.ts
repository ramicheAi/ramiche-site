import { existsSync } from "node:fs";
import { NextResponse } from "next/server";

import { ownerOnly } from "@/lib/server/command-center-guard";
import {
  readRegistry,
  resolveConfigPath,
  writeAgentModel,
} from "@/lib/fleet/model-registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { headers: { "cache-control": "no-store" } } as const;

/**
 * GET /api/command-center/fleet/models
 *
 * The authoritative fleet registry as the cockpit may see it: provider names, advertised model
 * ids, each agent's selected primary and fallbacks, and whether a selection is advertised. No
 * credential, base URL or env value is returned.
 *
 * On a runtime without the registry (Vercel) this reports `source: "unavailable"` with a reason.
 * It never returns an empty list that could read as "no agents configured".
 */
async function GET_handler() {
  const path = resolveConfigPath();
  if (!existsSync(path)) {
    return NextResponse.json(
      {
        ok: false,
        source: "unavailable",
        reason: "fleet registry is not present on this runtime",
        detail: "This view only works where openclaw.json lives (the iMac). Vercel cannot write or read it.",
      },
      { status: 503, ...NO_STORE },
    );
  }

  try {
    const registry = readRegistry(path);
    // The client does not need, and should not receive, a filesystem path.
    const { sourcePath: _sourcePath, ...safe } = registry;
    return NextResponse.json({ ok: true, source: "live", registry: safe }, NO_STORE);
  } catch (err) {
    if (err instanceof Error && err.message.includes("agents_list_not_array")) {
      return NextResponse.json(
        { ok: false, source: "malformed", reason: "agents.list is not an array" },
        { status: 502, ...NO_STORE },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        source: "unavailable",
        reason: "registry could not be read",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502, ...NO_STORE },
    );
  }
}

const STATUS: Record<string, number> = {
  unknown_agent: 400,
  invalid_model_ref: 400,
  unknown_provider: 400,
  unsupported_model: 400,
  locked: 409,
  lock_failed: 503,
  unverifiable_provider: 400,
  duplicate_agent: 409,
  invalid_existing_model: 400,
  source_unavailable: 503,
  readback_mismatch: 502,
  write_failed: 500,
};

/**
 * POST /api/command-center/fleet/models  { agentId, model }
 *
 * Writes the primary model of one agent into openclaw.json through the locked, backed-up,
 * read-back-verified path, then reports what the file actually contains. Success is never claimed
 * from an intended write: the response carries the value re-read from disk.
 */
async function POST_handler(req: Request) {
  let body: { agentId?: unknown; model?: unknown } | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400, ...NO_STORE });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400, ...NO_STORE });
  }

  const agentId = typeof body.agentId === "string" ? body.agentId.trim() : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";
  if (!agentId || !model) {
    return NextResponse.json(
      { ok: false, reason: "agentId and model are required" },
      { status: 400, ...NO_STORE },
    );
  }

  const result = writeAgentModel({ agentId, ref: model });
  if (!result.ok) {
    return NextResponse.json(result, { status: STATUS[result.reason] ?? 400, ...NO_STORE });
  }
  // The write result already contains `ok`; nest it so the envelope stays unambiguous.
  return NextResponse.json({ ok: true, source: "live", write: result }, NO_STORE);
}

export const GET = ownerOnly(GET_handler);
export const POST = ownerOnly(POST_handler);
