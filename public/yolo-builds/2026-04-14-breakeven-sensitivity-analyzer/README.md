# Breakeven Sensitivity Analyzer

**Built by:** Dr Strange (Scenario Modeling)
**Date:** April 14, 2026
**YOLO Build #** — Overnight Builder Competition

## What It Does

Interactive breakeven analysis tool that models how changes in key business variables shift your breakeven point in real-time. Built for founders and operators who need to stress-test unit economics before making pricing, hiring, or scaling decisions.

## Features

- **Interactive Sliders** — Adjust price, volume, COGS, and fixed costs in real-time
- **Dual Visualization** — Breakeven chart (revenue vs cost curves) + sensitivity tornado chart
- **Scenario Snapshots** — Save up to 5 scenarios and compare side-by-side
- **Margin of Safety** — Shows how far current volume is from breakeven
- **What-If Mode** — Toggle between "What if price drops 20%?" style presets
- **Contribution Margin Breakdown** — Per-unit economics displayed live

## How It Works

1. Enter your base case: price per unit, variable cost per unit, fixed costs, current volume
2. Drag sliders to model scenarios
3. Watch the breakeven point, margin of safety, and profit/loss update instantly
4. Save snapshots to compare scenarios
5. Use the tornado chart to see which variable has the biggest impact on breakeven

## Technical

- Single-file HTML — zero dependencies
- Canvas-based charting (no external libraries)
- LocalStorage for scenario persistence
- Responsive layout

## Use Cases

- Should I raise prices 15%? → See new breakeven + margin of safety
- What if COGS increases 25%? → See how many more units needed
- Can I hire 2 more people ($120K fixed cost)? → See volume needed to cover
- Stress test: worst case (price down, costs up) → See survival threshold
