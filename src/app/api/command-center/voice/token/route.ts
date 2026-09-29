import { NextResponse } from "next/server";

import { twilioConfig, voiceAccessToken } from "@/lib/twilio-voice";
import { guardPrivateRead } from "@/lib/server/protected-mutation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET -> browser access token for the Twilio Voice SDK (click-to-call from the
 * Deal Room on the Parallax line). Answers { needsSetup: true } until the
 * Twilio env keys exist — same pattern as email send + Vapi.
 */
export async function GET(req: Request) {
  const p03Guard = await guardPrivateRead(req);
  if (!p03Guard.ok) return p03Guard.response;
  const cfg = twilioConfig();
  if (!cfg) return NextResponse.json({ needsSetup: true });
  return NextResponse.json({
    token: voiceAccessToken(cfg, "ramon"),
    identity: "ramon",
    number: cfg.phoneNumber,
  });
}
