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
  | "no_email_capture"
  | "no_ai_visibility";

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
  { id: "ai_visibility", name: "AI Visibility (Get Found by ChatGPT)", billing: "monthly", low: 200, high: 700,
    value: "Get named and recommended by ChatGPT, Perplexity, Gemini & Google AI when people ask an assistant for a business like yours — the new front door to search.",
    triggers: ["no_ai_visibility"] },
  { id: "ai_receptionist", name: "AI Voice Receptionist", billing: "monthly", low: 300, high: 1500,
    value: "A 24/7 AI receptionist that answers every call in your customers' language, books appointments, and captures the leads you'd otherwise miss — never a missed call again.",
    triggers: ["no_email_capture", "no_online_ordering"] },
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
  items: RecommendedItem[];       // the RIGHT-SIZED starter anchor — what we quote cold
  oneTimeTotal: number;
  monthlyTotal: number;
  rationale: string[];
  expansion: RecommendedItem[];   // additional fits — the UPSELL menu for the review call, never the cold anchor
}

// ── Right-sizing the cold anchor (anti price-shock) ─────────────────────────
// We sell to small local businesses. Auto-stacking every triggered service at once
// (a cookie shop was quoted 11 items = $5,340 + $3,350/mo) guarantees a "no". So we
// anchor on a sane STARTER — the foundation + the single most impactful growth layer
// — and keep the rest as an upsell menu for Ramon's review call. TUNABLE caps:
const STARTER_ONETIME_CAP = 2500; // cold anchor stays near the Beacon Launch/Site level
const STARTER_MONTHLY_CAP = 500;  // one care/growth plan, not a full stack
// Heavy services that are UPSELLS on the call — never the cold anchor.
const UPSELL_ONLY = new Set<string>(["social_content", "ai_receptionist"]);
// Fill order for the starter (most foundational first).
const STARTER_PRIORITY = ["web_build", "local_seo", "ai_visibility", "online_ordering", "reviews", "branding", "email_sms", "ai_chatbot", "hosting_maint"];

/**
 * Build a right-sized recommendation from the audit gaps. `items` is the STARTER we
 * anchor on (capped — never price-shock); `expansion` is the rest (upsell on the call).
 * Price within each band scales with the lead's apparent size (sizeFactor 0..1).
 */
export function recommendBundle(gaps: GapId[], sizeFactor = 0.35): Recommendation {
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  const priceOf = (s: Service) => Math.round((s.low + (s.high - s.low) * clamp(sizeFactor)) / 10) * 10;
  const priced = (s: Service): RecommendedItem => ({ id: s.id, name: s.name, billing: s.billing, price: priceOf(s), value: s.value });

  // Every service whose triggers match a gap = the full opportunity.
  const wanted = SERVICES.filter((s) => s.triggers.some((t) => gaps.includes(t)));

  // Fill the starter in priority order under the caps. The first one-time build is
  // always included (the foundation) even if it edges the cap; later items must fit.
  const ordered = [...wanted].sort((a, b) => (STARTER_PRIORITY.indexOf(a.id) + 1 || 99) - (STARTER_PRIORITY.indexOf(b.id) + 1 || 99));
  const core: RecommendedItem[] = [];
  let oneTime = 0, monthly = 0, haveBuild = false;
  for (const s of ordered) {
    if (UPSELL_ONLY.has(s.id)) continue;
    const item = priced(s);
    if (item.billing === "one-time") {
      if (!haveBuild) {
        // Foundation is always included — but never above the anchor cap, even at a
        // high sizeFactor. The full scope still shows up in `expansion` as the upsell.
        const price = Math.min(item.price, STARTER_ONETIME_CAP);
        core.push({ ...item, price }); oneTime += price; haveBuild = true;
      } else if (oneTime + item.price <= STARTER_ONETIME_CAP) {
        core.push(item); oneTime += item.price;
      }
    } else if (monthly + item.price <= STARTER_MONTHLY_CAP) {
      core.push(item); monthly += item.price;
    }
  }

  const sortBundle = (a: RecommendedItem, b: RecommendedItem) => (a.billing === b.billing ? b.price - a.price : a.billing === "one-time" ? -1 : 1);
  core.sort(sortBundle);
  const coreIds = new Set(core.map((i) => i.id));
  const expansion = wanted.filter((s) => !coreIds.has(s.id)).map(priced).sort(sortBundle);

  return {
    items: core,
    oneTimeTotal: oneTime,
    monthlyTotal: monthly,
    rationale: gaps.map((g) => GAP_LABEL[g]).filter(Boolean),
    expansion,
  };
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
  no_ai_visibility: "Invisible to AI search — not cited by ChatGPT/Perplexity/Gemini when customers ask an assistant",
};
