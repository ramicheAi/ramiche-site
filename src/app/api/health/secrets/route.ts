import { NextResponse } from "next/server";
import Stripe from "stripe";

/* ══════════════════════════════════════════════════════════════
   GET /api/health/secrets — are this site's credentials actually valid?

   Written after a live incident on 2026-07-31. On power-challenge, a
   stored production secret had been silently replaced by a Vercel
   "sensitive env" wrapper blob: a base64 string beginning `eyJ2Ijoi`,
   which decodes to `{"v":"`. Stripe rejected every checkout and the site
   took zero payments for roughly 17 days.

   Two things hid it:
     1. The project had not been redeployed, so the live deployment kept
        serving its own older, working env snapshot. The break is LATENT
        and only lands on the next deploy.
     2. `/api/health` only checked that Firebase env vars were present, so
        it reported healthy the entire time. Presence is not validity.

   A fleet audit then found the same mass env write hit at least 7 of 11
   Vercel projects on 2026-07-14, and mettle-arena was confirmed broken in
   production with all five of its secrets corrupted. Ten of this project's
   secrets were written in that same batch.

   This project has NOT been redeployed since, so it is expected to look
   healthy today and break on the next deploy. Re-set the secrets in Vercel
   before deploying, then confirm here.

   Kept separate from `/api/health` so the existing liveness contract is
   untouched.

   GET /api/health/secrets          -> status plus the names of failing checks
   GET /api/health/secrets?detail=1 -> adds prefixes and lengths

   Never returns a secret value.
   ══════════════════════════════════════════════════════════════ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckStatus = "ok" | "fail" | "skipped";

interface Check {
  name: string;
  status: CheckStatus;
  detail: string;
  debug?: string;
}

/* The fingerprint of the incident. Any `eyJ` prefix means we are looking at
   base64 JSON rather than a real secret. It works even for secrets with no
   known prefix, which is most of the ones below. */
function looksWrapped(value: string): boolean {
  return value.startsWith("eyJ");
}

function shapeCheck(name: string, value: string | undefined, expectedPrefix?: string): Check {
  if (!value) return { name, status: "fail", detail: "not set" };
  if (looksWrapped(value)) {
    return {
      name,
      status: "fail",
      detail: "value looks like a wrapped env blob, not a real secret. Re-set it in Vercel.",
      debug: `starts "${value.slice(0, 6)}", length ${value.length}`,
    };
  }
  if (/\s/.test(value)) {
    return {
      name,
      status: "fail",
      detail: "contains whitespace or a trailing newline, which breaks HTTP headers",
      debug: `length ${value.length}`,
    };
  }
  if (expectedPrefix && !value.startsWith(expectedPrefix)) {
    return {
      name,
      status: "fail",
      detail: `expected a ${expectedPrefix} secret`,
      debug: `starts "${value.slice(0, 6)}", length ${value.length}`,
    };
  }
  return { name, status: "ok", detail: "present and well formed", debug: `length ${value.length}` };
}

/* Shape is not proof. This asks Stripe whether it accepts the key. */
async function stripeLiveCheck(key: string | undefined): Promise<Check> {
  const name = "stripe_api_reachable";
  if (!key || looksWrapped(key)) return { name, status: "skipped", detail: "key failed the shape check" };
  try {
    const stripe = new Stripe(key);
    const account = await stripe.accounts.retrieve();
    if (!account.charges_enabled) {
      return { name, status: "fail", detail: "Stripe account cannot currently accept charges" };
    }
    return {
      name,
      status: "ok",
      detail: `authenticated as "${account.business_profile?.name || account.id}", charges enabled`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return { name, status: "fail", detail: `Stripe rejected the key: ${message.slice(0, 140)}` };
  }
}

/* OpenRouter exposes a free key-introspection endpoint, which makes it the
   cheapest real auth probe available among the AI providers here. */
async function openRouterLiveCheck(key: string | undefined): Promise<Check> {
  const name = "openrouter_api_reachable";
  if (!key || looksWrapped(key)) return { name, status: "skipped", detail: "key failed the shape check" };
  try {
    const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok) return { name, status: "ok", detail: "OpenRouter accepted the key" };
    return { name, status: "fail", detail: `OpenRouter rejected the key with HTTP ${res.status}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return { name, status: "fail", detail: message.slice(0, 140) };
  }
}

export async function GET(req: Request) {
  const wantsDetail = new URL(req.url).searchParams.get("detail") === "1";

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  const checks: Check[] = [
    shapeCheck("stripe_secret_key_shape", stripeKey, "sk_"),
    shapeCheck("openrouter_api_key_shape", openRouterKey, "sk-or-"),
    shapeCheck("openai_image_api_key_shape", process.env.OPENAI_IMAGE_API_KEY, "sk-"),
    shapeCheck("deepseek_api_key_shape", process.env.DEEPSEEK_API_KEY, "sk-"),
    shapeCheck("gemini_api_key_shape", process.env.GEMINI_API_KEY, "AIza"),
    /* No published prefix on these, but the blob and whitespace checks still
       apply, and each one silently disables a whole capability if corrupt. */
    shapeCheck("bridge_api_secret_shape", process.env.BRIDGE_API_SECRET),
    shapeCheck("openclaw_gateway_token_shape", process.env.OPENCLAW_GATEWAY_TOKEN),
    shapeCheck("claude_max_proxy_token_shape", process.env.CLAUDE_MAX_PROXY_TOKEN),
    shapeCheck("vapid_private_key_shape", process.env.VAPID_PRIVATE_KEY),
    ...(await Promise.all([stripeLiveCheck(stripeKey), openRouterLiveCheck(openRouterKey)])),
  ];

  const failed = checks.filter((c) => c.status === "fail");
  const stripeBroken = failed.some((c) => c.name.startsWith("stripe"));
  const status = failed.length === 0 ? "ok" : stripeBroken ? "critical" : "degraded";

  const body = wantsDetail
    ? { status, checkedAt: new Date().toISOString(), checks }
    : { status, failing: failed.map(({ name, detail }) => ({ name, detail })) };

  return NextResponse.json(body, {
    status: status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
