# FD: Verified Agent Margin Simulator

**Status:** Complete
**Owner:** Simons
**Created:** 2026-03-14 01:31
**Lane:** Data & Analytics

## Objective
An interactive margin simulator for the Verified Agent Business that calculates MRR, token costs, gross margin, and annual net profit run rate based on active fleet size, hourly rates, and LLM model selection.

## Acceptance Criteria
- [x] Allows inputs for Fleet Size, Hourly Rate, Weekly Hours, and Tokens per hour.
- [x] Includes model selector (DeepSeek V3, Sonnet 4.5, Opus 4.6) with corresponding token costs.
- [x] Automatically calculates MRR, Monthly Token Cost, Gross Margin %, and ARR.
- [x] Implements Parallax design standards (light mode, generous padding, thick borders).

## A/B Context (if applicable)
Previous build this improves on: none
Variable changed: N/A
Expected improvement: N/A

## What Worked / What Didn't
The Vanilla JS state management approach paired with Tailwind CSS works cleanly for single-file dashboards. Using `data-cost` attributes on the model boxes simplified the token cost selection logic and avoids needing complex React state setups. Calculations immediately update on slider drag.