# Command Center — Implementation Status

**Last updated:** 2026-04-01  
**Scope:** Tracks delivery against `CC-IMPLEMENTATION-DOC.md`, `public/projects/command-center/CC-AUDIT-FIXES.md`, and `docs/CC-CHAT-OPENCLAW-INTEGRATION-SPEC.md`.

---

## Completed in repo (this pass)

| Area | What shipped |
|------|----------------|
| **CC Chat ↔ OpenClaw** | `@` mention parsing (`src/lib/chat-routing.ts`); POST `/api/command-center/chat` dispatches **all** team/project channel members in parallel (no random single agent); optional `mentionedAgents` overrides; `[NO_RESPONSE]` filter for group replies; combined `responses` array + legacy `response` string; optional `threadParentId` on relay so agent replies persist as thread children. |
| **Agent → CC** | `POST /api/command-center/chat/webhook` — Bearer `OPENCLAW_CC_WEBHOOK_TOKEN` or `OPENCLAW_GATEWAY_TOKEN`; inserts Supabase messages (use `SUPABASE_SERVICE_ROLE_KEY` if RLS blocks anon). |
| **Supabase DDL** | `docs/supabase-cc-chat-migrations.sql` — optional columns + `message_reactions` + Storage bucket note for `chat-attachments` (apply manually in Supabase). |
| **Docs library** | Single source `src/data/cc-documents.ts`; `GET /api/command-center/docs`. |
| **Revenue** | `GET /api/command-center/revenue` re-exports Stripe payload; revenue page shows **live MRR / ARR / 30d / active subs** when `STRIPE_SECRET_KEY` is set. |
| **Legal / Security** | `src/data/legal-status.ts`, `src/data/security-status.ts` — pages import these (no stale inline-only blocks for threats/IP). |
| **Chat UI** | Typing indicator uses **all channel member names** on team channels; sends `mentionedAgents` from parsed `@` handles. |
| **Phase 1.4 delivery** | User rows: `status` / `delivered_at` / `read`; ticks use design tokens; `mark-read` when first agent reply arrives; API fallback path also calls `mark-read`. |
| **Phase 2.1 reactions** | `POST /api/command-center/chat/reactions`; picker + realtime (`message_reactions`). |
| **Phase 2.2 media** | `POST /api/command-center/chat/upload` → Supabase Storage `chat-attachments`; composer drag/drop + paste; `attachments` JSONB on insert; inline previews in bubbles. |
| **Phase 2.3 pins** | `POST /api/command-center/chat/pin`; collapsible pinned banner; hover Pin/Unpin; realtime `messages` UPDATE for `pinned`. |
| **Phase 3.2 agent status** | Poll `GET /api/command-center/agents` every 30s; map `dr-strange` → `drstrange`; refresh sidebar `active` / `idle`. |
| **Phase 4** | `thread_parent_id` on user + agent messages; thread panel lists replies; main timeline hides thread children; header **Search messages** filters current channel/DM. |

---

## Intentionally not done here (requires local machine, external product, or long build)

These remain from `CC-IMPLEMENTATION-DOC.md`: full calendar ↔ `jobs.json` editing, Apple Calendar sync, ClawGuard Pro scan binary, Bambu/MQTT fabrication, EAS/App Builder production pipeline, Parallax-site Firestore intake, YOLO → Firestore migration of all build artifacts, `openclaw gateway restart` from Vercel (local-only), full observatory historical charts, agent avatar asset generation, etc.

---

## Audit fix list (`CC-AUDIT-FIXES.md`) mapping

- **Revenue / docs APIs:** `revenue` + `docs` routes and data modules are in place; activity API already existed.  
- **Legal / security JSON:** Implemented as **TypeScript modules** under `src/data/` (preferred over loose JSON files).  
- **Office / main dashboard / vitals / fabrication / tasks / nerve-center:** Partially addressed in earlier commits; re-run audit in UI to confirm.  
- **Settings / terminal / YOLO approve → agent ping:** Need tunnel + gateway; not fully automatable from Vercel-only.

---

## How to validate

1. `npm run typecheck` && `npm test`  
2. Chat: send in `#security-team` — multiple agents may reply (or `[NO_RESPONSE]`); DM unchanged.  
3. `curl -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN" -X POST .../api/command-center/chat/webhook -d '{"agentId":"atlas","channelId":"22222222-2222-2222-2222-222222222222","content":"test"}'`  
4. Revenue page with Stripe key: banner shows non-zero or explicit fallback.
