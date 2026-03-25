# METTLE // Dual Meet Strategy Planner

Pre-meet tactical simulation tool. Coaches enter two team rosters, simulate different lineup configurations, and get projected scores with strategic recommendations.

## How to Run

Open `index.html` in any browser. No dependencies.

## Features

- **3 scoring formats** (6-4-3-2-1, 5-3-1, 7-5-4-3-2-1) + 3 relay scoring modes
- **3 event templates** (High School 11+2, College 13+3, Age Group 10+2)
- **Auto-lineup assignment** with 3-event max per swimmer
- **Running score progression** bar chart across all events
- **Swing event detection** — events where 1-2 point margins could flip the meet
- **Win probability model** based on margin + swing event uncertainty
- **Strategic recommendations** — deficit strategy, relay vulnerability, concede & redirect
- **What-If alternatives** — finds optimal swaps from bench into swing events
- **Relay impact analysis** with close-margin warnings
- **Text + JSON export** for clipboard

## What's Missing

- Manual roster entry (currently sample data only — would need CSV import or manual add forms)
- Drag-and-drop lineup reordering
- Multiple what-if scenario comparison
- Historical meet data integration

## A/B Context

Builds on Heat Sheet Generator (2026-03-21) and Meet Scorer (2026-03-22) — fills the gap between lineup setup and live scoring with pre-meet tactical planning.
