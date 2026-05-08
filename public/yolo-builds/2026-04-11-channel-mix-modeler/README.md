# Channel Mix Modeler

**Agent:** Simons (Data & Analytics)
**Date:** 2026-04-11
**Category:** Marketing / Budget Optimization

## What It Does

Interactive marketing mix optimizer that models diminishing returns across channels, finds optimal budget allocation, and visualizes marginal ROAS to prevent overspending on saturated channels.

## Features

- **3 diminishing returns models:** Logistic (S-curve), Square Root, Logarithmic — each captures different channel behavior
- **Brand presets:** GA Collection, RAMICHE, Ramiche Studio, Custom — pre-configured with realistic channel parameters
- **6-8 channels per preset:** Meta Ads, Google Ads, TikTok, Email, Organic, Influencer, SEO, Affiliate
- **Per-channel parameters:** Saturation coefficient, conversion rate, AOV, response ceiling
- **Budget optimizer:** Max ROAS, Max Revenue, and Balanced Growth modes using gradient ascent on marginal returns
- **4 real-time charts:** Revenue by Channel (bar), ROAS by Channel (bar + breakeven line), Diminishing Returns Curves (line + current spend markers), Marginal ROAS at Current Spend (bar + 1x reference)
- **5 KPI cards:** Total Revenue, Blended ROAS, Avg CPA, Conversions, Efficiency (marginal ROAS) — all with delta tracking
- **Allocation bar:** Visual budget split with over/under-allocation warnings
- **Auto-generated insights:** Highest marginal return channel, saturation alerts, sub-breakeven warnings, concentration risk, optimal next-dollar recommendation, attribution window effects
- **Attribution window slider:** 7-90 day window modeling multi-touch credit inflation

## Use Cases

1. **GA launch budget planning** — Allocate $5k across Meta/Google/TikTok/Email, find optimal split before spending
2. **Channel saturation detection** — Identify when TikTok or Meta spend hits diminishing returns plateau
3. **ROAS optimization** — Auto-optimize to maximize return, then manually adjust for brand awareness goals
4. **Budget scaling decisions** — Compare $5k vs $15k vs $50k scenarios to see where returns flatten
5. **Platform diversification** — Detect concentration risk when >50% flows to one channel

## Model Details

- **Logistic (S-curve):** `ceiling / (1 + exp(-k * (spend/1000 - 3)))` — realistic adoption curve with slow start, rapid growth, and saturation
- **Square Root:** `ceiling * (1 - exp(-k * sqrt(spend/1000)))` — fast initial returns, gradual plateau
- **Logarithmic:** `ceiling * log(1 + k*x) / log(1 + k*50)` — steady diminishing returns throughout
- **Marginal ROAS:** Computed via finite difference (δ=$50) on the response curve
- **Optimizer:** 200-step gradient ascent transferring 0.5% per step from lowest to highest marginal return channel

## Technical Notes

- Single-file HTML/CSS/JS, zero dependencies
- Canvas-based charts with device pixel ratio support
- Dark theme matching RAMICHE OS design system
- All calculations client-side, instant feedback

## How to Run

Open `index.html` in any browser. No build step, no dependencies.

## Built By

SIMONS (Data & Analytics Lane) — April 11, 2026
