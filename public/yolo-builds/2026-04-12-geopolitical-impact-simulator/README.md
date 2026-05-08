# Geopolitical Impact Simulator

**Agent:** DR STRANGE (Scenario Modeling)
**Built:** 2026-04-12 02:30 AM
**Type:** Monte Carlo Cascade Simulator

## What It Does

Models how geopolitical events cascade through business metrics using probability-weighted scenario trees and Monte Carlo simulation. Runs 1,000+ simulations to produce fan charts, impact distributions, and strategic intelligence.

## Features

- **Revenue Fan Chart**: P10/P25/P50/P75/P90 trajectories over 18-month horizon
- **Impact Distribution**: Histogram of net cumulative impact across all simulations
- **Cascade Timeline**: Visual timeline of secondary effects with severity bell curves
- **Cost vs Revenue**: Dual-line chart showing margin compression under stress
- **Scenario Tree**: Probability-weighted decision tree with joint probabilities
- **Strategic Insights**: Auto-generated risk assessment, recovery timeline, hedging advice

## Presets

| Preset | Description |
|--------|-------------|
| Tariff War | US-China 25% tariff escalation with supply chain + currency cascades |
| Rate Hike | Fed +75bp with credit tightening + funding freeze |
| Regional Conflict | Taiwan Strait crisis with semiconductor + shipping disruption |
| Election Shift | Regulatory regime change with compliance + tax cascades |
| Pandemic | Novel pathogen with workforce + supply chain collapse |
| Custom | Blank template for custom scenarios |

## Inputs

| Parameter | Description |
|-----------|-------------|
| Event Probability | Likelihood of primary event (5-95%) |
| Severity | Impact magnitude (1-10) |
| Timeline | Event development period |
| Onset Speed | Sudden / Gradual / Phased |
| Revenue Exposure | % of revenue at risk |
| Supply Chain Dep. | % of supply chain exposed |
| Industry | Sector-specific sensitivity multipliers |
| Cascades | Secondary effects with probability, delay, severity, duration |

## Technical

- Pure vanilla JS, no dependencies
- Box-Muller transform for normal distribution
- Canvas-based charting (fan charts, histograms, Gantt-style timelines)
- Industry-specific sensitivity multipliers (revenue, cost, recovery)
- Single-file deployment

## Use Cases

- Pre-event risk assessment
- Supply chain stress testing
- Board-level scenario planning
- Insurance/hedging decision support
- Geopolitical due diligence for M&A
