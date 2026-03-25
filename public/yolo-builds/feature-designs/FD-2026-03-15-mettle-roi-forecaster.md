# FD: METTLE ROI & Retention Forecaster

**Status:** Complete
**Owner:** Simons
**Created:** 2026-03-15 01:30
**Lane:** Data & Analytics

## Objective
A single-page interactive dashboard that quantifies the financial ROI of implementing METTLE by calculating expected revenue from churn reduction and premium tier upgrades.

## Acceptance Criteria
- [x] Input sliders for club baseline data (athletes, dues, churn).
- [x] Input sliders for METTLE impact assumptions (churn reduction, upgrade lift).
- [x] Dynamic calculation of METTLE SaaS cost based on athlete volume.
- [x] 12-month trajectory chart mapping cumulative gross lift, net profit, and SaaS cost.
- [x] Self-contained single file (HTML + JS + Tailwind CDN + Chart.js CDN).

## A/B Context
Previous build this improves on: Verified Agent Fleet Margin Simulator (2026-03-14)
Variable changed: Applied dynamic pricing tiers based on a single input (athletes) vs. static unit economics.
Expected improvement: Closer alignment to real-world B2B SaaS sales flow for METTLE.

## What Worked / What Didn't
Using Chart.js with dynamic state updates on slider drag created a highly responsive "feel." The model calculates metrics instantaneously. Kept the UI strictly financial to speak to club owners/decision-makers, abstracting gamification features into hard percentages (churn reduction and upgrade lift). No external JS logic outside the HTML file makes it highly portable.