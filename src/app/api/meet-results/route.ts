/* ── METTLE — Automated Meet Results Pipeline ─────────────────────
   Fetches latest times from SwimCloud for all roster athletes,
   compares against stored bestTimes, detects PBs, calculates
   meet-day XP bonuses, and returns scoring results.

   POST /api/meet-results
   Body: { meetId, meetName, meetDate, course, athletes: [{id, name, usaSwimmingId, bestTimes, events}] }
   Response: { results: ScoringResult[], updatedBestTimes: Record<athleteId, Record<key, BestTime>> }
   ────────────────────────────────────────────────────────────────── */

import { NextResponse } from "next/server";
import { rateLimit, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { withRetry } from "@/lib/retry";
import {
  scoreAthleteMeet,
  swimcloudToRecord,
  parseTime,
  timeKey,
  type BestTime,
  type MeetResult,
  type ScoringResult,
} from "@/app/apex-athlete/lib/meet-scoring";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s for batch fetching

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface AthleteInput {
  id: string;
  name: string;
  usaSwimmingId?: string;
  bestTimes?: Record<string, BestTime>;
  events?: Array<{ event: string; stroke: string }>;
}

interface RequestBody {
  meetId: string;
  meetName: string;
  meetDate: string;
  course: "SCY" | "SCM" | "LCM";
  athletes: AthleteInput[];
}

// ── SwimCloud fetch (reuses existing scraper logic) ──────────────

async function fetchSwimCloudTimes(
  name: string,
  _usaSwimmingId?: string
): Promise<
  Array<{
    event: string;
    stroke: string;
    time: string;
    seconds: number;
    course: string;
    meet: string;
    date: string;
    source: string;
  }>
> {
  try {
    // Search SwimCloud for the athlete
    const searchUrl = `https://www.swimcloud.com/api/search/?q=${encodeURIComponent(name.trim())}`;
    const searchRes = await withRetry(
      () =>
        fetch(searchUrl, {
          headers: { "User-Agent": UA, Accept: "application/json" },
        }),
      { maxAttempts: 2, baseDelayMs: 500 }
    );

    if (!searchRes.data?.ok) return [];

    const results = await searchRes.data.json();
    if (!Array.isArray(results) || results.length === 0) return [];

    // Get the first matching swimmer's profile
    const swimmerUrl = results[0].url;
    if (!swimmerUrl) return [];

    const profileUrl = `https://www.swimcloud.com${swimmerUrl}`;
    const profileRes = await withRetry(
      () =>
        fetch(profileUrl, {
          headers: { "User-Agent": UA, Accept: "text/html" },
        }),
      { maxAttempts: 2, baseDelayMs: 500 }
    );

    if (!profileRes.data?.ok) return [];

    const html = await profileRes.data.text();

    // Parse embedded season data (JSON in script tag)
    const dataMatch = html.match(/const\s+data\s*=\s*(\[[\s\S]*?\]);/);
    if (!dataMatch) return [];

    let seasonData: Array<{
      event_name?: string;
      time?: string;
      meet_name?: string;
      meet_date?: string;
    }>;
    try {
      seasonData = JSON.parse(dataMatch[1]);
    } catch {
      return [];
    }

    // Convert to our format
    const times: Array<{
      event: string;
      stroke: string;
      time: string;
      seconds: number;
      course: string;
      meet: string;
      date: string;
      source: string;
    }> = [];

    for (const entry of seasonData) {
      if (!entry.event_name || !entry.time) continue;
      const parsed = parseEventString(entry.event_name);
      if (!parsed) continue;

      const seconds = parseTime(entry.time);
      if (seconds <= 0) continue;

      times.push({
        event: parsed.distance,
        stroke: parsed.stroke,
        time: entry.time,
        seconds,
        course: parsed.course,
        meet: entry.meet_name || "Unknown",
        date: entry.meet_date || new Date().toISOString().split("T")[0],
        source: "swimcloud",
      });
    }

    return times;
  } catch {
    return [];
  }
}

function normalizeStroke(s: string): string {
  const lower = s.toLowerCase().trim();
  if (lower.includes("free")) return "Freestyle";
  if (lower.includes("back")) return "Backstroke";
  if (lower.includes("breast")) return "Breaststroke";
  if (lower.includes("fly") || lower.includes("butter")) return "Butterfly";
  if (lower.includes("im") || lower.includes("medley")) return "IM";
  return s;
}

function parseEventString(
  eventStr: string
): { distance: string; course: "SCY" | "SCM" | "LCM"; stroke: string } | null {
  const m = eventStr.match(/^(\d+)\s+([YLS])?\s*(.+)$/i);
  if (!m) return null;
  const distance = m[1];
  const courseChar = (m[2] || "Y").toUpperCase();
  const course =
    courseChar === "L"
      ? ("LCM" as const)
      : courseChar === "S"
        ? ("SCM" as const)
        : ("SCY" as const);
  const stroke = normalizeStroke(m[3].trim());
  return { distance, course, stroke };
}

// ── Main endpoint ────────────────────────────────────────────────

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = rateLimit(`meet-results:${ip}`, 5, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const body: RequestBody = await req.json();
    const { meetName, meetDate, course, athletes } = body;

    if (!meetName || !meetDate || !athletes?.length) {
      return NextResponse.json(
        { error: "meetName, meetDate, and athletes[] required" },
        { status: 400 }
      );
    }

    const allResults: ScoringResult[] = [];
    const updatedBestTimes: Record<string, Record<string, BestTime>> = {};

    // Process athletes sequentially to avoid rate limiting SwimCloud
    for (const athlete of athletes) {
      // Fetch latest times from SwimCloud
      const scTimes = await fetchSwimCloudTimes(
        athlete.name,
        athlete.usaSwimmingId
      );

      if (scTimes.length === 0) continue;

      // Convert fetched times to our BestTime record format
      const fetchedRecord = swimcloudToRecord(scTimes);

      // Build MeetResult array by comparing fetched times with known events
      const meetResults: MeetResult[] = [];

      // Filter for times from today's meet (or recent meets matching date)
      const meetDateStr = meetDate.split("T")[0];
      const recentTimes = scTimes.filter((t) => {
        const tDate = t.date?.split("T")[0];
        // Match times from the meet date or within 1 day
        if (tDate === meetDateStr) return true;
        const diff = Math.abs(
          new Date(tDate).getTime() - new Date(meetDateStr).getTime()
        );
        return diff < 2 * 24 * 60 * 60 * 1000; // within 2 days
      });

      for (const time of recentTimes) {
        meetResults.push({
          athleteId: athlete.id,
          event: time.event,
          stroke: time.stroke,
          course: (time.course as "SCY" | "SCM" | "LCM") || course,
          seedTime: "",
          finalTime: time.time,
          finalSeconds: time.seconds,
        });
      }

      if (meetResults.length === 0) {
        // No recent meet times found — check if ANY new times are better than stored
        const existingBest = athlete.bestTimes || {};
        for (const [key, fetched] of Object.entries(fetchedRecord)) {
          const existing = existingBest[key];
          if (!existing || fetched.seconds < existing.seconds) {
            meetResults.push({
              athleteId: athlete.id,
              event: fetched.event,
              stroke: fetched.stroke,
              course: fetched.course,
              seedTime: existing?.time || "",
              finalTime: fetched.time,
              finalSeconds: fetched.seconds,
            });
          }
        }
      }

      if (meetResults.length > 0) {
        const scored = scoreAthleteMeet(
          meetResults,
          athlete.bestTimes || {},
          meetName,
          meetDate
        );
        allResults.push(scored);

        // Build updated best times
        if (scored.newBestTimes.length > 0) {
          const updated = { ...(athlete.bestTimes || {}) };
          for (const bt of scored.newBestTimes) {
            updated[timeKey(bt.event, bt.stroke, bt.course)] = bt;
          }
          updatedBestTimes[athlete.id] = updated;
        }
      }
    }

    return NextResponse.json({
      meetName,
      meetDate,
      course,
      athletesProcessed: athletes.length,
      athletesWithResults: allResults.filter((r) => r.totalXP > 0).length,
      totalXPAwarded: allResults.reduce((sum, r) => sum + r.totalXP, 0),
      totalPBs: allResults.filter((r) => r.isPB).length,
      results: allResults,
      updatedBestTimes,
    });
  } catch (err) {
    console.error("Meet results error:", err);
    return NextResponse.json(
      { error: "Failed to process meet results" },
      { status: 500 }
    );
  }
}
