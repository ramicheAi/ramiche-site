import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, getApps, cert } from "firebase-admin/app";

// Initialize Firebase Admin if not already
if (!getApps().length) {
  const cred = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (cred) {
    initializeApp({ credential: cert(JSON.parse(cred)) });
  } else {
    initializeApp({ projectId: "apex-athlete-73755" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { subscription, userId, group } = await req.json();
    if (!subscription?.endpoint) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const db = getFirestore();
    const docId = Buffer.from(subscription.endpoint).toString("base64url").slice(0, 128);

    await db.collection("push_subscriptions").doc(docId).set({
      subscription,
      userId: userId || "anonymous",
      group: group || "unknown",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Push subscribe error:", err);
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }
}
