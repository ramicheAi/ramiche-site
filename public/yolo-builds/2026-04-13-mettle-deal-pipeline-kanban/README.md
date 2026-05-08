# METTLE Deal Pipeline Kanban

**Built by:** MERCURY
**Date:** 2026-04-13
**Category:** Sales & Revenue

## What It Is

Interactive drag-and-drop deal pipeline board for managing METTLE SaaS sales. Every deal is a card you can drag between stages — from Prospect to Closed Won (or Lost).

## Features

- **7-stage Kanban board:** Prospect → Qualified → Demo Scheduled → Proposal Sent → Negotiation → Closed Won / Closed Lost
- **Weighted revenue forecasting:** Each stage has a win probability (10% → 100%). Pipeline value adjusts in real-time as deals move.
- **Deal health scoring:** Visual health bars per deal. Health increases when deals move forward, decreases when stalling or moving backward.
- **Smart next-action recommendations:** Each deal gets a stage-specific recommendation (e.g., "Don't discount — offer extended onboarding instead" at Negotiation stage).
- **Stale deal warnings:** Deals sitting in a stage for 10+ days get a red warning flag.
- **Pipeline distribution bar:** Visual breakdown of where revenue sits across stages.
- **Deal detail panel:** Click any card for full details — value, weighted value, win probability, activity log, notes, all recommended actions.
- **Add new deals:** Quick-add modal with org, contact, tier selection (Starter $149 / Pro $349 / Platinum $549 / Enterprise), athlete count, and notes.
- **Move forward / Mark lost:** One-click stage advancement or loss recording from the detail panel.
- **LocalStorage persistence:** Deals survive browser refresh.
- **10 sample deals** seeded across all stages with realistic activity logs.

## METTLE Pricing Tiers (baked in)

| Tier | Monthly | Annual |
|------|---------|--------|
| Starter | $149 | $1,788 |
| Pro | $349 | $4,188 |
| Platinum | $549 | $6,588 |
| Enterprise | $999 | $11,988 |

## Sales Intelligence

The next-action engine embeds Mercury's actual sales playbook:
- **Prospect:** Research → personalized outreach → LinkedIn engagement
- **Qualified:** Discovery call → comparison sheet → ID the real decision-maker
- **Demo:** Prep custom environment → confirm all stakeholders → ROI scenarios ready
- **Proposal:** 48-hour follow-up → objection prep → case study → pilot offer
- **Negotiation:** No discounts (add value) → verbal commitment → implementation timeline
- **Closed Won:** HAVEN handoff → thank-you → referral ask → 30-day check-in
- **Closed Lost:** Log reason → gracious exit → 90-day reminder → analyze failure type

## Usage

Open `index.html` in any browser. Drag deals between columns. Click cards for details.
