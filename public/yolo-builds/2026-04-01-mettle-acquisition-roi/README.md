# METTLE Acquisition Channel ROI Analyzer

Interactive tool modeling customer acquisition cost, conversion funnel efficiency, and ROI across 6 acquisition channels (referral, outbound, paid social, organic, partnerships, events) with diminishing returns curves, marginal CAC analysis, and optimal budget allocation via greedy constrained optimization.

## How to Run

Open `index.html` in any browser. No build step, no dependencies.

## Features

- **6 acquisition channels** with realistic METTLE swim SaaS parameters (base CAC, conversion rates, decay rates, spend caps)
- **Marginal CAC curves** — diminishing returns modeled as baseCac * (1 + decayRate * (spend/1000)^1.5)
- **3 chart views:** Marginal CAC curves, Cumulative ROI, Funnel efficiency visualization
- **Greedy optimizer:** Allocates each $50 increment to the channel with lowest marginal CAC
- **4 presets:** Bootstrap ($2K), Growth ($8K), Scale ($20K), Enterprise ($50K)
- **LTV:CAC ratio,** payback period, portfolio ROI auto-calculated
- **Auto-generated insights:** Identifies best marginal dollar destination, highest/lowest ROI channels, and optimization improvement %

## What's Missing / Next Steps

- Real data integration (Shopify/CRM actuals vs simulated parameters)
- Channel interaction effects (referral boost from paid social brand awareness)
- Time-series view (seasonal variation in swim team acquisition — Aug-Sep peak)
- Monte Carlo confidence intervals on customer estimates
- Export to CSV/PDF for board presentations
