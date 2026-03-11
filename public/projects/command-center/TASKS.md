# Command Center HQ — Task Board

## Phase 1: Real-Time Chat System

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 1 | Supabase project setup (DB, auth, realtime) | QUEUED | PROXIMON | |
| 2 | Database schema (channels, messages, threads, members, agent_messages) | QUEUED | PROXIMON | |
| 3 | WebSocket connection layer (Supabase Realtime subscriptions) | QUEUED | SHURI | Depends: #1-2 |
| 4 | Chat UI — message list, input, typing indicator | QUEUED | SHURI | Depends: #3 |
| 5 | Channel system (#general, #mettle, #parallax, #verified-agents) | QUEUED | SHURI | Depends: #4 |
| 6 | Threading — reply to any message, side thread | QUEUED | SHURI | Depends: #5 |
| 7 | Agent DM panels — click agent, direct chat | QUEUED | SHURI | Depends: #5 |
| 8 | File/image attachments via Supabase Storage | QUEUED | SHURI | Depends: #5 |
| 9 | Side navigation (Dashboard, Chat, Agents, Projects, Settings) | QUEUED | SHURI | Depends: #4 |
| 10 | Wire OpenClaw agent responses into chat | QUEUED | ATLAS | Depends: #7 |

## Phase 2: White-Label Architecture

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 11 | Tenant config system (name, logo, colors, agents) | QUEUED | PROXIMON | |
| 12 | Multi-tenant database isolation | QUEUED | PROXIMON | |
| 13 | Stripe billing per tenant | QUEUED | SHURI | |
| 14 | White-label deployment pipeline | QUEUED | PROXIMON | |
