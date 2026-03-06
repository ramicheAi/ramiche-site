// ── Command Center: Cron CRUD API ──────────────────────────────────
// Proxies cron operations to OpenClaw CLI on the local machine
// For Vercel deployment: reads from Firestore (bridge-synced data)
// For local dev: could call openclaw CLI directly

import { NextRequest, NextResponse } from "next/server";

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "apex-athlete-73755";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const BRIDGE_SECRET = process.env.BRIDGE_API_SECRET || "parallax-bridge-2026";

export const dynamic = "force-dynamic";

// GET: List cron jobs from Firestore (bridge-synced)
export async function GET() {
  try {
    const res = await fetch(`${FIRESTORE_BASE}/command-center/crons`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ jobs: [], error: "no data yet" });
    const doc = await res.json();
    return NextResponse.json(doc.fields || { jobs: [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST: Create/Delete/Toggle cron (writes action to Firestore queue for bridge to pick up)
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("x-bridge-secret");
  if (authHeader !== BRIDGE_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, cronId, data } = body;

    // Store the action in a Firestore queue for the bridge to process
    const queueEntry = {
      action, // create | delete | toggle | edit
      cronId: cronId || "",
      data: data || {},
      requestedAt: new Date().toISOString(),
      status: "pending",
    };

    const fields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(queueEntry)) {
      if (typeof value === "string") fields[key] = { stringValue: value };
      else if (typeof value === "object") fields[key] = { stringValue: JSON.stringify(value) };
    }

    await fetch(`${FIRESTORE_BASE}/command-center/cron-queue`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });

    return NextResponse.json({ ok: true, queued: queueEntry });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
