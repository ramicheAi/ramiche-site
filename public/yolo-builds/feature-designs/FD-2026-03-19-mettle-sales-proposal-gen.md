# FD: METTLE Sales Proposal Generator

**Status:** Complete
**Owner:** Mercury
**Created:** 2026-03-19 02:06
**Lane:** Sales & Revenue

## Objective
Interactive sales proposal generator that creates branded, personalized METTLE proposals with ROI projections and CRM-ready lead capture JSON.

## Acceptance Criteria
- [x] Input form captures team info, contact, pain points, tier preference
- [x] Generates branded proposal with personalized content, pricing, and ROI
- [x] ROI calculation based on athlete count, churn, and tier pricing
- [x] 3-tier pricing comparison with recommendation highlight
- [x] CRM-ready JSON export with lead capture data
- [x] Print/PDF support via browser print
- [x] METTLE v5 brand colors (purple, scarlet, gold, blue)

## A/B Context
Previous build this improves on: none (first Mercury build)
Variable changed: N/A
Expected improvement: N/A — establishes Mercury's sales tooling baseline

## What Worked / What Didn't
Single-file HTML approach keeps it self-contained and portable. ROI engine uses conservative benchmarks (20% retention improvement, 0.15 hrs/athlete/mo saved, $35/hr coach rate) to avoid overpromising — critical for trust. The pain points section personalizes proposals beyond generic templates. Lead JSON export bridges the gap between proposal generation and CRM pipeline. Dark UI for the builder, white/clean for the proposal output — mirrors the "back office vs. client-facing" split.
