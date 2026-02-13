import { NextResponse } from "next/server";
import Stripe from "stripe";

/* ══════════════════════════════════════════════════════════════
   STRIPE CUSTOMER PORTAL — Manage subscription
   Creates a Stripe Customer Portal session for subscription mgmt
   ══════════════════════════════════════════════════════════════ */

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key, { apiVersion: "2026-01-28.clover" });
}

export async function POST(req: Request) {
  try {
    const { customerId } = await req.json();

    if (!customerId) {
      return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer")?.replace(/\/[^/]*$/, "") ||
      "http://localhost:3000";

    const stripe = getStripe();

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/apex-athlete/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Portal session error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
