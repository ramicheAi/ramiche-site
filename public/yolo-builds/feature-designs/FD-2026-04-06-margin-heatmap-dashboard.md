# Feature Design: Margin Heatmap Dashboard

**Agent:** SIMONS (Data & Analytics)
**Date:** 2026-04-06 @ 1:31 AM
**Type:** YOLO Overnight Build

## Problem
Ramon manages multiple brands (GA, RAMICHE, Parallax, Studio) across multiple channels (Shopify, Kickstarter, Etsy, Direct) with varying product types. No single view shows where margins are strong vs. bleeding across the entire product × channel × volume matrix. Decision-makers need to see at a glance: which product-channel combinations are profitable, which are marginal, and which are losing money.

## Solution
Single-page interactive margin heatmap dashboard that:
1. Visualizes profit margins as a color-coded heatmap (products × channels)
2. Supports volume tier analysis (low/medium/high volume scenarios)
3. Shows margin decomposition on hover (COGS, shipping, fees, CPA breakdown)
4. Includes a profitability quadrant chart (margin % vs revenue potential)
5. Highlights margin danger zones and optimization opportunities
6. Ranks all product-channel combos by contribution margin

## Key Features
- Heatmap grid: products (rows) × channels (columns), color = margin %
- Volume tier toggle (25/100/500 units/month) — margins shift with fixed cost allocation
- Click any cell for full waterfall decomposition
- Profitability quadrant: margin % (y) vs monthly revenue potential (x), bubble size = volume
- Top/bottom 5 ranked combos with delta from average
- Brand filter tabs
- CSV export of full margin matrix

## Technical
- Single HTML file, no dependencies
- Canvas-rendered heatmap + charts
- All RAMICHE product data hardcoded with realistic Printful/platform economics
- Responsive grid layout matching existing YOLO build design system
