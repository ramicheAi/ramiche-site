---
name: ai-visibility-audit
description: Run an AI-visibility (GEO/AEO) audit and fix for a brand — find buying-intent questions, check if the brand shows up in ChatGPT/Claude/Perplexity, rewrite pages to be quotable, build third-party consensus, ship the technical layer (llms.txt/JSON-LD/robots), and set up a weekly citation tracking loop. Use when asked to "run an AI visibility audit", "are we showing up in ChatGPT", "get found by AI / Perplexity / Gemini", "GEO / AEO audit", or as the monthly engine for the Command Center `ai_visibility` service.
metadata:
  author: parallax
  version: "1.0.0"
  argument-hint: <brand + category, competitors, and key pages — or a Command Center leadId>
---

# AI Visibility Audit & Engine (GEO/AEO)

The recurring system that gets a brand **named and recommended by AI assistants** when customers ask what to buy. Pairs with `web-client-delivery` (which ships the technical foundation once) — this skill is the ongoing engine and the substance of the Command Center **`ai_visibility`** monthly service.

Canonical content: `src/lib/ai-visibility-playbook.ts` (`AV_WORKFLOWS`, `PARALLAX_AV_EDGE`, `fillTemplate`). Technical generators: `src/lib/seo-ai-visibility.ts`.

## Inputs
- Brand + category, 2–4 competitors, key pages, platform (Shopify/WordPress/custom/Next.js).
- Or a Command Center `leadId` — pull brand, competitors, and pages from the lead's intel; pre-fill the templates with `fillTemplate`.
- Always state assumptions; never fabricate facts, reviews, or ratings.

## Phase 1 — Audit (AV_WORKFLOWS.audit)
Run the audit prompt for the brand. Produce 25 buying-intent questions ('best X for Y', '{competitor} alternatives', '{brand} vs {competitor}'), answer each as an assistant would **today**, mark whether the brand plausibly shows up + why, and rank by value-to-win. **Verify, don't guess:** where possible use WebSearch / the Perplexity-style flow / chrome-devtools to actually check live answers rather than asserting from memory. Output the ranked list — these are the targets.

## Phase 2 — Make pages quotable (AV_WORKFLOWS.page_rewrite)
For each top-ranked target page: H1 = the exact customer question; first paragraph = a direct 40–80 word answer; a buyer-criteria comparison table (brand vs competitor); a 5-question FAQ; every answer factual and self-contained so it survives being quoted alone. On Parallax Next.js builds, also emit FAQPage JSON-LD.

## Phase 3 — Third-party consensus (AV_WORKFLOWS.consensus)
The biggest lever: assistants trust what OTHERS say. Identify the source TYPES AI cites in this category (subreddits, review sites, roundups, YouTube, podcasts), the exact searches to find the live threads/roundups, a genuine non-spammy way to earn each mention (contribute value, not self-posts), and a weekly routine. Honesty gate: earn mentions by being genuinely useful — no astroturfing, no fake reviews; it backfires and it's against doctrine.

## Phase 4 — Technical layer (AV_WORKFLOWS.technical)
Ship `/llms.txt`, product + FAQ JSON-LD, and robots.txt allowing `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`. For Next.js, generate with `buildLlmsTxt` / `buildLocalBusinessJsonLd` / `buildRobotsTxt`. For Shopify/WordPress/etc., give plain-English placement steps. Confirm no CDN/WAF blocks the AI crawlers.

## Phase 5 — The Parallax Edge (PARALLAX_AV_EDGE) — go past table stakes
Everyone now does phases 1–4. Apply the edge tactics so the advantage compounds:
1. **Citation share-of-voice loop** — re-run the question bank weekly against the live models, log mention-rate + cited sources, chart over time, attack what's losing. Ship as the monthly AI-Visibility Report (the renewal proof).
2. **Become the dataset** — publish the definitive, neutral, dated category roundup (competitors included, real damaging admissions); models cite it and you're in it.
3. **Optimize the retrieval unit** — a library of tiny, self-contained Q→A artifacts for the sub-questions models decompose into.
4. **Structured freshness feed** — a dated, machine-readable facts/changelog so the brand is always the most specific + most recent answer.
5. **Seed the high-weight substrate** — identical entity facts across Wikidata/Wikipedia, key subreddits, G2/Capterra so the model sees consensus, not assertion.

## Definition of done
- [ ] Ranked 25-question audit with current show-up verdicts.
- [ ] Top target pages rewritten to be extractable (H1-question, direct answer, comparison, FAQ).
- [ ] Consensus plan with real searches + a weekly routine.
- [ ] llms.txt + JSON-LD + AI-crawler robots shipped/handed off; crawlers confirmed unblocked.
- [ ] Weekly share-of-voice tracking set up; baseline recorded for the first monthly report.

## Candor (run THINKING_LENSES)
Models change fast, outputs are non-deterministic, and you can't edit training data — so the moat is the **repeating measurement loop + genuine authority**, not any single trick. Report honestly what the brand can and can't realistically win this quarter.

## Related
- `src/lib/ai-visibility-playbook.ts` · `src/lib/seo-ai-visibility.ts` · `src/lib/delivery-playbook.ts` (`ai_visibility` play) · `src/lib/services-catalog.ts` (`ai_visibility` SKU)
- Skills: `web-client-delivery`, `web-design-guidelines` · MCP: `chrome-devtools` · BUSINESS_BIBLE.md (Proof>Promise, specificity, Eminem strategy)
