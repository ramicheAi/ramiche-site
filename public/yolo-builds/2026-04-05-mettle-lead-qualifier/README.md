# METTLE Lead Qualification Scorecard — MERCURY

Interactive lead scoring and qualification engine for METTLE swim coaching SaaS prospects. Input prospect profile data → get a weighted qualification score, deal priority tier, recommended sales approach, personalized first-touch email script, and estimated deal value.

## What It Does

- **9-Factor Weighted Scoring** — Team size (15%), budget signal (15%), decision-maker access (18%), pain urgency (15%), current tech gap (10%), buy window (10%), champion strength (8%), competitive pressure (5%), tech readiness (4%). Total = 0-100 composite score.
- **4-Tier Classification** — HOT (80+, priority pursuit), WARM (60-79, active nurture), COOL (40-59, long-term drip), COLD (0-39, not qualified). Each tier triggers different sales playbooks.
- **Deal Estimation** — Automatic ACV calculation based on team size → tier mapping ($149/$349/$549), close probability ranges, and estimated sales cycle duration.
- **Personalized Approach Recommendations** — Dynamic sales strategy based on score, current tech stack, pain level, and team size. Includes enterprise play triggers, competitive positioning angles, and pain amplification tactics.
- **First-Touch Email Generator** — Full personalized outreach email customized with team name, coach name, tech context, pain-appropriate hooks, tier-matched offer, and score-calibrated CTA. Copy to clipboard in one click.
- **Lead History** — Persistent localStorage tracking of all scored leads with KPI dashboard (total leads, hot count, avg score, estimated pipeline value). Delete individual entries.
- **KPI Strip** — At-a-glance pipeline metrics: total leads scored, hot lead count, average qualification score, estimated pipeline ACV.

## Scoring Methodology

Each of 9 factors is normalized to 0-10, then weighted:

| Factor | Weight | Why |
|--------|--------|-----|
| Decision-Maker Access | 18% | No DM = no deal, regardless of everything else |
| Team Size | 15% | Directly determines ACV and tier |
| Budget Signal | 15% | Willingness + ability to pay |
| Pain Urgency | 15% | Motivated buyers close faster |
| Current Tech Gap | 10% | Paper-based teams convert 3x better than existing SaaS users |
| Buy Window | 10% | Timing kills more deals than price |
| Champion Strength | 8% | Internal advocate accelerates decisions |
| Competitive Pressure | 5% | External pressure creates urgency |
| Tech Readiness | 4% | Low friction adoption |

DMA is weighted highest because it's the #1 binary gate — without decision-maker access, nothing else matters.

## Sales Approach Logic

- **Score 80+**: Direct pitch → live demo offer → founding member pilot (60-day trial)
- **Score 60-79**: Value-first → personalized team analysis → mock athlete profiles
- **Score 40-59**: Education-first → "State of Swim Tech" content → 8-touch drip
- **Score <40**: Park → quarterly newsletter → revisit in 90 days
- **Pain ≥8**: Pain amplifier overlay — "What happens if nothing changes?"
- **Size ≥150 + budget not low**: Enterprise play — board presentation package

## Competitive Positioning

When prospect uses TeamUnify or competitor SaaS, the script automatically pivots: "TeamUnify runs your office. METTLE transforms your athletes. They're complementary, not competitive."

## How to Run

Open `index.html` in any browser. No build step, no dependencies. Single HTML file with localStorage persistence.

## What's Missing / Next Steps

- CRM integration (HubSpot/Pipedrive webhook on score)
- Lead enrichment from USA Swimming club registry API
- Auto-import from ECHO's community warm lead signals
- Score recalculation triggers on engagement events (email opens, demo attendance)
- Team comparison view (score multiple leads side-by-side)
- Geographic density mapping for territory planning
- Connect to mettle-outbound-sequence-builder for auto-sequence triggering on HOT leads

## Built By

MERCURY (Sales Lane) — April 5, 2026
