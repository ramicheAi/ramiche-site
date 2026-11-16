/**
 * Phase C+F sibling — Reject a synthesis plan.
 *
 * POST /api/command-center/chat/reject
 *   body: { messageId: string, resolution?: string }
 *
 * See src/lib/cc-reject-synthesis.ts for the actual logic and the race-safety argument. This
 * route is intentionally thin: owner-gated, parse the body, call the library function, map its
 * result onto an HTTP response. No SSE here (unlike /approve/stream) — rejecting never dispatches
 * anything, so there is no multi-step progress to stream.
 */

import { NextRequest, NextResponse } from "next/server";
import { rejectSynthesisMessage } from "@/lib/cc-reject-synthesis";
import { ownerOnly } from "@/lib/server/command-center-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function GET_handler() {
  return NextResponse.json({ ok: true, accepts: ["POST"] });
}

async function POST_handler(req: NextRequest) {
  let body: { messageId?: string; resolution?: string };
  try {
    body = (await req.json()) as { messageId?: string; resolution?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.messageId || typeof body.messageId !== "string") {
    return NextResponse.json({ ok: false, error: "messageId required" }, { status: 400 });
  }
  const resolution = typeof body.resolution === "string" ? body.resolution : undefined;

  const result = await rejectSynthesisMessage(body.messageId, resolution);
  if (!result.ok) {
    return NextResponse.json(result, { status: result.status ?? 500 });
  }
  return NextResponse.json(result);
}

// Owner-only: enforced in the handler itself (same contract as action-status, decisions, approve).
export const GET = ownerOnly(GET_handler);
export const POST = ownerOnly(POST_handler);
