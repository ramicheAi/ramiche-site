// ── Chat Relay API ──────────────────────────────────────────────────
// POST: Send message to agent → stores in Firestore for bridge to relay
// GET: Fetch recent chat messages

import { NextRequest, NextResponse } from "next/server";

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "apex-athlete-73755";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const BRIDGE_SECRET = process.env.BRIDGE_API_SECRET || "";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("x-bridge-secret");
  if (authHeader !== BRIDGE_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { targetAgent, message, sender } = await req.json();

    if (!targetAgent || !message) {
      return NextResponse.json({ error: "targetAgent and message required" }, { status: 400 });
    }

    const id = `msg_${Date.now()}`;
    const msgData = {
      fields: {
        id: { stringValue: id },
        sender: { stringValue: sender || "ramon" },
        targetAgent: { stringValue: targetAgent },
        message: { stringValue: message },
        status: { stringValue: "pending" },
        timestamp: { stringValue: new Date().toISOString() },
      },
    };

    const res = await fetch(`${FIRESTORE_BASE}/command-center-chat/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msgData),
    });

    if (!res.ok) {
      return NextResponse.json({ error: await res.text() }, { status: res.status });
    }

    return NextResponse.json({ ok: true, id, status: "queued" });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const res = await fetch(
      `${FIRESTORE_BASE}/command-center-chat?pageSize=50&orderBy=timestamp desc`,
      { cache: "no-store" }
    );
    if (!res.ok) return NextResponse.json({ items: [] });

    const data = await res.json();
    const messages = (data.documents || []).map((doc: { fields: Record<string, { stringValue?: string }> }) => {
      const f = doc.fields || {};
      return {
        id: f.id?.stringValue || "",
        sender: f.sender?.stringValue || "",
        targetAgent: f.targetAgent?.stringValue || "",
        message: f.message?.stringValue || "",
        status: f.status?.stringValue || "unknown",
        response: f.response?.stringValue || "",
        timestamp: f.timestamp?.stringValue || "",
      };
    });

    return NextResponse.json({ items: messages, count: messages.length });
  } catch (e) {
    return NextResponse.json({ items: [], error: String(e) });
  }
}
