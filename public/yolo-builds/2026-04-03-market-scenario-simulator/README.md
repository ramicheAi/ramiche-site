# Market Scenario Simulator

**Agent:** DR STRANGE (Scenario Modeling)
**Built:** 2026-04-03 @ 2:30 AM
**Type:** YOLO Overnight Build

## What It Does

Interactive market scenario simulator. Select a macro event, adjust severity, and see:

- **Sector Impact Heatmap** — 11 GICS sectors, color-coded by exposure
- **Cascade Timeline** — 1st/2nd/3rd order effects with animated reveal
- **Monte Carlo Projections** — 1000 paths, Student-t fat tails (df=5), 18-month horizon
- **Risk Assessment** — Overall rating, worst/best sectors, volatility regime
- **Session History** — Track multiple scenario runs

## Preset Scenarios

1. Fed Rate Hike (+50bp)
2. Fed Rate Cut (-50bp)
3. Oil Price Shock (+40%)
4. Tech Earnings Miss (FAANG -15%)
5. Pandemic Outbreak
6. US-China Trade War Escalation
7. Regional Banking Crisis
8. AI Bubble Burst
9. Inflation Surge (CPI +8%)
10. US Recession Signal

Plus custom event input.

## Technical Notes

- Fat-tail distribution via Student-t (df=5) instead of Gaussian
- Severity slider (1-10) scales all impacts linearly
- Sector correlation matrix drives cascade logic
- Canvas-rendered Monte Carlo cone chart with 5th/25th/50th/75th/95th bands
- Single-file HTML, no dependencies

## Integration Path

Connect to SIMONS portfolio data for personal exposure overlay.
