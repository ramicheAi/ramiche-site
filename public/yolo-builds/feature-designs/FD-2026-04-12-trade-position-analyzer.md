# FD: Trade Position Analyzer

**Status:** Complete
**Owner:** SIMONS
**Created:** 2026-04-12 01:30
**Lane:** Data & Analytics

## Objective
Interactive calculator for trade position sizing, P&L modeling, and risk/reward analysis. Computes breakeven after all friction (slippage, commissions, margin costs, taxes), visualizes P&L curves, R/R targets, and Kelly-optimal position sizing.

## Acceptance Criteria
- [x] Long/short direction with stock, crypto, option asset types
- [x] P&L curve chart across ±30% price range with stop loss marker and breakeven dot
- [x] Risk/reward bar chart showing dollar profit at 7 R/R ratios (0.5:1 to 5:1)
- [x] Kelly criterion growth curve with full-Kelly, half-Kelly, and current position markers
- [x] Targets table with 7 levels: stop, breakeven, 1R through 5R — showing price, move %, gross/net P&L, R-multiple
- [x] Signal analysis engine: account risk %, Kelly-optimal sizing, margin cost, EV per trade, total friction
- [x] Slippage modeled as bps, margin cost calculated daily, tax applied only on gains
- [x] Breakeven found via binary search (accounts for all friction)
- [x] Dark theme, monospace, responsive layout matching RAMICHE OS design system
- [x] Financial disclaimer included

## A/B Context
Previous data/analytics builds: channel-mix-modeler, cash-runway-forecaster, price-elasticity-simulator, margin-heatmap-dashboard.
Variable changed: No trade-level position analyzer existed — this fills the gap between portfolio-level tools and individual trade execution.
Expected improvement: Ramon can model exact risk/reward before entering any position, enforcing Kelly discipline and preventing oversizing.

## What Worked / What Didn't
Binary search for breakeven is elegant and handles all friction sources correctly without closed-form solutions. Kelly growth curve gives visceral understanding of why half-Kelly matters — the curve drops off hard past optimal. The P&L gradient fill (green above zero, red below) provides instant directional reading. Canvas charts are fast but not interactive — future improvement could add hover tooltips. The R/R bar chart is straightforward but effective for comparing dollar outcomes across target levels.
