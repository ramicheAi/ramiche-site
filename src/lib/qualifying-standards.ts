/* ══════════════════════════════════════════════════════════════
   QUALIFYING STANDARDS — Time Standard Cuts for Swim Events
   Used by BestTimesCard to show progress toward qualifying times
   ══════════════════════════════════════════════════════════════ */

// Course → Event → Cut time in seconds
export const QUALIFYING_STANDARDS: Record<string, Record<string, number>> = {
  SCY: {
    "50 Free": 21.49,
    "100 Free": 47.49,
    "200 Free": 103.49,
    "500 Free": 273.49,
    "1000 Free": 567.49,
    "1650 Free": 952.49,
    "100 Back": 51.49,
    "200 Back": 112.49,
    "100 Breast": 56.49,
    "200 Breast": 123.49,
    "100 Fly": 50.49,
    "200 Fly": 113.49,
    "200 IM": 113.49,
    "400 IM": 243.49,
  },
  LCM: {
    "50 Free": 24.49,
    "100 Free": 52.49,
    "200 Free": 113.49,
    "400 Free": 243.49,
    "800 Free": 507.49,
    "1500 Free": 967.49,
    "100 Back": 57.49,
    "200 Back": 123.49,
    "100 Breast": 63.49,
    "200 Breast": 137.49,
    "100 Fly": 55.49,
    "200 Fly": 123.49,
    "200 IM": 123.49,
    "400 IM": 267.49,
  },
};

export function normalizeEvent(event: string, stroke: string): string {
  const clean = event.replace(/\s+/g, " ").trim();
  // If event already contains stroke info (e.g. "100 Free"), return as-is
  if (/\d+\s+(Free|Back|Breast|Fly|IM)/i.test(clean)) return clean;
  // Otherwise combine distance + stroke
  const dist = clean.match(/\d+/)?.[0];
  if (dist && stroke) return `${dist} ${stroke}`;
  return clean;
}

export function parseTimeToSeconds(time: string): number {
  const parts = time.replace(/[^\d:.]/g, "").split(":");
  if (parts.length === 2) {
    // MM:SS.ss
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  if (parts.length === 1) {
    // SS.ss
    return parseFloat(parts[0]);
  }
  // HH:MM:SS.ss
  return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
}

export function formatSeconds(secs: number): string {
  const abs = Math.abs(secs);
  if (abs >= 60) {
    const m = Math.floor(abs / 60);
    const s = (abs % 60).toFixed(2).padStart(5, "0");
    return `${m}:${s}`;
  }
  return abs.toFixed(2);
}
