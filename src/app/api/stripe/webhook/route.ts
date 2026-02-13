import { NextResponse } from "next/server";
import Stripe from "stripe";

/* ══════════════════════════════════════════════════════════════
   STRIPE WEBHOOK — Handles subscription lifecycle events
   Verifies signature, processes checkout.session.completed,
   customer.subscription.updated/deleted
   ══════════════════════════════════════════════════════════════ */

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key, { apiVersion: "2026-01-28.clover" });
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  const body = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    console.error("Webhook signature verification failed:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const planId = session.metadata?.planId;
      const customerId = session.customer as string;
      console.log(`[Stripe] Checkout completed: plan=${planId}, customer=${customerId}`);
      // Future: write subscription status to Firestore
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      console.log(`[Stripe] Subscription updated: ${sub.id}, status=${sub.status}`);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      console.log(`[Stripe] Subscription canceled: ${sub.id}`);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`[Stripe] Payment failed: invoice=${invoice.id}`);
      break;
    }

    default:
      console.log(`[Stripe] Unhandled event: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
