/**
 * Command Center API authorization inventory — single source of truth.
 *
 * Every `src/app/api/command-center/**\/route.ts` is exactly one of:
 *   - HUMAN  (default): owner-only. Must be wrapped with `ownerOnly(...)` or call
 *            `requireCommandCenterOwner(req)` / `requireFreshFirebaseOwnerSession(req)`
 *            inside the handler. Middleware also enforces it, but the handler
 *            never relies on that.
 *   - MACHINE: authenticated by its OWN secret, no cookie/session, exempt from
 *            the owner gate and CSRF. Listed here (and ONLY here); middleware
 *            lets exactly these paths through, and a test asserts each verifies
 *            its secret on every exported method.
 *   - DEVICE: authenticated by the trusted-device PIN-unlock credential
 *            (see command-center-device-trust.ts) instead of a Firebase
 *            session — exempt from the Firebase owner gate (middleware lets
 *            exactly these paths through) because that gate is exactly what
 *            this route exists to be reachable WITHOUT. Must call
 *            `verifyDeviceCookie(` and deny close on an invalid/missing
 *            device credential; a test asserts this on every method.
 *
 * Adding a route that is in none of these categories fails the inventory test.
 */
export const MACHINE_ROUTES = {
  "/api/command-center/chat/webhook": { caller: "OpenClaw gateway / automations", secretEnv: "OPENCLAW_CC_WEBHOOK_TOKEN | OPENCLAW_GATEWAY_TOKEN", carrier: "Authorization: Bearer" },
  "/api/command-center/push": { caller: "Agents / external systems", secretEnv: "CC_PUSH_SECRET", carrier: "x-cc-push-secret | Authorization: Bearer" },
  "/api/command-center/telegram/webhook": { caller: "Telegram Bot API", secretEnv: "TELEGRAM_WEBHOOK_SECRET", carrier: "X-Telegram-Bot-Api-Secret-Token" },
  "/api/command-center/prospector/cron": { caller: "launchd/cron prospector scheduler", secretEnv: "PROSPECTOR_CRON_SECRET", carrier: "x-cron-secret | Authorization: Bearer" },
  "/api/command-center/voice/call/webhook": { caller: "Vapi end-of-call report", secretEnv: "VAPI_WEBHOOK_SECRET", carrier: "x-vapi-secret | Authorization: Bearer" },
} as const;

export function isMachineRoutePath(pathname: string): boolean {
  return Object.prototype.hasOwnProperty.call(MACHINE_ROUTES, pathname);
}

/**
 * The PIN only unlocks an already-Firebase-enrolled device (founder
 * Priority 1 decision) — it never independently establishes ownership, so
 * it must never be gated behind the Firebase owner session it exists to
 * let the owner skip. Exactly one route lives here; enrollment and
 * revocation stay HUMAN (Firebase-only) on purpose.
 */
export const DEVICE_ROUTES = {
  "/api/command-center/auth/pin": { purpose: "PIN-unlock an already-enrolled trusted device" },
} as const;

export function isDeviceRoutePath(pathname: string): boolean {
  return Object.prototype.hasOwnProperty.call(DEVICE_ROUTES, pathname);
}
