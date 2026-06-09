---
name: web-client-delivery
description: End-to-end delivery for a new web design / web development client — design, build, full SEO + AI-visibility (GEO/AEO), verify, and deploy. Use when starting a new website client, when a Command Center lead closes ("ship it / hand off to Claude Code"), or when asked to "build the site for <client>", "launch <client>'s website", or "run the web client workflow".
metadata:
  author: parallax
  version: "1.0.0"
  argument-hint: <client name + brief, or a Command Center leadId>
---

# Web Client Delivery — Parallax Web & Growth Studio

The repeatable system that turns a closed web-design/dev client into a **professionally designed, fast, and AI-discoverable** site that is live. This is the build half of the funnel that starts in the Command Center **Prospector → Leads → Deal Room**. The Deal Room's Delivery tab hands you the exact client brief; this skill executes it.

**Prime rule:** sites must look professionally designed, not vibe-coded. Use the design stack (frontend-design plugin + shadcn + 21st.dev Magic), and clear the **Parallax SEO + AI-Visibility Standard** in `src/lib/seo-ai-visibility.ts` before go-live — every check, with the AI-visibility items treated as first-class (they are the new front door to search).

## Inputs
- A client name + brief, **or** a Command Center `leadId` (pull the brief from the Deal Room handoff card).
- The sold bundle (e.g. Website Build, Local SEO, AI Visibility) — only do what's sold, but always apply the SEO/AI **foundation** to anything we ship.
- Brand assets, hours, services, NAP (name/address/phone), socials. If missing, ask once, then proceed with placeholders flagged `TODO`.

## The 7 phases (map to the "7-Day Site Sprint" delivery play)

### 1. Intake & lock the goal
- Pull the lead's profile/audit from the Deal Room (gaps, intel) if a `leadId` is given.
- Lock the **one** primary conversion goal: calls? bookings? orders? forms? Everything serves it.
- Capture `BusinessFacts` (see `seo-ai-visibility.ts`): name, one canonical description, url, phone, email, address, geo, hours, services, socials.

### 2. Design (professional, not vibe-coded)
- Invoke the **frontend-design** plugin for layout/system direction.
- Build UI from **shadcn** components (`shadcn` MCP) and **21st.dev Magic** (`/21 ...`) for polished, on-brand sections.
- Honor the client's brand. For Parallax's own properties, the house aesthetic is the futuristic game look (see AGENTS.md: `#0e0e18`, `#00f0ff`, `#a855f7`, glassmorphism) — **client sites match the client's brand, not ours.**
- Cross-check the result with the **web-design-guidelines** skill before moving on.

### 3. Build (fast by construction)
- Next.js + Tailwind, mobile-first, semantic HTML, one H1/page.
- Hero = Proof + Promise + Plan, copy at 5th-grade level (see BUSINESS_BIBLE messaging doctrine). Use the **writing-guidelines** skill.
- Wire the conversion goal: click-to-call, contact form → client email/SMS, booking/ordering if sold.
- Keep client JS minimal (protects INP/CLS).

### 4. SEO + AI-Visibility pass — the differentiator
Apply **every** section of `src/lib/seo-ai-visibility.ts` (`SEO_AI_STANDARD`). Use the generators in that file:
- **Metadata:** per-page `<title>` + meta description, canonical (reuse `src/lib/seo.ts` patterns).
- **Structured data:** inject `buildLocalBusinessJsonLd(facts)` as `<script type="application/ld+json">`; add `Service` + `FAQPage` JSON-LD on relevant pages.
- **Crawlability:** `app/sitemap.ts` (all public routes); `robots.txt` via `buildRobotsTxt(siteUrl)` — **must allow `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`** (see `AI_CRAWLERS`).
- **AI front door:** publish `/llms.txt` via `buildLlmsTxt(facts)`.
- **Extractable copy:** lead each section with a one-sentence direct answer; add a real FAQ; keep NAP + the one canonical description identical everywhere.
- **Social/share:** Open Graph + Twitter cards (1200×630), full favicon/touch-icon set + web manifest.

### 5. Verify (don't assume — measure)
- Use the **chrome-devtools** MCP to load the staging site and check rendering + console errors.
- Run the **web-perf** skill / Lighthouse for Core Web Vitals: **LCP < 2.5s, INP < 200ms, CLS < 0.1**. Fix regressions before review.
- Validate JSON-LD (Google Rich Results test shape) and confirm `/llms.txt`, `/sitemap.xml`, `/robots.txt` resolve.
- Confirm AI crawlers are **not** blocked by any CDN/WAF rule.

### 6. Staging review → go-live
- Send the staging URL; collect **one** round of edits.
- Go-live: domain, SSL. Deploy with the **deploy-to-vercel** skill (preview first, then production on approval).
- Verify ownership in **Google Search Console + Bing Webmaster**, submit the sitemap. Set up **GA4** with call/form/booking conversion events.

### 7. Handoff & make it sticky
- Record a short walkthrough video.
- Move them into **Hosting + Maintenance** (MRR) and, if sold, **Local SEO** + **AI Visibility** monthly (run the **`ai-visibility-audit`** skill as the recurring engine).
- Log delivery back to the Command Center pipeline; advance the lead stage.

## Definition of done (acceptance criteria — verify before declaring complete)
- [ ] Live on the client's domain over HTTPS, mobile-first, the conversion goal wired and tested.
- [ ] Core Web Vitals pass (LCP/INP/CLS) — **measured** with chrome-devtools/web-perf, not assumed.
- [ ] Every `SEO_AI_STANDARD` section satisfied: metadata, JSON-LD (LocalBusiness + FAQ), sitemap, robots (AI crawlers allowed), `/llms.txt`, OG/Twitter, favicons.
- [ ] `/llms.txt`, `/sitemap.xml`, `/robots.txt` all resolve; JSON-LD validates.
- [ ] Search Console + Bing verified, sitemap submitted; GA4 + conversion tracking live.
- [ ] Walkthrough recorded; client moved into recurring plan; pipeline updated.

## Related
- Standard: `src/lib/seo-ai-visibility.ts` · Delivery plays: `src/lib/delivery-playbook.ts` · Services/pricing: `src/lib/services-catalog.ts`
- Skills: `frontend-design`, `web-design-guidelines`, `writing-guidelines`, `vercel-optimize`, `deploy-to-vercel`, `web-perf`
- MCP: `shadcn`, `21st.dev Magic`, `chrome-devtools`
- Doctrine: BUSINESS_BIBLE.md (Value Equation, Proof>Promise, messaging) — apply silently.
