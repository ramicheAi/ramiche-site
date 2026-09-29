/**
 * Twilio webhook authentication (P05-B2). Machine caller, not Ramon.
 *
 * Twilio signs every webhook with HMAC-SHA1 over the exact public URL plus the
 * sorted POST params, keyed by the account auth token. This guard:
 *   - fails closed (503) when Twilio is not fully configured;
 *   - parses the form body itself so the signature check always runs first;
 *   - compares signatures in constant time;
 *   - returns the verified params for the handler to use.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import { twilioConfig } from "@/lib/twilio-voice";
import { denialResponse } from "./owner-identity";

export const TWILIO_PUBLIC_ORIGIN = "https://command.parallaxvinc.com";

export type TwilioGuardResult =
  | { ok: true; params: Record<string, string>; url: URL; principal: "service:twilio" }
  | { ok: false; status: number; reason: string; response: NextResponse };

function fail(status: number, reason: string) {
  return { ok: false as const, status, reason, response: denialResponse(status, reason) };
}

export function twilioSignatureMatches(authToken: string, url: string, params: Record<string, string>, signature: string | null): boolean {
  if (!signature || !authToken) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = Buffer.from(createHmac("sha1", authToken).update(data).digest("base64"), "utf8");
  const presented = Buffer.from(signature, "utf8");
  if (expected.length !== presented.length) return false;
  return timingSafeEqual(expected, presented);
}

/** `includeQuery`: Twilio signs query strings too when the callback URL carries one. */
export async function guardTwilioWebhook(req: Request, opts: { includeQuery: boolean }): Promise<TwilioGuardResult> {
  const cfg = twilioConfig();
  if (!cfg) return fail(503, "twilio_not_configured");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "twilio_body_invalid");
  }
  const params: Record<string, string> = {};
  form.forEach((v, k) => {
    if (typeof v === "string") params[k] = v;
  });
  const url = new URL(req.url);
  const publicUrl = `${TWILIO_PUBLIC_ORIGIN}${url.pathname}${opts.includeQuery ? url.search : ""}`;
  if (!twilioSignatureMatches(cfg.authToken, publicUrl, params, req.headers.get("x-twilio-signature"))) {
    return fail(403, "twilio_signature_invalid");
  }
  return { ok: true, params, url, principal: "service:twilio" };
}
