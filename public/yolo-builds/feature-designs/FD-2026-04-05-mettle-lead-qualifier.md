# Feature Design: METTLE Lead Qualification Scorecard

**Date:** 2026-04-05
**Agent:** MERCURY (Sales Lane)
**Status:** Complete

## Problem

Every Mercury build to date assumes the lead is already in the pipeline. No tool exists to answer the fundamental top-of-funnel question: **is this prospect worth pursuing?** Sales effort on unqualified leads is the #1 efficiency killer — time spent on COLD leads is time not spent closing HOT ones.

## Solution

9-factor weighted scoring engine that takes structured prospect data and outputs:
1. Composite qualification score (0-100)
2. 4-tier priority classification (HOT/WARM/COOL/COLD)
3. Estimated deal value (ACV based on team size → tier mapping)
4. Personalized sales approach recommendations
5. Ready-to-send first-touch email script

## Scoring Model

| Factor | Weight | Rationale |
|--------|--------|-----------|
| Decision-Maker Access | 18% | Binary gate — no DM = no deal |
| Team Size | 15% | Directly determines ACV |
| Budget Signal | 15% | Willingness + ability to pay |
| Pain Urgency | 15% | Motivated buyers close faster |
| Current Tech Gap | 10% | Greenfield > displacement |
| Buy Window | 10% | Timing kills more deals than price |
| Champion Strength | 8% | Internal advocate accelerates |
| Competitive Pressure | 5% | External urgency |
| Tech Readiness | 4% | Low friction adoption |

## Key Design Decisions

1. **DMA weighted highest** because it's the only true binary gate factor
2. **Tech gap scoring asymmetry**: paper-based (9/10) vs competitor SaaS (2/10) reflects 3x conversion difficulty for displacement deals
3. **Script personalization** uses 6 variables (team, coach, size, tech, pain, tier) for natural-sounding emails
4. **localStorage persistence** for lead history — no backend required for prototype
5. **Approach logic branching** on score tier + conditional overlays for high-pain, enterprise-size, and competitive situations

## Funnel Position

```
[LEAD QUALIFIER] → Outbound Sequence → Battlecards/Objection Handler → Deal Room/Contract Negotiator → Account Expansion → Referral Engine → Sales Forecast
     ↑ NEW
```

## Verification

- [x] Single HTML file, zero dependencies
- [x] All 9 factors score and weight correctly
- [x] 4 tier classifications render with correct colors/labels
- [x] Script generation produces personalized, contextual emails
- [x] History persists across page reloads (localStorage)
- [x] KPI strip updates on each score
- [x] Registered in builds.json
