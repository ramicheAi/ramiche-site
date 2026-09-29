/**
 * P05-B2 route authentication policy for routes whose callers are machines, or
 * either the owner or a machine. Every other cockpit/bridge route uses the P03
 * human owner guards (verified by p03-route-coverage.test.ts).
 *
 * guard names are the exact function each handler must await first.
 */
export type B2Guard = "guardServiceCaller" | "guardOwnerOrService" | "guardTwilioWebhook";

export const B2_ROUTE_POLICY: Record<string, Partial<Record<"GET" | "POST" | "PATCH" | "PUT" | "DELETE", { guard: B2Guard; service?: string; human?: "read" | "mutation" }>>> = {
  // bridge-sync (LaunchAgent) pushes status; machine only. PATCH/GET stay human (tasks page).
  "bridge/route.ts": { POST: { guard: "guardServiceCaller", service: "bridge" } },
  // OpenClaw posts agent messages into chat; machine only.
  "command-center/chat/webhook/route.ts": { POST: { guard: "guardServiceCaller", service: "openclaw-webhook" } },
  // Agents push proactive messages (optionally spoken); machine only. GET health stays human.
  "command-center/push/route.ts": { POST: { guard: "guardServiceCaller", service: "push" } },
  // Vapi end-of-call report; machine only (credential not yet issued: fails closed).
  "command-center/voice/call/webhook/route.ts": { POST: { guard: "guardServiceCaller", service: "vapi" } },
  // Twilio TwiML App + recording callbacks; Twilio signature.
  "command-center/voice/twiml/route.ts": { POST: { guard: "guardTwilioWebhook" } },
  "command-center/voice/recording/route.ts": { POST: { guard: "guardTwilioWebhook" } },
  // Cron-driven, also runnable by Ramon from the cockpit.
  "command-center/nurture/route.ts": {
    GET: { guard: "guardOwnerOrService", service: "cron", human: "read" },
    POST: { guard: "guardOwnerOrService", service: "cron", human: "mutation" },
  },
  "command-center/prospector/daily/route.ts": { POST: { guard: "guardOwnerOrService", service: "cron", human: "mutation" } },
  "command-center/stripe-revenue/route.ts": { GET: { guard: "guardOwnerOrService", service: "cron", human: "read" } },
};

/** Routes where at least one method follows B2_ROUTE_POLICY instead of the P03 human default. */
export const B2_MACHINE_OR_MIXED = new Set<string>([
  ...Object.keys(B2_ROUTE_POLICY),
  // revenue re-exports stripe-revenue's GET
  "command-center/revenue/route.ts",
]);
