// /Users/admin/ramiche-site/src/lib/services-catalog.ts
// Parallax service catalog — what we sell, one-time vs recurring (MRR), and the
// pricing bands. Value-based: the recommended bundle is driven by the lead's
// digital-presence gaps, not hours. Prices are starting bands; adjust freely.

export type Billing = "one-time" | "monthly";

export interface Service {
  id: string;
  name: string;
  billing: Billing;
  /** Starting price band (USD). low = small biz, high = larger scope. */
  low: number;
  high: number;
  /** Plain-English value statement (what it does for the business). */
  value: string;
  /** Which audit gaps trigger recommending this service. */
  triggers: GapId[];
}

export type GapId =
  | "no_website"
  | "outdated_website"
  | "not_mobile"
  | "no_ssl"
  | "slow_site"
  | "no_gbp"
  | "few_reviews"
  | "no_online_ordering"
  | "no_social"
  | "no_email_capture";

export const SERVICES: Service[] = [
  // ── One-time builds ──────────────────────────────────────────────────────
  { id: "web_build", name: "Website Design + Build", billing: "one-time", low: 500, high: 4000,
    value: "A fast, mobile-first website that turns searches into customers — live in days.",
    triggers: ["no_website", "outdated_website", "not_mobile", "no_ssl", "slow_site"] },
  { id: "branding", name: "Branding + Logo", billing: "one-time", low: 400, high: 2500,
    value: "A cohesive brand identity (logo, colors, type) so you look established and trustworthy.",
    triggers: ["no_website", "outdated_website"] },
  { id: "online_ordering", name: "Online Ordering / Booking", billing: "one-time", low: 600, high: 3000,
    value: "Take orders or bookings directly on your site — a revenue channel you don't have today.",
    triggers: ["no_online_ordering"] },
  { id: "ai_chatbot", name: "AI Site Assistant", billing: "one-time", low: 500, high: 2000,
    value: "A 24/7 AI receptionist that answers questions and captures leads while you sleep.",
    triggers: ["no_email_capture", "no_website"] },

  // ── Recurring (MRR — the sticky layer) ───────────────────────────────────
  { id: "hosting_maint", name: "Hosting + Maintenance", billing: "monthly", low: 50, high: 150,
    value: "Hosting, updates, backups, and security so your site never goes down or gets hacked.",
    triggers: ["no_website", "outdated_website", "no_ssl"] },
  { id: "local_seo", name: "Local SEO + Google Business Profile", billing: "monthly", low: 300, high: 800,
    value: "Get found on Google Maps and local search — claim, optimize, and rank your profile.",
    triggers: ["no_gbp", "no_website", "outdated_website"] },
  { id: "reviews", name: "Reviews + Reputation", billing: "monthly", low: 100, high: 300,
    value: "Automatically request reviews from happy customers and protect your reputation. More reviews = more trust = more sales.",
    triggers: ["few_reviews", "no_gbp"] },
  { id: "social_content", name: "Social + Content + Ads", billing: "monthly", low: 500, high: 2500,
    value: "We run your social and paid ads (Google/Meta) so new customers find you every week.",
    triggers: ["no_social"] },
  { id: "email_sms", name: "Email + SMS Marketing", billing: "monthly", low: 150, high: 600,
    value: "Automated email/SMS that brings past customers back — the cheapest revenue you'll ever get.",
    triggers: ["no_email_capture"] },
];

export function serviceById(id: string): Service | undefined {
  return SERVICES.find((s) => s.id === id);
}

export interface RecommendedItem { id: string; name: string; billing: Billing; price: number; value: string; }
export interface Recommendation {
  items: RecommendedItem[];
  oneTimeTotal: number;
  monthlyTotal: number;
  rationale: string[];
}

/**
 * Build a value-priced bundle from the audit gaps. Bigger gaps → bigger scope.
 * Price within each band scales with the lead's apparent size (sizeFactor 0..1).
 */
export function recommendBundle(gaps: GapId[], sizeFactor = 0.35): Recommendation {
  const wanted = new Set<string>();
  for (const s of SERVICES) {
    if (s.triggers.some((t) => gaps.includes(t))) wanted.add(s.id);
  }
  const items: RecommendedItem[] = [];
  for (const id of wanted) {
    const s = serviceById(id)!;
    const price = Math.round((s.low + (s.high - s.low) * Math.min(1, Math.max(0, sizeFactor))) / 10) * 10;
    items.push({ id: s.id, name: s.name, billing: s.billing, price, value: s.value });
  }
  // Sort: one-time build first, then recurring by price desc.
  items.sort((a, b) => (a.billing === b.billing ? b.price - a.price : a.billing === "one-time" ? -1 : 1));
  const oneTimeTotal = items.filter((i) => i.billing === "one-time").reduce((n, i) => n + i.price, 0);
  const monthlyTotal = items.filter((i) => i.billing === "monthly").reduce((n, i) => n + i.price, 0);
  const rationale = gaps.map((g) => GAP_LABEL[g]).filter(Boolean);
  return { items, oneTimeTotal, monthlyTotal, rationale };
}

export const GAP_LABEL: Record<GapId, string> = {
  no_website: "No website — invisible to ~30% of customers who search online first",
  outdated_website: "Outdated website — loses to competitors with a modern presence",
  not_mobile: "Not mobile-friendly — most local searches happen on phones",
  no_ssl: "No SSL — browsers warn visitors the site is 'Not Secure'",
  slow_site: "Slow site — every second of load time loses visitors",
  no_gbp: "No Google Business Profile — missing from Maps + local search",
  few_reviews: "Few/no reviews — low trust vs. competitors with social proof",
  no_online_ordering: "No online ordering/booking — a revenue channel left on the table",
  no_social: "Weak social presence — no top-of-funnel discovery",
  no_email_capture: "No email/lead capture — visitors leave without a way to follow up",
};
