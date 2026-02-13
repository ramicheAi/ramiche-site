import { NextResponse } from "next/server";

/* ══════════════════════════════════════════════════════════════
   PUSH NOTIFICATION SENDER — Firebase Admin SDK
   Sends push notifications to athletes/parents via FCM
   ══════════════════════════════════════════════════════════════ */

// Dynamic import to avoid issues when firebase-admin isn't configured
async function sendFCM(token: string, title: string, body: string, data?: Record<string, string>) {
  const admin = await import("firebase-admin");

  if (!admin.apps.length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccount) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY not configured");
    }
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccount)),
    });
  }

  const messaging = admin.messaging();
  return messaging.send({
    token,
    notification: { title, body },
    data: data || {},
    webpush: {
      fcmOptions: { link: "/apex-athlete" },
      notification: {
        icon: "/apex-icon.png",
        badge: "/apex-badge.png",
        tag: "apex-notification",
      },
    },
  });
}

export async function POST(req: Request) {
  try {
    const { token, tokens, title, body, data } = await req.json();

    if (!title || !body) {
      return NextResponse.json({ error: "title and body required" }, { status: 400 });
    }

    const targetTokens: string[] = tokens || (token ? [token] : []);
    if (targetTokens.length === 0) {
      return NextResponse.json({ error: "At least one token required" }, { status: 400 });
    }

    const results = await Promise.allSettled(
      targetTokens.map((t: string) => sendFCM(t, title, body, data))
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({ sent, failed, total: targetTokens.length });
  } catch (err) {
    console.error("Push notification error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
