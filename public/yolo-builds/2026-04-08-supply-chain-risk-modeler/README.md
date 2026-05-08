# Supply Chain Risk Modeler

**Agent:** DR STRANGE — Scenario Modeling
**Built:** 2026-04-08 @ 2:30 AM
**Type:** YOLO Overnight Build

## What It Does

Interactive geopolitical supply chain risk simulator. Select a geopolitical event, configure your supply chain profile, and see cascading impacts across cost, delivery, and sourcing.

## Features

- **10 Preset Geopolitical Events** — Taiwan crisis, Red Sea disruption, tariff wars, energy cutoffs, pandemics, Suez blockage, rare earth bans, Indo-Pacific standoff, port cyberattack, nearshoring boom
- **Custom Event Input** — Model any scenario
- **Supply Chain Profile** — Industry selector, China dependency, single-source exposure, inventory buffer, logistics flexibility
- **Risk Summary Dashboard** — Risk score (0-100), peak cost increase %, max delivery delay, recovery time, resilience grade
- **Cost Impact Curve** — 18-month cost increase projection with peak/decay modeling
- **Supply Node Risk Map** — Visual map of 7 supply chain nodes with per-node risk scoring
- **Cascade Timeline** — 1st/2nd/3rd order effects with animated reveal
- **Delivery Delay Projection** — 18-month bar chart with color-coded severity
- **Strategic Recommendations** — Prioritized P0/P1/P2 actions based on analysis
- **Scenario Comparison** — Stack multiple scenarios side-by-side

## Presets

1. Taiwan Strait Crisis
2. Red Sea Shipping Disruption
3. US-China Tariff War (+60%)
4. Russia Energy Cutoff
5. Pandemic 2.0 (Factory Shutdowns)
6. Suez Canal Blockage
7. Rare Earth Export Ban (China)
8. Indo-Pacific Naval Standoff
9. Major Port Cyberattack
10. Mexico Nearshoring Boom (positive scenario)

## Differentiation from Existing Builds

| Market Simulator | Scenario War Room | **Supply Chain Risk** |
|---|---|---|
| Macro economic events | Business strategy | **Geopolitical → supply chain** |
| Sector-level impacts | Company metrics | **Node-level risk mapping** |
| Investment-focused | Operations-focused | **Procurement-focused** |
| Monte Carlo paths | Deterministic model | **Cascade + deterministic** |

## Technical

- Single-file HTML/CSS/JS, zero dependencies
- Canvas-rendered charts (cost curve, delay bars)
- SVG supply chain node connections
- Animated cascade timeline
- Dark theme matching RAMICHE OS
- Responsive canvas redraw

## Application

Use to model:
- METTLE hardware supply risk (if physical product expansion)
- Verified Agents compute/GPU supply scenarios
- Any client consulting on supply chain resilience
- General geopolitical scenario planning
