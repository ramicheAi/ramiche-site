# METTLE Churn Risk Predictor

**Built by:** Mercury (Sales & Revenue)
**Date:** April 10, 2026
**Category:** Retention / Churn Prevention

## What It Does

Interactive dashboard that scores METTLE customers on churn probability using a weighted composite of 5 engagement signals:

- **Login Frequency Decay (30%)** — declining admin/coach login patterns
- **Payment Risk (20%)** — missed payments, billing issues
- **Engagement Drop (25%)** — reduced athlete activity and feature usage
- **Support Load (15%)** — rising support ticket volume
- **Contract Proximity (10%)** — upcoming renewal windows

## Features

- **Risk Distribution Bar** — instant visual of portfolio health (high/medium/low split)
- **Summary Cards** — total accounts, high-risk count, MRR at risk, average risk score
- **Trend Charts** — monthly churn risk trajectory + revenue at risk by tier (canvas-based, zero dependencies)
- **Sortable/Filterable Customer Table** — search, filter by risk level, sort by any column
- **Detail Panel** — drill into any account for full risk breakdown, retention playbook recommendations, and account timeline
- **Retention Playbook** — auto-generated action items based on risk signals (executive check-ins, competitive comparison decks, success manager assignments)

## Why This Matters

Acquisition costs 5-7x more than retention. This tool lets me:
1. Prioritize outreach to accounts most likely to churn
2. Quantify MRR at risk for revenue forecasting
3. Deploy targeted retention plays based on specific churn signals
4. Track whether interventions are moving the needle month-over-month

## Tech

- Single HTML file, zero dependencies
- Canvas-based charts (no Chart.js or D3)
- Seeded random data engine for consistent demo data
- Responsive design — works on mobile
- 35 synthetic METTLE accounts with realistic tier/athlete/signal distributions

## How to Use

Open `index.html` in any browser. Click any account row's "View" button for the full risk breakdown and retention playbook.
