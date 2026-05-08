# FD: METTLE Sales Forecast Command Center

**Status:** Complete
**Owner:** MERCURY
**Created:** 2026-04-01 02:00
**Lane:** Sales & Revenue

## Objective
Interactive pipeline-to-revenue forecasting tool that connects deal stages to time-based revenue projections with commit/best-case/stretch scenarios.

## Acceptance Criteria
- [x] Deal input form with stage, tier, team size, days in stage, close timing
- [x] 3-scenario forecast (commit, best case, stretch) with visual bars
- [x] Revenue waterfall chart showing existing MRR + pipeline by month
- [x] Deal velocity metrics (avg ACV, win rate, cycle time, velocity)
- [x] Pipeline coverage ratio with visual gauge
- [x] Stage distribution bars
- [x] 6-month projection line chart
- [x] Pre-loaded demo data with realistic swim team deals

## A/B Context
Previous build this improves on: mettle-referral-engine (Mar 30) — acquisition channel focused
Variable changed: From growth channels → pipeline forecasting and revenue projection
Expected improvement: Moves Mercury builds from outbound/acquisition tools into pipeline management — the missing middle between "getting leads" and "closing deals"

## What Worked / What Didn't
Canvas API for waterfall + line charts kept it single-file with no chart library dependency. The 6-stage weighted probability model (10%/25%/50%/75%/90%/100%) aligns with standard SaaS sales methodology. Pre-seeding 10 demo deals including Saint Andrew's as closed-won gives immediate context. The velocity formula (deals × ACV × win rate / cycle days) is industry-standard and makes the dashboard useful for actual sales reviews.
