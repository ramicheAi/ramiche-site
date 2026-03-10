import { NextResponse } from "next/server";
import { rateLimit, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { withRetry } from "@/lib/retry";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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

function cacheKey(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, "-");
}

/* ── SwimCloud Best Times Scraper v2 ─────────────────────────
   Fetches best times for ALL courses (SCY, LCM, SCM).
   Step 1: /api/search/?q=NAME → JSON array of {name, url, team}
   Step 2: /swimmer/ID/ → HTML profile page
     - Parse HTML best times table (current season, primary course)
     - Parse embedded season JSON (all seasons, all courses)
     - Merge both sources → complete best times across all courses
   ────────────────────────────────────────────────────────────── */

interface BestTimeEntry {
  event: string;       // "100"
  stroke: string;      // "Freestyle"
  time: string;        // "52.34"
  seconds: number;     // 52.34
  course: "SCY" | "SCM" | "LCM";
  meet: string;
  date: string;
  source: "swimcloud";
}

interface SearchResult {
  id: string;
  name: string;
  url: string;          // "/swimmer/2429607"
  team: string;
  location: string;
}

function parseTime(t: string): number {
  if (!t) return 0;
  const clean = t.replace(/[^0-9:.]/g, "").trim();
  if (!clean) return 0;
  const parts = clean.split(":");
  if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  return parseFloat(clean) || 0;
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

function parseEventString(eventStr: string): { distance: string; course: "SCY" | "SCM" | "LCM"; stroke: string } | null {
  // Formats: "50 Y Free", "200 L IM", "100 S Breast", "1500 L Free"
  const m = eventStr.match(/^(\d+)\s+([YLS])?\s*(.+)$/i);
  if (!m) return null;
  const distance = m[1];
  const courseChar = (m[2] || "Y").toUpperCase();
  const course = courseChar === "L" ? "LCM" as const : courseChar === "S" ? "SCM" as const : "SCY" as const;
  const stroke = normalizeStroke(m[3].trim());
  return { distance, course, stroke };
}

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = rateLimit(`swimcloud:${ip}`, 15, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const body = await req.json();
    const { name, usaSwimmingId } = body;

    if (!name) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }

    // ── Cache check: return cached times if <7 days old ──
    const forceRefresh = body.forceRefresh === true;
    try {
      if (!forceRefresh) {
        const db = await getDb();
        const cacheDoc = await db.collection("swimcloud_cache").doc(cacheKey(name)).get();
        if (cacheDoc.exists) {
          const cached = cacheDoc.data();
          if (cached && cached.fetchedAt) {
            const age = Date.now() - cached.fetchedAt;
            if (age < CACHE_TTL_MS) {
              return NextResponse.json({
                ...cached.response,
                cached: true,
                cacheAge: Math.round(age / (1000 * 60 * 60)), // hours
              });
            }
          }
        }
      }
    } catch {
      // Cache read failed — proceed with live fetch
    }

    // Step 1: Search via JSON API (with retry)
    const searchUrl = `https://www.swimcloud.com/api/search/?q=${encodeURIComponent(name.trim())}`;
    const searchResult = await withRetry(
      () => fetch(searchUrl, { headers: { "User-Agent": UA, "Accept": "application/json" } }),
      { maxAttempts: 3, baseDelayMs: 500, shouldRetry: (_err, _attempt) => true }
    );

    const searchRes = searchResult.data;
    if (!searchRes || !searchRes.ok) {
      return NextResponse.json({
        times: [], error: "SwimCloud search unavailable", source: "swimcloud",
      });
    }

    let searchResults: SearchResult[];
    try {
      searchResults = await searchRes.json();
    } catch {
      return NextResponse.json({
        times: [], error: "Invalid search response from SwimCloud", source: "swimcloud",
      });
    }

    if (!Array.isArray(searchResults) || searchResults.length === 0) {
      return NextResponse.json({
        times: [],
        message: `No swimmer found for "${name}". They may not have USA Swimming registered times yet.`,
        source: "swimcloud",
      });
    }

    // Pick best match — prefer USA Swimming ID match, then exact name, then first result
    let best = searchResults[0];
    const target = name.toLowerCase().trim();

    // Priority 1: Match by USA Swimming ID (most accurate)
    if (usaSwimmingId) {
      const idMatch = searchResults.find(
        (r) => r.id === `sdif.swimmer.${usaSwimmingId}` || r.url === `/swimmer/${usaSwimmingId}/`
      );
      if (idMatch) { best = idMatch; }
    }

    // Priority 2: Exact name match (fallback when no ID match)
    if (!usaSwimmingId || best === searchResults[0]) {
      for (const r of searchResults) {
        if (r.name.toLowerCase().trim() === target) { best = r; break; }
      }
    }

    const swimmerUrl = best.url; // e.g. "/swimmer/2429607"

    // Step 2: Fetch swimmer profile page (with retry)
    const profileUrl = `https://www.swimcloud.com${swimmerUrl}`;
    const profileResult = await withRetry(
      () => fetch(profileUrl, { headers: { "User-Agent": UA, "Accept": "text/html" } }),
      { maxAttempts: 3, baseDelayMs: 500, shouldRetry: (_err, _attempt) => true }
    );

    const profileRes = profileResult.data;
    if (!profileRes || !profileRes.ok) {
      return NextResponse.json({
        times: [], error: `Could not fetch profile for ${best.name}`, source: "swimcloud",
      });
    }

    const html = await profileRes.text();
    const bestMap = new Map<string, BestTimeEntry>();

    // ── Source 1: HTML best times table (current season, primary course) ──
    // Collect unique meet IDs from time links for batch meet info fetch
    const meetIdSet = new Set<string>();
    const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
    const rows = html.match(rowRegex) || [];

    // First pass: extract times + collect meet IDs
    const htmlTimes: Array<{ key: string; entry: BestTimeEntry; meetId: string }> = [];
    for (const row of rows) {
      if (row.includes("<th")) continue;

      const eventMatch = row.match(/<strong>(\d+\s+[A-Z]?\s*\w[\w\s()]*)<\/strong>/i);
      if (!eventMatch) continue;

      const eventRaw = eventMatch[1].trim();
      if (eventRaw.includes("Relay") || eventRaw.includes("Split")) continue;

      const timeMatch = row.match(/<a\s+href="\/results\/(\d+)\/[^"]*?"[^>]*>(\d{1,2}:\d{2}\.\d{2}|\d{2}\.\d{2})<\/a>/);
      if (!timeMatch) continue;

      const meetId = timeMatch[1];
      const timeStr = timeMatch[2];
      const parsed = parseEventString(eventRaw);
      if (!parsed) continue;

      const seconds = parseTime(timeStr);
      if (seconds <= 0) continue;

      meetIdSet.add(meetId);
      const key = `${parsed.distance}-${parsed.stroke}-${parsed.course}`;
      htmlTimes.push({
        key,
        meetId,
        entry: { event: parsed.distance, stroke: parsed.stroke, time: timeStr, seconds, course: parsed.course, meet: "", date: "", source: "swimcloud" },
      });
    }

    // Batch fetch meet names (usually 2-5 unique meets)
    // Serialized with retry to avoid SwimCloud/Cloudflare rate-limiting on Vercel
    const meetInfoMap = new Map<string, { name: string; date: string }>();
    const meetIds = Array.from(meetIdSet).slice(0, 8);
    for (const mid of meetIds) {
      try {
        const result = await withRetry(
          () => fetch(`https://www.swimcloud.com/results/${mid}/`, { headers: { "User-Agent": UA, "Accept": "text/html" } }),
          { maxAttempts: 2, baseDelayMs: 400, shouldRetry: (_err: unknown, _attempt: number) => true }
        );
        const res = result.data;
        if (!res || !res.ok) continue;
        const meetHtml = await res.text();
        const nameMatch = meetHtml.match(/<h1[^>]*>([^<]+)/) || meetHtml.match(/<h2[^>]*>([^<]+)/);
        const dateMatch = meetHtml.match(/"startDate":\s*"([^"]+)"/);
        meetInfoMap.set(mid, {
          name: nameMatch ? nameMatch[1].trim() : "",
          date: dateMatch ? dateMatch[1].trim() : "",
        });
      } catch { /* skip failed meet fetches */ }
    }

    // Second pass: merge times with meet info
    for (const { key, meetId, entry } of htmlTimes) {
      const meetInfo = meetInfoMap.get(meetId);
      if (meetInfo) { entry.meet = meetInfo.name; entry.date = meetInfo.date; }
      const existing = bestMap.get(key);
      if (!existing || entry.seconds < existing.seconds) {
        bestMap.set(key, entry);
      }
    }

    // ── Source 2: Embedded season JSON (all seasons, all courses) ──
    // Pattern: const data = [{...swimmer_id, fastest_times: [{event: "50 Y Free", time: "26.96"}, ...], ...}, ...]
    const jsonMatch = html.match(/const\s+data\s*=\s*(\[[\s\S]*?\]);/);
    if (jsonMatch) {
      try {
        const seasons = JSON.parse(jsonMatch[1]) as Array<{
          fastest_times?: Array<{ event: string; time: string }>;
        }>;

        for (const season of seasons) {
          for (const ft of season.fastest_times || []) {
            const parsed = parseEventString(ft.event);
            if (!parsed) continue;

            const seconds = parseTime(ft.time);
            if (seconds <= 0) continue;

            const key = `${parsed.distance}-${parsed.stroke}-${parsed.course}`;
            const existing = bestMap.get(key);
            if (!existing || seconds < existing.seconds) {
              // Preserve meet/date from HTML source — JSON rarely has meet info
              const hasMeetFromExisting = existing && existing.meet;
              bestMap.set(key, {
                event: parsed.distance,
                stroke: parsed.stroke,
                time: ft.time,
                seconds,
                course: parsed.course,
                meet: hasMeetFromExisting ? existing.meet : "",
                date: hasMeetFromExisting ? existing.date : "",
                source: "swimcloud",
              });
            }
          }
        }
      } catch {
        // JSON parse failed — continue with HTML-only times
      }
    }

    const times = Array.from(bestMap.values()).sort((a, b) => {
      // Sort by course (SCY first, then LCM, then SCM), then distance, then stroke
      const courseOrder = { SCY: 0, LCM: 1, SCM: 2 };
      if (courseOrder[a.course] !== courseOrder[b.course]) return courseOrder[a.course] - courseOrder[b.course];
      const distA = parseInt(a.event) || 0;
      const distB = parseInt(b.event) || 0;
      if (distA !== distB) return distA - distB;
      return a.stroke.localeCompare(b.stroke);
    });

    const response = {
      times,
      swimmer: best.name,
      team: best.team,
      swimmerUrl: `https://www.swimcloud.com${swimmerUrl}`,
      count: times.length,
      source: "swimcloud",
    };

    // ── Cache write: save to Firestore ──
    try {
      const db = await getDb();
      await db.collection("swimcloud_cache").doc(cacheKey(name)).set({
        response,
        fetchedAt: Date.now(),
        searchName: name.trim(),
      });
    } catch {
      // Cache write failed — not critical
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error("SwimCloud API error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
