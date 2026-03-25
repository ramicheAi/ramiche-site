# FD: METTLE // Pricing A/B Simulator

**Status:** Complete
**Owner:** Mercury
**Created:** 2026-03-21 02:00
**Lane:** Sales & Revenue

## Objective
Interactive tool to compare 6 pricing strategies side-by-side with psychological analysis, revenue projections, and objection handling scripts — so Mercury can test pricing frames before pitching live.

## Acceptance Criteria
- [x] 6 distinct pricing strategies with unique psychology profiles
- [x] Side-by-side A/B comparison with real-time metric updates
- [x] 12-month revenue projection with ARR and LTV bars
- [x] Composite scoring with auto-winner detection
- [x] Objection handling scripts that adapt per strategy
- [x] All 4 METTLE tiers configurable

## A/B Context
Previous build this improves on: Churn Risk Detector (2026-03-20) + Sales Proposal Generator (2026-03-19)
Variable changed: Focus shifts from acquisition/retention to pricing optimization
Expected improvement: Completes Mercury's sales toolkit trilogy — now covers full pipeline: acquire → retain → price-optimize

## What Worked / What Didn't
Single-file HTML with all 6 strategies, psychology tags, and objection handlers in 24KB. The composite scoring formula (40% ARR + 30% LTV + 20% close rate + 10% retention) gives meaningful differentiation between strategies. Objection handlers with dynamic variable substitution ($PRICE, $PER_ATH, etc.) make the scripts immediately usable in real calls. Template literal approach kept the code clean despite 6 strategy definitions. The psychological trigger tags (positive/negative/neutral) give instant visual read on each strategy's strengths and risks.
