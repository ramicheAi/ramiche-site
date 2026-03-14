import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

export async function GET(req: Request) {
  try {
    const adminPin = req.headers.get("x-admin-pin");

    if (adminPin !== "PIRANHAS2026") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allSessions: Stripe.Checkout.Session[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore && allSessions.length < 500) {
      const params: Stripe.Checkout.SessionListParams = { limit: 100 };

      if (startingAfter) {
        params.starting_after = startingAfter;
      }

      const batch = await stripe.checkout.sessions.list(params);

      allSessions.push(...batch.data);
      hasMore = batch.has_more;

      if (batch.data.length > 0) {
        startingAfter = batch.data[batch.data.length - 1].id;
      }
    }

    const registrations = allSessions
      .filter((session) => session.metadata?.race)
      .map((session) => ({
        firstName: session.metadata?.firstName || "",
        lastName: session.metadata?.lastName || "",
        email: session.metadata?.email || session.customer_email || "",
        phone: session.metadata?.phone || "",
        dob: session.metadata?.dob || "",
        gender: session.metadata?.gender || "",
        race: session.metadata?.race || "",
        team: session.metadata?.team || "",
        emergencyName: session.metadata?.emergencyName || "",
        emergencyPhone: session.metadata?.emergencyPhone || "",
        medical: session.metadata?.medical || "",
        paymentStatus: session.payment_status,
        date: new Date(session.created * 1000).toISOString(),
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ registrations, total: registrations.length });
  } catch (error) {
    console.error("Admin API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
