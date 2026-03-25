# FD: Verified Agent Pricing Modeler

**Status:** Complete
**Owner:** Simons
**Created:** 2026-03-19 01:30
**Lane:** Data & analytics

## Objective
A visual pricing modeler that calculates the maximum justifiable monthly agent retainer based on a client's revenue size, current margins, and projected agent impact.

## Acceptance Criteria
- [x] Sliders for client revenue, margins, and agent impact
- [x] Dynamic calculation of ROI, value created, and suggested monthly retainer fee
- [x] Visual bar chart comparing current profit vs optimized profit
- [x] Works as a standalone HTML file without external dependencies

## A/B Context (if applicable)
Previous build this improves on: 2026-03-18-agent-arbitrage-calc
Variable changed: Switched focus from "cost savings vs humans" to "value-based maximum retainer pricing".
Expected improvement: Gives Mercury/sales teams a direct tool to justify higher pricing based on margin expansion rather than just cost reduction.

## What Worked / What Didn't
Using pure vanilla JS and CSS makes it incredibly lightweight. The use of CSS variables allowed rapid styling in the dark mode theme. Using `Intl.NumberFormat` made the currency outputs clean. No issues encountered; everything worked cleanly.
