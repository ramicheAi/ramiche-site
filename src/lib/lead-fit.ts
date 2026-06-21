// /Users/admin/ramiche-site/src/lib/lead-fit.ts
// The ICP (ideal client profile) + fit scoring. We help REAL, REACHABLE local
// businesses with WEAK online presence — that's where a site + Google presence is
// a step-change. We skip businesses that already have it handled.

export interface ProspectLike {
  name?: string | null;
  category?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

// Verticals where customers find you by searching online → a web presence pays.
export const TARGET_VERTICALS = [
  "restaurant", "cafe", "bar", "gym", "salon", "beauty", "retail",
  "realestate", "lawyer", "dentist", "doctor", "autorepair", "hotel", "contractor",
];

// Chain/franchise names we skip — corporate handles their marketing.
const CHAINS = [
  "mcdonald", "starbucks", "subway", "burger king", "wendy", "dunkin", "domino", "pizza hut",
  "planet fitness", "la fitness", "crunch fitness", "orangetheory", "anytime fitness", "ups store",
  "great clips", "supercuts", "marriott", "hilton", "holiday inn", "7-eleven", "cvs", "walgreens",
  "taco bell", "chipotle", "kfc", "popeyes", "five guys", "jersey mike", "panera",
];

/** Stable dedup key — collapses punctuation/quote/spacing differences so the two
 *  ingestion paths agree ("Tony's Pizza" === "Tonys  Pizza"). */
export function normalizeName(s?: string | null): string {
  // Drop apostrophes FIRST so contractions collapse ("Tony's" === "Tonys", which is
  // what sanitize() produces) — then turn other separators into spaces.
  return (s || "").toLowerCase().replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function isChain(name: string): boolean {
  // Match the chain as the START of the name (or the whole name), not any substring —
  // a bare `includes` false-flags "Discount Subway Tiles" as the sandwich chain.
  const n = name.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  return CHAINS.some((c) => n === c || n.startsWith(c + " "));
}

export interface FitResult {
  fitScore: number;      // 0..100, higher = better target
  qualified: boolean;    // worth pursuing
  reasons: string[];     // why it's a fit
  disqualifiers: string[]; // why we'd skip
}

/**
 * Pre-research fit from prospector/OSM data. (Post-research disqualification by
 * digital-health score happens in diagnose.)
 */
export function qualifyProspect(p: ProspectLike): FitResult {
  const name = (p.name || "").trim();
  const reasons: string[] = [];
  const dq: string[] = [];
  let score = 0;

  if (!name) { dq.push("no business name"); return { fitScore: 0, qualified: false, reasons, disqualifiers: dq }; }
  if (isChain(name)) dq.push("national chain / franchise (corporate marketing)");

  // Core need signal: weak/no web presence.
  if (!p.website) { score += 45; reasons.push("no website — biggest opportunity"); }
  // A real contact CHANNEL is what makes a lead workable. An address is findable, not
  // reachable — we can't sell to a pin on a map. Require phone OR email to qualify.
  if (p.phone) { score += 18; reasons.push("has a phone (reachable)"); }
  if (p.email) { score += 16; reasons.push("has an email (reachable)"); }
  if (p.address) { score += 8; reasons.push("has a real address (findable)"); }
  const reachable = !!p.phone || !!p.email;
  if (!reachable) dq.push("no phone or email — can't reach them (research must find a contact first)");
  // Right vertical.
  const cat = (p.category || "").toLowerCase();
  const inVertical = TARGET_VERTICALS.some((v) => cat.includes(v)) || /restaurant|cafe|bar|gym|fitness|salon|hair|beauty|spa|shop|retail|estate|law|dentist|doctor|clinic|repair|hotel|contractor|craft/.test(cat);
  if (inVertical) { score += 12; reasons.push("local service vertical (needs online discovery)"); }

  score = Math.min(100, score);
  // Qualified = clear need (no website) + reachable via a real channel (phone/email) + not a chain.
  const qualified = !p.website && reachable && !isChain(name) && score >= 45;
  return { fitScore: score, qualified, reasons, disqualifiers: dq };
}

// ── Daily auto-prospector targets (edit freely) ─────────────────────────────
// Rotates through (vertical × city) so the funnel refills with fresh leads daily.
export const ICP_VERTICALS = ["restaurant", "gym", "salon", "autorepair", "dentist", "contractor", "beauty", "cafe"];
export const ICP_CITIES = [
  "Fort Lauderdale, FL", "Miami, FL", "West Palm Beach, FL", "Boca Raton, FL", "Hollywood, FL",
  "Pompano Beach, FL", "Coral Springs, FL", "Hialeah, FL", "Pembroke Pines, FL", "Naples, FL",
  "Orlando, FL", "Tampa, FL", "Atlanta, GA", "Austin, TX", "Charlotte, NC",
];

/** Deterministic day-based rotation so each day hits different city/vertical combos. */
export function dailyTargets(dayIndex: number, perDay = 6): { vertical: string; city: string }[] {
  const out: { vertical: string; city: string }[] = [];
  for (let i = 0; i < perDay; i++) {
    const v = ICP_VERTICALS[(dayIndex * perDay + i) % ICP_VERTICALS.length];
    const c = ICP_CITIES[(dayIndex * perDay + i * 3) % ICP_CITIES.length];
    out.push({ vertical: v, city: c });
  }
  return out;
}
