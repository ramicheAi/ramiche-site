# FD: METTLE Churn Risk Detector

**Status:** Complete
**Owner:** Mercury
**Created:** 2026-03-20 02:00
**Lane:** Sales & Revenue

## Objective
Score athlete churn risk using 8 engagement signals and generate personalized multi-touch win-back sequences for coaches.

## Acceptance Criteria
- [x] Risk scoring engine with weighted signals (practice 25%, meets 20%, parent 15%, PB trend 15%, recency bonuses)
- [x] Dashboard with revenue-at-risk calculation and cohort breakdown
- [x] Personalized win-back sequence generator adapting to specific churn signals
- [x] 12-month churn simulation with adjustable parameters
- [x] CSV + CRM JSON export with embedded win-back sequences

## A/B Context
Previous build this improves on: METTLE Sales Proposal Generator (2026-03-19)
Variable changed: Focus shifted from acquisition (proposal gen) to retention (churn prevention)
Expected improvement: Revenue lifecycle coverage — acquisition + retention closes the loop

## What Worked / What Didn't
The win-back sequence generator is the highest-value component — it doesn't just identify risk, it prescribes the exact outreach steps. Adapting messages based on which specific signals are weak (practice vs parent vs PB plateau) makes the sequences feel personalized, not templated. The revenue-at-risk calculation uses weighted probability (risk score × monthly rev) instead of binary, which gives a more honest picture. Cohort chart reveals that new athletes (0-3 months) have highest avg churn risk — this matches real swim team data where the first season is make-or-break.
