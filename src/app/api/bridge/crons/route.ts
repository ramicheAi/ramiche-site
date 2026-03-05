// ── Cron CRUD API ───────────────────────────────────────────────────
// POST: Create cron → writes to Firestore, bridge picks up
// DELETE: Remove cron → writes to Firestore, bridge picks up

import { NextRequest, NextResponse } from "next/server";

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "apex-athlete-73755";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const BRIDGE_SECRET = process.env.BRIDGE_API_SECRET || "parallax-bridge-2026";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("x-bridge-secret");
  if (authHeader !== BRIDGE_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { action, name, schedule, agent, task, cronId } = await req.json();

    if (action === "create") {
      if (!name || !schedule || !agent || !task) {
        return NextResponse.json({ error: "name, schedule, agent, task required" }, { status: 400 });
      }

      const id = `cron_${Date.now()}`;
      const cronData = {
        fields: {
          id: { stringValue: id },
          name: { stringValue: name },
          schedule: { stringValue: schedule },
          agent: { stringValue: agent },
          task: { stringValue: task },
          status: { stringValue: "pending" },
          createdAt: { stringValue: new Date().toISOString() },
          createdBy: { stringValue: "command-center" },
        },
      };

      const res = await fetch(`${FIRESTORE_BASE}/command-center-crons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cronData),
      });

      if (!res.ok) {
        return NextResponse.json({ error: await res.text() }, { status: res.status });
      }

      return NextResponse.json({ ok: true, id, action: "created" });
    }

    if (action === "delete") {
      if (!cronId) {
        return NextResponse.json({ error: "cronId required" }, { status: 400 });
      }

      const res = await fetch(`${FIRESTORE_BASE}/command-center-crons/${cronId}`, {
        method: "DELETE",
      });

      return NextResponse.json({ ok: true, cronId, action: "deleted" });
    }

    return NextResponse.json({ error: "action must be 'create' or 'delete'" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const res = await fetch(
      `${FIRESTORE_BASE}/command-center-crons?pageSize=100`,
      { cache: "no-store" }
    );
    if (!res.ok) return NextResponse.json({ items: [] });

    const data = await res.json();
    const crons = (data.documents || []).map((doc: { fields: Record<string, { stringValue?: string }> }) => {
      const f = doc.fields || {};
      return {
        id: f.id?.stringValue || "",
        name: f.name?.stringValue || "",
        schedule: f.schedule?.stringValue || "",
        agent: f.agent?.stringValue || "",
        task: f.task?.stringValue || "",
        status: f.status?.stringValue || "unknown",
        createdAt: f.createdAt?.stringValue || "",
      };
    });

    return NextResponse.json({ items: crons, count: crons.length });
  } catch (e) {
    return NextResponse.json({ items: [], error: String(e) });
  }
}
