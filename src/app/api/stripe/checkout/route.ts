import { NextResponse } from "next/server";
import Stripe from "stripe";
import { rateLimit, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { parseBody, isOneOf, sanitize, badRequest } from "@/lib/api-security";
import { withAudit } from "@/lib/api-audit";

/* ══════════════════════════════════════════════════════════════
   STRIPE CHECKOUT SESSION — API Route (Stripe Connect)
   Creates a Stripe Checkout session for a selected plan tier
   Supports: Starter ($149), Professional ($349), Program ($549)
   Platform fee: 10% via application_fee_percent on Connect
   ══════════════════════════════════════════════════════════════ */

const PLATFORM_FEE_PERCENT = 10; // 90/10 split: team gets 90%, platform takes 10%

// Price IDs — set via env vars, or create in Stripe Dashboard → Products
const STARTER_PRICE_ID = process.env.STRIPE_STARTER_PRICE_ID || "price_starter_monthly";
const CLUB_PRICE_ID = process.env.STRIPE_CLUB_PRICE_ID || "price_club_monthly";
const PROGRAM_PRICE_ID = process.env.STRIPE_PROGRAM_PRICE_ID || "price_program_monthly";

const VALID_PRICES: Record<string, { priceId: string; planId: string }> = {
  price_starter_monthly: { priceId: STARTER_PRICE_ID, planId: "starter" },
  price_club_monthly: { priceId: CLUB_PRICE_ID, planId: "club" },
  price_program_monthly: { priceId: PROGRAM_PRICE_ID, planId: "program" },
};

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set in environment variables");
  }
  return new Stripe(key, { apiVersion: "2026-01-28.clover" });
}

export const POST = withAudit("/api/stripe/checkout", async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = rateLimit(`checkout:${ip}`, 10, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { data: body, error: parseError } = await parseBody(req);
    if (parseError || !body) return badRequest(parseError || "Invalid request");

    const priceId = sanitize(body.priceId, 100);
    const planId = body.planId ? sanitize(body.planId, 50) : undefined;
    const connectedAccountId = body.connectedAccountId ? sanitize(body.connectedAccountId, 100) : undefined;

    if (!isOneOf(priceId, Object.keys(VALID_PRICES))) {
      return badRequest("Invalid price ID");
    }

    // Determine base URL for redirects
    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer")?.replace(/\/[^/]*$/, "") ||
      "http://localhost:3000";

    const stripe = getStripe();

    const resolvedPlanId = planId || VALID_PRICES[priceId].planId;

    // Build checkout params — add Connect fields when team has a connected account
    const checkoutParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: VALID_PRICES[priceId].priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/apex-athlete/billing?success=true&plan=${resolvedPlanId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/apex-athlete/billing?canceled=true`,
      metadata: {
        planId: resolvedPlanId,
      },
    };

    // Stripe Connect: route payment to team's connected account with platform fee
    if (connectedAccountId) {
      checkoutParams.subscription_data = {
        application_fee_percent: PLATFORM_FEE_PERCENT,
      };
      // Use on_behalf_of to connect the subscription to the team's account
      checkoutParams.subscription_data.transfer_data = {
        destination: connectedAccountId,
      };
    }

    const session = await stripe.checkout.sessions.create(checkoutParams);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);

    if (err instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode || 500 }
      );
    }

    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
