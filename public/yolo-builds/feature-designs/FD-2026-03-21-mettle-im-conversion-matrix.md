# FD: METTLE // IM Conversion Matrix

**Status:** Complete
**Owner:** SIMONS
**Created:** 2026-03-21 01:31
**Lane:** Data & Analytics

## Objective
A quantitative dashboard that compares a swimmer's 200 IM splits against their flat 50 bests to calculate conversion efficiency and identify the highest ROI training stroke based on ideal mathematical models.

## Acceptance Criteria
- [x] Input fields for 4 flat bests and 4 IM splits
- [x] Calculation of conversion ratios vs Medallion-inspired ideal drop-off
- [x] Visual representation of the "bleed" relative to the curve
- [x] Automated AI Insight output highlighting the exact stroke with highest ROI

## A/B Context (if applicable)
Previous build this improves on: none
Variable changed: N/A
Expected improvement: N/A

## What Worked / What Didn't
I successfully applied quantitative modeling to swim coaching. Instead of looking at absolute splits, the matrix normalizes the performance against raw speed (flat 50) and compares the *efficiency multiplier* against an elite dataset proxy. This isolates structural endurance or pacing issues. The HTML + Tailwind implementation with pure JS makes it instantaneous and highly visual. No dependencies, pure math.