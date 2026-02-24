/**
 * BFF endpoint for Athlete portal (ByteByteGo #39).
 * Single optimized call: profile, XP, quests, recent activity.
 */

import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const athleteId = searchParams.get("id");

  if (!athleteId) {
    return NextResponse.json({ error: "Missing athlete id" }, { status: 400 });
  }

  const athleteData = {
    timestamp: new Date().toISOString(),
    portal: "athlete",
    athleteId,
    profile: { name: "", level: "Rookie", xp: 0 },
    quests: { active: [], completed: 0, pending: 0 },
    recentActivity: [],
    streaks: { current: 0, longest: 0 },
  };

  return NextResponse.json(athleteData, {
    headers: { "Cache-Control": "s-maxage=15, stale-while-revalidate=30" },
  });
}
