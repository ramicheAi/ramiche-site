# Margin Heatmap Dashboard — SIMONS Data & Analytics

Interactive margin heatmap showing profitability across all RAMICHE product × channel combinations. One glance reveals where margins are strong, marginal, or bleeding — across 14 products, 4 channels, and 3 volume tiers.

## What It Does

- **Margin Heatmap** — Color-coded grid: products (rows) × channels (columns). Green = healthy margin, amber = thin, red = losing money. Hover any cell for full cost decomposition (COGS, shipping, packaging, platform fees, CPA breakdown).
- **KPI Strip** — Total combos, average margin, profitable count, monthly revenue, best/worst margins at a glance.
- **Profitability Quadrant** — Bubble chart plotting margin % vs revenue potential. Four quadrants: Stars (high margin + high rev), Niche (high margin + low rev), Volume Plays (low margin + high rev), Danger Zone (low margin + low rev). Bubble color = brand, size = contribution dollars.
- **Margin Distribution** — Histogram of all product-channel margins with mean line. Shows how skewed or concentrated the margin distribution is.
- **Top/Bottom 5 Rankings** — Best and worst combos ranked by margin %, with contribution dollars and delta from average.
- **Brand Filter** — Toggle between All, GA, RAMICHE, Parallax, Studio.
- **Volume Tier Toggle** — Switch between Low (25/mo), Mid (100/mo), High (500/mo) to see how fixed cost allocation shifts margins.
- **CSV Export** — Full margin matrix download for pipeline consumption.

## Products Covered

| Brand | Products |
|-------|----------|
| GA | iPhone Case, Framed Poster, T-Shirt, Hoodie, Mug, Sticker Pack, Enamel Pin |
| RAMICHE | Vinyl, CD, Merch Tee |
| Parallax | Vinyl, Cassette |
| Studio | Session/hr, Mix/Master |

## Channels Modeled

| Channel | Platform Fee | Processing | Fixed Fee |
|---------|------------|------------|-----------|
| Shopify | 2.9% | — | $0.30 |
| Kickstarter | 5.0% | 3.5% | — |
| Etsy | 6.5% | 3.0% | $0.25 |
| Direct | 0% | 0% | 0% |

## Key Insights This Reveals

1. **Channel arbitrage** — Same product, different margins by channel. Direct sales always win on margin but lose on volume.
2. **Product-channel fit** — Some products shouldn't be on certain channels (negative margin after fees).
3. **Volume sensitivity** — Fixed cost allocation shifts the picture dramatically at low volumes.
4. **Brand margin profiles** — Studio services dominate on margin, GA collectibles fight thin margins on physical goods.

## How to Run

Open `index.html` in any browser. No build step, no dependencies. Single HTML file.

## What's Missing / Next Steps

- Connect to Shopify API for actual product data and real-time COGS
- Pull Printful fulfillment costs dynamically
- Add seasonal demand multipliers
- Integrate with daily_signals pipeline for cross-correlation with market data
- Wire to dashboard_api.json for Finance HQ integration
- Add time-series view (margin trends over months)
- Competitor price benchmarking overlay

## Built By

SIMONS (Data & Analytics Lane) — April 6, 2026
