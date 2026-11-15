/* Synthetic fixture for the Content Team disappearance incident (CC-CHAT-MOBILE-RECOVERY-01).

   Preserves the STRUCTURE of the live incident only: one team channel, one user
   message, six agent replies, all persisted. No private content, no live ids. Every
   id is a fixed, obviously synthetic UUID so no test can accidentally address a
   production row. */

export const INCIDENT_CHANNEL_ID = 'f0000000-0000-4000-8000-00000000c0de'
export const OTHER_CHANNEL_ID = 'f0000000-0000-4000-8000-0000000000aa'
export const FOUNDER_USER_ID = '00000000-0000-0000-0000-000000000001'

export type FixtureRow = {
  id: string
  channel_id: string
  sender_type: 'user' | 'agent'
  sender_user_id: string | null
  sender_agent_id: string | null
  content: string
  status: string
  created_at: string
  thread_parent_id: string | null
}

const AGENTS = ['agent-a', 'agent-b', 'agent-c', 'agent-d', 'agent-e', 'agent-f']
const T0 = Date.parse('2026-11-01T15:00:00.000Z')

export const incidentChannels = [
  { id: OTHER_CHANNEL_ID, slug: 'general', type: 'project', last_activity_at: '2026-11-02T00:00:00.000Z' },
  { id: INCIDENT_CHANNEL_ID, slug: 'content-team', type: 'team', last_activity_at: '2026-11-01T15:10:00.000Z' },
]

export const incidentMessages: FixtureRow[] = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    channel_id: INCIDENT_CHANNEL_ID,
    sender_type: 'user',
    sender_user_id: FOUNDER_USER_ID,
    sender_agent_id: null,
    content: '[synthetic user prompt]',
    status: 'delivered',
    created_at: new Date(T0).toISOString(),
    thread_parent_id: null,
  },
  ...AGENTS.map((agent, i) => ({
    id: `a0000000-0000-4000-8000-00000000001${i}`,
    channel_id: INCIDENT_CHANNEL_ID,
    sender_type: 'agent' as const,
    sender_user_id: null,
    sender_agent_id: agent,
    content: `[synthetic reply ${i + 1}]`,
    status: 'delivered',
    created_at: new Date(T0 + (i + 1) * 20_000).toISOString(),
    thread_parent_id: null,
  })),
]

/* PostgREST body returned when anon/authenticated has no table privilege
   (the state after migration 20260928120000_p05b3_cockpit_anon_lockdown). */
export const PERMISSION_DENIED_BODY = {
  code: '42501',
  details: null,
  hint: null,
  message: 'permission denied for table messages',
}
