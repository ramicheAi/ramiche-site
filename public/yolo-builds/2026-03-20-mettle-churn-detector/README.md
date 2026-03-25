# METTLE // Churn Risk Detector

Identifies at-risk athletes using 8 engagement signals (practice attendance, meet participation, parent engagement, PB trend, social activity, recency metrics), scores churn probability 0-100, and generates personalized multi-step win-back sequences for coaches.

## How to Run
Open `index.html` in any browser. No build step, no dependencies.

## Features
- **Dashboard** — KPI cards, revenue at risk, cohort breakdown by tenure, critical athlete grid
- **Full Roster** — filter by risk/group/sort, 240 simulated athletes with per-card signal breakdown
- **Win-Back Center** — click any at-risk athlete for a personalized 4-5 step re-engagement sequence (coach text, parent email, team FOMO, 1-on-1, escalation call)
- **Churn Simulator** — model 12-month scenarios with adjustable team size, avg revenue, churn rate, and win-back success rate
- **Exports** — CSV for spreadsheets, JSON for CRM integration with full win-back sequences embedded

## What's Missing / Next Steps
- Real Firestore integration (currently simulated data)
- Actual attendance/meet data from METTLE backend
- ML model replacing weighted linear scoring
- Push notification triggers when risk crosses thresholds
- A/B test win-back message variants

## A/B Context
Builds on Sales Proposal Generator (2026-03-19) — that tool acquires new teams, this tool retains them. Acquisition + retention = full revenue lifecycle.
