import { NextResponse } from "next/server";

/* ── SwimCloud Best Times Scraper ─────────────────────────────
   Fetches best times for an athlete from SwimCloud.com
   Step 1: /api/search/?q=NAME → JSON array of {name, url, team}
   Step 2: /swimmer/ID/ → HTML profile with embedded times table
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

function normalizeCourse(c: string): "SCY" | "SCM" | "LCM" {
  const lower = c.toLowerCase();
  if (lower === "l" || lower.includes("lcm") || lower.includes("long")) return "LCM";
  if (lower === "s" || lower.includes("scm") || lower.includes("short course m")) return "SCM";
  return "SCY";
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

    // Step 2: Fetch swimmer profile page (has latest times embedded)
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

    // Parse times from HTML tables
    // Pattern: <strong>50 Y Free</strong> ... <a href="/results/...">26.96</a>
    // Each <tr> has: event cell (with <strong>EVENT</strong>), time cell (with <a>TIME</a>), improvement, place
    let times: BestTimeEntry[] = [];

    // Extract all <tr> blocks
    const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
    const rows = html.match(rowRegex) || [];

    for (const row of rows) {
      // Skip header rows and rows without event data
      if (row.includes("<th")) continue;

      // Extract event name: <strong>50 Y Free</strong> or <strong>100 L Fly</strong>
      const eventMatch = row.match(/<strong>(\d+\s+[A-Z]?\s*\w[\w\s()]*)<\/strong>/i);
      if (!eventMatch) continue;

      const eventRaw = eventMatch[1].trim();

      // Skip relay splits — they contain "(Split)" in the event name
      if (eventRaw.includes("Relay") || eventRaw.includes("Split")) continue;

      // Extract time: <a href="/results/...">26.96</a> or <a ...>2:03.76</a>
      const timeMatch = row.match(/<a\s+href="\/results\/[^"]*">(\d{1,2}:\d{2}\.\d{2}|\d{2}\.\d{2})<\/a>/);
      if (!timeMatch) continue;

      const timeStr = timeMatch[1];
      const seconds = parseTime(timeStr);
      if (seconds <= 0) continue;

      // Parse event: "50 Y Free" → distance=50, course=Y(SCY), stroke=Free
      // Formats: "100 Y Free", "200 L IM", "100 Y Breast", "50 Y Fly"
      const eventParts = eventRaw.match(/^(\d+)\s+([YLS])?\s*(.+)$/i);
      if (!eventParts) continue;

      const distance = eventParts[1];
      const courseChar = (eventParts[2] || "Y").toUpperCase();
      const strokeRaw = eventParts[3].trim();

      const course = courseChar === "L" ? "LCM" : courseChar === "S" ? "SCM" : "SCY";
      const stroke = normalizeStroke(strokeRaw);

      times.push({
        event: distance,
        stroke,
        time: timeStr,
        seconds,
        course,
        meet: "",
        date: "",
        source: "swimcloud",
      });
    }

    // Deduplicate — keep best (fastest) time per event/stroke/course
    const bestMap = new Map<string, BestTimeEntry>();
    for (const t of times) {
      const key = `${t.event}-${t.stroke}-${t.course}`;
      const existing = bestMap.get(key);
      if (!existing || t.seconds < existing.seconds) {
        bestMap.set(key, t);
      }
    }
    times = Array.from(bestMap.values()).sort((a, b) => {
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
