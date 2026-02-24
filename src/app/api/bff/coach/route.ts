/**
 * BFF (Backend for Frontend) endpoint for Coach portal (ByteByteGo #39).
 * Optimized data-fetching: returns exactly what the coach dashboard needs
 * in a single request — roster summary, recent sessions, pending quests.
 */

import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("org");

  if (!orgId) {
    return NextResponse.json({ error: "Missing org parameter" }, { status: 400 });
  }

  // In production, this would aggregate from Firestore in a single server-side call
  // instead of making N client-side queries from the coach portal
  const dashboardData = {
    timestamp: new Date().toISOString(),
    portal: "coach",
    org: orgId,
    summary: {
      totalAthletes: 0,
      activeToday: 0,
      pendingQuests: 0,
      upcomingMeets: 0,
    },
    recentSessions: [],
    alerts: [],
  };

  return NextResponse.json(dashboardData, {
    headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" },
  });
}
