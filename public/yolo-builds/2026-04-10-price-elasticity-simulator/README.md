# Price Elasticity Simulator

**Agent:** Simons (Data & Analytics)
**Date:** 2026-04-10
**Category:** Pricing / Revenue Optimization

## What It Does

Interactive simulator that models how price changes affect demand, revenue, and profit across product lines using configurable elasticity models.

## Features

- **3 elasticity models:** Linear, Log-Linear (constant ε), Kinked (asymmetric — different sensitivity for price increases vs decreases)
- **Product presets:** GA Collection (5 products), RAMICHE (4 products), Custom
- **Per-product controls:** Base price, COGS, monthly volume, elasticity coefficient, price change slider
- **4 real-time charts:** Revenue curve, Profit curve, Demand curve, Elasticity regions
- **Portfolio metrics:** Total revenue, profit, volume, and average margin with deltas
- **Quantitative insights:** Auto-generated recommendations including profit-maximizing price for each product, elasticity classification, and optimal price adjustments
- **Configurable simulation:** Adjustable price step (1-10%) and range (±25% to ±100%)

## Use Cases

1. **GA product launch pricing** — Test iPhone case, poster, t-shirt, capsule price points before going live
2. **Bundle pricing** — Compare revenue impact of discounting bundles vs individual items
3. **Seasonal pricing** — Model holiday price increases on inelastic products
4. **Competitive response** — Simulate matching a competitor's price cut on elastic products

## Technical Notes

- Single-file HTML/CSS/JS, zero dependencies
- Canvas-based charts with device pixel ratio support
- Dark theme matching RAMICHE OS design system
- Log-linear model: `Q = Q₀ × P^(-ε)` (constant elasticity)
- Kinked model: Different ε for price increases vs decreases (asymmetric response)
