import { NextResponse } from "next/server";

import { twilioConfig, outboundDialTwiML, normalizeE164 } from "@/lib/twilio-voice";
import { guardTwilioWebhook } from "@/lib/server/twilio-webhook-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * TwiML App Voice URL. The browser SDK's Device.connect({ params }) POSTs here
 * (form-encoded, signed by Twilio); we answer with the <Dial> TwiML that places
 * the outbound leg from the Parallax number.
 *
 * P05-B2.1: this leg never records, whatever params arrive. Recording starts only
 * through /api/command-center/voice/recording/start after the owner confirms
 * consent for the specific live call.
 */
export async function POST(req: Request) {
  const twilio = await guardTwilioWebhook(req, { includeQuery: false });
  if (!twilio.ok) return twilio.response;
  const params = twilio.params;
  const cfg = twilioConfig();
  if (!cfg) return new NextResponse("not configured", { status: 503 });

  const to = normalizeE164(params.To || params.to || "");
  if (!to) return new NextResponse("<Response><Say>No valid number.</Say></Response>", { status: 200, headers: { "content-type": "text/xml" } });

  return new NextResponse(outboundDialTwiML(cfg, to), {
    status: 200,
    headers: { "content-type": "text/xml" },
  });
}
