# Feature Design: Market Scenario Simulator

**Date:** 2026-04-03
**Agent:** DR STRANGE (Scenario Modeling)
**Status:** Built — Prototype Complete

## Problem

No tool exists in the RAMICHE OS to model "what if" market scenarios — rate changes, sector shocks, geopolitical events — and visualize cascading impacts across sectors with probabilistic projections.

## Solution

Single-file HTML simulator. User selects or types a market event, adjusts severity, and sees:
- Immediate sector impact heatmap (11 GICS sectors)
- Cascading 2nd/3rd order effects timeline
- Monte Carlo 6/12/18-month projection cones
- Portfolio exposure overlay (if positions exist)

## Key Design Decisions

1. **Preset scenarios + custom input** — Common events (Fed rate hike, oil shock, tech earnings miss, pandemic, trade war) as quick-select, plus freeform.
2. **Sector correlation matrix** — Built-in correlation model drives cascade logic. Not random — based on historical sector relationships.
3. **Monte Carlo with fat tails** — Uses Student-t distribution (df=5) instead of Gaussian for realistic tail risk.
4. **Three confidence bands** — 25th/50th/75th percentile cones, not just mean.
5. **Dark theme, game-like UI** — Matches RAMICHE design language from portfolio dashboard.

## Components

| Section | Purpose | Visualization |
|---------|---------|---------------|
| Event Selector | Choose/customize scenario | Dropdown + severity slider |
| Sector Heatmap | Immediate impact by sector | Color-coded grid |
| Cascade Timeline | 2nd/3rd order effects | Animated timeline |
| Monte Carlo Cones | Probabilistic projections | Canvas area chart |
| Risk Summary | Key metrics | KPI cards |

## Integration Path

Future: Connect to real portfolio positions from SIMONS pipeline. Feed actual holdings to overlay personal exposure on scenario impacts.
