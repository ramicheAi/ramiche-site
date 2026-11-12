/**
 * Command Center API authorization inventory — single source of truth.
 *
 * Every `src/app/api/command-center/**\/route.ts` is exactly one of:
 *   - HUMAN  (default): owner-only. Must be wrapped with `ownerOnly(...)` or call
 *            `requireCommandCenterOwner(req)` inside the handler. Middleware
 *            also enforces it, but the handler never relies on that.
 *   - MACHINE: authenticated by its OWN secret, no cookie/session, exempt from
 *            the owner gate and CSRF. Listed here (and ONLY here); middleware
 *            lets exactly these paths through, and a test asserts each verifies
 *            its secret on every exported method.
 *
 * Adding a route that is in neither category fails the inventory test.
 */
export const MACHINE_ROUTES = {
  "/api/command-center/chat/webhook": { caller: "OpenClaw gateway / automations", secretEnv: "OPENCLAW_CC_WEBHOOK_TOKEN | OPENCLAW_GATEWAY_TOKEN", carrier: "Authorization: Bearer" },
  "/api/command-center/push": { caller: "Agents / external systems", secretEnv: "CC_PUSH_SECRET", carrier: "x-cc-push-secret | Authorization: Bearer" },
  "/api/command-center/telegram/webhook": { caller: "Telegram Bot API", secretEnv: "TELEGRAM_WEBHOOK_SECRET", carrier: "X-Telegram-Bot-Api-Secret-Token" },
  "/api/command-center/voice/call/webhook": { caller: "Vapi end-of-call report", secretEnv: "VAPI_WEBHOOK_SECRET", carrier: "x-vapi-secret | Authorization: Bearer" },
} as const;

export function isMachineRoutePath(pathname: string): boolean {
  return Object.prototype.hasOwnProperty.call(MACHINE_ROUTES, pathname);
}
