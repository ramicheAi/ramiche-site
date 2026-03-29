// ── Command Center: Firestore Read ──────────────────────────────────
// Reads synced data FROM Firestore for when running on Vercel.
// GET ?collection=agents|crons|memory|yolo[&date=YYYY-MM-DD]

import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ── Types ─────────────────────────────────────────────────────────── */

type CollectionKey = "agents" | "crons" | "memory" | "yolo";

interface FirestoreDoc {
  [key: string]: unknown;
  _syncedAt?: { toDate?: () => Date };
}

interface ReadResponse {
  ok: boolean;
  collection: CollectionKey;
  data: Record<string, unknown> | null;
  syncedAt: string | null;
}

/* ── Firebase Admin ────────────────────────────────────────────────── */

let adminDb: Firestore | null = null;

function getAdminDb(): Firestore | null {
  if (adminDb) return adminDb;
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) return null;
  try {
    const parsed = JSON.parse(sa);
    const app: App =
      getApps().length > 0
        ? getApps()[0]
        : initializeApp({ credential: cert(parsed) });
    adminDb = getFirestore(app);
    return adminDb;
  } catch {
    return null;
  }
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function extractSyncedAt(data: FirestoreDoc | undefined): string | null {
  if (!data?._syncedAt) return null;
  return data._syncedAt.toDate?.()?.toISOString() ?? null;
}

const VALID_COLLECTIONS: ReadonlySet<string> = new Set([
  "agents",
  "crons",
  "memory",
  "yolo",
]);

/* ── Collection Readers ────────────────────────────────────────────── */

async function readAgents(db: Firestore): Promise<ReadResponse> {
  const snap = await db
    .collection("command-center")
    .doc("agents")
    .collection("directory")
    .doc("latest")
    .get();

  const data = snap.data() as FirestoreDoc | undefined;
  return {
    ok: snap.exists,
    collection: "agents",
    data: data ? stripMeta(data) : null,
    syncedAt: extractSyncedAt(data),
  };
}

async function readCrons(db: Firestore): Promise<ReadResponse> {
  const [configSnap, historySnap] = await Promise.all([
    db
      .collection("command-center")
      .doc("crons")
      .collection("config")
      .doc("latest")
      .get(),
    db
      .collection("command-center")
      .doc("crons")
      .collection("history")
      .doc("latest")
      .get(),
  ]);

  const configData = configSnap.data() as FirestoreDoc | undefined;
  const historyData = historySnap.data() as FirestoreDoc | undefined;

  const latestSync =
    extractSyncedAt(configData) || extractSyncedAt(historyData);

  return {
    ok: configSnap.exists || historySnap.exists,
    collection: "crons",
    data: {
      jobs: configData?.jobs ?? [],
      jobCount: configData?.jobCount ?? 0,
      history: historyData?.entries ?? [],
      historyCount: historyData?.entryCount ?? 0,
    },
    syncedAt: latestSync,
  };
}

async function readMemory(
  db: Firestore,
  date: string
): Promise<ReadResponse> {
  const snap = await db
    .collection("command-center")
    .doc("memory")
    .collection(date)
    .doc("daily")
    .get();

  const data = snap.data() as FirestoreDoc | undefined;
  return {
    ok: snap.exists,
    collection: "memory",
    data: data ? stripMeta(data) : null,
    syncedAt: extractSyncedAt(data),
  };
}

async function readMemoryIndex(db: Firestore, limit: number): Promise<ReadResponse> {
  const dates: string[] = [];
  const today = new Date();

  for (let i = 0; i < limit; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }

  const snapshots = await Promise.all(
    dates.map(date =>
      db
        .collection("command-center")
        .doc("memory")
        .collection(date)
        .doc("daily")
        .get()
        .then(snap => ({ date, snap }))
        .catch(() => ({ date, snap: null }))
    )
  );

  const days: Record<string, unknown>[] = [];
  let latestSync: string | null = null;

  for (const { date, snap } of snapshots) {
    if (!snap?.exists) continue;
    const data = snap.data() as FirestoreDoc | undefined;
    if (!data) continue;

    const syncedAt = extractSyncedAt(data);
    if (syncedAt && (!latestSync || syncedAt > latestSync)) {
      latestSync = syncedAt;
    }

    days.push({
      date,
      content: data.content,
      contentLength: data.contentLength,
    });
  }

  return {
    ok: days.length > 0,
    collection: "memory",
    data: { days, count: days.length },
    syncedAt: latestSync,
  };
}

async function readYoloBuilds(db: Firestore): Promise<ReadResponse> {
  const snap = await db
    .collection("command-center")
    .doc("yolo-builds")
    .collection("manifest")
    .doc("latest")
    .get();

  const data = snap.data() as FirestoreDoc | undefined;
  return {
    ok: snap.exists,
    collection: "yolo",
    data: data ? stripMeta(data) : null,
    syncedAt: extractSyncedAt(data),
  };
}

function stripMeta(
  data: FirestoreDoc
): Record<string, unknown> {
  const { _syncedAt, ...rest } = data;
  return rest;
}

/* ── GET Handler ───────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const collection = req.nextUrl.searchParams.get("collection");

  if (!collection || !VALID_COLLECTIONS.has(collection)) {
    return NextResponse.json(
      {
        error: "Missing or invalid ?collection= param. Valid: agents, crons, memory, yolo",
        valid: Array.from(VALID_COLLECTIONS),
      },
      { status: 400 }
    );
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json(
      { error: "FIREBASE_SERVICE_ACCOUNT not configured" },
      { status: 503 }
    );
  }

  try {
    const key = collection as CollectionKey;
    let result: ReadResponse;

    switch (key) {
      case "agents":
        result = await readAgents(db);
        break;

      case "crons":
        result = await readCrons(db);
        break;

      case "memory": {
        const date = req.nextUrl.searchParams.get("date");
        const days = parseInt(
          req.nextUrl.searchParams.get("days") || "0",
          10
        );

        if (date) {
          result = await readMemory(db, date);
        } else if (days > 0) {
          result = await readMemoryIndex(db, Math.min(days, 30));
        } else {
          result = await readMemory(db, todayDate());
        }
        break;
      }

      case "yolo":
        result = await readYoloBuilds(db);
        break;
    }

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          collection: key,
          data: null,
          syncedAt: null,
          hint: "No synced data found. Run POST /api/command-center/firestore-sync first.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e), ok: false }, { status: 500 });
  }
}
