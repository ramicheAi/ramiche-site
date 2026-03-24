import { NextResponse } from "next/server";
import Stripe from "stripe";
import { rateLimit, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { parseBody, sanitize, badRequest } from "@/lib/api-security";
import { withAudit } from "@/lib/api-audit";
import { verifyIdToken } from "@/lib/firebase-admin";
import { adminWriteConnectedAccount } from "@/lib/firebase-admin";

/* ══════════════════════════════════════════════════════════════
   STRIPE CONNECT — Onboarding & Account Management
   Creates Connected Accounts for teams (90/10 split)
   Coach creates account → Stripe hosted onboarding → webhook confirms
   ══════════════════════════════════════════════════════════════ */

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key, { apiVersion: "2026-01-28.clover" });
}

// ── POST: Create Connected Account + Onboarding Link ──────────
export const POST = withAudit("/api/stripe/connect", async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = rateLimit(`connect:${ip}`, 5, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { data: body, error: parseError } = await parseBody(req);
    if (parseError || !body) return badRequest(parseError || "Invalid request");

    // Verify Firebase auth
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await verifyIdToken(token);
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const teamName = sanitize(body.teamName, 200);
    const email = sanitize(body.email, 254);

    if (!teamName || !email) return badRequest("teamName and email required");

    const stripe = getStripe();

    // Create Express Connected Account
    const account = await stripe.accounts.create({
      type: "express",
      email,
      metadata: {
        firebaseUid: user.uid,
        teamName,
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    // Create onboarding link
    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer")?.replace(/\/[^/]*$/, "") ||
      "http://localhost:3000";

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${origin}/apex-athlete?tab=billing&connect=refresh`,
      return_url: `${origin}/apex-athlete?tab=billing&connect=complete`,
      type: "account_onboarding",
    });

    // Store Connected Account ID in Firestore
    await adminWriteConnectedAccount(user.uid, {
      stripeAccountId: account.id,
      teamName,
      email,
      status: "onboarding",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      accountId: account.id,
      onboardingUrl: accountLink.url,
    });
  } catch (err) {
    console.error("[Stripe Connect] Onboarding error:", err);
    if (err instanceof Stripe.errors.StripeError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode || 500 });
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});

// ── GET: Check account status ──────────────────────────────────
export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = rateLimit(`connect-status:${ip}`, 20, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl);

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await verifyIdToken(token);
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const url = new URL(req.url);
  const accountId = sanitize(url.searchParams.get("accountId") || "", 100);
  if (!accountId) return badRequest("accountId required");

  try {
    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(accountId);

    return NextResponse.json({
      id: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    });
  } catch (err) {
    console.error("[Stripe Connect] Status check error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
