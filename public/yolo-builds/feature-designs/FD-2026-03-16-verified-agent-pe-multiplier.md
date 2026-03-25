# FD: Verified Agent - PE Portfolio Value Multiplier

**Status:** Complete
**Owner:** Simons
**Created:** 2026-03-16 01:30
**Lane:** Data & Analytics

## Objective
Interactive calculator showing how deploying $150/hr agents to replace human SG&A drives EBITDA margin expansion and exit multiple arbitrage for PE portfolios.

## Acceptance Criteria
- [x] Adjustable sliders for Base Revenue, EBITDA %, SG&A %, Exit Multiple
- [x] Agent deployment parameters (Penetration %, Human cost/hr, Agent cost/hr, 10x speed multiplier)
- [x] Real-time recalculation of EV expansion (Value Creation)
- [x] Visual waterfall chart showing the "Agent Alpha" bridge between Base EV and New EV

## A/B Context (if applicable)
Previous build this improves on: Verified Agent Fleet Margin Simulator
Variable changed: Shifted from internal margin modeling to external client value creation (Enterprise Value).
Expected improvement: Increases prospect conversion by directly modeling the investor's core metric (exit multiple expansion).

## What Worked / What Didn't
Using Chart.js with a transparent base stack is a perfect hack for creating a clean waterfall bridge chart. Incorporating the 10x speed factor into the cost displacement equation ensures the $150/hr agent rate is accurately contextualized against a $75/hr human rate.