// ── Meet Results Cron Worker ─────────────────────────────────────────
// Bulletproof cron: retries failed schedules, catches up missed windows,
// tolerates auth failures gracefully. Called via Vercel Cron or direct GET.

import { NextResponse } from "next/server";

const PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "apex-athlete-73755";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const CRON_SECRET = process.env.CRON_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://ramiche-site.vercel.app";
const MAX_RETRIES = 3;

export const dynamic = "force-dynamic";
export const maxDuration = 120; // 2 min to handle catch-up

// ── Firestore helpers ───────────────────────────────────────────────

function fsString(val: string) {
  return { stringValue: val };
}

async function fsGet(path: string) {
  const res = await fetch(`${FIRESTORE_BASE}/${path}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

async function fsPatch(path: string, fields: Record<string, unknown>) {
  await fetch(`${FIRESTORE_BASE}/${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
}

// ── Read roster from Firestore ──────────────────────────────────────

interface RosterAthlete {
  id: string;
  name: string;
  usaSwimmingId?: string;
  bestTimes?: Record<string, unknown>;
  events?: Array<{ event: string; stroke: string }>;
}

async function fetchRoster(orgId: string): Promise<RosterAthlete[]> {
  const doc = await fsGet(`organizations/${orgId}/rosters/all`);
  if (!doc?.fields?.athletes?.arrayValue?.values) return [];

  return doc.fields.athletes.arrayValue.values
    .map((v: { mapValue?: { fields?: Record<string, { stringValue?: string; mapValue?: unknown }> } }) => {
      const f = v?.mapValue?.fields;
      if (!f) return null;
      return {
        id: f.id?.stringValue || "",
        name: f.name?.stringValue || "",
        usaSwimmingId: f.usaSwimmingId?.stringValue,
        bestTimes: {},
        events: [],
      };
    })
    .filter(Boolean) as RosterAthlete[];
}

// ── Main cron handler ───────────────────────────────────────────────

export async function GET(req: Request) {
  // Auth: accept CRON_SECRET via header or query param; skip if not configured
  const authHeader = req.headers.get("authorization");
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && querySecret !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch all meet schedules
    const schedulesRes = await fetch(
      `${FIRESTORE_BASE}/meet-schedules?pageSize=50`,
      { cache: "no-store" }
    );
    if (!schedulesRes.ok) {
      return NextResponse.json({ error: "Failed to fetch schedules" }, { status: 500 });
    }

    const schedulesData = await schedulesRes.json();
    const documents = schedulesData.documents || [];

    if (documents.length === 0) {
      return NextResponse.json({ processed: 0, message: "No scheduled meets" });
    }

    const now = new Date();
    let processed = 0;
    let resultsFound = 0;
    const log: string[] = [];

    for (const doc of documents) {
      const f = doc.fields || {};
      const meetId = f.meetId?.stringValue;
      const meetName = f.meetName?.stringValue || "Unknown";
      const meetDate = f.meetDate?.stringValue;
      const orgId = f.orgId?.stringValue || "saint-andrews-aquatics";
      const status = f.status?.stringValue;
      const schedulesJson = f.schedules?.stringValue || "[]";

      if (!meetId || !meetDate) continue;
      if (status === "completed") continue;

      // Parse schedules and check if any are due
      let schedules: Array<{
        id: string;
        type: string;
        triggerAt: string;
        processed?: boolean;
        retries?: number;
        lastError?: string;
      }>;
      try {
        schedules = JSON.parse(schedulesJson);
      } catch {
        continue;
      }

      // Catch-up: process ALL overdue schedules (even if missed by hours/days)
      // Also retry failed schedules up to MAX_RETRIES times
      const dueSchedules = schedules.filter((s) => {
        if (s.processed) return false;
        const triggerTime = new Date(s.triggerAt);
        if (triggerTime <= now) return true; // overdue — catch up
        return false;
      }).filter((s) => {
        const retries = (s as { retries?: number }).retries || 0;
        return retries < MAX_RETRIES;
      });

      if (dueSchedules.length === 0) continue;

      // Fetch roster for this org
      const roster = await fetchRoster(orgId);
      if (roster.length === 0) {
        log.push(`${meetName}: no roster found for ${orgId}`);
        continue;
      }

      // Call the meet-results API
      const resultsRes = await fetch(`${APP_URL}/api/meet-results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetId,
          meetName,
          meetDate,
          course: "SCY",
          athletes: roster.slice(0, 50), // cap at 50 to avoid timeout
        }),
      });

      if (resultsRes.ok) {
        const results = await resultsRes.json();
        processed++;
        resultsFound += results.totalPBs || 0;
        log.push(
          `${meetName}: ${results.athletesWithResults}/${results.athletesProcessed} athletes, ${results.totalPBs} PBs, ${results.totalXPAwarded} XP`
        );

        // Store results in Firestore
        await fsPatch(`meet-results/${meetId}-${Date.now()}`, {
          meetId: fsString(meetId),
          meetName: fsString(meetName),
          processedAt: fsString(now.toISOString()),
          totalPBs: { integerValue: String(results.totalPBs || 0) },
          totalXP: { integerValue: String(results.totalXPAwarded || 0) },
          athletesProcessed: {
            integerValue: String(results.athletesProcessed || 0),
          },
          resultsSummary: fsString(JSON.stringify(results.results || [])),
        });
      } else {
        log.push(`${meetName}: API error ${resultsRes.status}`);
      }

      // Mark due schedules as processed (or increment retry on failure)
      const apiSucceeded = resultsRes.ok;
      const updatedSchedules = schedules.map((s) => {
        const wasDue = dueSchedules.find((d) => d.id === s.id);
        if (!wasDue) return s;
        if (apiSucceeded) {
          return { ...s, processed: true, processedAt: now.toISOString() };
        }
        // Failed — increment retry counter so we try again next cron run
        const retries = ((s as { retries?: number }).retries || 0) + 1;
        return { ...s, retries, lastError: now.toISOString() };
      });

      const allProcessed = updatedSchedules.every((s) => s.processed);

      await fsPatch(`meet-schedules/${meetId}`, {
        ...f,
        schedules: fsString(JSON.stringify(updatedSchedules)),
        status: fsString(allProcessed ? "completed" : "active"),
        lastProcessedAt: fsString(now.toISOString()),
      });
    }

    return NextResponse.json({
      processed,
      resultsFound,
      log,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error("Meet cron error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
