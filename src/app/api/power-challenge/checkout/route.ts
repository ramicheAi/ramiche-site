import { NextResponse } from "next/server";
import Stripe from "stripe";
import { rateLimit, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { parseBody, sanitize, badRequest } from "@/lib/api-security";
import { withAudit } from "@/lib/api-audit";

/* ══════════════════════════════════════════════════════════════
   POWER CHALLENGE 2026 — Checkout API Route
   Creates a Stripe Checkout session for race registration
   Supports: 500m ($45) and 1.5K ($65)
   ══════════════════════════════════════════════════════════════ */

const RACE_PRICING: Record<string, number> = {
  "500m": 4500,
  "1.5K": 6500,
};

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set in environment variables");
  }
  return new Stripe(key, { apiVersion: "2026-01-28.clover" });
}

export const POST = withAudit("/api/power-challenge/checkout", async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = rateLimit(`pc-checkout:${ip}`, 5, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { data: body, error: parseError } = await parseBody(req);
    if (parseError || !body) return badRequest(parseError || "Invalid request");

    // Sanitize all string inputs
    const firstName = sanitize(body.firstName, 100);
    const lastName = sanitize(body.lastName, 100);
    const email = sanitize(body.email, 254);
    const phone = sanitize(body.phone, 30);
    const dob = sanitize(body.dob, 20);
    const gender = sanitize(body.gender, 30);
    const race = sanitize(body.race, 10);
    const team = sanitize(body.team, 150);
    const emergencyName = sanitize(body.emergencyName, 150);
    const emergencyPhone = sanitize(body.emergencyPhone, 30);
    const medical = sanitize(body.medical, 500);

    // Validate required fields
    if (!firstName) return badRequest("First name is required");
    if (!lastName) return badRequest("Last name is required");
    if (!email) return badRequest("Email is required");
    if (!race) return badRequest("Race is required");

    // Validate race selection and get pricing
    const unitAmount = RACE_PRICING[race];
    if (!unitAmount) {
      return badRequest("Invalid race selection. Must be '500m' or '1.5K'");
    }

    // Determine base URL for redirects
    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer")?.replace(/\/[^/]*$/, "") ||
      "http://localhost:3000";

    const stripe = getStripe();

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `POWER CHALLENGE 2026 - ${race}`,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      customer_email: email,
      metadata: {
        firstName,
        lastName,
        email,
        phone,
        dob,
        gender,
        race,
        team,
        emergencyName,
        emergencyPhone,
        medical,
      },
      success_url: `${origin}/power-challenge/register?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/power-challenge/register?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Power Challenge checkout error:", err);

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
