/**
 * Seed the Command Center's channel rows.
 *
 *   npx tsx create-channels.mjs
 *
 * Run with tsx, not plain node: the agent uuids come from the canonical registry
 * (src/lib/agent-registry-core.ts) so this file never becomes a second source of truth for them.
 *
 * IDENTITY MODEL (read before editing):
 *   agent identity        = the registry dmUuid. Also what messages.sender_agent_id stores.
 *   conversation identity = channels.id.
 *   the link              = channels.agent_id -> the agent's dmUuid.
 *
 * Every type='dm' row MUST set agent_id, or the channels_dm_has_agent constraint rejects it. agent_id is
 * read from the registry and is never inferred from the channel id. The 20 rows seeded here reproduce the
 * original conversations, whose id happens to EQUAL the agent uuid. That equality is legacy compatibility,
 * not the model: every conversation created after this gets a fresh uuid with the same agent_id.
 *
 * Group channels are not conversations with an agent, so they leave agent_id null.
 */
import { createClient } from '@supabase/supabase-js';
import { agentDmUuidMap } from './src/lib/agent-registry-core.ts';

const T = '11111111-1111-1111-1111-111111111111';

const GROUPS = [
  { id: 'bb000001-0000-0000-0000-000000000000', name: 'Security Team', slug: 'team-security', desc: 'Widow, Triage, Atlas' },
  { id: 'bb000002-0000-0000-0000-000000000000', name: 'Finance Team', slug: 'team-finance', desc: 'Kiyosaki, Simons, Mercury, Atlas' },
  { id: 'bb000003-0000-0000-0000-000000000000', name: 'Sales Team', slug: 'team-sales', desc: 'Mercury, Haven, Atlas' },
  { id: 'bb000004-0000-0000-0000-000000000000', name: 'Strategy Team', slug: 'team-strategy', desc: 'Dr Strange, Aetherion, Simons, Atlas' },
  { id: 'bb000005-0000-0000-0000-000000000000', name: 'Legal Team', slug: 'team-legal', desc: 'Themis, Atlas' },
  { id: 'bb000006-0000-0000-0000-000000000000', name: 'Content Team', slug: 'team-content', desc: 'Ink, Echo, Vee, Atlas' },
  { id: 'bb000007-0000-0000-0000-000000000000', name: 'Wellness Team', slug: 'team-wellness', desc: 'Selah, Michael, Atlas' },
  { id: 'bb000008-0000-0000-0000-000000000000', name: 'Creative Team', slug: 'team-creative', desc: 'Aetherion, Shuri, Nova, TheMAESTRO, Atlas' },
];

/** The rows this seeder inserts. Pure, so it can be asserted without a database. */
export function buildSeedRows() {
  const dms = Object.entries(agentDmUuidMap()).map(([agentId, dmUuid]) => ({
    // The original conversation for this agent. Historically its id IS the agent uuid (see the note above).
    id: dmUuid,
    tenant_id: T,
    name: 'DM: ' + agentId.charAt(0).toUpperCase() + agentId.slice(1),
    slug: 'dm-' + agentId,
    type: 'dm',
    description: 'Direct message with ' + agentId,
    is_private: true,
    // Canonical agent identity, straight from the registry. Never inferred from `id`.
    agent_id: dmUuid,
  }));
  const groups = GROUPS.map((g) => ({
    id: g.id, tenant_id: T, name: g.name, slug: g.slug, type: 'group',
    description: g.desc, is_private: false,
    // Not a conversation with an agent.
    agent_id: null,
  }));
  return { dms, groups, all: [...dms, ...groups] };
}

/** Insert only when this file is executed directly, so importing it for tests is side-effect free. */
if (import.meta.url === `file://${process.argv[1]}`) {
  const sb = createClient('https://qkbkfsjkysdsfmhgfdoc.supabase.co', 'sb_publishable_p4hYK7b_gShaL4wA7u_zvQ_aFDFHd91');
  const { dms, groups, all } = buildSeedRows();
  const { error } = await sb.from('channels').insert(all);
  if (error) console.log('ERROR:', error.message);
  else console.log(`Created ${all.length} channels (${dms.length} DMs + ${groups.length} groups)`);
}
