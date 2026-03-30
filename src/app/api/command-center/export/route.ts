import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Crons: `jobs.json` via `resolveOpenclawCronDir()` (same as calendar), then Firestore when
 * no local file (e.g. Vercel). Agents/memory/git use workspace when present; otherwise
 * static fallbacks or empty. Implementation is dynamically imported to limit serverless bundle.
 */
export async function GET(req: NextRequest) {
  const { handleExport } = await import("./handler");
  return handleExport(req);
}
