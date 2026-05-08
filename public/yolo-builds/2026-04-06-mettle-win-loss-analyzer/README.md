# METTLE Win/Loss Post-Mortem Analyzer — MERCURY

Interactive deal post-mortem tool for logging won/lost/stalled deals and extracting patterns. Closes the feedback loop on the entire METTLE sales toolkit — learn from outcomes, not just inputs.

## What It Does

- **Deal Logger** — Structured deal capture: team details, outcome (Won/Lost/Stalled), primary reason (14 categories for wins and losses), contributing factors (12 multi-select), competitive context, ACV, cycle time, notes. Log a deal in <30 seconds.
- **KPI Strip** — Total deals, win rate, revenue won, revenue lost, avg win cycle, avg deal size at a glance.
- **Deal History** — Filterable deal list with outcome/tier/reason filters. Sort by recency. Delete individual entries.
- **Dashboard** — 6 bar chart breakdowns: win rate by tier, team size bucket, source channel, decision maker role. Loss reason distribution. Avg sales cycle by outcome.
- **Pattern Analysis** — Loss reason × tier heatmap (where are deals dying by segment). Revenue won vs lost waterfall. Competitive win rate (how we perform against each competitor). Contributing factor frequency.
- **Insights Engine** — Auto-generated intelligence after 3+ deals: biggest pipeline leak with targeted fix recommendation, best-performing channel, best DM entry path, deal size patterns, cycle time signals, win/loss predictors from contributing factors. Actionable recommendations per leak category.
- **Sample Data** — 15 realistic METTLE deals pre-loaded: 8 won, 5 lost, 2 stalled across all tiers, channels, and reasons. One-click load for instant demo.
- **CSV Export** — Full deal data download for CRM import or pipeline analysis.

## Why This Matters

We have tools for every pipeline stage — Lead Qualifier (scoring), Proposal Generator (pitching), Objection Handler (overcoming), Negotiation Playbook (closing). But no tool for learning from outcomes. This closes the loop: log what happened → see patterns → adjust the process → win more.

## Sales Intelligence Embedded

- METTLE tier pricing: $149/$349/$549/Enterprise
- Auto-tier recommendation by team size
- ACV calculation per tier ($1,788/$4,188/$6,588)
- Saint Andrew's Aquatics case study referenced in sample data
- TeamUnify/SwimTopia/GoMotion/Captyn competitive positioning
- Decision-maker role tracking (Head Coach, Board President, Treasurer, AD, Parent Committee)
- 6 source channels including ECHO community leads

## Insight Categories

| Insight | Trigger |
|---------|---------|
| Win Rate Benchmark | Always (vs 35-45% SaaS average) |
| Biggest Pipeline Leak | 1+ lost deals |
| Best Channel | 2+ deals per channel |
| Best DM Path | 2+ deals per DM role |
| Deal Size Pattern | 2+ wins |
| Cycle Time Signal | 2+ wins + 2+ losses with cycle data |
| Win/Loss Predictors | Contributing factors logged |

## Leak-Specific Recommendations

Each loss reason triggers tailored tactical advice:
- **Price** → Lead with ROI, never discount
- **Timing** → 90-day nurture sequences
- **Competitor** → Displacement playbook
- **No Champion** → Early champion identification
- **Budget Freeze** → Pilot with success clause
- **Ghosted** → 5-touch breakup sequence
- **Status Quo** → Cost-of-inaction amplification
- **Feature Gap** → Product feedback loop
- **Wrong Tier** → Better discovery questions

## How to Run

Open `index.html` in any browser. No build step, no dependencies. Single HTML file with localStorage persistence.

## Connects To

- **Lead Qualifier** → scores feed into deal logging
- **Proposal Generator** → proposals become deals tracked here
- **Objection Handler** → objection patterns validated against outcomes
- **Negotiation Playbook** → negotiation strategies tested against win/loss data
- **ECHO Community** → community-sourced leads tracked as channel

## What's Missing / Next Steps

- CRM sync (HubSpot/Pipedrive) for auto-import of closed deals
- Team leaderboard (multiple reps tracking individual win rates)
- Time-series trending (are we getting better or worse?)
- Deal replay — full timeline reconstruction from first touch to close
- Integration with Lead Qualifier scores for qualification accuracy tracking
- Automated weekly email digest with pattern changes
- Cohort analysis by quarter and season

## Built By

MERCURY (Sales & Revenue Lane) — April 6, 2026
