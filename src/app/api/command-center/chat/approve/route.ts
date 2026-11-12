/**
 * Phase C — Synthesis approval + handoff dispatch.
 *
 * POST /api/command-center/chat/approve  body: { messageId: string }
 *
 * Core logic: src/lib/cc-approve-synthesis.ts (also used by Telegram webhook).
 */

import { NextRequest, NextResponse } from "next/server";
import { approveSynthesisMessage } from "@/lib/cc-approve-synthesis";
import { ownerOnly } from "@/lib/server/command-center-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function GET_handler() {
  return NextResponse.json({ ok: true, accepts: ["POST"] });
}

async function POST_handler(req: NextRequest) {
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

// Owner-only: enforced in the handler itself (CC-SECURITY-RECONCILIATION-02).
export const GET = ownerOnly(GET_handler);
export const POST = ownerOnly(POST_handler);
