# FD-2026-04-04 — METTLE Proposal Generator

**Author:** MERCURY (Sales & Revenue Lane)
**Date:** 2026-04-04
**Status:** Built

## Problem

Every METTLE sales conversation requires a custom proposal — team size, pain points, competitive positioning, ROI projections. Currently this is manual: copy-paste a doc, tweak numbers, hope the math is right. Slow, error-prone, and doesn't scale. Mercury needs a tool that generates polished, branded proposals in seconds.

## Solution

Interactive single-file HTML proposal generator. Input prospect details (team name, athlete count, groups, current platform, pain points) → auto-recommends tier → shows ROI projections → generates a print-ready branded proposal with competitive positioning, feature breakdown, and CTA.

## Key Design Decisions

1. **Auto tier recommendation** — Based on athlete count. Starter ≤50, Professional ≤150, Program ≤500, Enterprise 500+. Manual override available.
2. **ROI model** — Uses industry churn baseline (20% annual) × METTLE retention lift (10-20% by tier) × average monthly dues ($140) to calculate revenue protected and ROI multiple.
3. **Competitive positioning** — Dynamic comparison grid that adjusts based on prospect's current platform (TeamUnify, Swimmingly, spreadsheets, other). METTLE wins on gamification, Race AI, engagement; ties on meet management and roster.
4. **Platform-aware messaging** — Proposal body automatically adjusts framing: TeamUnify = "complementary, not competitive"; Swimmingly = "superset"; spreadsheets = "leapfrog the competition."
5. **Print-ready output** — CSS print styles hide the builder, show only the proposal. Clean white background with METTLE branding for PDF export.
6. **KPI strip** — Monthly cost, per-athlete cost, retention lift, and ROI multiple visible before generating the full proposal.
7. **Feature tiers** — Each tier shows its complete feature list. Higher tiers inherit lower tier features with "Everything in X, plus:" prefix.
8. **Dark theme builder** — Matches RAMICHE design language for internal use. Proposal output is white/clean for client-facing.

## Components

| Section | Purpose | Output |
|---------|---------|--------|
| Prospect Form | Input team details | Drives all calculations |
| Tier Selector | Auto-recommend + override | Pricing + features |
| ROI Panel | Retention-based projections | KPIs + detailed table |
| Competitive Grid | Platform comparison | Win/tie/lose indicators |
| Proposal Generator | Full branded document | Print-ready HTML |

## Revenue Impact

- Reduces proposal creation from ~30 min manual → ~2 min with generator
- Ensures pricing accuracy (pulls from tier definitions, not memory)
- Professional output increases close rate on cold outreach
- ROI framing anchors value conversation before price discussion

## Integration Path

- Connect to CRM for prospect auto-fill
- Email integration to send proposal directly
- Track proposal views (add analytics pixel)
- A/B test different ROI messaging
- Add digital signature / acceptance flow
