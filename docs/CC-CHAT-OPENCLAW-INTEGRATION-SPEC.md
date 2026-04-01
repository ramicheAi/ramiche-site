# CC Chat ↔ OpenClaw Integration Spec

**Date:** 2026-03-31
**Goal:** Make CC Chat work like Telegram — real agent conversations, group chats, @mentions, message routing through OpenClaw.

---

## Current State

The CC Chat (`src/app/command-center/chat/page.tsx`, 2474 lines) has:
- 3-column layout: channels (left), messages (center), agent info (right)
- Project channels (#general, #mettle, #dev, etc.)
- Team group chats (#security-team, #finance-team, etc. with agent member lists)
- Agent DMs (1:1 with each of 19 agents)
- Supabase realtime for message persistence + sync
- An API route (`src/app/api/command-center/chat/route.ts`) that already has:
  - OpenClaw gateway integration via `src/lib/openclaw-gateway.ts`
  - `gatewaySessionsSend()` — sends to a real OpenClaw session and waits for reply
  - `gatewaySessionsSpawn()` — spawns a sub-agent
  - Fallback chain: OpenClaw → Gemini → DeepSeek → OpenRouter
  - Agent persona system with roles + styles

**What's missing:** The plumbing exists but the chat doesn't feel like Telegram because:
1. No @agent mentions that route to specific agents
2. No multi-agent group chat (only one random agent responds in team channels)
3. No typing indicators or delivery status
4. No agent-initiated messages (agents can't push messages to CC)
5. No media support (images, files, voice)
6. No reactions
7. No message threading
8. No pinned messages
9. No read receipts

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  CC Chat Frontend                         │
│  src/app/command-center/chat/page.tsx                     │
│                                                           │
│  User types message → POST /api/command-center/chat       │
│  Supabase realtime subscription ← receives all messages   │
│                                                           │
│  NEW: @mention parser → routes to specific agent(s)       │
│  NEW: typing indicator via Supabase presence              │
│  NEW: delivery status (sent/delivered/read)                │
│  NEW: reactions via Supabase                               │
│  NEW: media attachments (upload to Supabase storage)       │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│           API Route: /api/command-center/chat             │
│           src/app/api/command-center/chat/route.ts        │
│                                                           │
│  EXISTING: gatewaySessionsSend() for single agent         │
│                                                           │
│  NEW: @mention parsing → parallel gatewaySessionsSend()   │
│       to each mentioned agent                             │
│  NEW: Group channels → route to ALL members               │
│       (not random pick — let each agent decide to reply)  │
│  NEW: POST /api/command-center/chat/webhook               │
│       ← OpenClaw pushes agent messages TO the CC          │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│        OpenClaw Gateway (localhost:18789)                 │
│        src/lib/openclaw-gateway.ts                        │
│                                                           │
│  sessions_send(sessionKey, message) → agent reply         │
│  sessions_spawn(task, agentId) → new agent session        │
│  sessions_list() → active sessions                        │
│                                                           │
│  NEW: Webhook registration so agents can push to CC       │
│       (or polling via sessions_list + session history)     │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Tasks (Priority Order)

### Phase 1: Core Messaging Parity (Do First)

#### 1.1 — @Mention Routing
**File:** `src/app/command-center/chat/page.tsx`
**What:** When user types `@shuri` or `@atlas` in a message, parse the mention(s) and send to those specific agents.

- Add `parseMentions(text: string): string[]` function that extracts agent IDs from @mentions
- In the message input, show autocomplete dropdown when user types `@` (filter from the 19 agents list already defined in `DEFAULT_AGENTS` at line 137)
- On send: if mentions found, pass `mentionedAgents: string[]` to the API route
- Style mentions with agent color (use `COLORS.agents[id]`) inline in message bubbles

**File:** `src/app/api/command-center/chat/route.ts`
**What:** Accept `mentionedAgents` array. Send to each mentioned agent in parallel.

- If `mentionedAgents` provided and non-empty, send `gatewaySessionsSend()` to EACH agent
- Use `Promise.allSettled()` for parallel dispatch
- Each agent response gets its own Supabase message insert with correct `sender_agent_id`
- If no mentions and it's a DM channel, use existing single-agent logic
- If no mentions and it's a team/project channel, send to ALL channel members (not random pick)

#### 1.2 — Group Chat Multi-Agent Response
**File:** `src/app/api/command-center/chat/route.ts` (line 78-90)
**What:** Replace the random-agent-picker with parallel dispatch to all channel members.

Current code picks ONE random non-atlas member. Change to:
- For team channels: send to ALL members in parallel via `Promise.allSettled()`
- Each agent gets the full channel context: channel name, who else is in the channel, recent message history
- Each agent decides independently whether to respond (add instruction in system prompt: "Only respond if this message is relevant to your domain. If not, reply with `[NO_RESPONSE]`")
- Filter out `[NO_RESPONSE]` replies before inserting to Supabase
- This makes group chats feel natural — only relevant agents chime in

#### 1.3 — Typing Indicators
**File:** `src/app/command-center/chat/page.tsx`
**What:** Show "Agent is typing..." while waiting for OpenClaw response.

- When user sends a message, immediately show typing indicator for the target agent(s)
- Use Supabase Presence or a simple state flag (agent responses are fast, <30s typically)
- Show the agent's avatar + name + animated dots: `🟢 Shuri is typing...`
- Remove indicator when agent message arrives via Supabase realtime subscription
- If multiple agents typing (group chat), show: `Shuri, Mercury are typing...`

#### 1.4 — Delivery Status
**File:** `src/app/command-center/chat/page.tsx`
**What:** Show sent/delivered/read status on user messages (like Telegram checkmarks).

- Add `status` column to Supabase `messages` table: `sent` → `delivered` → `read`
- Single gray check = sent (inserted to Supabase)
- Double gray check = delivered (API route processed it, agent received it)
- Double blue check = read (agent responded — response message exists)
- Update via Supabase realtime when status changes

**Migration SQL:**
```sql
ALTER TABLE messages ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
```

### Phase 2: Rich Media (Do Second)

#### 2.1 — Reactions
**File:** `src/app/command-center/chat/page.tsx`
**What:** Click to react to any message. Store in Supabase.

- Long-press or hover on message shows reaction picker (emoji subset: 👍 🔥 ❤️ 🚀 👀 ✅)
- Store reactions in `message_reactions` table:
  ```sql
  CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(message_id, user_id, emoji)
  );
  ```
- Subscribe to realtime changes on `message_reactions`
- Display reaction counts below messages (current code already has reaction UI in `DEFAULT_MESSAGES` — make it real)

#### 2.2 — Media Attachments
**File:** `src/app/command-center/chat/page.tsx`
**What:** Upload images, files, screenshots to chat.

- Add paperclip icon in message input area
- Upload to Supabase Storage bucket `chat-attachments`
- Store attachment URLs in existing `attachments` JSONB column on `messages` table
- Render image previews inline, file downloads as cards
- Drag-and-drop support
- Paste from clipboard (screenshots)

#### 2.3 — Pinned Messages
**File:** `src/app/command-center/chat/page.tsx`
**What:** Pin important messages to channel header.

- Add `pinned` boolean column to `messages` table
- Right-click/long-press → "Pin message"
- Show pinned messages in a collapsible banner at top of message area
- `ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false;`

### Phase 3: Agent Push Messages (Do Third)

#### 3.1 — Webhook Endpoint for Agent → CC Messages
**File:** `src/app/api/command-center/chat/webhook/route.ts` (NEW)
**What:** OpenClaw agents can push messages to CC channels.

```typescript
// POST /api/command-center/chat/webhook
// Body: { agentId: string, channelId: string, content: string, attachments?: string[] }
// Auth: Bearer token (OPENCLAW_GATEWAY_TOKEN)
```

- Validate bearer token matches `OPENCLAW_GATEWAY_TOKEN`
- Insert message to Supabase with correct `sender_agent_id` and `channel_id`
- Supabase realtime will push to all connected CC clients automatically
- This is how agents proactively message channels (status updates, alerts, build notifications)

#### 3.2 — Agent Status Sync
**File:** `src/app/command-center/chat/page.tsx`
**What:** Show real agent status (active/idle/offline) instead of hardcoded values.

- Poll `/api/command-center/agents` every 30s (existing API route already reads `agents/directory.json`)
- Or use SSE endpoint at `/api/command-center/sse` for push updates
- Map to status dots: 🟢 active (session alive, responded <5min ago), 🟡 idle (session alive, no recent activity), ⚫ offline (no session)
- Update the agent list in left sidebar in real-time

### Phase 4: Threading & Search (Do Last)

#### 4.1 — Message Threading
- Click "Reply" on any message to start a thread
- Thread replies appear indented or in a slide-out panel
- Add `thread_parent_id UUID REFERENCES messages(id)` to messages table

#### 4.2 — Search
- Search bar at top of chat
- Full-text search across all channels via Supabase text search
- Filter by agent, channel, date range

---

## Reference: Existing Code Map

| What | Where | Notes |
|------|-------|-------|
| Chat frontend | `src/app/command-center/chat/page.tsx` (2474 lines) | 3-column layout, Supabase realtime |
| Chat API | `src/app/api/command-center/chat/route.ts` (247 lines) | Multi-provider fallback chain |
| Gateway lib | `src/lib/openclaw-gateway.ts` (161 lines) | `gatewaySessionsSend`, `gatewaySessionsSpawn` |
| Agent UUIDs | `DM_CHANNEL_MAP` in chat page.tsx line 103 | Maps agent ID → Supabase UUID |
| Agent personas | `AGENT_PERSONAS` in chat route.ts line 40 | Role + style per agent |
| Agent colors | `COLORS.agents` in chat page.tsx line 35 | Color per agent for UI |
| Default channels | `DEFAULT_CHANNELS` in chat page.tsx line 82 | Channel definitions with members |
| Supabase config | `.env.local` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | |
| OpenClaw config | `.env.local` — `OPENCLAW_GATEWAY_URL`, `OPENCLAW_GATEWAY_TOKEN` | |

## Reference: OpenClaw Gateway API

The gateway runs at `localhost:18789`. Auth: Bearer token.

**Key endpoint:** `POST /tools/invoke`
```json
{
  "tool": "sessions_send",
  "args": { "sessionKey": "main", "message": "...", "timeoutSeconds": 90 },
  "dryRun": false
}
```

**Session keys:** Map agent IDs to session keys via `OPENCLAW_AGENT_SESSION_KEYS` env var (JSON object). Default: all route to `"main"` session.

**Response format:** `{ "result": { "reply": "agent response text" } }`

## Reference: Supabase Schema

Existing `messages` table columns (inferred from code):
- `id` UUID (PK)
- `channel_id` UUID (FK to channels)
- `sender_agent_id` UUID
- `sender_type` TEXT ('agent' | 'user')
- `content` TEXT
- `tenant_id` UUID
- `attachments` JSONB
- `created_at` TIMESTAMPTZ

**New columns needed:**
```sql
ALTER TABLE messages ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS thread_parent_id UUID REFERENCES messages(id);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS mentioned_agents TEXT[];
```

**New table:**
```sql
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);
```

---

## Design Tokens (Must Match)

All UI must use the existing design tokens defined in `chat/page.tsx` lines 13-62:
- Background: `#0a0a0a` (main), `rgba(255,255,255,0.02)` (card)
- Borders: `#1e1e1e`
- Text: `#e5e5e5` (primary), `#888888` (secondary)
- Accent: `#7c3aed` (purple), `#C9A84C` (gold)
- Agent colors: Use `COLORS.agents[agentId]` for all agent-specific UI
- Font: Inter, system-ui

---

## Success Criteria

- [x] User can @mention agents and get responses from those specific agents *(API + `parseMentions`; UI passes `mentionedAgents`)*
- [x] Team channels route to all members, only relevant agents respond *(parallel `gatewaySessionsSend` / LLM chain per member; `[NO_RESPONSE]` filtered)*
- [x] Typing indicators show while waiting for agent response *(existing `waitingForResponse`; team channels show member names)*
- [x] Delivery status checkmarks on user messages *(Supabase `status` / `mark-read`; read ticks use `COLORS.accent.purpleLight`)*
- [x] Emoji reactions stored in Supabase and rendered in real-time *(`message_reactions` + `/api/command-center/chat/reactions`)*
- [x] Image/file uploads via Supabase Storage *(`/api/command-center/chat/upload`, bucket `chat-attachments`, drag/drop + paste)*
- [x] Pinned messages banner + pin/unpin *(`POST /api/command-center/chat/pin`, `pinned` column)*
- [x] Agents can push messages via webhook endpoint *(`POST /api/command-center/chat/webhook`)*
- [x] Real agent status in sidebar *(poll `GET /api/command-center/agents` every 30s; active/idle from directory)*
- [x] Thread replies + search *(`thread_parent_id`, thread panel replies, header search on current view)*
- [x] All new UI uses existing design tokens — no new colors, no dark mode changes *(no visual token changes in this pass)*

**Status file:** `docs/CC-IMPLEMENTATION-STATUS.md`
