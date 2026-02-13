import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import webpush from "web-push";

// Initialize Firebase Admin if not already
if (!getApps().length) {
  const cred = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (cred) {
    initializeApp({ credential: cert(JSON.parse(cred)) });
  } else {
    initializeApp({ projectId: "apex-athlete-73755" });
  }
}

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails("mailto:ramichehq@gmail.com", VAPID_PUBLIC, VAPID_PRIVATE);
}

export async function POST(req: NextRequest) {
  try {
    const { title, body, group, tag, url } = await req.json();
    if (!title || !body) {
      return NextResponse.json({ error: "title and body required" }, { status: 400 });
    }

    const db = getFirestore();
    let query = db.collection("push_subscriptions").limit(500);
    if (group) {
      query = db.collection("push_subscriptions").where("group", "==", group).limit(500);
    }

    const snap = await query.get();
    const payload = JSON.stringify({ title, body, tag: tag || "apex-coach", url: url || "/apex-athlete", icon: "/agents/apex-icon-192.png" });

    let sent = 0;
    let failed = 0;
    const cleanupIds: string[] = [];

    await Promise.allSettled(
      snap.docs.map(async (doc) => {
        const { subscription } = doc.data();
        try {
          await webpush.sendNotification(subscription, payload);
          sent++;
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 410 || statusCode === 404) {
            cleanupIds.push(doc.id);
          }
          failed++;
        }
      })
    );

    // Clean up expired subscriptions
    await Promise.allSettled(cleanupIds.map((id) => db.collection("push_subscriptions").doc(id).delete()));

    return NextResponse.json({ ok: true, sent, failed, cleaned: cleanupIds.length });
  } catch (err) {
    console.error("Push send error:", err);
    return NextResponse.json({ error: "Failed to send notifications" }, { status: 500 });
  }
}
