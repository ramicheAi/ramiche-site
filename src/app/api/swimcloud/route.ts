import { NextResponse } from "next/server";

/* ── SwimCloud Best Times Scraper ─────────────────────────────
   Fetches best times for an athlete from SwimCloud.com
   Input: POST { name: string, usaSwimmingId?: string }
   Output: { times: BestTimeEntry[], source: "swimcloud" }
   ────────────────────────────────────────────────────────────── */

interface BestTimeEntry {
  event: string;       // "100"
  stroke: string;      // "Freestyle"
  time: string;        // "52.34"
  seconds: number;     // 52.34
  course: "SCY" | "SCM" | "LCM";
  meet: string;        // "NCSA Spring Championships"
  date: string;        // "2026-03-17"
  source: "swimcloud";
}

// Parse time string (M:SS.hh or SS.hh) to seconds
function parseTime(t: string): number {
  if (!t) return 0;
  const clean = t.replace(/[^0-9:.]/g, "").trim();
  if (!clean) return 0;
  const parts = clean.split(":");
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(clean) || 0;
}

// Normalize stroke name
function normalizeStroke(s: string): string {
  const lower = s.toLowerCase().trim();
  if (lower.includes("free")) return "Freestyle";
  if (lower.includes("back")) return "Backstroke";
  if (lower.includes("breast")) return "Breaststroke";
  if (lower.includes("fly") || lower.includes("butter")) return "Butterfly";
  if (lower.includes("im") || lower.includes("medley")) return "IM";
  return s;
}

// Normalize distance
function normalizeDistance(d: string): string {
  const num = d.replace(/[^0-9]/g, "");
  return num || d;
}

// Normalize course
function normalizeCourse(c: string): "SCY" | "SCM" | "LCM" {
  const lower = c.toLowerCase();
  if (lower.includes("lcm") || lower.includes("long course meter") || lower === "l") return "LCM";
  if (lower.includes("scm") || lower.includes("short course meter") || lower === "s") return "SCM";
  return "SCY";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, usaSwimmingId } = body;

    if (!name && !usaSwimmingId) {
      return NextResponse.json({ error: "Name or USA Swimming ID required" }, { status: 400 });
    }

    // Strategy 1: Search SwimCloud by name
    const searchName = name?.trim().replace(/\s+/g, "+") || "";
    const searchUrl = `https://www.swimcloud.com/swimmer/search/?q=${encodeURIComponent(searchName)}`;

    let times: BestTimeEntry[] = [];
    let swimmerUrl = "";
    let swimmerName = "";

    try {
      // Step 1: Search for the swimmer
      const searchRes = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      if (!searchRes.ok) {
        // Fallback: try USA Swimming Times Search
        return NextResponse.json({
          times: [],
          error: "SwimCloud search unavailable. Try entering times manually.",
          source: "swimcloud",
        });
      }

      const searchHtml = await searchRes.text();

      // Parse search results — look for swimmer links
      // SwimCloud search results have links like /swimmer/123456/
      const swimmerLinkRegex = /href="(\/swimmer\/\d+\/)"/g;
      const nameRegex = /<a[^>]*href="\/swimmer\/\d+\/"[^>]*>([^<]+)<\/a>/gi;

      const links: string[] = [];
      let match;
      while ((match = swimmerLinkRegex.exec(searchHtml)) !== null) {
        if (!links.includes(match[1])) links.push(match[1]);
      }

      // Extract names to find best match
      const names: string[] = [];
      while ((match = nameRegex.exec(searchHtml)) !== null) {
        names.push(match[1].trim());
      }

      if (links.length === 0) {
        return NextResponse.json({
          times: [],
          message: `No swimmer found for "${name}". They may not have USA Swimming registered times yet.`,
          source: "swimcloud",
        });
      }

      // Use first match (or try to find exact name match)
      let bestIdx = 0;
      if (name) {
        const target = name.toLowerCase();
        for (let i = 0; i < names.length; i++) {
          if (names[i].toLowerCase() === target) { bestIdx = i; break; }
          if (names[i].toLowerCase().includes(target) || target.includes(names[i].toLowerCase())) {
            bestIdx = i;
          }
        }
      }

      swimmerUrl = links[bestIdx] || links[0];
      swimmerName = names[bestIdx] || name;

      // Step 2: Fetch swimmer's best times page
      const timesUrl = `https://www.swimcloud.com${swimmerUrl}times/`;
      const timesRes = await fetch(timesUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      if (!timesRes.ok) {
        return NextResponse.json({
          times: [],
          error: `Could not fetch times for ${swimmerName}`,
          source: "swimcloud",
        });
      }

      const timesHtml = await timesRes.text();

      // Parse best times from the HTML
      // SwimCloud times pages have tables with event, time, meet, date
      // Pattern: <td> with event name, time, meet name, date

      // Look for structured time data in the page
      // SwimCloud uses a table structure with classes like "c-table-clean"
      const tableRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
      const rows = timesHtml.match(tableRegex) || [];

      for (const row of rows) {
        // Skip header rows
        if (row.includes("<th")) continue;

        // Extract cells
        const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        const cells: string[] = [];
        let cellMatch;
        while ((cellMatch = cellRegex.exec(row)) !== null) {
          // Strip HTML tags and trim
          cells.push(cellMatch[1].replace(/<[^>]+>/g, "").trim());
        }

        // We need at least 3 cells: event, time, and either meet or date
        if (cells.length < 3) continue;

        // Try to identify which cells contain what
        // Typical patterns: Event | Time | Meet | Date | Course
        const timePattern = /^\d{1,2}:\d{2}\.\d{2}$|^\d{2}\.\d{2}$/;
        const datePattern = /^\d{2}\/\d{2}\/\d{4}$|^\d{4}-\d{2}-\d{2}$|^[A-Z][a-z]+ \d+, \d{4}$/;

        let eventCell = "";
        let timeCell = "";
        let meetCell = "";
        let dateCell = "";
        let courseCell = "SCY";

        for (const cell of cells) {
          if (timePattern.test(cell) && !timeCell) {
            timeCell = cell;
          } else if (datePattern.test(cell) && !dateCell) {
            dateCell = cell;
          } else if ((cell.includes("Free") || cell.includes("Back") || cell.includes("Breast") || cell.includes("Fly") || cell.includes("IM") || cell.includes("Medley")) && !eventCell) {
            eventCell = cell;
          } else if ((cell.includes("SCY") || cell.includes("LCM") || cell.includes("SCM")) && !courseCell) {
            courseCell = cell;
          } else if (cell.length > 5 && !meetCell) {
            meetCell = cell;
          }
        }

        if (!eventCell || !timeCell) continue;

        // Parse event: "100 Freestyle" → distance "100", stroke "Freestyle"
        const eventParts = eventCell.match(/(\d+)\s*(.+)/);
        if (!eventParts) continue;

        const distance = normalizeDistance(eventParts[1]);
        const stroke = normalizeStroke(eventParts[2]);
        const seconds = parseTime(timeCell);

        if (seconds <= 0) continue;

        times.push({
          event: distance,
          stroke,
          time: timeCell,
          seconds,
          course: normalizeCourse(courseCell),
          meet: meetCell || "Unknown",
          date: dateCell || new Date().toISOString().slice(0, 10),
          source: "swimcloud",
        });
      }

      // Deduplicate — keep best time per event/stroke/course combo
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

    } catch (fetchErr) {
      console.error("SwimCloud fetch error:", fetchErr);
      return NextResponse.json({
        times: [],
        error: "Network error fetching SwimCloud data. Check server connectivity.",
        source: "swimcloud",
      });
    }

    return NextResponse.json({
      times,
      swimmer: swimmerName,
      swimmerUrl: swimmerUrl ? `https://www.swimcloud.com${swimmerUrl}` : null,
      count: times.length,
      source: "swimcloud",
    });
  } catch (err) {
    console.error("SwimCloud API error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
