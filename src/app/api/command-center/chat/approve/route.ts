/**
 * Phase C — Synthesis approval + handoff dispatch. CONSEQUENTIAL (P01 class 4+).
 * Guarded by the canonical boundary before any body parse or dispatch.
 */
import { NextRequest, NextResponse } from "next/server";
import { approveSynthesisMessage } from "@/lib/cc-approve-synthesis";
import { guardPrivateRead, guardProtectedMutation } from "@/lib/server/protected-mutation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request) {
  const p03Guard = await guardPrivateRead(req);
  if (!p03Guard.ok) return p03Guard.response;

  return NextResponse.json({ ok: true, accepts: ["POST"], guarded: true });
}

export async function POST(req: NextRequest) {
  const guard = await guardProtectedMutation(req);
  if (!guard.ok) return guard.response;

  try {
    const { messageId } = (await req.json()) as { messageId?: string };
    const result = await approveSynthesisMessage(String(messageId || ""), req);
    if (!result.ok) {
      return NextResponse.json(result, { status: result.status ?? 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("[approve] unexpected error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
