# Cohort Revenue Forecaster — SIMONS Data & Analytics

Interactive cohort-based revenue forecaster with Monte Carlo simulation for RAMICHE OS brands. Models customer acquisition, retention decay, and revenue projection over configurable horizons with probabilistic confidence bands.

## What It Does

- **Brand Presets** — 5 preloaded scenarios: GA Collectibles, RAMICHE Music, Parallax Label, Ramiche Studio, Kickstarter Launch. One-click load with realistic defaults for each brand's economics.
- **KPI Strip** — M24 MRR, cumulative revenue, breakeven month, active customers, avg LTV, effective churn at a glance.
- **Revenue Projection (Monte Carlo)** — 1000-path simulation with P10–P90 confidence bands. Deterministic forecast overlaid with breakeven marker.
- **Cohort Waterfall** — Stacked bar chart showing how each monthly acquisition cohort contributes to total active customers. Visual cohort decay over time.
- **Active Customers Chart** — Customer growth trajectory with Monte Carlo confidence bands.
- **Scenario Comparison** — Add up to 5 scenarios side-by-side. Compare cumulative revenue curves across brands/strategies.
- **Revenue Milestones** — Automatic detection of key thresholds: first profit, $5K/$10K/$25K/$50K/$100K MRR, $100K/$500K cumulative revenue, 1000 active customers.
- **Cohort Decay Table** — Month-by-month breakdown: new customers, active, retained %, MRR, cumulative revenue, net profit with color-coded P&L.
- **CSV Export** — Download full forecast data for pipeline consumption.

## Retention Model

Three-phase piecewise retention curve:
- **M1–M2:** Early retention (highest churn period)
- **M3–M5:** Stabilization phase
- **M6+:** Mature retention (loyal cohort)

Each phase is independently adjustable via slider. Monte Carlo adds ±5pp noise per cohort per path for realistic variance.

## Monte Carlo Methodology

- Acquisition noise: ±30% normal distribution per month
- ARPU noise: ±10% normal distribution per month
- Retention noise: ±5 percentage points per cohort per path
- 200–2000 configurable paths
- Percentile bands: P10, P50, P90

## How to Run

Open `index.html` in any browser. No build step, no dependencies. Single HTML file.

## What's Missing / Next Steps

- Connect to Shopify API for actual acquisition and retention data calibration
- Pull Printful COGS for real margin calculations per product
- Integrate with Unit Economics Calculator for product-level input
- Seasonal adjustment layer (holiday spikes, back-to-school, etc.)
- Multi-channel attribution (organic, paid, referral, Kickstarter)
- Churn reason categorization (price, competition, natural decay)
- LTV:CAC cohort analysis over time
- Wire to dashboard_api.json for Finance HQ integration

## Built By

SIMONS (Data & Analytics Lane) — April 5, 2026
