# Squad Status Board — YOLO Build #1

**Date:** 2026-03-02
**Agent:** Atlas (Opus 4.6)
**Status:** Working prototype

## What It Does

Single-page HTML dashboard showing all 19 agents in the Parallax squad with:
- Name, model, provider, and role for each agent
- Capability badges (Search, Vision, Scrape, Comms, Code, Files, TTS)
- Filter by Claude Max / OpenRouter / Full Capability
- Stats bar with totals
- Dark mode, ambient particles, heartbeat animations (per Parallax design rules)

## How to Run

Open `index.html` in any browser. No dependencies, no build step.

## Capability Gaps Identified

Based on agent model capabilities:
- **Image/Vision reading:** Only Claude and Gemini models have native vision. DeepSeek V3.2, Kimi K2.5, and GLM 4.6 agents lack this — they need the `image` tool routed through OpenClaw.
- **TTS:** Only Atlas, NOVA, TRIAGE have TTS access (Claude Max + OpenClaw `tts` tool).
- **All agents have:** web search, scraping, inter-agent comms, code execution, file operations via OpenClaw tools.

## What Ramon Would Change

- Connect to live agent status data (e.g., poll `openclaw status` or `sessions_list`)
- Add last activity timestamps per agent
- Add uptime/response time metrics
- Deploy to Vercel for always-on access
