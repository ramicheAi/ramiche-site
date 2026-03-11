# Command Center HQ — Project Memory

## Project Overview
- **Goal:** Replace Telegram as primary interface. Full AI team workspace with real-time chat, agent DMs, project channels, threading, side navigation.
- **White-label potential:** "Parallax HQ" — deployable workspace for any AI team.
- **Stack:** Next.js + Supabase (Realtime, DB, Auth, Storage) + Vercel
- **First customer:** Us. Second: Eric (Verified Agents). Third: Derrick.

## Architecture Decisions
- **WebSocket via Supabase Realtime** (not raw Socket.io) — managed, scales, built-in auth
- **Supabase over EC2** — simpler, cheaper at our stage, real-time built in
- **Channel-based** — per-project channels like Slack, not DM-only like Telegram
- **Agents are first-class members** — not bots. They appear in member lists, have profiles, respond in real-time.

## Key Dates
- Mar 9, 2026: Project created, Phase 1 scoped, PROXIMON + SHURI delegated
- Wed Mar 12: Atlanta lawyer meeting (Verified Agents — separate project but related)

## Inspiration
- Ramon's friend's chat app (PWA, threads, agent panels, document viewer, calendar)
- Agency-Agents repo (61 agents, structured handoffs, anti-sycophancy stances)
