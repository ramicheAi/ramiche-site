# PARALLAX // Agent Session Analytics

Real-time dashboard visualising the 19-agent fleet's session metrics: token usage, response latency, success/failure rates, cost tracking with arbitrage analysis, throughput timeline, and system alerts.

## How to Run

Open `index.html` in any browser. No build step, no dependencies.

## Features

- **KPI strip:** Active sessions, total tokens, avg latency, success rate, estimated cost, uptime
- **Agent fleet table:** All 19 agents with model, status, sessions, tokens, latency, success %, cost, efficiency score
- **Token usage by provider:** Claude Max vs OpenRouter vs Ollama bar comparison
- **Latency distribution:** Histogram across 7 buckets (<500ms to 60s+)
- **Cost breakdown:** Equivalent API cost vs actual Claude Max subscription cost, with daily arbitrage savings
- **Token burn ring:** Doughnut chart showing per-provider token consumption rate
- **Throughput timeline:** 24h request volume with overnight build cycle patterns
- **System alerts:** Error/warning/info feed with agent-specific diagnostics

## What's Missing / Next Steps

- Wire to real OpenClaw session data via `sessions_list` API
- Add historical trend comparison (day-over-day, week-over-week)
- Agent drill-down view (click agent → session history)
- Export to CSV/JSON for external analysis
