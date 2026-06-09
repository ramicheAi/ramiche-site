// /Users/admin/ramiche-site/src/lib/ai-visibility-playbook.ts
// ──────────────────────────────────────────────────────────────────────────────
// THE AI-VISIBILITY ENGINE (GEO/AEO) — the ongoing, sellable work
// ──────────────────────────────────────────────────────────────────────────────
// The technical layer (schema, llms.txt, robots) lives in seo-ai-visibility.ts and
// ships with the build. THIS file is the recurring engine that wins citations over
// time — the four workflows + the Parallax edge — and is the substance of the
// `ai_visibility` monthly service and the `ai-visibility-audit` skill.
//
// The prompts are faithful, fillable templates. {{brand}}, {{competitors}},
// {{page}}, {{facts}}, {{platform}}, {{pages}}, {{questions}} are substituted with
// the real client info (via fillTemplate) — in the Command Center we pre-fill from
// the lead's intel so it's one click to run for a specific client.

export interface AvWorkflow {
  id: string;
  title: string;
  goal: string;
  /** What running it produces. */
  outputs: string[];
  /** Faithful, fillable prompt — paste into ChatGPT/Claude/Perplexity or run via the skill. */
  promptTemplate: string;
}

/* 1 ── Audit: where do we stand vs. the buying-intent questions ────────────── */
const audit: AvWorkflow = {
  id: "audit",
  title: "AI Visibility Audit",
  goal: "Find the buying-intent questions that matter and whether the brand shows up today.",
  outputs: ["25 buying-intent questions", "Per-question: would the brand show up + why/why not", "Questions ranked by value to win first"],
  promptTemplate: `I want to run an AI visibility audit for my brand.

My brand: {{brand}}
My main competitors: {{competitors}}

Step 1: Generate 25 real 'buying-intent' questions a customer would type into ChatGPT, Claude, or Perplexity right before purchasing in my category. Include 'best [product] for [use case]', '[competitor] alternatives', and '[my brand] vs [competitor]' style questions.

Step 2: For each question, answer it the way an AI assistant would TODAY, and tell me whether my brand would plausibly show up, and why or why not.

Step 3: Rank the questions by how valuable it would be for me to show up in them, so I know which to win first.`,
};

/* 2 ── Page rewrite: make a page quotable by assistants ────────────────────── */
const pageRewrite: AvWorkflow = {
  id: "page_rewrite",
  title: "Rewrite Page for AI Extraction",
  goal: "Turn a key page into content an assistant can extract and quote verbatim.",
  outputs: ["Question-as-H1", "40–80 word direct first-paragraph answer", "Buyer-criteria comparison table", "5-question FAQ block", "Self-contained, quotable answers"],
  promptTemplate: `Rewrite my page so AI assistants can easily extract and quote it.

My page topic: {{page}}
Key facts about my product: {{facts}}
Main competitor to compare against: {{competitor}}

Do this:
1. Give me an H1 that is the EXACT question a customer would ask.
2. Write a direct 40-80 word answer as the very first paragraph.
3. Build a comparison table (my product vs the competitor) across the criteria a buyer actually cares about.
4. Add a short FAQ block (5 questions as headers + 1-3 sentence answers).
5. Keep every answer factual and self-contained, so it makes sense even quoted on its own.`,
};

/* 3 ── Consensus: get third parties to recommend the brand ─────────────────── */
const consensus: AvWorkflow = {
  id: "consensus",
  title: "Build Third-Party Consensus",
  goal: "Get the sources AI trusts to mention the brand — the real lever (AI believes others over you).",
  outputs: ["Source types AI cites in the category", "Exact searches to find the threads/roundups", "Non-spammy way to earn each mention", "A weekly routine"],
  promptTemplate: `Help me build third-party consensus so AI assistants recommend my brand.

My brand + category: {{brand}}
My main buying-intent questions: {{questions}}

Give me:
1. The specific TYPES of third-party sources AI is most likely to cite for my category (subreddits, review sites, roundup articles, YouTube channels, podcasts).
2. For each, the actual search I'd run to find the exact threads/posts/roundups where I should be present or mentioned.
3. A genuine, non-spammy way to earn a mention in each (what I'd contribute or offer, not just 'post about myself').
4. A simple weekly routine to keep building this over time.`,
};

/* 4 ── Technical: the on-site machine layer ────────────────────────────────── */
const technical: AvWorkflow = {
  id: "technical",
  title: "Technical AI-Visibility Layer",
  goal: "Ship llms.txt, JSON-LD, and crawler permissions — with platform-specific install steps.",
  outputs: ["Draft llms.txt", "Filled-in JSON-LD for product + FAQ pages", "robots.txt lines allowing GPTBot/ClaudeBot/PerplexityBot", "Where each goes on the platform"],
  promptTemplate: `Help me set up the technical layer for AI visibility on my site.

My brand + key pages: {{pages}}
My platform: {{platform}}

Give me:
1. A draft llms.txt file for my site, a short brand description plus a prioritized list of my key pages with one-line descriptions of each.
2. The schema markup (JSON-LD) I should add to my product and FAQ pages, with a filled-in example using my real info.
3. The exact robots.txt lines to confirm GPTBot, ClaudeBot, and PerplexityBot are allowed to crawl me.
4. Plain-English instructions for where each of these goes on {{platform}}.

(For Parallax-built Next.js sites, generate these with buildLlmsTxt / buildLocalBusinessJsonLd / buildRobotsTxt from src/lib/seo-ai-visibility.ts instead of by hand.)`,
};

export const AV_WORKFLOWS: AvWorkflow[] = [audit, pageRewrite, consensus, technical];

/* ── THE PARALLAX EDGE ──────────────────────────────────────────────────────
   Everyone is now doing llms.txt + schema + FAQ + "get cited on Reddit." That's
   table stakes within a year. The durable advantage is a MEASUREMENT LOOP plus
   manufactured, genuine consensus — things that compound and that competitors
   doing one-time "AI SEO" don't have. Be candid: models change fast, outputs are
   non-deterministic, and you can't directly edit training data — so the moat is
   the repeating loop and real authority, never a trick. */
export interface EdgeTactic {
  id: string;
  name: string;
  insight: string; // the non-obvious idea
  how: string; // how Parallax operationalizes it
}

export const PARALLAX_AV_EDGE: EdgeTactic[] = [
  {
    id: "sov_loop",
    name: "Citation share-of-voice loop (the measurement moat)",
    insight: "Almost all 'AI SEO' is fire-and-forget. Nobody re-asks the live models weekly and tracks whether they're named — so nobody knows what's actually working.",
    how: "Every week, run the client's buying-intent question bank against ChatGPT/Claude/Perplexity, log brand-mention rate + which sources got cited, chart it over time, and attack the losing questions. Ship it as the monthly AI-Visibility Report — proof of ROI that renews the contract.",
  },
  {
    id: "be_the_dataset",
    name: "Become the dataset, not a datapoint",
    insight: "Assistants love NEUTRAL comparison roundups and cite them heavily. Most brands only publish self-promotion, which models discount.",
    how: "Publish the definitive, honestly-neutral, dated comparison/roundup for the category — competitors included, with real damaging admissions (Eminem strategy). The model cites the roundup; you authored it and you're in it. You become the source the category is judged by.",
  },
  {
    id: "query_decomposition",
    name: "Optimize the retrieval unit, not the page",
    insight: "Models decompose a buying question into sub-questions and retrieve atomic answers. Competitors optimize whole pages; the model wants the atom.",
    how: "Reverse-engineer the sub-questions behind each high-value query and publish a library of tiny, perfectly-extractable answer artifacts (one self-contained Q→A each) — an /answers hub the model can lift cleanly.",
  },
  {
    id: "freshness_feed",
    name: "Structured freshness + proof feed",
    insight: "Models reward the most SPECIFIC and most RECENT source. A static llms.txt goes stale.",
    how: "Maintain a dated, machine-readable facts/changelog endpoint (current prices, counts, results, 'updated' dates) so the brand is always the freshest, most specific answer — specificity over lingo, applied to GEO.",
  },
  {
    id: "high_weight_substrate",
    name: "Seed the high-weight substrate (entity consensus)",
    insight: "Models weight a few sources far above the rest (Wikidata/Wikipedia, well-moderated subreddits, G2/Capterra). Cross-source agreement makes a model 'believe' a fact.",
    how: "Establish the brand as a clean ENTITY with identical facts (NAP, one canonical description, founding facts) across exactly those high-weight sources so consensus — not assertion — is what the model sees.",
  },
];

/** Substitute {{vars}} into a template; unknown vars are left as a visible TODO. */
export function fillTemplate(template: string, vars: Record<string, string | undefined | null>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = vars[k];
    return v && v.trim() ? v : `[${k}]`;
  });
}
