# FD: DCA vs Lump Sum Simulator

**Status:** Complete
**Owner:** SIMONS
**Created:** 2026-04-18 01:30
**Lane:** Data & Analytics

## Objective
Interactive Monte Carlo simulator comparing Dollar-Cost Averaging vs Lump Sum investing. Quantifies the probability of each strategy winning across user-defined market regimes, with full equity curve visualization, percentile outcome tables, and risk metrics.

## Acceptance Criteria
- [x] Capital, time horizon, DCA frequency, regime, drift, volatility, MC paths, tx cost inputs
- [x] Monte Carlo engine (500–10K paths) using geometric Brownian motion
- [x] Equity curve chart (median path) showing DCA, Lump Sum, and indexed asset price
- [x] Distribution histogram comparing DCA and Lump Sum outcome spreads
- [x] Win rate analysis — percentage of paths each strategy outperforms
- [x] Average advantage when winning (conditional expected value)
- [x] Percentile table (5th–95th) with DCA value, return, Lump value, return, delta
- [x] DCA schedule table with per-period invest, price, shares, cumulative cost/value
- [x] Max drawdown (75th percentile), DCA Sharpe ratio
- [x] Regime presets (bull/moderate/sideways/bear/volatile) + custom
- [x] Asset presets (S&P 500, BTC) with realistic parameters
- [x] Transaction cost modeling in basis points
- [x] Regime insight badges (auto-generated)
- [x] Dark theme, monospace, RAMICHE OS design system
- [x] Financial disclaimer
- [x] Single-file, no dependencies

## A/B Context
Previous data/analytics builds: trade-position-analyzer, margin-heatmap, price-elasticity-simulator, cash-runway-forecaster, channel-mix-modeler, LTV-cohort-analyzer, dividend-compounder, macro-regime-shift-detector, breakeven-sensitivity-analyzer.
Variable changed: No DCA vs Lump Sum comparison tool existed — this fills the gap for investment strategy comparison at the contribution-method level.
Expected improvement: Ramon can quantify the DCA vs lump-sum tradeoff for specific market views before committing capital, enforcing probabilistic thinking over gut feel.

## What Worked / What Didn't
GBM simulation is fast enough for 10K paths in-browser without Web Workers. Canvas charts render cleanly. The median-path selection (sorting all paths by DCA final value, taking the middle one) gives a representative equity curve without averaging artifacts. The percentile table is the most useful output — it shows the full distribution of outcomes. The regime insight badges add context but could be expanded with more nuanced analysis (e.g., "DCA particularly strong when vol > 30% and drift < 0"). The DCA schedule table truncates cleanly for weekly frequency over long horizons.
