/* CC-CHAT-MOBILE-RECOVERY-01 / CC-RECOVERY-INTEGRATION-01: regression tests for
   the Content Team disappearance.

   Two kinds of test live here:
   - `it(...)`        evidence that a defect mechanism is real, or (once fixed)
                      the CONTRACT the fix satisfies — flipped from `it.fails`
                      the moment the fix landed, per this suite's own rule.
   - `it.fails(...)`  a CONTRACT not yet satisfied. Fails today on purpose; the
                      moment a fix makes one pass, vitest turns it red so the
                      author must flip it to `it(...)`. That makes a defect
                      impossible to "fix" silently or regress after the flip.

   D1 (server-authorized reads), D2 (explicit error state) and D3 (persisted
   conversation, no hardcoded fallback) are FIXED as of CC-RECOVERY-INTEGRATION-01
   and flipped below. D4 (idempotency) and D5 (mobile lifecycle reconciliation)
   remain open `it.fails` contracts — deliberately not attempted in this PR.

   Nothing here touches the network or a real Supabase project. The supabase-js client
   is driven by an in-process fetch stub; the source checks read files from the repo. */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  INCIDENT_CHANNEL_ID,
  incidentChannels,
  incidentMessages,
  PERMISSION_DENIED_BODY,
} from './__fixtures__/content-team-incident'

const ROOT = process.cwd()
const PAGE = readFileSync(join(ROOT, 'src/app/command-center/chat/page.tsx'), 'utf8')
const CHAT_ROUTE = readFileSync(join(ROOT, 'src/app/api/command-center/chat/route.ts'), 'utf8')
const MIGRATIONS_DIR = join(ROOT, 'supabase/migrations')

/** supabase-js client whose every request is answered by `respond`. Never leaves the process. */
function stubClient(respond: (url: string) => { status: number; body: unknown }) {
  const calls: string[] = []
  const fetchStub: typeof fetch = async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    calls.push(url)
    const { status, body } = respond(url)
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }
  const client = createClient('http://stub.invalid', 'anon-test-key', {
    global: { fetch: fetchStub },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return { client, calls }
}

describe('fixture integrity (structure of the incident, no private content)', () => {
  it('has one user message and six agent replies in the incident channel', () => {
    const rows = incidentMessages.filter((m) => m.channel_id === INCIDENT_CHANNEL_ID)
    expect(rows.filter((m) => m.sender_type === 'user')).toHaveLength(1)
    expect(rows.filter((m) => m.sender_type === 'agent')).toHaveLength(6)
    expect(rows.every((m) => m.content.startsWith('[synthetic'))).toBe(true)
  })

  it('incident channel is NOT the most recently active channel (so mapped[0] picks another one)', () => {
    const sorted = [...incidentChannels].sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at))
    expect(sorted[0].id).not.toBe(INCIDENT_CHANNEL_ID)
  })
})

describe('D1 denied read: browser reads private tables that are locked down', () => {
  it('lockdown migration revokes anon/authenticated privileges on messages and channels', () => {
    const sql = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
      .join('\n')
    expect(sql).toMatch(/revoke all on table\s+public\.messages,\s*public\.message_reactions,\s*public\.channels/i)
    expect(sql).toMatch(/from anon, authenticated/i)
  })

  // FIXED (CC-RECOVERY-INTEGRATION-01, R1): the chat page no longer reads
  // messages/channels directly with the anon Supabase client. It calls the
  // owner-gated server routes below, which use the service-role client.
  it('CONTRACT: chat page reads history only through an authorized server API, never the anon client', () => {
    expect(PAGE).not.toMatch(/\.from\("messages"\)\s*\n?\s*\.select/)
    expect(PAGE).not.toMatch(/\.from\("channels"\)\s*\n?\s*\.select/)
    expect(PAGE).toMatch(/fetch\(\s*`\/api\/command-center\/conversations\/\$\{channelId\}\/messages/)
    expect(PAGE).toMatch(/fetch\("\/api\/command-center\/channels"/)
  })
})

describe('D2 swallowed error: a denied read is indistinguishable from empty history', () => {
  it('supabase-js resolves (does not throw) on 42501, so try/catch never fires', async () => {
    const { client, calls } = stubClient(() => ({ status: 401, body: PERMISSION_DENIED_BODY }))
    const result = await client.from('messages').select('*').eq('channel_id', INCIDENT_CHANNEL_ID)
    expect(calls).toHaveLength(1)
    expect(result.data).toBeNull()
    expect(result.error?.code).toBe('42501')
  })

  it('the exact destructure the page used to use drops the error and yields "no data" (still true of the raw anon client)', async () => {
    const { client } = stubClient(() => ({ status: 401, body: PERMISSION_DENIED_BODY }))
    // This is exactly why the page no longer destructures the anon client this way.
    const { data } = await client.from('messages').select('*').eq('channel_id', INCIDENT_CHANNEL_ID)
    const rendered = data ?? []
    expect(rendered).toEqual([]) // would render six persisted replies as an empty channel
  })

  // FIXED (CC-RECOVERY-INTEGRATION-01, R2): a failed/denied history or
  // channel-list request sets `historyError` and renders an explicit banner
  // (see the `historyError &&` block above the messages container), instead
  // of being coerced into "no messages."
  it('CONTRACT: every history/channel read inspects error and renders a typed error state', () => {
    expect(PAGE).toMatch(/setHistoryError\(/)
    expect(PAGE).not.toMatch(/const \{ data \} = await sb\s*\n\s*\.from\("messages"\)/)
    expect(PAGE).not.toMatch(/const \{ data: channelsData \} = await supabase\s*\n\s*\.from\("channels"\)/)
  })
})

describe('D3 wrong conversation on restart: active channel is not durably restored', () => {
  it('with the incident fixture, the "most recently active" rule alone would land on a different channel', () => {
    // Same ordering the page requests: .order("last_activity_at", { ascending: false }).
    // This is exactly why "most recent" can never be the ONLY rule — it's the
    // reason persisted restoration (the fix below) has to run first.
    const ordered = [...incidentChannels].sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at))
    const startupPick = ordered[0]
    expect(startupPick.id).not.toBe(INCIDENT_CHANNEL_ID)
  })

  // FIXED (CC-RECOVERY-INTEGRATION-01, R3): the last channel the owner was
  // actually on is persisted to localStorage on every select and restored
  // on load, before falling back to "most recent" or a hardcoded default.
  it('CONTRACT: last active conversation is persisted and restored before any default', () => {
    expect(PAGE).toMatch(/(cc:lastConversation|lastActiveConversation|last_active_conversation)/)
    expect(PAGE).toMatch(/readLastConversationId\(\)/)
    expect(PAGE).toMatch(/writeLastConversationId\(/)
  })

  it('send path no longer falls back to a hardcoded channel UUID when none is active', () => {
    expect(PAGE).not.toMatch(/activeChannel\?\.id \|\| "22222222-2222-2222-2222-222222222222"/)
  })
})

describe('D4 no idempotency or durable acceptance on send', () => {
  // Still open: POST /api/command-center/chat (the agent-relay route) has no
  // client-generated idempotency key. Out of this PR's R1-R4 scope.
  it.fails('CONTRACT: POST /api/command-center/chat requires a client-generated idempotency key', () => {
    expect(CHAT_ROUTE).toMatch(/(clientMessageId|client_message_id|Idempotency-Key)/i)
  })

  // FIXED (CC-RECOVERY-INTEGRATION-01, R1): the authorized history route now
  // exists with a real GET, exposing a paginated list — not just liveness.
  // (The original regex, `/export async function GET/`, would never match
  // the shipped `export const GET = ownerOnly(...)` shape even though the
  // route is real; fixed to check the actual shape rather than one literal
  // export style — independent review finding.)
  it('CONTRACT: an authorized history GET exists (route exposes a paginated list, not only health)', () => {
    const historyRoute = join(ROOT, 'src/app/api/command-center/conversations/[id]/messages/route.ts')
    expect(readdirSync(join(ROOT, 'src/app/api/command-center'))).toContain('conversations')
    const routeSrc = readFileSync(historyRoute, 'utf8')
    expect(routeSrc).toMatch(/async function GET_handler/)
    expect(routeSrc).toMatch(/export const GET = ownerOnly\(GET_handler\)/)
    expect(routeSrc).toMatch(/\.limit\(/) // paginated, not a liveness-only stub
  })
})

describe('D5 mobile lifecycle: no resume reconciliation', () => {
  it.fails('CONTRACT: page reconciles history on visibilitychange/pageshow (iOS bfcache, app resume)', () => {
    expect(PAGE).toMatch(/addEventListener\("pageshow"/)
    expect(PAGE).toMatch(/visibilitychange/)
  })
})

describe('D6 conversation switching must not race (CC-RECOVERY-INTEGRATION-01 pre-merge review)', () => {
  // FIXED: a slow history fetch for a channel the owner has already switched
  // away from used to be able to land late and overwrite the NOW-active
  // channel's messages, because the loadMessages effect had no cleanup/
  // cancellation guard at all. Verified by code shape here (the effect is
  // 6000+ lines deep in a client component, which this repo's own convention
  // for this file tests by source inspection, not by mounting it — see the
  // D1-D5 contracts above).
  it('CONTRACT: the history-loading effect cancels itself when the channel/agent changes again before it resolves', () => {
    const loadMessagesEffect = PAGE.slice(
      PAGE.indexOf('Guards against a slow fetch for a channel the owner has already'),
      PAGE.indexOf('}, [activeChannel, activeAgent, viewMode]);') + 1
    )
    expect(loadMessagesEffect).toMatch(/let cancelled = false/)
    expect(loadMessagesEffect).toMatch(/if \(cancelled\) return/)
    expect(loadMessagesEffect).toMatch(/return \(\) => \{\s*cancelled = true;\s*\}/)
  })
})

describe('D7 failed send must not vanish silently (CC-RECOVERY-INTEGRATION-01 pre-merge review)', () => {
  // FIXED: a failed POST (expired session, 401/403, network error) used to
  // remove the optimistic bubble and log only to console.error — the owner
  // saw their message and composer go empty with zero on-screen trace it
  // was never persisted. Same silent-failure class as the incident this
  // whole recovery effort exists to close.
  it('CONTRACT: a failed send surfaces relayError instead of discarding the message with console.error only', () => {
    const sendFailureBranch = PAGE.slice(
      PAGE.indexOf('if (sendError || !inserted?.id) {'),
      PAGE.indexOf('const realId = inserted.id;')
    )
    expect(sendFailureBranch).not.toMatch(/setMessages\(\(prev\) => prev\.filter\(\(m\) => m\.id !== tempId\)\)/)
    expect(sendFailureBranch).toMatch(/setRelayError\(/)
  })
})

describe('D8 chat send idempotency (CC-RECOVERY-DELIVERY-CONVERGENCE-01)', () => {
  // The message-persistence half (unique constraint + replay lookup + 409 on
  // key reuse with a different payload, scoped per-channel) is proven in
  // src/app/api/command-center/conversations/[id]/messages/route.test.ts.
  // The agent-dispatch half (exactly-once relay claim) is proven in
  // src/app/api/command-center/chat/relay-claim.test.ts. This proves the
  // client generates and sends a stable per-attempt key, and — corrected
  // after independent review — always calls the relay regardless of replay,
  // since "replay" only means the ROW wasn't duplicated, not that the agent
  // was already dispatched (that de-dup is now the server's job).
  it('CONTRACT: a stable clientMessageId is generated once and sent on every send attempt', () => {
    expect(PAGE).toMatch(/const clientMessageId = crypto\.randomUUID\(\)/)
    expect(PAGE).toMatch(/clientMessageId,/)
  })

  it('CONTRACT: the relay is always dispatched on a successful send, replay or not — dedup lives server-side', () => {
    const sendSuccessBranch = PAGE.slice(
      PAGE.indexOf('const realId = inserted.id;'),
      PAGE.indexOf('} else {\n      lastPendingUserMessageIdRef.current = null;')
    )
    expect(sendSuccessBranch).not.toMatch(/isReplay/)
    expect(sendSuccessBranch).toMatch(/runRelay\(realId\)/)
  })
})

describe('Cross-device restoration — explicitly pending, not claimed', () => {
  it('CONTRACT: the persisted-conversation mechanism is browser localStorage, not a cross-device/server-side preference', () => {
    // D3's fix is real but scoped to ONE browser: it reads/writes
    // localStorage, which never syncs across devices or browser profiles.
    // A second device/browser restores "most recently active" the same way
    // it always did. That gap is real and intentionally not closed here —
    // closing it needs a durable, server-side "last viewed conversation"
    // record per owner, which is a feature, not this PR's R1-R4 scope.
    expect(PAGE).toMatch(/localStorage\.getItem\(LAST_CONVERSATION_KEY\)/)
    expect(PAGE).toMatch(/localStorage\.setItem\(LAST_CONVERSATION_KEY/)
  })
})
