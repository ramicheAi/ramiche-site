# Command Center Chat — Deployment Checklist

Companion to `CC-CHAT-OPENCLAW-INTEGRATION-SPEC.md`. This file lists the env
vars and Supabase configuration that must be in place for the chat system and
the OpenClaw gateway controls to work end-to-end.

## Vercel environment variables

Set every variable below in **Vercel → Project → Settings → Environment
Variables** (Production + Preview). Anything marked `client` is also exposed
to the browser (any `NEXT_PUBLIC_*` is).

| Var | Scope | Required | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client | yes | `https://<project>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | yes | RLS-restricted reads only |
| `SUPABASE_SERVICE_ROLE_KEY` | server | yes | Used by `/api/command-center/chat`, `/chat/stream`, `/chat/reactions` for **all** writes — bypasses RLS |
| `OPENCLAW_GATEWAY_URL` | server | yes (for live agents) | Public/tunnel URL of OpenClaw, e.g. `https://command.parallaxvinc.com` — never `127.0.0.1` from Vercel |
| `OPENCLAW_GATEWAY_TOKEN` | server | yes | Bearer token. `OPENCLAW_GATEWAY_PASSWORD` is also accepted as a fallback |
| `OPENCLAW_CHAT_SESSION_KEY` | server | optional | Default OpenClaw session key, e.g. `main` |
| `OPENCLAW_AGENT_SESSION_KEYS` | server | optional | JSON: `{"atlas":"main","shuri":"agent::shuri"}`. `*` is a wildcard fallback |
| `OPENCLAW_CHAT_STRICT` | server | optional | `1` to disable Gemini/DeepSeek/OpenRouter fallbacks |
| `OPENCLAW_CC_WEBHOOK_TOKEN` | server | optional | Required if `/api/command-center/chat/webhook` is enabled |
| `GEMINI_API_KEY` | server | optional | Used only when strict mode is off and OpenClaw didn't reply |
| `DEEPSEEK_API_KEY` | server | optional | ↑ |
| `OPENROUTER_API_KEY` | server | optional | ↑ |

After updating env vars, **redeploy** — Vercel does not hot-swap them into
running serverless functions.

## Supabase schema

Run the SQL in `docs/supabase-cc-chat-migrations.sql` against the project's
Postgres. Then verify in the dashboard:

1. **Database → Replication** — enable Realtime on `messages` **and**
   `message_reactions`. Without this, the chat UI's `RealtimeBadge` will
   stick at "Connecting…" then fall back to "Realtime error".
2. **Authentication → Policies** — RLS state on `messages` and
   `message_reactions`:
   - `anon` role: `SELECT` policy that returns rows for the channels the user
     is allowed to see. The chat UI reads with the anon key.
   - `service_role` role: full read/write (this is automatic — the service
     role bypasses RLS).
   - The chat API never writes with the anon key, so you do **not** need an
     anon `INSERT` policy.
3. **Storage** — bucket `chat-attachments` set to **Public** so the upload
   endpoint can return public URLs.

## Required `messages` columns

The chat code expects every column in the migration file. The newer ones the
fixes in this branch rely on:

- `status` (`text`, default `'sent'`) — `'sent' | 'delivered' | 'read' | 'failed'`
- `delivered_at` (`timestamptz`)
- `thread_parent_id` (`uuid`, FK → `messages.id`)
- `pinned` (`boolean`, default `false`)
- `attachments` (`jsonb`)
- `tenant_id` (`text`, default `'11111111-1111-1111-1111-111111111111'`)

If any are missing, agent inserts will silently fail server-side — check
Vercel function logs for `[chat] agent reply insert failed`.

## Smoke test

After deploying:

1. Open `/command-center/chat` in incognito.
2. Watch the channel header — the `RealtimeBadge` should go **CONNECTING
   → LIVE** within ~2s.
3. Send a message in `general`.
4. Confirm the user message gets `✓` (sent) immediately and `✓✓` (delivered)
   within seconds.
5. Confirm an agent reply appears.
6. If anything is misconfigured, you'll see a red bubble under the failing
   message instead of silence.

## OpenClaw gateway controls

`/command-center/settings → System` polls
`GET /api/command-center/settings` every 30s for the gateway-health
indicator. It's green only when both:

- `OPENCLAW_GATEWAY_URL` + `OPENCLAW_GATEWAY_TOKEN` are set, and
- `POST {url}/tools/invoke` with `{ tool: "gateway", action: "status" }`
  returns 200.

The control buttons (`restart-gateway`, `reload-crons`, `sessions-list`,
`agents-list`, `cron-list`, `run-doctor`) call the same endpoint with
different `action` values; all of them require the gateway to be reachable.
`restart-gateway` is rate-limited to once per 60 seconds.

## What changed in this branch

- All server-side chat inserts now use `SUPABASE_SERVICE_ROLE_KEY` so RLS on
  `messages` cannot reject them.
- Fallback timeouts: 30s each (was 15-20s) — Gemini/DeepSeek/OpenRouter now
  have actual time to respond before bailing.
- New SSE endpoint `POST /api/command-center/chat/stream` for incremental
  responses. Chat UI can switch from the non-stream endpoint by reading
  `response.body` as a stream and parsing `event: chunk` / `event: done`.
- `/api/command-center/settings` no longer shells out to the `openclaw` CLI;
  every action goes through `gatewayToolsInvoke()` over HTTP, so it works
  from Vercel.
- Chat UI now shows a Supabase-Realtime status pill in the header and a
  red error bubble below user messages when relay fails.
