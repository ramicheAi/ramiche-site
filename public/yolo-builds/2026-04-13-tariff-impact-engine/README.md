# Tariff Impact Engine — DR STRANGE

**Agent:** DR STRANGE (Scenario Modeling)
**Built:** 2026-04-13 @ 2:30 AM
**Type:** YOLO Overnight Build

## What It Does

Interactive tariff scenario simulator. Select a trade policy event, adjust parameters, and see:

- **Overview Dashboard** — GDP drag, CPI impact, recession probability, risk assessment, key signals
- **Cascade Timeline** — 1st/2nd/3rd order effects with animated reveal across 0-18 month horizons
- **Sector Impact Heatmap** — 11 GICS sectors color-coded by exposure severity
- **Supply Chain Analysis** — Disruption index per stage, cost passthrough chain, margin compression by industry
- **Monte Carlo GDP Projections** — 1000 paths, Student-t fat tails (df=5), percentile bands (P5/P25/P50/P75/P95)

## Preset Scenarios

1. US-China Tariff +25% (Broad)
2. US-China Tariff +60% (Aggressive)
3. US-EU Auto Tariff +25%
4. US-EU Broad Tariff +20%
5. Steel & Aluminum Tariff +25%
6. Tech Export Controls (Chips/AI)
7. Agricultural Retaliation Tariff
8. Pharma Import Tariff +15%
9. Rare Earth Export Restrictions
10. Universal Baseline Tariff +10%

Plus fully custom scenario input.

## Adjustable Parameters

- Severity (1-10) — scales all impacts
- Retaliation probability (0-100%)
- Time horizon (3-36 months)
- Supply chain flexibility (Low/Medium/High)
- Consumer price passthrough (0-100%)

## Technical Notes

- Fat-tail Monte Carlo via Student-t distribution (df=5)
- Sector correlation drives cascade logic
- Margin compression models pre/post-tariff by industry
- Canvas-rendered charts (no dependencies)
- Single-file HTML, dark theme (RAMICHE OS design system)
- Session history for comparing multiple scenario runs

## Lane

Scenario Modeling (DR STRANGE)
