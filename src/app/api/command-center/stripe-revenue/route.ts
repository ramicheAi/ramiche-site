import { NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

const UNAVAILABLE_RESPONSE = {
  balance: { available: 0, pending: 0, currency: "usd" },
  revenue: { last30Days: 0, monthlyBreakdown: [] as { month: string; amount: number }[], totalCharges: 0 },
  subscriptions: { active: 0, mrr: 0, arr: 0 },
  payouts: [] as { id: string; amount: number; arrival_date: string; status: string }[],
  recentTransactions: [] as { id: string; amount: number; description: string; created: string; status: string }[],
  source: "unavailable" as const,
  fetchedAt: "",
};

function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

function monthKey(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET() {
  const stripe = getStripe();

  if (!stripe) {
    return NextResponse.json({
      ...UNAVAILABLE_RESPONSE,
      fetchedAt: new Date().toISOString(),
    });
  }

  try {
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;

    const [balance, charges, subscriptions, payouts] = await Promise.all([
      stripe.balance.retrieve(),
      stripe.charges.list({ limit: 100, created: { gte: thirtyDaysAgo } }),
      stripe.subscriptions.list({ limit: 50, status: "active" }),
      stripe.payouts.list({ limit: 10 }),
    ]);

    const availableBalance = balance.available.reduce((sum, b) => sum + b.amount, 0);
    const pendingBalance = balance.pending.reduce((sum, b) => sum + b.amount, 0);
    const primaryCurrency = balance.available[0]?.currency || "usd";

    const successfulCharges = charges.data.filter((c) => c.status === "succeeded");
    const last30Days = successfulCharges.reduce((sum, c) => sum + c.amount, 0);

    const monthlyMap = new Map<string, number>();
    for (const charge of successfulCharges) {
      const key = monthKey(charge.created);
      monthlyMap.set(key, (monthlyMap.get(key) || 0) + charge.amount);
    }

    const monthlyBreakdown = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, amount]) => ({ month, amount: centsToDollars(amount) }));

    const mrr = subscriptions.data.reduce((sum, sub) => {
      const item = sub.items.data[0];
      if (!item?.price?.unit_amount || !item.price.recurring) return sum;
      const amount = item.price.unit_amount * (item.quantity ?? 1);
      const interval = item.price.recurring.interval;
      if (interval === "month") return sum + amount;
      if (interval === "year") return sum + Math.round(amount / 12);
      if (interval === "week") return sum + amount * 4;
      if (interval === "day") return sum + amount * 30;
      return sum;
    }, 0);

    return NextResponse.json({
      balance: {
        available: centsToDollars(availableBalance),
        pending: centsToDollars(pendingBalance),
        currency: primaryCurrency,
      },
      revenue: {
        last30Days: centsToDollars(last30Days),
        monthlyBreakdown,
        totalCharges: successfulCharges.length,
      },
      subscriptions: {
        active: subscriptions.data.length,
        mrr: centsToDollars(mrr),
        arr: centsToDollars(mrr * 12),
      },
      payouts: payouts.data.map((p) => ({
        id: p.id,
        amount: centsToDollars(p.amount),
        arrival_date: new Date(p.arrival_date * 1000).toISOString(),
        status: p.status,
      })),
      recentTransactions: successfulCharges.slice(0, 20).map((c) => ({
        id: c.id,
        amount: centsToDollars(c.amount),
        description: c.description || c.metadata?.description || "Payment",
        created: new Date(c.created * 1000).toISOString(),
        status: c.status,
      })),
      source: "live" as const,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[stripe-revenue] Error fetching Stripe data:", err);

    if (err instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        {
          ...UNAVAILABLE_RESPONSE,
          fetchedAt: new Date().toISOString(),
          error: `Stripe API error: ${err.message}`,
        },
        { status: err.statusCode || 500 }
      );
    }

    return NextResponse.json(
      {
        ...UNAVAILABLE_RESPONSE,
        fetchedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
