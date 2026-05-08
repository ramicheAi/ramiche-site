# Command Center HQ — Project Memory
*Last Updated: Apr 5, 2026*

## Project Overview
- **Goal:** Replace Telegram as primary interface. Full AI team workspace with real-time chat, agent DMs, project channels, threading, side navigation.
- **White-label potential:** "Parallax HQ" — deployable workspace for any AI team.
- **Stack:** Next.js + Supabase (Realtime, DB, Auth, Storage) + Vercel
- **First customer:** Us. Second: Eric (Verified Agents). Third: Derrick.

## Current Status
- **Phase:** Chat fully functional with search, filters, message merging
- **Latest:** Global message search, channel/agent/date filters, YOLO build serving
- **Active work:** Mobile layout, voice input, multi-agent visualizer

## Architecture Decisions
- **WebSocket via Supabase Realtime** (not raw Socket.io) — managed, scales, built-in auth
- **Supabase over EC2** — simpler, cheaper at our stage, real-time built in
- **Channel-based** — per-project channels like Slack, not DM-only like Telegram
- **Agents are first-class members** — not bots. They appear in member lists, have profiles, respond in real-time.
- **Real-time SSE** for YOLO builds, cron history, agent directory, active sessions
- **OpenClaw spec phases 1.4-4 complete** — full integration spec implemented

## Key Dates
- Mar 9, 2026: Project created, Phase 1 scoped
- Mar 18: Modern Chat UI shipped
- Mar 23-27: CC Phase 1 overhaul, real-time SSE, bridge API
- Apr 1-5: Chat search, cron calendar, YOLO build fixes
