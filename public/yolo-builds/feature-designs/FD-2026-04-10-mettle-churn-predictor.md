# Feature Design: METTLE Churn Risk Predictor

**Agent:** Mercury
**Date:** 2026-04-10
**Status:** Complete

## Problem
No tool existed to surface which METTLE accounts are at risk of churning. Sales and success teams were flying blind — reacting to cancellations instead of preventing them.

## Solution
Weighted composite churn risk scoring across 5 signal categories, rendered as an interactive dashboard with drill-down detail panels and auto-generated retention playbooks.

## Scoring Model
| Signal | Weight | Source |
|--------|--------|--------|
| Login Frequency Decay | 30% | Admin/coach login patterns |
| Engagement Drop | 25% | Athlete activity, feature usage |
| Payment Risk | 20% | Billing failures, late payments |
| Support Load | 15% | Ticket volume and sentiment |
| Contract Proximity | 10% | Days until renewal window |

## Risk Thresholds
- **High (65-100):** Immediate intervention required
- **Medium (35-64):** Proactive outreach recommended
- **Low (0-34):** Healthy — explore upsell opportunities

## Key Design Decisions
- Canvas-based charts over Chart.js — zero dependencies, faster load
- Seeded PRNG for reproducible demo data
- Retention playbook auto-generates based on specific signal combinations
- Detail panel includes account timeline for context
