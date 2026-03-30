// ── Command Center: Firestore Sync ──────────────────────────────────
// Reads local filesystem data and syncs to Firestore so the Command
// Center works fully on Vercel without a tunnel.
// GET  → returns current sync status
// POST → performs the sync and returns results

import { NextResponse } from "next/server";
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { resolveOpenclawCronDir } from "@/lib/openclaw-paths";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore, FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ── Paths ─────────────────────────────────────────────────────────── */

const WS = process.env.OPENCLAW_WORKSPACE ?? "/Users/admin/.openclaw/workspace";
const CRON_DIR = resolveOpenclawCronDir();
const DIRECTORY_PATH = join(WS, "agents", "directory.json");
const CRON_JOBS_PATH = join(CRON_DIR, "jobs.json");
const CRON_HISTORY_PATH = join(CRON_DIR, "history.json");
const MEMORY_DIR = join(WS, "memory");
const YOLO_DIR = join(WS, "yolo-builds");
/** SIMONS MERIDIAN pipeline output — same file as `GET /api/command-center/meridian` local path. */
const MERIDIAN_JSON_PATH = join(WS, "shared/artifacts/quantitative/dashboard_api.json");

/* ── Types ─────────────────────────────────────────────────────────── */

interface SyncResult {
  collection: string;
  ok: boolean;
  docCount?: number;
  error?: string;
}

interface SyncStatus {
  lastSyncedAt: string | null;
  counts: Record<string, number>;
}

interface AgentEntry {
  model: string;
  provider: string;
  role: string;
  capabilities?: string[];
  skills?: string[];
  escalation_level?: string;
  default_stance?: string;
  provider_note?: string;
}

interface CronJob {
  id?: string;
  name?: string;
  schedule?: string;
  enabled?: boolean;
  lastRun?: string;
  lastResult?: string;
}

interface CronHistoryEntry {
  id?: string;
  name?: string;
  time?: string;
  completedAt?: string;
  status?: string;
  error?: string;
  duration?: number;
}

interface BuildMeta {
  name?: string;
  idea?: string;
  status?: string;
  agent?: string;
  date?: string;
  takeaway?: string;
  verified?: boolean;
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

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

/* ── Local Data Readers ────────────────────────────────────────────── */

function readAgentDirectory(): Record<string, unknown> | null {
  return safe(() => {
    if (!existsSync(DIRECTORY_PATH)) return null;
    const raw = readFileSync(DIRECTORY_PATH, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  }, null);
}

function readCronJobs(): CronJob[] {
  return safe(() => {
    if (!existsSync(CRON_JOBS_PATH)) return [];
    const raw = readFileSync(CRON_JOBS_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as CronJob[] : [];
  }, []);
}

function readCronHistory(): CronHistoryEntry[] {
  return safe(() => {
    if (!existsSync(CRON_HISTORY_PATH)) return [];
    const raw = readFileSync(CRON_HISTORY_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as CronHistoryEntry[] : [];
  }, []);
}

function readDailyMemory(date: string): string | null {
  return safe(() => {
    const path = join(MEMORY_DIR, `${date}.md`);
    if (!existsSync(path)) return null;
    return readFileSync(path, "utf-8");
  }, null);
}

function readRecentMemoryDates(limit = 14): string[] {
  return safe(() => {
    if (!existsSync(MEMORY_DIR)) return [];
    return readdirSync(MEMORY_DIR)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort()
      .reverse()
      .slice(0, limit)
      .map(f => f.replace(".md", ""));
  }, []);
}

interface YoloBuild {
  folder: string;
  name: string;
  date: string;
  agent: string;
  idea: string;
  status: string;
  takeaway: string;
  verified: boolean;
  files: string[];
}

function readYoloBuilds(): YoloBuild[] {
  return safe(() => {
    if (!existsSync(YOLO_DIR)) return [];
    const entries = readdirSync(YOLO_DIR, { withFileTypes: true });
    const builds: YoloBuild[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const dirPath = join(YOLO_DIR, entry.name);
      const metaPath = join(dirPath, "meta.json");
      const files = safe(() => readdirSync(dirPath).filter(f => !f.startsWith(".")), []);

      let meta: BuildMeta = {};
      if (existsSync(metaPath)) {
        meta = safe(() => JSON.parse(readFileSync(metaPath, "utf-8")) as BuildMeta, {});
      }

      const dateMatch = entry.name.match(/^(\d{4}-\d{2}-\d{2})/);
      const agentMatch = entry.name.match(/^\d{4}-\d{2}-\d{2}-([a-z-]+?)-/);

      builds.push({
        folder: entry.name,
        name:
          meta.name ||
          entry.name
            .replace(/^\d{4}-\d{2}-\d{2}-[a-z-]+?-/, "")
            .split("-")
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" "),
        date: meta.date || (dateMatch ? dateMatch[1] : "unknown"),
        agent:
          meta.agent ||
          (agentMatch
            ? agentMatch[1].charAt(0).toUpperCase() + agentMatch[1].slice(1)
            : "Unknown"),
        idea: meta.idea || "",
        status: meta.status || "working",
        takeaway: meta.takeaway || "",
        verified: meta.verified ?? existsSync(join(dirPath, "index.html")),
        files,
      });
    }

    builds.sort((a, b) => b.date.localeCompare(a.date) || b.folder.localeCompare(a.folder));
    return builds;
  }, []);
}

/* ── Sync Operations ───────────────────────────────────────────────── */

async function syncAgents(db: Firestore): Promise<SyncResult> {
  const dir = readAgentDirectory();
  if (!dir) return { collection: "agents", ok: false, error: "directory.json not found" };

  try {
    await db
      .collection("command-center")
      .doc("agents")
      .collection("directory")
      .doc("latest")
      .set({ ...dir, _syncedAt: FieldValue.serverTimestamp() }, { merge: true });

    const agentCount = dir.agents
      ? Object.keys(dir.agents as Record<string, AgentEntry>).length
      : 0;
    return { collection: "agents", ok: true, docCount: agentCount };
  } catch (e) {
    return { collection: "agents", ok: false, error: String(e) };
  }
}

async function syncCrons(db: Firestore): Promise<SyncResult> {
  const jobs = readCronJobs();
  const history = readCronHistory();

  try {
    const batch = db.batch();

    const configRef = db
      .collection("command-center")
      .doc("crons")
      .collection("config")
      .doc("latest");
    batch.set(
      configRef,
      { jobs, jobCount: jobs.length, _syncedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    const historyRef = db
      .collection("command-center")
      .doc("crons")
      .collection("history")
      .doc("latest");
    batch.set(
      historyRef,
      {
        entries: history.slice(-100),
        entryCount: history.length,
        _syncedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await batch.commit();
    return { collection: "crons", ok: true, docCount: jobs.length + history.length };
  } catch (e) {
    return { collection: "crons", ok: false, error: String(e) };
  }
}

async function syncMemory(db: Firestore): Promise<SyncResult> {
  const dates = readRecentMemoryDates(14);
  if (dates.length === 0) {
    return { collection: "memory", ok: true, docCount: 0 };
  }

  try {
    let synced = 0;
    const batch = db.batch();

    for (const date of dates) {
      const content = readDailyMemory(date);
      if (!content) continue;

      const ref = db
        .collection("command-center")
        .doc("memory")
        .collection(date)
        .doc("daily");
      batch.set(
        ref,
        {
          date,
          content,
          contentLength: content.length,
          _syncedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      synced++;
    }

    await batch.commit();
    return { collection: "memory", ok: true, docCount: synced };
  } catch (e) {
    return { collection: "memory", ok: false, error: String(e) };
  }
}

async function syncYoloBuilds(db: Firestore): Promise<SyncResult> {
  const builds = readYoloBuilds();

  try {
    await db
      .collection("command-center")
      .doc("yolo-builds")
      .collection("manifest")
      .doc("latest")
      .set(
        {
          builds,
          buildCount: builds.length,
          _syncedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    return { collection: "yolo-builds", ok: true, docCount: builds.length };
  } catch (e) {
    return { collection: "yolo-builds", ok: false, error: String(e) };
  }
}

async function syncMeridian(db: Firestore): Promise<SyncResult> {
  if (!existsSync(MERIDIAN_JSON_PATH)) {
    return { collection: "meridian", ok: true, docCount: 0 };
  }
  try {
    const raw = readFileSync(MERIDIAN_JSON_PATH, "utf-8");
    await db.collection("command-center").doc("meridian").set(
      {
        snapshot: raw,
        _syncedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return { collection: "meridian", ok: true, docCount: 1 };
  } catch (e) {
    return { collection: "meridian", ok: false, error: String(e) };
  }
}

/* ── GET: Sync Status ──────────────────────────────────────────────── */

export async function GET() {
  const db = getAdminDb();
  if (!db) {
    return NextResponse.json(
      { error: "FIREBASE_SERVICE_ACCOUNT not configured", status: null },
      { status: 503 }
    );
  }

  try {
    const collections = ["agents", "crons", "yolo-builds", "memory"] as const;
    const status: SyncStatus = { lastSyncedAt: null, counts: {} };

    for (const col of collections) {
      const subcol = col === "agents" ? "directory" : col === "crons" ? "config" : col === "yolo-builds" ? "manifest" : todayDate();
      const snap = await db
        .collection("command-center")
        .doc(col)
        .collection(subcol)
        .doc("latest")
        .get();

      if (snap.exists) {
        const data = snap.data();
        const syncedAt = data?._syncedAt?.toDate?.()?.toISOString() ?? null;
        if (syncedAt && (!status.lastSyncedAt || syncedAt > status.lastSyncedAt)) {
          status.lastSyncedAt = syncedAt;
        }
        status.counts[col] =
          data?.jobCount ?? data?.buildCount ?? data?.entryCount ??
          (data?.agents ? Object.keys(data.agents as Record<string, unknown>).length : 0);
      } else {
        status.counts[col] = 0;
      }
    }

    return NextResponse.json({
      ok: true,
      status,
      /** Resolved paths on this host (sync reads these). PIN-gated UI only. */
      paths: {
        workspace: WS,
        cronDir: CRON_DIR,
        cronJobs: CRON_JOBS_PATH,
        cronHistory: CRON_HISTORY_PATH,
        agentsDirectory: DIRECTORY_PATH,
        yoloBuilds: YOLO_DIR,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e), ok: false }, { status: 500 });
  }
}

/* ── POST: Perform Sync ────────────────────────────────────────────── */

export async function POST() {
  const db = getAdminDb();
  if (!db) {
    return NextResponse.json(
      { error: "FIREBASE_SERVICE_ACCOUNT not configured" },
      { status: 503 }
    );
  }

  const started = Date.now();
  const results: SyncResult[] = [];

  results.push(await syncAgents(db));
  results.push(await syncCrons(db));
  results.push(await syncMemory(db));
  results.push(await syncYoloBuilds(db));
  results.push(await syncMeridian(db));

  const elapsed = Date.now() - started;
  const allOk = results.every(r => r.ok);
  const totalDocs = results.reduce((sum, r) => sum + (r.docCount ?? 0), 0);

  // Write a sync log entry
  safe(
    () => {
      db.collection("command-center")
        .doc("sync-log")
        .collection("runs")
        .add({
          timestamp: FieldValue.serverTimestamp(),
          results,
          elapsed,
          allOk,
          totalDocs,
        });
    },
    undefined
  );

  return NextResponse.json({
    ok: allOk,
    elapsed,
    totalDocs,
    results,
    syncedAt: new Date().toISOString(),
  });
}
