// ── Meet Schedule API ─────────────────────────────────────────────────
// When a meet is created, this schedules automatic result fetching.
// Called from MeetsView.createMeet() on the client side.
// Stores scheduled jobs in Firestore so a cron/bridge can pick them up.

import { NextRequest, NextResponse } from "next/server";

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "apex-athlete-73755";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export const dynamic = "force-dynamic";

interface MeetScheduleRequest {
  meetId: string;
  meetName: string;
  meetDate: string; // ISO date string
  athleteIds: string[];
  orgId?: string;
}

// POST: Schedule auto-result-fetching for a meet
export async function POST(req: NextRequest) {
  try {
    const body: MeetScheduleRequest = await req.json();
    const { meetId, meetName, meetDate, athleteIds, orgId = "saint-andrews-aquatics" } = body;

    if (!meetId || !meetDate || !athleteIds?.length) {
      return NextResponse.json({ error: "meetId, meetDate, athleteIds required" }, { status: 400 });
    }

    const meetDateObj = new Date(meetDate);
    const now = new Date();

    // Schedule 4 auto-fetch windows:
    // 1. Meet day (start polling) — every 15 min during meet hours (8am-8pm)
    // 2. Meet end + 1 hour — full sweep
    // 3. Meet end + 6 hours — catch late posts
    // 4. Meet + 24 hours — final sweep

    const schedules = [
      {
        id: `${meetId}-live`,
        type: "live-polling",
        label: `Live results: ${meetName}`,
        triggerAt: meetDateObj.toISOString(),
        intervalMinutes: 15,
        durationHours: 12, // poll for 12 hours
      },
      {
        id: `${meetId}-sweep-1h`,
        type: "post-meet-sweep",
        label: `Post-meet sweep: ${meetName} (+1h)`,
        triggerAt: new Date(meetDateObj.getTime() + 13 * 60 * 60 * 1000).toISOString(), // meet day + 13h
      },
      {
        id: `${meetId}-sweep-6h`,
        type: "post-meet-sweep",
        label: `Late results: ${meetName} (+6h)`,
        triggerAt: new Date(meetDateObj.getTime() + 18 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: `${meetId}-final`,
        type: "final-sweep",
        label: `Final sweep: ${meetName} (+24h)`,
        triggerAt: new Date(meetDateObj.getTime() + 36 * 60 * 60 * 1000).toISOString(),
      },
    ];

    // Store in Firestore: meet-schedules/{meetId}
    const fields: Record<string, unknown> = {
      meetId: { stringValue: meetId },
      meetName: { stringValue: meetName },
      meetDate: { stringValue: meetDate },
      orgId: { stringValue: orgId },
      athleteIds: { arrayValue: { values: athleteIds.map(id => ({ stringValue: id })) } },
      schedules: { stringValue: JSON.stringify(schedules) },
      status: { stringValue: meetDateObj > now ? "scheduled" : "active" },
      createdAt: { stringValue: new Date().toISOString() },
    };

    await fetch(`${FIRESTORE_BASE}/meet-schedules/${meetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });

    return NextResponse.json({
      ok: true,
      meetId,
      scheduled: schedules.length,
      schedules: schedules.map(s => ({ id: s.id, type: s.type, triggerAt: s.triggerAt })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// GET: List scheduled meets and their fetch jobs
export async function GET() {
  try {
    const res = await fetch(`${FIRESTORE_BASE}/meet-schedules`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ meets: [] });
    const data = await res.json();
    const meets = (data.documents || []).map((doc: Record<string, unknown>) => {
      const f = doc.fields as Record<string, Record<string, string>>;
      return {
        meetId: f?.meetId?.stringValue,
        meetName: f?.meetName?.stringValue,
        meetDate: f?.meetDate?.stringValue,
        status: f?.status?.stringValue,
        schedules: JSON.parse(f?.schedules?.stringValue || "[]"),
      };
    });
    return NextResponse.json({ meets });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
