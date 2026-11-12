# CC-CHAT-MOBILE-RECOVERY-01: Conversation Durability and Mobile Continuity

Status: test and documentation only. No production code, data, grants, policies, migrations, auth, or deploys changed.
Base: `origin/main` @ `25f1f517`. Builds on draft PR #76 (Stage 0 audit and architecture).
Regression suite: `src/lib/chat-recovery/incident-regression.test.ts` (fixture: `__fixtures__/content-team-incident.ts`).

---

## 1. Verified defects (evidence from source at base commit)

| ID | Defect | Evidence (file:line at 25f1f517) | Test |
|---|---|---|---|
| D1 | Browser reads `messages`, `channels`, `agent_profiles`, `message_reactions` with the anon client after migration `20260928120000_p05b3_cockpit_anon_lockdown` revoked all privileges from anon and authenticated. | `chat/page.tsx:7` imports `supabase`; reads at `:2218`, `:2249`, `:2308`, `:2645`; migration lines 47-50 | D1 block |
| D2 | Read errors discarded. supabase-js resolves `{data:null,error}` on 42501 (verified with an in-process fetch stub), so `try/catch` never fires and `const { data } =` renders an empty channel. Polling fallback returns silently on error. | `page.tsx:2308`, `:2218`, `:2647` | D2 block |
| D3 | Active channel not restored. Startup picks `mapped[0]` (most recent `last_activity_at`) or `DEFAULT_CHANNELS[1]`. No persisted last conversation. Send falls back to hardcoded `2222…` UUID. | `page.tsx:2242`, `:2211`, `:2245`, `:2284`, `:2834` | D3 block |
| D4 | No idempotency key, no durable acceptance, no authorized history GET (route GET is liveness only). | `api/command-center/chat/route.ts:38`, `:1064` | D4 block |
| D5 | No `pageshow` or `visibilitychange` reconciliation; iOS bfcache restore and PWA resume keep stale or empty state. | absence in `page.tsx` | D5 block |

Incident reconstruction: phone reopens, page boots, the `channels` read is denied, `channelsData` is null, the page falls back to `DEFAULT_CHANNELS[1]`, which is not Content Team. Even when Content Team is selected manually, the `messages` read is denied and renders empty. The rows were never lost; the view was.

Note: whether the live browser read is actually denied depends on whether the lockdown migration is applied to production. PR #76 Stage 0 recorded the direct reads as locked down. This suite proves the code path cannot distinguish denial from emptiness either way.

---

## 2. Failure-mode matrix

| # | Failure | Today | Required behavior | Test status |
|---|---|---|---|---|
| F1 | Denied read (401/403/42501) | Empty channel, no signal | Typed `forbidden` error state, retry, never empty | D1, D2 contracts |
| F2 | Genuinely empty history | Same render as F1 | `empty` state distinct from `error` | D2 contract |
| F3 | Wrong conversation on startup | `mapped[0]` or default | Restore order: URL > server `last_active` > local cache > most recent | D3 contract |
| F4 | Lost network on load | Silent, polling swallows | `offline` banner, cached history read-only, auto-retry with backoff | spec, needs harness |
| F5 | Failed send | Optimistic bubble, inconsistent | Bubble `failed` with retry, draft retained | D4 contract |
| F6 | Duplicate send (double tap, retry after timeout) | Two rows, two agent fan-outs | Same `clientMessageId` returns the original turn, 200 not 201 | D4 contract |
| F7 | Interrupted stream | Partial text lost | Resume from `Last-Event-ID`; else reconcile with REST | spec |
| F8 | App terminated mid-turn | Turn state lost client side | Server turn continues; reopen shows `running` or final | spec, needs device |
| F9 | Agent timeout | Whole reply fails or hangs | Per-agent `timed_out` receipt; synthesis proceeds with partial set | spec |
| F10 | Reconnect after background (iOS) | No reconcile | `pageshow`/`visibilitychange` triggers history delta fetch | D5 contract |

---

## 3. Conversation API contract (backend for frontend)

All routes server-side, service-role client, gated by the existing Command Center session check. Browser never touches private tables.

### `GET /api/command-center/conversations`
- Query: `cursor?` (opaque), `limit` (1-100, default 50), `type?` (`team|project|dm`).
- Membership: return only conversations where the caller is a member, or founder role. Teams with zero `channel_members` rows (state recorded 2026-11-08) need a founder-access rule, not silent fallback.
- 200: `{ items: [{ id, slug, type, title, lastMessageAt, lastSeq, unreadCount, readCursorSeq }], nextCursor, serverLastActiveId }`.

### `GET /api/command-center/conversations/{id}/messages`
- Query: `before?` / `after?` (server `seq`), `limit` (1-200, default 50). `after` is the reconnect delta path.
- Ordering: by server `seq` (monotonic per conversation), never by client clock.
- 200: `{ items: [{ id, seq, clientMessageId?, senderType, senderId, content, status, turnId?, createdAt }], hasMore, latestSeq }`.

### Typed errors (all routes)
`{ error: { code, message, retryable } }` with codes: `unauthenticated` 401, `forbidden` 403, `not_found` 404 (also returned for non-member to avoid enumeration), `invalid_cursor` 400, `rate_limited` 429, `upstream_unavailable` 503. The UI maps each to a distinct state; none renders as empty.

### `POST /api/command-center/conversations/{id}/messages`
- Body: `{ clientMessageId (uuid v4, required), content, threadParentId? }`, header `Idempotency-Key` equal to `clientMessageId`.
- Transaction: insert message (unique `(conversation_id, client_message_id)`), allocate `seq`, insert `turn` (`accepted`), insert `outbox` row. Commit, then respond `202 { messageId, seq, turnId, status:"accepted" }`.
- Replay of an existing key: `200` with the original body. Key reused with different content: `409 idempotency_conflict`.
- Dispatch is by outbox worker, never inline in the request, so a dropped client connection cannot orphan a turn.

### `POST /api/command-center/turns/{turnId}/cancel`
Sets `cancel_requested`; agents check between steps; terminal state `cancelled` with receipts for whatever finished.

### `PUT /api/command-center/conversations/{id}/read-cursor`
Body `{ seq }`; monotonic (server keeps max). Drives unread counts across devices.

---

## 4. Client state survival (restart and device change)

| State | Store | Restore rule |
|---|---|---|
| Last active conversation | Server `user_preferences.last_active_conversation_id` (written on switch, debounced 1s) plus `localStorage cc:lastConversation` | URL `?c=` > server > local > most recent. Never a hardcoded id. |
| Drafts | `localStorage cc:draft:{conversationId}` (text, updatedAt) | Restored on open; cleared only after `202 accepted`. Device change: not synced (v1), documented. |
| Unsent message | `localStorage cc:outbox` (clientMessageId, payload) | Resent on resume with same key; idempotency makes it safe. |
| Scroll position | `sessionStorage cc:scroll:{id}` anchored to message `seq`, not pixels | Restore to anchor; if new messages arrived, show "N new" pill. |
| Read cursor | Server | Fetched with conversation list. |
| Unfinished turns | Server `turns` table | On open, `GET messages` includes turn status; open SSE with `after=latestSeq`. |

All storage access wrapped in try/catch (Safari private mode throws). Storage failure degrades to server state, never to wrong conversation.

---

## 5. Agent turn state machine

```
accepted -> routing -> dispatched -> (per agent: pending -> running -> succeeded | failed | timed_out | cancelled)
         -> synthesizing -> verifying -> completed
                                      -> completed_partial   (>=1 agent failed/timed out, synthesis ran)
         -> failed            (routing error, or zero agents succeeded)
         -> cancelled         (cancel_requested observed)
```

- Routing receipt (persisted before dispatch): `{ turnId, routerVersion, selectedAgents[], reason, contextRevision }`. Makes "why did these six agents reply" answerable.
- Canonical context revision: hash of (conversation `seq` cutoff, system prompt version, memory snapshot id). Every agent in a turn receives the same revision; a late agent never sees messages from after the cutoff.
- Agent receipt: `{ agentId, status, startedAt, endedAt, attempt, error?, messageId? }`. Timeout default 90s, one retry for retryable errors, then `timed_out`.
- Synthesis runs on the succeeded set; verification checks synthesis cites only succeeded agents. Partial failure is surfaced in UI as "5 of 6 agents replied", never hidden.
- Outbox: at-least-once delivery; workers dedupe on `(turnId, agentId, attempt)`.

---

## 6. Resumable SSE

- `GET /api/command-center/conversations/{id}/events?after={seq}`; also honors `Last-Event-ID`.
- Every event carries `id: {seq}:{subseq}`. Types: `message.created`, `turn.status`, `agent.status`, `agent.delta`, `heartbeat` (every 15s; iOS and proxies drop idle streams).
- Server buffers events per conversation for at least 10 minutes. If the requested id is older than the buffer, send `reset` and the client refetches REST `after=latestSeq`.
- Reconciliation rule: REST history is the source of truth; SSE is a hint. Merge by `seq`, dedupe by `id` and `clientMessageId`. Delta text is discarded once the final `message.created` arrives.
- Realtime via anon key is retired (anon receives nothing once SELECT is revoked, per migration header).

---

## 7. Mobile interaction specification

| Area | Requirement |
|---|---|
| Viewport | Root height `100dvh` with `100vh` fallback; no fixed `100vh` containers. |
| Safe area | `viewport-fit=cover`; composer padding `env(safe-area-inset-bottom)`; header `env(safe-area-inset-top)` in standalone PWA. |
| Keyboard | iOS: use `visualViewport` resize to keep composer above keyboard; scroll last message into view on focus. Android Chrome: `interactive-widget=resizes-content`. Input font-size >= 16px to stop iOS zoom. |
| Lifecycle | `visibilitychange` hidden: flush draft, close SSE. Visible: refetch `after=latestSeq`, reopen SSE. `pageshow` with `persisted=true` (bfcache): same as visible. `pagehide`: flush outbox to storage. |
| Offline | `navigator.onLine` plus failed fetch: banner, composer queues to outbox, history read-only from last fetch. |
| Installed PWA | iOS standalone has separate storage from Safari: server-side last conversation is mandatory, not optional. Service worker must not cache API responses (`/api/*` network-only). |
| Accessibility | Message list `role="log"` `aria-live="polite"`; error and offline states announced; tap targets >= 44px; respects reduced motion. |

---

## 8. Phone to desktop to phone acceptance matrix

Each row passes on iPhone Safari, iPhone installed PWA, Android Chrome, and desktop Chrome.

| # | Step | Expected |
|---|---|---|
| A1 | Phone: open Content Team, send message | `accepted` within 1s; bubble shows sent |
| A2 | Phone: force-quit app during agent replies | Server turn continues |
| A3 | Desktop: open Command Center | Lands on Content Team (server last active); sees user message and all completed replies in `seq` order |
| A4 | Desktop: switch to another channel, send | Last active becomes that channel |
| A5 | Phone: reopen | Lands on desktop's last active channel; Content Team unread count correct; history intact |
| A6 | Phone: open Content Team | All 7 messages present; no duplicates |
| A7 | Phone: airplane mode, type and send | Draft kept, queued, banner shown |
| A8 | Phone: reconnect | Queued send delivered once (same clientMessageId) |
| A9 | Phone: background 10 min, foreground | Delta fetch; no missing or duplicate messages |
| A10 | Revoke membership for a test user | List omits conversation; direct GET returns 404; UI shows typed error, not empty |
| A11 | Denied read injected | UI shows `forbidden` state with retry; never empty history |
| A12 | One agent forced to time out | Turn `completed_partial`, UI shows 5 of 6 |

---

## 9. Implementation PR sequence (smallest slices first)

| PR | Scope | Depends on | Flips contract |
|---|---|---|---|
| R1 | Read BFF: `GET conversations`, `GET messages` (service role, session gated, typed errors). No schema change; uses existing tables and `created_at` ordering as interim `seq`. | none | D1 history route |
| R2 | Page reads through R1; typed `error`/`empty`/`offline` states; remove anon reads of private tables. | R1 | D1, D2 |
| R3 | Last active restore (URL, local, then server once R5), remove hardcoded send fallback. | R2 | D3 |
| R4 | Lifecycle reconcile on `pageshow`/`visibilitychange`, dvh and safe-area layout. | R2 | D5 |
| R5 | Migration (needs approval): `seq`, `client_message_id` unique, `turns`, `agent_receipts`, `outbox`, `user_preferences`, `read_cursors`. | approval | none |
| R6 | Durable send: idempotent POST, transactional accept, outbox worker. | R5 | D4 |
| R7 | Turn state machine, routing receipts, context revision, partial failure. Splits the 1,574-line chat route. | R6 | none |
| R8 | Resumable SSE with replay buffer; retire anon Realtime. | R6 | none |

R1 to R4 restore visibility with zero schema change. R5 onward establishes durable execution.

---

## 10. Readiness report

Run in an isolated worktree on branch `test/cc-chat-mobile-recovery-01` from `origin/main` @ `25f1f517`. Results are listed in the PR body.

Verified: defects D1 to D5 exist in source; supabase-js returns rather than throws on 42501 (stubbed fetch, no network); the fixture's startup ordering selects a non-incident channel.

Not verified here: production grant state (read-only check would need a Supabase query; not run to stay off production); real-device behavior; SSE behavior through the Cloudflare tunnel.

## 11. Explicit blockers

1. Real iPhone Safari and installed PWA run of matrix A1 to A12: needs an authenticated device session.
2. Migration R5: needs founder approval and a non-production Supabase branch to test against.
3. Membership policy for team channels with zero `channel_members` rows: product decision (founder-only access vs. seeding membership).
4. Confirmation of which lockdown state is live in production: read-only check, needs authorization to query.
5. Overlap check with Tracks A and B before R1 lands (both touch Command Center routes).
