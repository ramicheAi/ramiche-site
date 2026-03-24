import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminWriteSubscription, adminWriteConnectedAccount } from "@/lib/firebase-admin";

/* ══════════════════════════════════════════════════════════════
   STRIPE WEBHOOK — Handles subscription + Connect lifecycle events
   Verifies signature, processes checkout, subscriptions, payments,
   and Connect account status updates
   Writes to Firestore via Admin SDK
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
      const email = session.customer_details?.email || "";
      console.log(`[Stripe] Checkout completed: plan=${planId}, customer=${customerId}`);
      await adminWriteSubscription(customerId, {
        planId,
        status: "active",
        email,
        subscriptionId: session.subscription as string,
        createdAt: new Date().toISOString(),
      });
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      console.log(`[Stripe] Subscription updated: ${sub.id}, status=${sub.status}`);
      await adminWriteSubscription(customerId, {
        subscriptionId: sub.id,
        status: sub.status,
        currentPeriodEnd: new Date(((sub as unknown as Record<string, unknown>).current_period_end as number) * 1000).toISOString(),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      console.log(`[Stripe] Subscription canceled: ${sub.id}`);
      await adminWriteSubscription(customerId, {
        subscriptionId: sub.id,
        status: "canceled",
        canceledAt: new Date().toISOString(),
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      console.log(`[Stripe] Payment failed: invoice=${invoice.id}`);
      if (customerId) {
        await adminWriteSubscription(customerId, {
          lastPaymentFailed: true,
          lastFailedInvoice: invoice.id,
          lastFailedAt: new Date().toISOString(),
        });
      }
      break;
    }

    // ── Stripe Connect events ──────────────────────────────
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      const uid = account.metadata?.firebaseUid;
      if (uid) {
        console.log(`[Stripe Connect] Account updated: ${account.id}, charges=${account.charges_enabled}`);
        await adminWriteConnectedAccount(uid, {
          stripeAccountId: account.id,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          detailsSubmitted: account.details_submitted,
          status: account.charges_enabled ? "active" : "onboarding",
        });
      }
      break;
    }

    default:
      console.log(`[Stripe] Unhandled event: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
