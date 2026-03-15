import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_placeholder", {
  apiVersion: "2026-01-28.clover",
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pin = searchParams.get("pin");

    if (pin !== "PIRANHAS2026") {
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

    const headers = [
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "DOB",
      "Gender",
      "Race",
      "Team",
      "Emergency Contact",
      "Emergency Phone",
      "Medical",
      "Payment Status",
      "Registration Date",
    ];

    const csvRows = [headers.join(",")];

    for (const r of registrations) {
      const row = [
        r.firstName,
        r.lastName,
        r.email,
        r.phone,
        r.dob,
        r.gender,
        r.race,
        r.team,
        r.emergencyName,
        r.emergencyPhone,
        r.medical,
        r.paymentStatus,
        r.date,
      ].map((val) => `"${(val || "").replace(/"/g, '""')}"`);
      csvRows.push(row.join(","));
    }

    const csv = csvRows.join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="power-challenge-registrations-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export CSV error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
