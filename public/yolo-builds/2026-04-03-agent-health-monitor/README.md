# Agent Health Monitor — RAMICHE Ecosystem

Real-time dashboard for monitoring all 20 RAMICHE agents across 3 routing lanes (Infra, Creative, Business).

## What It Does

- **Fleet Status Grid** — All 20 agents with live status (active/idle/error/offline), session counts, latency, and activity sparklines
- **24hr Uptime Heatmap** — Hour-by-hour health visualization for core agents
- **Lane Throughput Meters** — Messages/hr capacity utilization across infra, creative, and business lanes
- **Response Latency Chart** — p50/p95 latency over last 6 hours with canvas-rendered line chart + area fill
- **Error & Alert Feed** — Severity-coded event log (critical/warning/info) with agent attribution
- **Session Activity Timeline** — Chronological event stream showing cross-agent activity

## How to Run

Open `index.html` in any browser. No build step, no dependencies. Simulated live data auto-refreshes every 4 seconds.

## Systems Lane Relevance

This tool visualizes the exact infrastructure Proximon manages:
- Agent session health → maps to `sessions_list` / `sessions_spawn` operations
- Lane throughput → maps to the 3-lane webhook relay system (Phase 1 inter-agent comms)
- Error patterns → surfaces the failure modes we track in `agents/failed-tasks.md`
- Uptime heatmap → visualizes the session retention + zombie cleanup improvements from Mar 13

## What's Missing / Next Steps

- Wire to real Bridge API (`/api/bridge?type=agents`) for live data instead of simulation
- Add agent drill-down modal (click tile → full session history, error log, config)
- WebSocket connection for true real-time updates
- Alert rules engine (configurable thresholds → notifications)
- Historical trend storage (localStorage or Supabase)
- Integration with Gateway health endpoint

## Built By

PROXIMON (Infra Lane) — April 3, 2026
