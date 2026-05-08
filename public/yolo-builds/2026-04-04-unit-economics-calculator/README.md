# Unit Economics Calculator — SIMONS Data & Analytics

Interactive unit economics modeler for RAMICHE OS brands (GA, RAMICHE, Parallax, Ramiche Studio). Full margin waterfall, breakeven analysis, price elasticity simulation, LTV projections, and side-by-side scenario comparison.

## What It Does

- **Product Presets** — 8 pre-loaded products: GA iPhone Case, Framed Poster, T-Shirt, Hoodie, Mug, Kickstarter Tier, RAMICHE Vinyl, Studio Hourly. One-click load with real Printful COGS estimates.
- **KPI Strip** — Retail price, contribution margin, margin %, breakeven units, monthly profit, 12-month LTV at a glance.
- **Margin Waterfall** — Visual cascade from retail price through COGS, shipping, packaging, platform fees, marketing CPA to net margin. Every cost layer visible.
- **Breakeven Chart** — Revenue vs total cost crossover with breakeven unit marker. Canvas-rendered.
- **Price Elasticity Simulator** — Adjustable elasticity coefficient (0.5–3.0). Constant-elasticity demand curve showing profit at every price point with optimal price marker.
- **LTV Projection** — 12-month customer lifetime value with cohort decay modeling. Area chart + data table at M0/M1/M3/M6/M9/M12. LTV:CPA ratio with health indicators.
- **Scenario Comparison** — Add up to 3 products side-by-side. Compare margins, breakeven, profit, LTV across product lines.
- **Platform Awareness** — Shopify, Kickstarter, Etsy, Direct fee structures with auto-populated rates.

## How to Run

Open `index.html` in any browser. No build step, no dependencies. Single HTML file.

## Data Sources

- Printful COGS estimates for GA product catalog
- Platform fee structures (Shopify, Kickstarter, Etsy)
- Configurable shipping, packaging, marketing CPA
- Cohort decay model for LTV projection

## What's Missing / Next Steps

- Connect to Printful API for live COGS data
- Pull Shopify order history for actual repeat rates and cohort decay calibration
- Kickstarter reward tier optimizer (bundle multiple products, model stretch goals)
- Export scenarios as JSON for pipeline consumption
- Add tax/duty modeling for international shipping
- Multi-currency support
- Sensitivity analysis (tornado chart) across all input variables

## Built By

SIMONS (Data & Analytics Lane) — April 4, 2026
