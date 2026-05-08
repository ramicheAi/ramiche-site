# FD-2026-04-04 — Unit Economics Calculator

**Author:** SIMONS (Data & Analytics Lane)
**Date:** 2026-04-04
**Status:** Built

## Problem

Ramon runs 4 brands (GA, RAMICHE, Parallax, Ramiche Studio) with products across Printful (POD), Shopify, and potential Kickstarter tiers. No single tool models unit economics end-to-end: COGS, fulfillment, shipping, platform fees, payment processing, marketing cost per acquisition, breakeven volume, contribution margin, and LTV projections. Pricing decisions are gut-feel without margin visibility.

## Solution

Interactive single-file HTML calculator. Input product parameters → see full margin waterfall, breakeven analysis, price sensitivity curves, scenario comparison (3 products side-by-side), and LTV projections with cohort decay modeling. Supports POD (Printful) and custom fulfillment cost structures.

## Key Design Decisions

1. **Margin waterfall chart** — Visual cascade from retail price down through every cost layer to net margin. Makes margin compression visible at a glance.
2. **Printful-aware defaults** — Pre-loaded COGS for iPhone cases, t-shirts, framed posters, hoodies, mugs matching GA product catalog.
3. **Platform fee modeling** — Shopify (2.9% + $0.30), Kickstarter (5% + 3-5% processing), Etsy (6.5% + $0.20 + 3% processing) as presets.
4. **Price elasticity simulator** — Drag price slider, see how volume must change to maintain same total profit. Based on constant-elasticity demand model.
5. **Breakeven visualizer** — Fixed costs + variable costs → breakeven units with visual crossover chart.
6. **LTV projection** — Configurable repeat rate, purchase frequency, and cohort decay curve. Shows 12-month projected LTV per customer.
7. **Side-by-side comparison** — Up to 3 product scenarios simultaneously for portfolio-level margin analysis.
8. **Dark theme** — Matches RAMICHE design language.

## Components

| Section | Purpose | Visualization |
|---------|---------|---------------|
| Product Config | Input price, COGS, fees | Form with smart defaults |
| Margin Waterfall | Cost breakdown | Horizontal cascade chart |
| Breakeven | Volume to profitability | Line chart with crossover |
| Price Sensitivity | Elasticity modeling | Interactive curve |
| LTV Projection | Customer lifetime value | Area chart with cohort decay |
| Scenario Compare | Side-by-side products | Multi-column cards |

## Integration Path

- Connect to Printful API for live COGS data
- Pull Shopify order data for actual repeat rates and cohort analysis
- Feed into Kickstarter reward tier optimizer
- Export scenarios as JSON for pipeline consumption
