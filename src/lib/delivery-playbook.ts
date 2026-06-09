// /Users/admin/ramiche-site/src/lib/delivery-playbook.ts
// The PROVEN, REPEATABLE delivery system — what we actually do once a client says
// yes, per service. This is the "reliable system" half: every sold service maps
// to a defined process, timeline, and which agents execute it. Shown in the Deal
// Room so the path from "closed" to "delivered" is never improvised.

export interface DeliveryPlay {
  serviceId: string;
  system: string;        // the name of our repeatable system
  outcome: string;       // what the client gets
  steps: string[];       // the process, in order
  timeline: string;      // realistic delivery window
  agents: string[];      // which Parallax agents execute it
}

export const DELIVERY: Record<string, DeliveryPlay> = {
  web_build: {
    serviceId: "web_build",
    system: "7-Day Site Sprint",
    outcome: "A fast, mobile-first website that converts searches into calls/bookings — live on a staging URL they approve before go-live.",
    steps: [
      "Day 1 — Intake: scrape their current presence, logo/photos, hours, services; lock the one goal (calls? bookings? orders?).",
      "Day 2 — Wireframe + copy: hero (Proof+Promise+Plan), services, reviews, contact. Written at 5th-grade level.",
      "Day 3-4 — Build: responsive, fast (Core Web Vitals: LCP<2.5s/CLS<0.1), click-to-call, contact form → their email/SMS. Designed with the frontend-design + shadcn/Magic stack (not vibe-coded).",
      "Day 5 — SEO + AI Visibility pass: full Parallax SEO/AI standard — titles/meta, LocalBusiness + FAQ JSON-LD, sitemap, robots.txt allowing AI crawlers, /llms.txt, extractable answer-shaped copy. (see seo-ai-visibility.ts)",
      "Day 6 — Staging review: send live URL, collect 1 round of edits.",
      "Day 7 — Edits + go-live: domain, SSL, GA4, Search Console + Bing verification, sitemap submitted. Then handoff (walkthrough video) into Hosting + Maintenance.",
    ],
    timeline: "7 days to live",
    agents: ["Builder (Claude Code)", "Vee (design)", "Ink (copy)"],
  },
  branding: {
    serviceId: "branding",
    system: "Identity Kit",
    outcome: "Logo, color palette, type, and brand usage — so they look established and trustworthy everywhere.",
    steps: [
      "Discovery: vibe, competitors, who they serve.",
      "3 logo directions → pick → refine.",
      "Palette + type system + usage guide.",
      "Deliver source files (SVG/PNG) + social avatars + favicon.",
    ],
    timeline: "3-5 days",
    agents: ["Vee (brand)", "Aetherion (creative direction)"],
  },
  online_ordering: {
    serviceId: "online_ordering",
    system: "Direct Revenue Channel",
    outcome: "Customers order or book directly on their site — a channel they didn't have, with no third-party commission.",
    steps: [
      "Pick the engine (Stripe checkout / booking calendar / menu+cart).",
      "Wire products/services + hours + payment.",
      "Confirmation email/SMS + their notification.",
      "Test full order flow end to end before launch.",
    ],
    timeline: "3-5 days (with the site)",
    agents: ["Builder (Claude Code)", "Mercury (offer/pricing)"],
  },
  ai_chatbot: {
    serviceId: "ai_chatbot",
    system: "24/7 AI Receptionist",
    outcome: "An on-site assistant that answers FAQs, captures contact info, and books — so no after-hours lead is lost.",
    steps: [
      "Train on their services, hours, pricing, FAQs.",
      "Lead-capture flow → their email/CRM.",
      "Embed widget + test common questions.",
    ],
    timeline: "2-4 days",
    agents: ["Builder (Claude Code)", "Haven (support flows)"],
  },
  hosting_maint: {
    serviceId: "hosting_maint",
    system: "Always-On Care Plan",
    outcome: "Hosting, SSL, backups, updates, uptime monitoring, and monthly small edits — they never worry about the site.",
    steps: [
      "Move to managed hosting + SSL + daily backups.",
      "Uptime + security monitoring.",
      "Monthly: updates, small content edits, a health report.",
    ],
    timeline: "Ongoing (monthly)",
    agents: ["Triage (monitoring)", "Builder (edits)"],
  },
  local_seo: {
    serviceId: "local_seo",
    system: "Local Domination System",
    outcome: "They show up on Google Maps + local search for their services — claimed, optimized, and climbing.",
    steps: [
      "Claim + verify Google Business Profile; fill every field, categories, services, hours, photos.",
      "Local citations — identical name/address/phone (NAP) across directories (Apple/Bing/Yelp + niche).",
      "On-page local SEO: service + city landing pages, each with LocalBusiness JSON-LD.",
      "Monthly posts + ranking report; iterate on what moves.",
    ],
    timeline: "Setup in 2 weeks, ranking compounds monthly",
    agents: ["Mercury (SEO ops)", "Builder (pages/schema)", "Echo (content)"],
  },
  ai_visibility: {
    serviceId: "ai_visibility",
    system: "Answer Engine System (GEO/AEO)",
    outcome: "When someone asks ChatGPT, Perplexity, Gemini or Google AI for a business like theirs, they get named and recommended — the new front door to search, before anyone clicks a link.",
    steps: [
      "Allow AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended) in robots.txt + confirm no WAF block.",
      "Publish /llms.txt — a clean machine-readable map of who they are, services, hours, area, contact.",
      "Structured data: LocalBusiness + Service + FAQPage JSON-LD so assistants can read and quote the facts.",
      "Rewrite key pages as answer-shaped, extractable content (direct one-line answers, FAQs, definitions).",
      "Lock entity consistency: identical NAP + one canonical description across site, GBP, directories, socials.",
      "Earn third-party citations + monthly AI-mention check (ask the assistants, track who cites them).",
      "Run the ai-visibility-audit engine monthly: re-test the buying-intent questions, track share-of-voice, attack what's losing (see ai-visibility-playbook.ts).",
    ],
    timeline: "Setup in 1-2 weeks, citations compound monthly",
    agents: ["Mercury (SEO/GEO ops)", "Builder (schema/llms.txt)", "Echo (content)"],
  },
  reviews: {
    serviceId: "reviews",
    system: "Reputation Engine",
    outcome: "A steady flow of new 5-star reviews + fast response to any negative — trust that compounds into sales.",
    steps: [
      "Set up review-request automation (SMS/email after a visit/purchase).",
      "One-tap review links to Google/Facebook.",
      "Monitor + draft responses to every review.",
      "Monthly reputation report.",
    ],
    timeline: "Live in 1 week, compounds monthly",
    agents: ["Haven (reputation)", "Mercury (automation)"],
  },
  social_content: {
    serviceId: "social_content",
    system: "Always-Visible Engine",
    outcome: "Consistent social + paid ads (Google/Meta) so new customers discover them every week.",
    steps: [
      "Content plan + brand voice; 3-4 posts/week.",
      "Set up + run Google/Meta local ads to the new site.",
      "Track leads/cost; reskin winners, kill losers (70/20/10).",
      "Monthly performance + spend report.",
    ],
    timeline: "Live in 1-2 weeks, ongoing",
    agents: ["Echo (social)", "Mercury (ads)", "Vee (creative)"],
  },
  email_sms: {
    serviceId: "email_sms",
    system: "Customer Reactivation",
    outcome: "Automated email/SMS that brings past customers back — the cheapest revenue they'll get.",
    steps: [
      "Import/collect their customer list (opt-in).",
      "Welcome + win-back + promo automations.",
      "Monthly campaign + revenue report.",
    ],
    timeline: "Live in 1 week, ongoing",
    agents: ["Haven (lifecycle)", "Ink (copy)"],
  },
};

export function deliveryFor(serviceId: string): DeliveryPlay | undefined {
  return DELIVERY[serviceId];
}
