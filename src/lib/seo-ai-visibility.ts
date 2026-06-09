// /Users/admin/ramiche-site/src/lib/seo-ai-visibility.ts
// ──────────────────────────────────────────────────────────────────────────────
// THE PARALLAX SEO + AI-VISIBILITY STANDARD
// The single source of truth for what "found by humans AND machines" means on
// every site we ship. Two halves:
//   1) Classic SEO  — rank in Google/Bing (humans searching).
//   2) AI Visibility (GEO/AEO) — get cited by ChatGPT, Perplexity, Claude,
//      Google AI Overviews & Gemini (machines answering).
//
// This is consumed in three places so the workflow is seamless:
//   • Deal Room → Delivery tab (the runnable checklist for a closed client)
//   • The `web-client-delivery` Claude Code / OpenClaw skill (the build agent)
//   • delivery-playbook.ts (the per-service process shown pre-close)
//
// AI search is now ~the front door: people ask an assistant before they click a
// blue link. A site with no schema / no llms.txt / blocked AI crawlers is
// invisible to that front door even if it ranks #1 on Google. We fix both.
// ──────────────────────────────────────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  label: string;
  /** Why it matters in plain, sales-usable language. */
  why: string;
  /** Concrete, repeatable implementation step the build agent performs. */
  how: string;
  /** AI crawlers/assistants this primarily helps, if AI-specific. */
  ai?: boolean;
}

export interface ChecklistSection {
  id: string;
  title: string;
  intro: string;
  items: ChecklistItem[];
}

/* ── 1. Technical SEO foundation ──────────────────────────────────────────── */
const technical: ChecklistSection = {
  id: "technical",
  title: "Technical SEO foundation",
  intro: "The non-negotiable base. If a crawler can't read it, nothing else matters.",
  items: [
    { id: "titles", label: "Unique <title> + meta description per page",
      why: "The headline Google shows in results — the click decision.",
      how: "≤60-char title (keyword + city + brand), ≤155-char description with the benefit. One per route via Next metadata." },
    { id: "headings", label: "Semantic HTML + one H1 per page",
      why: "Crawlers and screen readers read structure, not styling.",
      how: "Real <header>/<main>/<section>/<footer>, one descriptive H1, ordered H2/H3. No heading-as-styling." },
    { id: "canonical", label: "Canonical URL on every page",
      why: "Stops duplicate-content dilution between www/non-www, trailing slash, params.",
      how: "Set alternates.canonical to the absolute self URL (already supported in src/lib/seo.ts)." },
    { id: "robots", label: "robots.txt — allow indexers AND AI crawlers",
      why: "Default configs silently block AI bots, making you invisible to assistants.",
      how: "Explicitly Allow Googlebot, Bingbot, GPTBot, ClaudeBot, PerplexityBot, Google-Extended; link the sitemap.", ai: true },
    { id: "sitemap", label: "XML sitemap, auto-generated",
      why: "Tells search + AI crawlers every page that exists and when it changed.",
      how: "app/sitemap.ts emitting all public routes with lastModified; referenced from robots.txt." },
    { id: "alt", label: "Descriptive alt text on every image",
      why: "Image search traffic + accessibility + gives AI text to read the page.",
      how: "Concrete alt ('wood-fired pizza at <name>, Fort Lauderdale'), never 'image1.jpg'." },
    { id: "https", label: "HTTPS, no mixed content, clean 404",
      why: "Browsers flag non-HTTPS 'Not Secure'; broken links bleed crawl budget.",
      how: "SSL on go-live, all assets https, a real 404 page that links home." },
    { id: "mobile", label: "Mobile-first, responsive",
      why: "Google indexes the mobile version; most local searches are on phones.",
      how: "Fluid layout, ≥44px tap targets, no horizontal scroll, readable without zoom." },
  ],
};

/* ── 2. Core Web Vitals / performance ─────────────────────────────────────── */
const performance: ChecklistSection = {
  id: "performance",
  title: "Performance & Core Web Vitals",
  intro: "Speed is a ranking factor and a conversion factor. Verified, not assumed.",
  items: [
    { id: "lcp", label: "LCP < 2.5s",
      why: "Largest paint = perceived load. Past 2.5s, rankings and bounce both suffer.",
      how: "Optimize the hero image, preconnect fonts, no render-blocking JS. Verify with chrome-devtools MCP / web-perf skill." },
    { id: "inp", label: "INP < 200ms",
      why: "Interaction responsiveness — the 2024+ replacement for FID.",
      how: "Ship minimal client JS, break up long tasks, debounce handlers." },
    { id: "cls", label: "CLS < 0.1",
      why: "Layout shift is the #1 'cheap site' tell and a Vitals fail.",
      how: "Set width/height on images, reserve ad/embed space, swap-safe fonts." },
    { id: "assets", label: "Optimized images & fonts",
      why: "Images are usually 70%+ of page weight.",
      how: "next/image (AVIF/WebP), lazy-load below the fold, self-host + preload one font." },
  ],
};

/* ── 3. Structured data (Schema.org / JSON-LD) ────────────────────────────── */
const structured: ChecklistSection = {
  id: "structured",
  title: "Structured data (Schema.org JSON-LD)",
  intro: "How machines KNOW what you are. The single biggest lever for both rich results and AI citation.",
  items: [
    { id: "localbusiness", label: "LocalBusiness / Organization schema",
      why: "Feeds Google's knowledge panel AND tells assistants your name, hours, area, phone — the facts they quote.",
      how: "JSON-LD with @type LocalBusiness, address, geo, openingHours, telephone, sameAs[socials]. Use buildLocalBusinessJsonLd().", ai: true },
    { id: "website", label: "WebSite + sitelinks search schema",
      why: "Enables the brand search box and helps AI map your site.",
      how: "@type WebSite with url, name, potentialAction SearchAction." },
    { id: "breadcrumb", label: "BreadcrumbList on inner pages",
      why: "Cleaner result display + page hierarchy for crawlers.",
      how: "@type BreadcrumbList mirroring the URL path." },
    { id: "service", label: "Service / Product / Offer schema",
      why: "Each service becomes an entity AI can recommend by name + price.",
      how: "@type Service per offering with name, description, areaServed, provider, offers.", ai: true },
    { id: "faq", label: "FAQPage schema on key pages",
      why: "FAQs are the format assistants extract verbatim to answer questions.",
      how: "@type FAQPage with real Q/A pairs matching how customers actually ask.", ai: true },
    { id: "review", label: "Review / AggregateRating schema",
      why: "Star ratings in results + the social proof AI repeats ('rated 4.9').",
      how: "@type AggregateRating from real reviews — never fabricate; only mark up what's on-page." },
  ],
};

/* ── 4. AI Visibility (GEO / AEO) ─────────────────────────────────────────── */
const aiVisibility: ChecklistSection = {
  id: "ai_visibility",
  title: "AI Visibility (GEO / AEO)",
  intro:
    "Generative & Answer Engine Optimization — getting named, quoted, and recommended by ChatGPT, Perplexity, Claude, Gemini and Google AI Overviews. This is the new top of funnel.",
  items: [
    { id: "llms_txt", label: "Publish /llms.txt",
      why: "The emerging standard (like robots.txt for LLMs) — a clean markdown map of who you are and what you offer, written for models.",
      how: "Generate /llms.txt with name, one-line description, services, hours, service area, contact, and key page links. Use buildLlmsTxt().", ai: true },
    { id: "crawlers", label: "Allow AI crawlers explicitly",
      why: "If GPTBot/ClaudeBot/PerplexityBot/Google-Extended are blocked, you can never be cited.",
      how: "Allow them in robots.txt (see AI_CRAWLERS). Confirm no CDN/WAF rule blocks them.", ai: true },
    { id: "extractable", label: "Write extractable, answer-shaped content",
      why: "Assistants quote clear, self-contained statements — not clever prose.",
      how: "Lead each section with a direct one-sentence answer, then detail. Use lists, definitions, and 'X is / X offers' phrasing.", ai: true },
    { id: "entity", label: "Entity & fact consistency across the web",
      why: "AI cross-checks your name/address/phone/claims across sources before trusting them.",
      how: "Identical NAP + identical positioning on site, GBP, directories, socials. One canonical description reused everywhere.", ai: true },
    { id: "conversational", label: "Conversational long-tail content",
      why: "People ask assistants full questions ('best X near me that does Y').",
      how: "Pages/FAQs targeting natural-language questions with specific, local, dated answers.", ai: true },
    { id: "eeat", label: "E-E-A-T / authorship signals",
      why: "Models weight trust — named author, credentials, real address, citations.",
      how: "Real About page, named owner/Person schema, credentials, sources for any claim.", ai: true },
    { id: "citations", label: "Earn third-party citations",
      why: "AI trusts what others say about you more than what you say.",
      how: "Get listed/quoted in local directories, press, partner sites, and review platforms with consistent facts.", ai: true },
    { id: "freshness", label: "Visible freshness signals",
      why: "Assistants prefer current sources and surface 'updated' content.",
      how: "Show real published/updated dates; refresh key pages; keep hours/offers current.", ai: true },
  ],
};

/* ── 5. Local SEO ─────────────────────────────────────────────────────────── */
const local: ChecklistSection = {
  id: "local",
  title: "Local SEO",
  intro: "For any business with a service area — where the money is for SMB clients.",
  items: [
    { id: "gbp", label: "Google Business Profile claimed + maxed",
      why: "The #1 local ranking + the source AI uses for 'near me' answers.",
      how: "Claim/verify, fill every field, categories, services, hours, photos; post weekly.", ai: true },
    { id: "nap", label: "NAP consistency across directories",
      why: "Inconsistent name/address/phone tanks local trust for both Google and AI.",
      how: "Identical NAP on site, GBP, Yelp, Apple Maps, Bing Places, niche directories." },
    { id: "citypages", label: "Service + city landing pages",
      why: "Ranks for 'service in city' and gives AI a page per intent.",
      how: "One indexable page per service×city with unique local content + LocalBusiness schema." },
    { id: "map", label: "Embedded map + directions",
      why: "Confirms location to users and crawlers.",
      how: "Embed the GBP map; link click-to-call and directions." },
  ],
};

/* ── 6. Social / share ────────────────────────────────────────────────────── */
const social: ChecklistSection = {
  id: "social",
  title: "Social & share metadata",
  intro: "How the link looks when shared — and the icons that signal a real brand.",
  items: [
    { id: "og", label: "Open Graph + Twitter cards",
      why: "A rich preview on every share lifts clicks; bare links look spammy.",
      how: "og:title/description/image (1200×630) + summary_large_image. Already in src/lib/seo.ts." },
    { id: "favicon", label: "Favicon + Apple touch icons + manifest",
      why: "Tab icon, home-screen icon, install prompt — the polish bar.",
      how: "Full icon set + web manifest with name, theme color, icons." },
  ],
};

/* ── 7. Analytics & verification ──────────────────────────────────────────── */
const analytics: ChecklistSection = {
  id: "analytics",
  title: "Analytics & verification",
  intro: "You can't improve what you don't measure — and verification proves ownership.",
  items: [
    { id: "gsc", label: "Google Search Console + Bing Webmaster",
      why: "See real queries, index status, and submit the sitemap.",
      how: "Verify both, submit sitemap.xml, watch coverage + Core Web Vitals reports." },
    { id: "ga", label: "Analytics + conversion tracking",
      why: "Prove the site drives calls/bookings — the ROI we sell on renewal.",
      how: "GA4 (or privacy-light alt); track call clicks, form submits, bookings as events." },
  ],
};

/** The full ordered standard. */
export const SEO_AI_STANDARD: ChecklistSection[] = [
  technical,
  performance,
  structured,
  aiVisibility,
  local,
  social,
  analytics,
];

/** AI crawler/user-agents to explicitly allow in robots.txt. */
export const AI_CRAWLERS = [
  "GPTBot", // OpenAI / ChatGPT
  "OAI-SearchBot", // ChatGPT search
  "ClaudeBot", // Anthropic / Claude
  "anthropic-ai",
  "PerplexityBot", // Perplexity
  "Google-Extended", // Gemini / AI Overviews training
  "Applebot-Extended", // Apple Intelligence
  "Bingbot", // Copilot
] as const;

/** Flatten to a single list (used by the skill + checklist progress UI). */
export function flattenStandard(): { section: string; item: ChecklistItem }[] {
  return SEO_AI_STANDARD.flatMap((s) => s.items.map((item) => ({ section: s.title, item })));
}

/** Count: total items and AI-specific items — for the Deal Room summary line. */
export function standardCounts(): { total: number; ai: number } {
  const all = SEO_AI_STANDARD.flatMap((s) => s.items);
  return { total: all.length, ai: all.filter((i) => i.ai).length };
}

/* ── Actionable generators (used by the build agent on a real client) ─────── */

export interface BusinessFacts {
  name: string;
  description: string; // one canonical line, reused everywhere
  url: string;
  phone?: string;
  email?: string;
  address?: { street?: string; city?: string; state?: string; zip?: string; country?: string };
  geo?: { lat: number; lng: number };
  hours?: string[]; // e.g. ["Mo-Fr 09:00-17:00", "Sa 10:00-14:00"]
  services?: { name: string; description?: string; price?: string }[];
  socials?: string[]; // absolute URLs
  type?: string; // Schema.org @type, default "LocalBusiness"
}

/** LocalBusiness JSON-LD — drop into a <script type="application/ld+json">. */
export function buildLocalBusinessJsonLd(b: BusinessFacts): Record<string, unknown> {
  const a = b.address;
  return {
    "@context": "https://schema.org",
    "@type": b.type || "LocalBusiness",
    name: b.name,
    description: b.description,
    url: b.url,
    ...(b.phone ? { telephone: b.phone } : {}),
    ...(b.email ? { email: b.email } : {}),
    ...(a
      ? {
          address: {
            "@type": "PostalAddress",
            ...(a.street ? { streetAddress: a.street } : {}),
            ...(a.city ? { addressLocality: a.city } : {}),
            ...(a.state ? { addressRegion: a.state } : {}),
            ...(a.zip ? { postalCode: a.zip } : {}),
            addressCountry: a.country || "US",
          },
        }
      : {}),
    ...(b.geo ? { geo: { "@type": "GeoCoordinates", latitude: b.geo.lat, longitude: b.geo.lng } } : {}),
    ...(b.hours?.length ? { openingHours: b.hours } : {}),
    ...(b.socials?.length ? { sameAs: b.socials } : {}),
    ...(b.services?.length
      ? {
          makesOffer: b.services.map((s) => ({
            "@type": "Offer",
            itemOffered: { "@type": "Service", name: s.name, ...(s.description ? { description: s.description } : {}) },
            ...(s.price ? { price: s.price } : {}),
          })),
        }
      : {}),
  };
}

/** /llms.txt content — the markdown map written for language models. */
export function buildLlmsTxt(b: BusinessFacts): string {
  const lines: string[] = [];
  lines.push(`# ${b.name}`, "");
  lines.push(`> ${b.description}`, "");
  if (b.address?.city) lines.push(`**Location:** ${[b.address.city, b.address.state].filter(Boolean).join(", ")}`);
  if (b.phone) lines.push(`**Phone:** ${b.phone}`);
  if (b.email) lines.push(`**Email:** ${b.email}`);
  if (b.hours?.length) lines.push(`**Hours:** ${b.hours.join("; ")}`);
  lines.push("");
  if (b.services?.length) {
    lines.push("## Services");
    for (const s of b.services) {
      lines.push(`- **${s.name}**${s.description ? ` — ${s.description}` : ""}${s.price ? ` (${s.price})` : ""}`);
    }
    lines.push("");
  }
  lines.push("## Key pages", `- [Home](${b.url})`);
  if (b.socials?.length) {
    lines.push("", "## Elsewhere");
    for (const s of b.socials) lines.push(`- ${s}`);
  }
  return lines.join("\n") + "\n";
}

/** robots.txt body that allows search + AI crawlers and links the sitemap. */
export function buildRobotsTxt(siteUrl: string): string {
  const ua = ["User-agent: *", "Allow: /", ""];
  for (const bot of AI_CRAWLERS) ua.push(`User-agent: ${bot}`, "Allow: /", "");
  ua.push(`Sitemap: ${siteUrl.replace(/\/$/, "")}/sitemap.xml`, `# llms.txt: ${siteUrl.replace(/\/$/, "")}/llms.txt`);
  return ua.join("\n") + "\n";
}
