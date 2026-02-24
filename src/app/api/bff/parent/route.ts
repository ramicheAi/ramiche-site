/**
 * BFF endpoint for Parent portal (ByteByteGo #39).
 * Single optimized call: child profile, attendance, badges, coach updates.
 */

import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const childId = searchParams.get("child");

  if (!childId) {
    return NextResponse.json({ error: "Missing child parameter" }, { status: 400 });
  }

  const parentData = {
    timestamp: new Date().toISOString(),
    portal: "parent",
    childId,
    child: { name: "", level: "Rookie", xp: 0, attendance: 0 },
    badges: [],
    coachUpdates: [],
    weeklyProgress: { sessions: 0, target: 8 },
  };

  return NextResponse.json(parentData, {
    headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" },
  });
}
