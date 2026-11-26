/* ══════════════════════════════════════════════════════════════
   SYNTHETIC OWNER COOKIES

   The Command Center is owner-gated by two cookies signed with secrets the
   DEPLOYMENT provides. This mints them for the synthetic device row in the
   fake Supabase, using the same HMAC the server verifies. Nothing here can
   authenticate against production: the secrets are local e2e values and the
   device row exists only in the harness database.
   ══════════════════════════════════════════════════════════════ */
import { createHmac } from "node:crypto";

export const DEVICE_ID = "11111111-1111-4111-8111-111111111111";
export const DEVICE_SECRET = "e2e-device-secret-0123456789abcdef0123456789abcdef";

/** `cc_device` = `<deviceId>.<secret>` (parseDeviceCookie). */
export function deviceCookie() {
  return `${DEVICE_ID}.${DEVICE_SECRET}`;
}

/** `cc_unlock` = `<deviceId>.<issuedAtS>.<hmac(deviceId.issuedAtS)>`. */
export function unlockCookie(secret = process.env.CC_UNLOCK_SIGNING_SECRET, now = Date.now()) {
  if (!secret) throw new Error("CC_UNLOCK_SIGNING_SECRET is required to mint the unlock cookie");
  const issuedAtS = Math.floor(now / 1000);
  const sig = createHmac("sha256", secret).update(`${DEVICE_ID}.${issuedAtS}`, "utf8").digest("hex");
  return `${DEVICE_ID}.${issuedAtS}.${sig}`;
}

export function ownerCookies(baseURL, secret) {
  return [
    { name: "cc_device", value: deviceCookie(), url: baseURL },
    { name: "cc_unlock", value: unlockCookie(secret), url: baseURL },
  ];
}
