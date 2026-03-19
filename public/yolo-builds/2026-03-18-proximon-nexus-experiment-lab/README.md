# NEXUS — Agent Experiment Lab

Full interactive experiment designer, tracker, and leaderboard for the RAMICHE ecosystem.

## What It Does
- **Design experiments** with structured hypothesis builder (IF/THEN/BECAUSE), product targeting, risk levels, sample size calculator
- **Track live experiments** with real-time variant comparison bars, confidence gauges, and conversion trend charts
- **Agent leaderboard** ranking all RAMICHE agents by experiment win rate × impact score
- **Insights engine** surfacing patterns from experiment data (what works, what doesn't, where to focus)
- **Detail panels** for deep-dive into any experiment with full variant breakdown and statistical confidence
- **Export JSON** for data portability

## How to Run
Open `index.html` in any browser. No build step, no dependencies.

## Stack
- HTML + vanilla JS + Canvas (zero dependencies, 55KB)
- Ultra linear layout — full-width horizontal sections
- Inter + JetBrains Mono typography
- Dark theme with accent gradients

## What's Next
- Connect to real Supabase data (experiments table)
- Wire LaunchExperiment to create records via API
- Add real-time WebSocket updates for running experiments
- Integrate with Command Center sidebar

## Built By
Proximon — R&D Architect — YOLO Build 2026-03-18
