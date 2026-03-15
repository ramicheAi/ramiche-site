# Command Center HQ — Task Board

## Phase 1: Real-Time Chat System

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 1 | Supabase project setup (DB, auth, realtime) | DONE | PROXIMON | `qkbkfsjkysdsfmhgfdoc.supabase.co` — tables + realtime enabled |
| 2 | Database schema (channels, messages, threads, members, agent_messages) | DONE | PROXIMON | channels, messages, agent_profiles tables live |
| 3 | WebSocket connection layer (Supabase Realtime subscriptions) | DONE | ATLAS | postgres_changes INSERT subscription on messages table |
| 4 | Chat UI — message list, input, typing indicator | DONE | SHURI | 1929 lines, 3-column layout, channels, DMs, threading, typing sim |
| 5 | Channel system (#general, #mettle, #parallax, #verified-agents) | DONE | ATLAS | Fetched from Supabase with DEFAULT_CHANNELS fallback |
| 6 | Threading — reply to any message, side thread | DONE | SHURI | Click message → thread panel opens with reply chain |
| 7 | Agent DM panels — click agent, direct chat | DONE | SHURI | Click agent → DM view with simulated agent replies |
| 8 | File/image attachments via Supabase Storage | DONE (UI) | ATLAS | File picker, preview thumbnails, remove. Backend storage pending |
| 9 | Side navigation (Dashboard, Chat, Agents, Projects, Settings) | DONE | ATLAS | Global nav bar matching main page style — 10 links |
| 10 | Wire OpenClaw agent responses into chat | DONE | ATLAS | DM sends POST to /api/bridge/chat → Firestore queue → agent relay. Responses via Supabase realtime. |

## Phase 2: White-Label Architecture

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 11 | Tenant config system (name, logo, colors, agents) | QUEUED | PROXIMON | |
| 12 | Multi-tenant database isolation | QUEUED | PROXIMON | |
| 13 | Stripe billing per tenant | QUEUED | SHURI | |
| 14 | White-label deployment pipeline | QUEUED | PROXIMON | |
