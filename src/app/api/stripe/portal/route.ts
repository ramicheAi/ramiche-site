import { NextResponse } from "next/server";
import Stripe from "stripe";

import { rateLimit, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { verifyIdToken } from "@/lib/firebase-admin";

/* ══════════════════════════════════════════════════════════════
   STRIPE CUSTOMER PORTAL — Manage subscription
   Creates a Stripe Customer Portal session for subscription mgmt.

   SECURITY (CC-FINAL-MERGE-GATE-05 / CC-STAGED-IMAC-ACCEPTANCE-06 triage):
   this previously took an arbitrary `customerId` from an unauthenticated
   caller and minted a billing-portal session for ANY Stripe customer — an
   IDOR. It now requires the caller's own Firebase ID token and only
   proceeds when the token's verified email matches the Stripe customer's
   email on file, so a caller can only open the portal for their own
   subscription. `return_url` no longer trusts the attacker-controlled
   Origin/Referer header.
   ══════════════════════════════════════════════════════════════ */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ramiche-site.vercel.app";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key, { apiVersion: "2026-01-28.clover" });
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = rateLimit(`stripe-portal:${ip}`, 10, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl);

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await verifyIdToken(token);
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { customerId } = await req.json();
    if (!customerId || typeof customerId !== "string") {
      return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    const stripe = getStripe();

    const customer = await stripe.customers.retrieve(customerId);
    if (!customer || customer.deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const customerEmail = (customer as Stripe.Customer).email;
    if (!customerEmail || customerEmail.toLowerCase() !== user.email.toLowerCase()) {
      // Deliberately the same shape as "not found" — never confirm that a
      // customerId exists for a different account.
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${SITE_URL}/apex-athlete/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Portal session error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
