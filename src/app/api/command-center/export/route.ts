import { NextRequest, NextResponse } from "next/server";
import { ownerOnly } from "@/lib/server/command-center-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Crons: `jobs.json` via `resolveOpenclawCronDir()` (same as calendar), then Firestore when
 * no local file (e.g. Vercel). Agents/memory/git use workspace when present; otherwise
 * static fallbacks or empty. Implementation is dynamically imported to limit serverless bundle.
 */
async function GET_handler(req: NextRequest) {
  const { handleExport } = await import("./handler");
  return handleExport(req);
}

// Owner-only: enforced in the handler itself (CC-SECURITY-RECONCILIATION-02).
export const GET = ownerOnly(GET_handler);
