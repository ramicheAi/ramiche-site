import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

export async function GET() {
  try {
    const db = await getDb();
    const snap = await db.collection("yolo_builds").orderBy("date", "desc").get();
    const builds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json(builds);
  } catch (err) {
    return NextResponse.json({ error: "Failed to read builds", detail: String(err) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { folder, reviewStatus } = body as { folder: string; reviewStatus: "approved" | "rejected" | "pending" };
    if (!folder || !reviewStatus) {
      return NextResponse.json({ error: "Missing folder or reviewStatus" }, { status: 400 });
    }
    const db = await getDb();
    const snap = await db.collection("yolo_builds").where("folder", "==", folder).limit(1).get();
    if (snap.empty) {
      return NextResponse.json({ error: `Build not found: ${folder}` }, { status: 404 });
    }
    const docRef = snap.docs[0].ref;
    await docRef.update({ reviewStatus, reviewedAt: new Date().toISOString() });
    const updated = await docRef.get();
    return NextResponse.json({ id: updated.id, ...updated.data() });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update build", detail: String(err) }, { status: 500 });
  }
}

// POST — seed builds from builds.json (one-time migration)
export async function POST(request: Request) {
  try {
    const builds = await request.json();
    if (!Array.isArray(builds)) {
      return NextResponse.json({ error: "Expected array of builds" }, { status: 400 });
    }
    const db = await getDb();
    const batch = db.batch();
    for (const build of builds) {
      const docRef = db.collection("yolo_builds").doc(build.folder || build.name.replace(/\s+/g, "-").toLowerCase());
      batch.set(docRef, { ...build, reviewStatus: build.reviewStatus || "pending" }, { merge: true });
    }
    await batch.commit();
    return NextResponse.json({ success: true, count: builds.length });
  } catch (err) {
    return NextResponse.json({ error: "Failed to seed builds", detail: String(err) }, { status: 500 });
  }
}
