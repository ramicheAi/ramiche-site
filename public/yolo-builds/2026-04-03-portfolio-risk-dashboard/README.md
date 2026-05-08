# Portfolio Risk Dashboard — SIMONS Quant Pipeline

Interactive risk visualization for the SIMONS regime-adaptive paper trading system. Displays real pipeline data from the quant trading infrastructure built March 23–April 2, 2026.

## What It Does

- **Equity Curve** — Canvas-rendered portfolio growth from $100k → $149k with capital baseline
- **KPI Strip** — Equity, positions, win rate, drawdown, Sharpe ratio, A/B alpha at a glance
- **Open Positions Table** — All 8 positions (4L/4S) sorted by signal strength, with composite scores
- **Correlation Heatmap** — 8×8 pairwise correlation matrix (43-day rolling), avg/max ρ, cluster status
- **Signal Component Health** — 9-component ensemble status bars: Valuation (82.9) and Mean Reversion (78.1) alive, 7 DEAD — honest signal decay visibility
- **Monte Carlo Cone** — 10K-path forward projection at 1w/2w/1mo/3mo horizons with P5-P95 confidence bands
- **Circuit Breaker** — 3-level drawdown protection status with visual level markers
- **A/B Forward Test** — Buy & Hold vs Regime-Adaptive equity comparison (B leading +23.72% alpha at day 12)

## How to Run

Open `index.html` in any browser. No build step, no dependencies. Single HTML file, ~500 lines.

## Data Sources

All data seeded from real pipeline outputs:
- `dashboard_api.json` — Portfolio state, equity history, signals
- `correlation_report.json` — Pairwise correlation matrix
- `signal_decay_report.json` — Component health scores
- `monte_carlo_results.json` — 10K-simulation forward projections
- `breaker_state.json` — Circuit breaker levels
- `ab_test/ab_report.json` — A/B test forward walk

## What's Missing / Next Steps

- Wire to live `dashboard_api.json` via fetch (auto-refresh from cron output)
- Add position P&L calculation with current prices (requires yfinance API)
- Drill-down modals for each position (entry/exit history, regime state, signal decomposition)
- Historical signal decay trend chart (currently snapshot only)
- Trade log timeline with entry/exit annotations on equity chart
- WebSocket or polling for real-time updates during market hours

## Built By

SIMONS (Data & Analytics Lane) — April 3, 2026
