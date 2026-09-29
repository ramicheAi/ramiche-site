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

// Chain/franchise names we skip — corporate handles their marketing. We sell to
// INDEPENDENT local businesses only. Single-word entries match as the first word
// ("Wendy's", "Wingstop Tampa"); multi-word entries match as a phrase anywhere
// ("Bob's Planet Fitness"). Curated for our verticals (food, gym, salon, auto, hotel,
// home-services, retail, dental, real estate). Extend freely.
const CHAINS = [
  // ── Food / cafe / QSR ──────────────────────────────────────────────────────
  "mcdonald", "starbucks", "subway", "wendy", "dunkin", "domino", "chipotle", "kfc", "popeyes",
  "panera", "wingstop", "zaxby", "culver", "whataburger", "sonic drive", "arby", "quiznos", "sbarro",
  "cinnabon", "chick fil a", "burger king", "pizza hut", "taco bell", "five guys", "jersey mike",
  "jimmy john", "firehouse subs", "panda express", "raising cane", "papa john", "little caesars",
  "marco pizza", "jet pizza", "hungry howie", "cold stone", "baskin robbins", "dairy queen",
  "tropical smoothie", "smoothie king", "dutch bros", "panera bread", "krispy kreme", "steak n shake",
  "jack in the box", "del taco", "el pollo loco", "golden corral", "cracker barrel", "olive garden",
  "red lobster", "outback steakhouse", "buffalo wild wings", "texas roadhouse", "first watch",
  "tijuana flats", "pollo tropical", "miami grill", "moe southwest", "qdoba", "wawa", "circle k",
  // ── Gyms / fitness ─────────────────────────────────────────────────────────
  "planet fitness", "la fitness", "crunch fitness", "anytime fitness", "workout anytime",
  "snap fitness", "blink fitness", "ufc gym", "club pilates", "pure barre", "gold gym", "golds gym",
  "24 hour fitness", "retro fitness", "eos fitness", "youfit", "lifetime fitness", "life time",
  "burn boot camp", "fit body boot camp", "title boxing", "orange theory", "row house", "stretch zone",
  "camp transformation", "d1 training", "basecamp fitness",
  // ── Salon / beauty / spa ───────────────────────────────────────────────────
  "great clips", "supercuts", "sport clips", "fantastic sams", "sola salon", "massage envy",
  "european wax", "amazing lash", "lash lounge", "hand stone", "palm beach tan", "sun tan city",
  "woodhouse spa", "deka lash", "drybar", "image studios",
  // ── Auto ───────────────────────────────────────────────────────────────────
  "jiffy lube", "take 5", "big o tires", "discount tire", "tires plus", "christian brothers",
  "caliber collision", "gerber collision", "pep boys", "mavis", "tint world", "midas", "meineke",
  "aamco", "maaco", "valvoline", "firestone",
  // ── Hotel ──────────────────────────────────────────────────────────────────
  "marriott", "hilton", "holiday inn", "hampton inn", "best western", "comfort inn", "la quinta",
  "days inn", "super 8", "motel 6", "residence inn", "fairfield inn", "embassy suites", "courtyard",
  "home2 suites", "spring hill suites", "doubletree", "wyndham", "ramada", "hyatt",
  // ── Home services ──────────────────────────────────────────────────────────
  "merry maids", "molly maid", "two men and a truck", "stanley steemer", "mr handyman", "mr rooter",
  "roto rooter", "one hour heating", "aire serv", "mister sparky", "benjamin franklin", "servpro",
  "the maids", "chem dry",
  // ── Retail / services / dental / real estate ───────────────────────────────
  "ups store", "fedex office", "postal annex", "ace hardware", "true value", "batteries plus",
  "vitamin shoppe", "the joint chiropractic", "cvs", "walgreens", "7-eleven", "gnc",
  "aspen dental", "western dental", "comfort dental", "sono bello", "ideal image",
  "keller williams", "century 21", "coldwell banker", "exp realty", "berkshire hathaway",
];

// Distinctive single-word franchise ROOTS — for location variants that DROP the suffix
// (e.g. "Crunch Oakland Park" for Crunch Fitness). Matched as a whole word anywhere.
const FRANCHISE_ROOTS = ["crunch", "orangetheory", "f45", "9round", "youfit", "eos"];

const normChain = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Stable dedup key — collapses punctuation/quote/spacing differences so the two
 *  ingestion paths agree ("Tony's Pizza" === "Tonys  Pizza"). */
export function normalizeName(s?: string | null): string {
  // Drop apostrophes FIRST so contractions collapse ("Tony's" === "Tonys", which is
  // what sanitize() produces) — then turn other separators into spaces.
  return (s || "").toLowerCase().replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function isChain(name: string): boolean {
  const clean = normChain(name);
  if (!clean) return false;
  const firstWord = clean.split(" ")[0];
  const padded = ` ${clean} `;
  for (const raw of CHAINS) {
    const c = normChain(raw);
    if (!c) continue;
    if (c.includes(" ")) {
      // multi-word brand: match as a whole phrase ANYWHERE ("Bob's Planet Fitness")
      if (padded.includes(` ${c} `)) return true;
    } else if (firstWord.startsWith(c)) {
      // single-word brand: only as the FIRST word — catches "McDonald's", "Wendy's",
      // "Subway #12" without false-flagging "Discount Subway Tiles"
      return true;
    }
  }
  // suffix-dropping franchise roots, as a whole word anywhere ("Crunch Oakland Park")
  for (const raw of FRANCHISE_ROOTS) {
    if (padded.includes(` ${normChain(raw)} `)) return true;
  }
  return false;
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
