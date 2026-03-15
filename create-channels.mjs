import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://qkbkfsjkysdsfmhgfdoc.supabase.co', 'sb_publishable_p4hYK7b_gShaL4wA7u_zvQ_aFDFHd91');
const T = '11111111-1111-1111-1111-111111111111';
const agents = ['atlas','triage','shuri','proximon','aetherion','simons','mercury','vee','ink','echo','haven','widow','drstrange','kiyosaki','michael','selah','prophets','themaestro','nova','themis'];

const dmChannels = agents.map((a, i) => ({
  id: 'aa' + String(i + 1).padStart(6, '0') + '-0000-0000-0000-000000000000',
  tenant_id: T,
  name: 'DM: ' + a.charAt(0).toUpperCase() + a.slice(1),
  slug: 'dm-' + a,
  type: 'dm',
  description: 'Direct message with ' + a,
  is_private: true,
}));

const groups = [
  { id: 'bb000001-0000-0000-0000-000000000000', name: 'Security Team', slug: 'team-security', desc: 'Widow, Triage, Atlas' },
  { id: 'bb000002-0000-0000-0000-000000000000', name: 'Finance Team', slug: 'team-finance', desc: 'Kiyosaki, Simons, Mercury, Atlas' },
  { id: 'bb000003-0000-0000-0000-000000000000', name: 'Sales Team', slug: 'team-sales', desc: 'Mercury, Haven, Atlas' },
  { id: 'bb000004-0000-0000-0000-000000000000', name: 'Strategy Team', slug: 'team-strategy', desc: 'Dr Strange, Aetherion, Simons, Atlas' },
  { id: 'bb000005-0000-0000-0000-000000000000', name: 'Legal Team', slug: 'team-legal', desc: 'Themis, Atlas' },
  { id: 'bb000006-0000-0000-0000-000000000000', name: 'Content Team', slug: 'team-content', desc: 'Ink, Echo, Vee, Atlas' },
  { id: 'bb000007-0000-0000-0000-000000000000', name: 'Wellness Team', slug: 'team-wellness', desc: 'Selah, Michael, Atlas' },
  { id: 'bb000008-0000-0000-0000-000000000000', name: 'Creative Team', slug: 'team-creative', desc: 'Aetherion, Shuri, Nova, TheMAESTRO, Atlas' },
].map(g => ({ id: g.id, tenant_id: T, name: g.name, slug: g.slug, type: 'group', description: g.desc, is_private: false }));

const all = [...dmChannels, ...groups];
const { error } = await sb.from('channels').insert(all);
if (error) console.log('ERROR:', error.message);
else console.log('Created', all.length, 'channels (20 DMs + 8 groups)');
