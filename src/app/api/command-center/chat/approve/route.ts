/**
 * Phase C — Synthesis approval + handoff dispatch.
 *
 * POST /api/command-center/chat/approve  body: { messageId: string }
 *
 * Core logic: src/lib/cc-approve-synthesis.ts (also used by Telegram webhook).
 */

import { NextRequest, NextResponse } from "next/server";
import { approveSynthesisMessage } from "@/lib/cc-approve-synthesis";
import { requireFounderAuthority } from "@/lib/server/founder-authority";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  return NextResponse.json({ ok: true, accepts: ["POST"] });
}

export async function POST(req: NextRequest) {
  // CC-SECURITY-COMPLETION-02: founder authority (no-op until CC_FOUNDER_GUARD_ENFORCE
  // lists "chat-approve"). Placed first so no side effect can run for an unauthorized caller.
  const denied = requireFounderAuthority(req, "chat-approve");
  if (denied) return denied;

  try {
    const { messageId } = (await req.json()) as { messageId?: string };
    const result = await approveSynthesisMessage(String(messageId || ""));
    if (!result.ok) {
      return NextResponse.json(result, { status: result.status ?? 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("[approve] unexpected error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
