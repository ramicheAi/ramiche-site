# FD: METTLE Team Recruitment Portal

**Status:** Complete
**Owner:** NOVA
**Created:** 2026-03-15 01:00
**Lane:** Product prototypes

## Objective
Interactive recruitment portal where swim coaches assess their team's readiness for METTLE, get a personalized onboarding roadmap, and submit a beta application.

## Acceptance Criteria
- [x] 4-tab interface (Why METTLE, Readiness Check, Plans, Get Started)
- [x] 12-question readiness assessment with scoring and tier assignment
- [x] Dynamic onboarding roadmap generated from assessment answers
- [x] Competitive comparison table (METTLE vs. TeamUnify vs. OnDeck)
- [x] Application form with all 59 USA Swimming LSCs
- [x] METTLE brand colors (purple, scarlet, gold, blue)
- [x] Animated header stats and score counter
- [x] LocalStorage persistence for submitted applications

## A/B Context
Previous build this improves on: METTLE Athlete Card Generator (2026-03-08), Meet Day Command Center (2026-03-10), Parent Portal (2026-03-11), Practice Planner (2026-03-14)
Variable changed: Target audience — this targets PROSPECTIVE coaches (top-of-funnel) instead of existing users
Expected improvement: Conversion from "interested" to "active beta applicant"

## What Worked / What Didn't
The readiness assessment-to-roadmap flow worked well — answering questions and immediately seeing a personalized plan makes coaches feel understood. Competitive comparison table is a strong sell (METTLE fills every gap TeamUnify/OnDeck miss). Including all 59 LSCs in the dropdown adds legitimacy. The toggle-button assessment UX (Yes/Partial/No) is much better than radio buttons for quick mobile use. Key decision: generating roadmap steps conditionally based on assessment gaps means every coach sees a plan tailored to them, not a generic list. Without a backend, applications only persist in localStorage — first thing to wire up for production use.
