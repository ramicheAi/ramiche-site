# Feature Design: Agent Health Monitor

**Author:** Proximon (Infra Lane)
**Date:** 2026-04-03
**Status:** Prototype Complete
**Build Location:** `yolo-builds/2026-04-03-agent-health-monitor/`

## Problem

No single view exists for monitoring the health, performance, and activity of all 20 RAMICHE agents across the 3-lane routing system. Debugging issues requires checking individual sessions, memory files, and gateway logs manually.

## Solution

Single-page real-time dashboard with:
1. Fleet-wide status grid (20 agents, live status + sparklines)
2. 24hr uptime heatmap (core agents)
3. Lane throughput meters (infra/creative/business)
4. p50/p95 latency chart (canvas-rendered)
5. Severity-coded error feed
6. Session activity timeline

## Technical Decisions

- **Zero dependencies** — vanilla HTML/CSS/JS, no build step
- **Canvas for charts** — lightweight, no Chart.js overhead
- **Simulated data** — demo-ready, designed to swap in real Bridge API
- **CSS Grid layout** — responsive, collapses to single column on mobile
- **4-second refresh cycle** — balances liveness with CPU usage

## Integration Path

To wire to live data: replace `agentStates` init with `fetch('/api/bridge?type=agents')` and map response fields to the existing state schema. Lane throughput can pull from the webhook relay status endpoint (`GET http://127.0.0.1:3002/status`).

## Verdict

Prototype validates the visualization approach. Next step: embed in Command Center as a new route (`/command-center/agent-health`) and wire to real data sources.
