# Feature Design: Portfolio Risk Dashboard

**Date:** 2026-04-03
**Agent:** SIMONS (Data & Analytics)
**Status:** Built — Prototype Complete

## Problem

The SIMONS quant trading pipeline generates rich data (regime states, composite scores, correlation matrices, Monte Carlo projections, signal decay metrics, A/B test results) but lacks a visual interface. Ramon and the team have no way to see portfolio risk at a glance without reading raw JSON files.

## Solution

Single-file HTML dashboard that renders all key risk dimensions using Canvas charts and CSS grid. Seeded with real pipeline data from the most recent cron run (Apr 2, 2026).

## Key Design Decisions

1. **Honest signal reporting** — 7 of 9 signal components show as DEAD. Not hiding bad data. Only Valuation and Mean Reversion are carrying the ensemble.
2. **Real data, not mock data** — Every number comes from actual pipeline JSON outputs.
3. **Half-Kelly philosophy reflected** — Position sizing, breaker levels, and size multipliers visible in the UI.
4. **A/B transparency** — Shows both outperformance AND the "need 30+ days" caveat. No premature conclusions.

## Components

| Section | Data Source | Visualization |
|---------|-----------|---------------|
| Equity Curve | dashboard_api.json | Canvas line + area chart |
| Positions | paper_portfolio.json | Sorted table with score badges |
| Correlation | correlation_report.json | Color-coded grid heatmap |
| Signal Health | signal_decay_report.json | Horizontal bar chart |
| Monte Carlo | monte_carlo_results.json | Canvas cone chart + stats grid |
| Circuit Breaker | breaker_state.json | Status indicator + level bar |
| A/B Test | ab_report.json | Dual line chart + comparison cards |

## Integration Path

Next step: Replace static data with `fetch('./data/dashboard_api.json')` calls pointing to the cron output directory. Add a 60-second polling interval during market hours (9:30 AM–4:00 PM ET).
