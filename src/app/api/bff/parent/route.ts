/**
 * BFF endpoint for Parent portal (ByteByteGo #39).
 * Single optimized call: child profile, attendance, badges, coach updates.
 * Reads from Firestore — same data source the coach writes to.
 */

import { NextResponse } from "next/server";

const ORG_ID = "saint-andrews-aquatics";

async function getDb() {
  const { getApps, initializeApp, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  if (!getApps().length) {
    const cred = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (cred) {
      initializeApp({ credential: cert(JSON.parse(cred)) });
    } else {
      initializeApp({ projectId: "apex-athlete-73755" });
    }
  }
  return getFirestore();
}

function getLevel(xp: number): string {
  if (xp >= 2000) return "Legend";
  if (xp >= 1200) return "Champion";
  if (xp >= 700) return "Contender";
  if (xp >= 300) return "Rising Star";
  if (xp >= 100) return "Prospect";
  return "Rookie";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const childId = searchParams.get("child");

  if (!childId) {
    return NextResponse.json({ error: "Missing child parameter" }, { status: 400 });
  }

  try {
    const db = await getDb();

    // Fetch the "all" roster to find the child
    const rosterDoc = await db.collection(`organizations/${ORG_ID}/rosters`).doc("all").get();
    const athletes = rosterDoc.exists ? (rosterDoc.data()?.athletes || []) : [];
    const child = athletes.find((a: { id: string }) => a.id === childId);

    if (!child) {
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        portal: "parent",
        childId,
        child: null,
        error: "Child not found in roster",
      }, { status: 404 });
    }

    // Fetch best times if available
    const timesDoc = await db.doc(`organizations/${ORG_ID}/athletes/${childId}/bestTimes`).get();
    const bestTimes = timesDoc.exists ? (timesDoc.data()?.times || []) : [];

    // Build response
    const parentData = {
      timestamp: new Date().toISOString(),
      portal: "parent",
      childId,
      child: {
        name: child.name || "",
        age: child.age || 0,
        gender: child.gender || "",
        group: child.group || "",
        level: getLevel(child.xp || 0),
        xp: child.xp || 0,
        streak: child.streak || 0,
        totalPractices: child.totalPractices || 0,
        weekSessions: child.weekSessions || 0,
        weekTarget: child.weekTarget || 0,
      },
      bestTimes,
      weeklyProgress: {
        sessions: child.weekSessions || 0,
        target: child.weekTarget || 8,
      },
    };

    return NextResponse.json(parentData, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    console.error("[Parent BFF] Firestore error:", err);
    // Graceful fallback — return empty but valid structure
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      portal: "parent",
      childId,
      child: { name: "", level: "Rookie", xp: 0, attendance: 0 },
      bestTimes: [],
      weeklyProgress: { sessions: 0, target: 8 },
    }, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" },
    });
  }
}
