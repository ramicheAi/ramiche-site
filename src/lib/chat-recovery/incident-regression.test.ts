/* CC-CHAT-MOBILE-RECOVERY-01: regression tests for the Content Team disappearance.

   Two kinds of test live here:
   - `it(...)`        evidence that the defect mechanism is real (passes today).
   - `it.fails(...)`  the CONTRACT the fix must satisfy. These fail today on purpose.
                      Vitest reports them green while they fail; the moment a fix PR
                      makes one pass, vitest turns it red so the author must flip it to
                      `it(...)`. That makes each defect impossible to "fix" silently or
                      to regress after the flip.

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

  it('chat page still queries messages and channels with the browser (anon) client', () => {
    expect(PAGE).toMatch(/import \{ supabase \} from "@\/lib\/supabase"/)
    expect(PAGE).toMatch(/\.from\("messages"\)/)
    expect(PAGE).toMatch(/\.from\("channels"\)/)
  })

  it.fails('CONTRACT: chat page reads history only through an authorized server API, never the anon client', () => {
    expect(PAGE).not.toMatch(/\.from\("messages"\)\s*\n?\s*\.select/)
    expect(PAGE).not.toMatch(/\.from\("channels"\)\s*\n?\s*\.select/)
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

  it('the exact destructure the page uses drops the error and yields "no data"', async () => {
    const { client } = stubClient(() => ({ status: 401, body: PERMISSION_DENIED_BODY }))
    // Mirrors page.tsx loadMessages: `const { data } = await sb.from("messages")...`
    const { data } = await client.from('messages').select('*').eq('channel_id', INCIDENT_CHANNEL_ID)
    const rendered = data ?? []
    expect(rendered).toEqual([]) // six persisted replies render as an empty channel
  })

  it('page destructures history and channel reads without the error field', () => {
    expect(PAGE).toMatch(/const \{ data \} = await sb\s*\n\s*\.from\("messages"\)/)
    expect(PAGE).toMatch(/const \{ data: channelsData \} = await supabase\s*\n\s*\.from\("channels"\)/)
  })

  it.fails('CONTRACT: every history/channel read inspects error and renders a typed error state', () => {
    expect(PAGE).not.toMatch(/const \{ data \} = await sb\s*\n\s*\.from\("messages"\)/)
    expect(PAGE).not.toMatch(/const \{ data: channelsData \} = await supabase/)
  })

  it('polling fallback also silently returns on error', () => {
    expect(PAGE).toMatch(/if \(error \|\| !data \|\| cancelled\) return;/)
  })
})

describe('D3 wrong conversation on restart: active channel is not durably restored', () => {
  it('startup selects the most recently active channel or a hardcoded default', () => {
    expect(PAGE).toMatch(/setActiveChannel\(\(mapped\[0\] \|\| merged\[0\]\) as Channel\)/)
    expect(PAGE).toMatch(/setActiveChannel\(DEFAULT_CHANNELS\[1\]\)/)
  })

  it('with the incident fixture, the startup rule lands on a different channel', () => {
    // Same ordering the page requests: .order("last_activity_at", { ascending: false })
    const ordered = [...incidentChannels].sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at))
    const startupPick = ordered[0]
    expect(startupPick.id).not.toBe(INCIDENT_CHANNEL_ID)
  })

  it.fails('CONTRACT: last active conversation is persisted and restored before any default', () => {
    expect(PAGE).toMatch(/(cc:lastConversation|lastActiveConversation|last_active_conversation)/)
  })

  it('send path falls back to a hardcoded channel UUID when none is active', () => {
    expect(PAGE).toMatch(/activeChannel\?\.id \|\| "22222222-2222-2222-2222-222222222222"/)
  })
})

describe('D4 no idempotency or durable acceptance on send', () => {
  it.fails('CONTRACT: POST /api/command-center/chat requires a client-generated idempotency key', () => {
    expect(CHAT_ROUTE).toMatch(/(clientMessageId|client_message_id|Idempotency-Key)/i)
  })

  it.fails('CONTRACT: an authorized history GET exists (route exposes a paginated list, not only health)', () => {
    // Today GET only reports liveness. The contract route is
    // /api/command-center/conversations/[id]/messages (see CC-CHAT-RECOVERY-CONTRACTS.md).
    const historyRoute = join(ROOT, 'src/app/api/command-center/conversations/[id]/messages/route.ts')
    expect(readdirSync(join(ROOT, 'src/app/api/command-center'))).toContain('conversations')
    expect(readFileSync(historyRoute, 'utf8')).toMatch(/export async function GET/)
  })
})

describe('D5 mobile lifecycle: no resume reconciliation', () => {
  it.fails('CONTRACT: page reconciles history on visibilitychange/pageshow (iOS bfcache, app resume)', () => {
    expect(PAGE).toMatch(/addEventListener\("pageshow"/)
    expect(PAGE).toMatch(/visibilitychange/)
  })
})
