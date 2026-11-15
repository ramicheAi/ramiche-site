/**
 * Builds provenance helpers.
 *
 * The builds page could not tell "the source answered with zero builds" apart from "the source
 * could not be read", and it never said which source answered or how old the data was. These
 * helpers keep that judgement pure so it can be tested without a filesystem.
 */

export type BuildsState = "live" | "empty" | "unavailable";

export type BuildsProvenance = {
  state: BuildsState;
  source: string;
  /** When this process read the source, ISO. */
  observedAt: string;
  /** Newest build date (YYYY-MM-DD) or null when there are none. */
  latestBuildDate: string | null;
  /** Age of the newest build in whole days, or null. */
  ageDays: number | null;
  /** "fresh" within the window, "stale" beyond it, "none" with no builds. */
  freshness: "fresh" | "stale" | "none";
};

/** A build older than this is reported as stale rather than current. */
export const FRESH_WINDOW_DAYS = 7;

function parseDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function newestBuildDate(dates: string[]): string | null {
  let best: string | null = null;
  for (const d of dates) {
    // Shape is not enough: 2026-13-99 matches the regex and is not a date.
    if (!parseDate(d)) continue;
    if (!best || d > best) best = d;
  }
  return best;
}

export function buildProvenance(options: {
  source: string;
  dates: string[];
  /** Number of builds returned. State follows the count, not whether dates parse. */
  count?: number;
  observedAt?: Date;
  unavailable?: boolean;
  freshWindowDays?: number;
}): BuildsProvenance {
  const observedAt = (options.observedAt ?? new Date()).toISOString();
  const window = options.freshWindowDays ?? FRESH_WINDOW_DAYS;

  if (options.unavailable) {
    return { state: "unavailable", source: options.source, observedAt, latestBuildDate: null, ageDays: null, freshness: "none" };
  }

  const count = options.count ?? options.dates.length;
  const latest = newestBuildDate(options.dates);
  if (count === 0) {
    // No builds is only "empty" when the source actually answered.
    return { state: "empty", source: options.source, observedAt, latestBuildDate: null, ageDays: null, freshness: "none" };
  }
  if (!latest) {
    // Builds exist but none carries a usable date: live, age unknown. Calling this "empty" while
    // the grid renders cards is the inversion the review found.
    return { state: "live", source: options.source, observedAt, latestBuildDate: null, ageDays: null, freshness: "none" };
  }

  const latestDate = parseDate(latest);
  const ageDays = latestDate
    ? Math.max(0, Math.floor(((options.observedAt ?? new Date()).getTime() - latestDate.getTime()) / 86_400_000))
    : null;
  // A future date clamps to zero age; it cannot make an inventory look newer than "today".

  return {
    state: "live",
    source: options.source,
    observedAt,
    latestBuildDate: latest,
    ageDays,
    freshness: ageDays !== null && ageDays > window ? "stale" : "fresh",
  };
}

/** Human sentence for the page. Never claims freshness it cannot prove. */
export function provenanceLabel(p: BuildsProvenance, locale = "en-US"): string {
  const when = new Date(p.observedAt).toLocaleString(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  if (p.state === "unavailable") return `builds source unavailable · observed ${when}`;
  if (p.state === "empty") return `source answered with zero builds · ${p.source} · observed ${when}`;
  const age = p.ageDays === null ? "age unknown" : p.ageDays === 0 ? "newest today" : `newest ${p.ageDays}d old`;
  return `${p.source} · ${p.freshness} · ${age} · observed ${when}`;
}
