import { NextResponse } from "next/server";
import Stripe from "stripe";

/* ══════════════════════════════════════════════════════════════
   STRIPE CHECKOUT SESSION — API Route
   Creates a Stripe Checkout session for a selected plan
   ══════════════════════════════════════════════════════════════ */

// Team plan price ID — set STRIPE_TEAM_PRICE_ID env var with your real Stripe price ID
// Create product + price in Stripe Dashboard → Products → Add product → $249/month recurring
const TEAM_PRICE_ID = process.env.STRIPE_TEAM_PRICE_ID || "price_team_monthly";

const VALID_PRICES: Record<string, { priceId: string; planId: string }> = {
  price_team_monthly: { priceId: TEAM_PRICE_ID, planId: "team" },
};

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set in environment variables");
  }
  return new Stripe(key, { apiVersion: "2026-01-28.clover" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { priceId, planId } = body;

    // Validate the price ID
    if (!priceId || !VALID_PRICES[priceId]) {
      return NextResponse.json(
        { error: "Invalid price ID" },
        { status: 400 }
      );
    }

    // Determine base URL for redirects
    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer")?.replace(/\/[^/]*$/, "") ||
      "http://localhost:3000";

    const stripe = getStripe();

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: VALID_PRICES[priceId].priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/apex-athlete/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/apex-athlete/billing?canceled=true`,
      metadata: {
        planId: planId || VALID_PRICES[priceId].planId,
      },
    });

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
}
