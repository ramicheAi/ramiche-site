import { NextResponse } from "next/server";
import Stripe from "stripe";

import { rateLimit, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { verifyIdToken } from "@/lib/firebase-admin";

/* ══════════════════════════════════════════════════════════════
   STRIPE CUSTOMER PORTAL — Manage subscription
   Creates a Stripe Customer Portal session for subscription mgmt.

   SECURITY (CC-FINAL-MERGE-GATE-05 / CC-STAGED-RELEASE-CLOSURE-07):
   this previously took an arbitrary `customerId` from an unauthenticated
   caller and minted a billing-portal session for ANY Stripe customer — an
   IDOR. It now always requires the caller's own Firebase ID token, and
   authorizes by a SERVER-SIDE uid mapping stamped onto the Stripe customer
   at checkout (`customer.metadata.firebaseUid`, set by the webhook — never
   client-suppliable), not by matching email. Email equality is only a
   fallback for customers created before this mapping existed, and even
   then the comparison is against the CUSTOMER record Stripe holds, never
   anything the caller sends. A customer that already has a uid mapping
   denies every uid other than the exact match — a coincidentally equal or
   subsequently changed email never overrides that. `return_url` no longer
   trusts the attacker-controlled Origin/Referer header.
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
  if (!user?.uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    const c = customer as Stripe.Customer;

    const mappedUid = c.metadata?.firebaseUid;
    const authorized = mappedUid
      // Primary path: an exact, server-stamped uid match. Decisive on its own —
      // a matching OR a changed email on either side never enters this comparison.
      ? mappedUid === user.uid
      // Fallback only for a customer with no uid mapping yet (pre-existing data).
      : !!user.email && !!c.email && c.email.toLowerCase() === user.email.toLowerCase();

    if (!authorized) {
      // Same shape as "not found" either way — never confirm that a customerId
      // exists for an account that isn't the caller's own.
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
