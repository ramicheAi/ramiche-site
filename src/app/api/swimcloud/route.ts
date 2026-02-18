import { NextResponse } from "next/server";

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
  try {
    const body = await req.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }

    // Step 1: Search via JSON API
    const searchUrl = `https://www.swimcloud.com/api/search/?q=${encodeURIComponent(name.trim())}`;
    const searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": UA, "Accept": "application/json" },
    });

    if (!searchRes.ok) {
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

    // Pick best match — prefer exact name match, then partial
    let best = searchResults[0];
    const target = name.toLowerCase().trim();
    for (const r of searchResults) {
      if (r.name.toLowerCase().trim() === target) { best = r; break; }
    }

    const swimmerUrl = best.url; // e.g. "/swimmer/2429607"

    // Step 2: Fetch swimmer profile page
    const profileUrl = `https://www.swimcloud.com${swimmerUrl}`;
    const profileRes = await fetch(profileUrl, {
      headers: { "User-Agent": UA, "Accept": "text/html" },
    });

    if (!profileRes.ok) {
      return NextResponse.json({
        times: [], error: `Could not fetch profile for ${best.name}`, source: "swimcloud",
      });
    }

    const html = await profileRes.text();
    const bestMap = new Map<string, BestTimeEntry>();

    // ── Source 1: HTML best times table (current season, primary course) ──
    const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
    const rows = html.match(rowRegex) || [];

    for (const row of rows) {
      if (row.includes("<th")) continue;

      const eventMatch = row.match(/<strong>(\d+\s+[A-Z]?\s*\w[\w\s()]*)<\/strong>/i);
      if (!eventMatch) continue;

      const eventRaw = eventMatch[1].trim();
      if (eventRaw.includes("Relay") || eventRaw.includes("Split")) continue;

      const timeMatch = row.match(/<a\s+href="\/results\/[^"]*">(\d{1,2}:\d{2}\.\d{2}|\d{2}\.\d{2})<\/a>/);
      if (!timeMatch) continue;

      const parsed = parseEventString(eventRaw);
      if (!parsed) continue;

      const timeStr = timeMatch[1];
      const seconds = parseTime(timeStr);
      if (seconds <= 0) continue;

      const key = `${parsed.distance}-${parsed.stroke}-${parsed.course}`;
      const existing = bestMap.get(key);
      if (!existing || seconds < existing.seconds) {
        bestMap.set(key, {
          event: parsed.distance,
          stroke: parsed.stroke,
          time: timeStr,
          seconds,
          course: parsed.course,
          meet: "",
          date: "",
          source: "swimcloud",
        });
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
              bestMap.set(key, {
                event: parsed.distance,
                stroke: parsed.stroke,
                time: ft.time,
                seconds,
                course: parsed.course,
                meet: "",
                date: "",
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

    return NextResponse.json({
      times,
      swimmer: best.name,
      team: best.team,
      swimmerUrl: `https://www.swimcloud.com${swimmerUrl}`,
      count: times.length,
      source: "swimcloud",
    });
  } catch (err) {
    console.error("SwimCloud API error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
