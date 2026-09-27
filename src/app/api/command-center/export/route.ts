import { guardPrivateRead } from "@/lib/server/protected-mutation";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Crons: `jobs.json` via `resolveOpenclawCronDir()` (same as calendar), then Firestore when
 * no local file (e.g. Vercel). Agents/memory/git use workspace when present; otherwise
 * static fallbacks or empty. Implementation is dynamically imported to limit serverless bundle.
 */
export async function GET(req: NextRequest) {
  const p03Guard = await guardPrivateRead(req);
  if (!p03Guard.ok) return p03Guard.response;

  const { handleExport } = await import("./handler");
  return handleExport(req);
}
