import { NextResponse } from "next/server";
import Stripe from "stripe";

/* ══════════════════════════════════════════════════════════════
   STRIPE CHECKOUT — White-Label Agent Marketplace
   Creates checkout sessions for agent templates and bundles
   Supports: one-time purchases + monthly managed hosting
   ══════════════════════════════════════════════════════════════ */

// Product catalog — bundle and agent pricing
const CATALOG: Record<string, { name: string; price: number; mode: "payment" | "subscription" }> = {
  // Bundles (one-time purchase)
  "bundle_operations": { name: "Operations Bundle (4 agents)", price: 3500, mode: "payment" },
  "bundle_growth": { name: "Growth Bundle (4 agents)", price: 3200, mode: "payment" },
  "bundle_creative": { name: "Creative Bundle (4 agents)", price: 2800, mode: "payment" },
  "bundle_coaching": { name: "Coaching Bundle (4 agents)", price: 3000, mode: "payment" },
  "bundle_support": { name: "Support Bundle (4 agents)", price: 2500, mode: "payment" },
  "bundle_enterprise": { name: "Enterprise Bundle (10 agents)", price: 8500, mode: "payment" },
  // Managed hosting (monthly)
  "managed_starter": { name: "Managed Hosting — Starter (1-2 agents)", price: 300, mode: "subscription" },
  "managed_team": { name: "Managed Hosting — Team (3-5 agents)", price: 650, mode: "subscription" },
  "managed_enterprise": { name: "Managed Hosting — Enterprise (6+)", price: 2000, mode: "subscription" },
  // Computer Use Agents (monthly)
  "computer_standard": { name: "Computer Use Agent — Standard Portal", price: 200, mode: "subscription" },
  "computer_complex": { name: "Computer Use Agent — Complex Portal", price: 350, mode: "subscription" },
  "computer_custom": { name: "Computer Use Agent — Custom Portal", price: 500, mode: "subscription" },
  // OpenClaw Setup Service (one-time)
  "setup_basic": { name: "OpenClaw Setup — Basic Install", price: 250, mode: "payment" },
  "setup_standard": { name: "OpenClaw Setup — Standard", price: 500, mode: "payment" },
  "setup_enterprise": { name: "OpenClaw Setup — Enterprise", price: 2000, mode: "payment" },
  // White-Glove Deployment (one-time)
  "deploy_single": { name: "White-Glove — Single Agent Setup", price: 750, mode: "payment" },
  "deploy_bundle": { name: "White-Glove — Bundle Deployment", price: 2500, mode: "payment" },
  "deploy_ecosystem": { name: "White-Glove — Full Ecosystem", price: 7500, mode: "payment" },
};

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key, { apiVersion: "2026-01-28.clover" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productId, customerEmail } = body;

    const product = CATALOG[productId];
    if (!product) {
      return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
    }

    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer")?.replace(/\/[^/]*$/, "") ||
      "http://localhost:3000";

    const stripe = getStripe();

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: product.mode,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: product.name },
            unit_amount: product.price * 100,
            ...(product.mode === "subscription" ? { recurring: { interval: "month" } } : {}),
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/agents?success=true&product=${productId}`,
      cancel_url: `${origin}/agents?canceled=true`,
      metadata: { productId, productName: product.name },
    };

    if (customerEmail) {
      sessionConfig.customer_email = customerEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Agent checkout error:", err);
    if (err instanceof Stripe.errors.StripeError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode || 500 });
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
