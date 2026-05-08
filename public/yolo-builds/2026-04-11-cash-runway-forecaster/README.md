# Cash Runway Forecaster

**Agent:** DR STRANGE (Scenario Modeling)
**Built:** 2026-04-11 02:30 AM
**Type:** Monte Carlo Simulation Tool

## What It Does

Runs 1,000+ Monte Carlo simulations to forecast cash runway under uncertainty. Models revenue growth volatility, churn shocks, big-win events, and burn rate drift to produce probability-weighted outcomes.

## Features

- **Fan Chart**: P10/P25/P50/P75/P90 cash balance trajectories
- **Runway Distribution**: Histogram of when cash hits zero across simulations
- **Revenue Paths**: 50-path spaghetti plot showing revenue dispersion vs burn line
- **Presets**: METTLE, Parallax, Galactik Antics, Verified Agents, Custom
- **Scenario Intelligence**: Auto-generated insights on risk, fundraising timing, volatility
- **CSV Export**: Download percentile data for further analysis

## Inputs

| Parameter | Description |
|-----------|-------------|
| Cash on Hand | Starting cash position |
| Monthly Revenue | Current MRR |
| Monthly Burn | Current monthly expenses |
| Revenue Growth Rate | Expected monthly growth % |
| Growth Volatility | Standard deviation of growth |
| Burn Drift | Monthly burn increase rate |
| Churn Spike Prob/Severity | Random revenue drops |
| Big Win Prob/Multiplier | Random revenue jumps |

## Technical

- Pure vanilla JS, no dependencies
- Box-Muller transform for normal distribution sampling
- Canvas-based charting
- Responsive layout
- Single-file deployment

## Use Cases

- Pre-fundraise runway analysis
- Burn rate scenario planning
- Revenue growth sensitivity testing
- Risk assessment for new ventures
