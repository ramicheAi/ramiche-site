-- ============================================================================
-- COMMAND CENTER CHAT — FIX-IT SCRIPT
-- ============================================================================
-- Run this in the Supabase SQL editor when /api/command-center/chat/health
-- reports broken or degraded. Idempotent — safe to run multiple times.
--
-- It fixes the four most common reasons the chat panel is empty:
--   1. `channels` table empty → app falls back to DEFAULT_CHANNELS UUIDs that
--      don't exist in Supabase, so no messages match.
--   2. `messages` not in the supabase_realtime publication → CHANNEL_ERROR
--      badge, no live updates.
--   3. `messages.pinned` / `status` columns missing → row mapping fails or
--      pin/delivery features misbehave.
--   4. `message_reactions` table missing (some envs only have `reactions`)
--      → reaction load throws and silently breaks rendering.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Seed the canonical channel UUIDs that DEFAULT_CHANNELS uses in the
--    frontend. Idempotent thanks to (tenant_id, slug) unique key.
-- ---------------------------------------------------------------------------
INSERT INTO channels (id, tenant_id, name, slug, type, description, is_private) VALUES
    ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'General',         'general',          'channel', 'Main discussion channel',           false),
    ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'METTLE',          'mettle',           'channel', 'METTLE — Athlete SaaS (#1 priority)', false),
    ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Parallax',        'parallax',         'channel', 'Parallax — Brand System',          false),
    ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Verified Agents', 'verified-agents',  'channel', 'Verified Agent Business (#2 priority)', false),
    ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Dev',             'dev',              'channel', 'Development discussions',          false),
    ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', 'Security Team',   'security-team',    'channel', 'Security team',                    false),
    ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'Finance Team',    'finance-team',     'channel', 'Finance team',                     false),
    ('99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', 'Sales Team',      'sales-team',       'channel', 'Sales team',                       false),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Strategy Team',   'strategy-team',    'channel', 'Strategy team',                    false),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Legal Team',      'legal-team',       'channel', 'Legal team',                       false),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Content Team',    'content-team',     'channel', 'Content team',                     false),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'Wellness Team',   'wellness-team',    'channel', 'Wellness team',                    false),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'Studio Team',     'studio-team',      'channel', 'Studio team',                      false),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', 'Creative Team',   'creative-team',    'channel', 'Creative team',                    false),
    ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Engineering Team', 'engineering-team', 'channel', 'Engineering team',                 false)
ON CONFLICT (tenant_id, slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Seed DM channel UUIDs the frontend resolves agents to.
-- ---------------------------------------------------------------------------
INSERT INTO channels (id, tenant_id, name, slug, type, description, is_private) VALUES
    ('aa000001-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Atlas DM',       'dm-atlas',       'dm', 'Direct message with Atlas',       true),
    ('aa000002-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Triage DM',      'dm-triage',      'dm', 'Direct message with Triage',      true),
    ('aa000003-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Shuri DM',       'dm-shuri',       'dm', 'Direct message with Shuri',       true),
    ('aa000004-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Proximon DM',    'dm-proximon',    'dm', 'Direct message with Proximon',    true),
    ('aa000005-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Aetherion DM',   'dm-aetherion',   'dm', 'Direct message with Aetherion',   true),
    ('aa000006-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Simons DM',      'dm-simons',      'dm', 'Direct message with Simons',      true),
    ('aa000007-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Mercury DM',     'dm-mercury',     'dm', 'Direct message with Mercury',     true),
    ('aa000008-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Vee DM',         'dm-vee',         'dm', 'Direct message with Vee',         true),
    ('aa000009-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Ink DM',         'dm-ink',         'dm', 'Direct message with Ink',         true),
    ('aa000010-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Echo DM',        'dm-echo',        'dm', 'Direct message with Echo',        true),
    ('aa000011-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Haven DM',       'dm-haven',       'dm', 'Direct message with Haven',       true),
    ('aa000012-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Widow DM',       'dm-widow',       'dm', 'Direct message with Widow',       true),
    ('aa000013-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Dr. Strange DM', 'dm-drstrange',   'dm', 'Direct message with Dr. Strange', true),
    ('aa000014-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Kiyosaki DM',    'dm-kiyosaki',    'dm', 'Direct message with Kiyosaki',    true),
    ('aa000015-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Michael DM',     'dm-michael',     'dm', 'Direct message with Michael',     true),
    ('aa000016-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Selah DM',       'dm-selah',       'dm', 'Direct message with Selah',       true),
    ('aa000017-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Prophets DM',    'dm-prophets',    'dm', 'Direct message with Prophets',    true),
    ('aa000018-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'TheMaestro DM',  'dm-themaestro',  'dm', 'Direct message with TheMaestro',  true),
    ('aa000019-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Nova DM',        'dm-nova',        'dm', 'Direct message with Nova',        true),
    ('aa000020-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Themis DM',      'dm-themis',      'dm', 'Direct message with Themis',      true)
ON CONFLICT (tenant_id, slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Ensure messages has the columns the frontend reads.
--    These are no-ops if the columns already exist.
-- ---------------------------------------------------------------------------
ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned           boolean      DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS status           text         DEFAULT 'delivered';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachments      jsonb        DEFAULT '[]'::jsonb;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS thread_parent_id uuid;

-- Mirror is_pinned → pinned if both exist and pinned hasn't been backfilled.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'is_pinned'
  ) THEN
    UPDATE messages SET pinned = is_pinned WHERE pinned IS DISTINCT FROM is_pinned;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. message_reactions table — frontend queries this exact name.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_reactions (
    id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id  uuid        REFERENCES messages(id) ON DELETE CASCADE,
    user_id     text        NOT NULL,
    emoji       text        NOT NULL,
    created_at  timestamptz DEFAULT now(),
    UNIQUE (message_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);

-- ---------------------------------------------------------------------------
-- 5. Add messages + message_reactions to the realtime publication.
--    This is what clears the red REALTIME ERROR badge in the chat header.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Tiny RPC the chat/health endpoint uses to confirm publication membership.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_publication_tables_for(pub text)
RETURNS TABLE(tablename text) LANGUAGE sql STABLE AS $$
    SELECT pt.tablename::text
    FROM pg_publication_tables pt
    WHERE pt.pubname = pub;
$$;

GRANT EXECUTE ON FUNCTION pg_publication_tables_for(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Seed a single hello message in #mettle so the channel isn't empty
--    on first render. Idempotent via the WHERE-NOT-EXISTS guard.
-- ---------------------------------------------------------------------------
INSERT INTO messages (channel_id, sender_agent_id, sender_type, content, tenant_id)
SELECT
    '33333333-3333-3333-3333-333333333333',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'agent',
    'Channel restored. Realtime publication updated. Atlas online.',
    '11111111-1111-1111-1111-111111111111'
WHERE NOT EXISTS (
    SELECT 1 FROM messages WHERE channel_id = '33333333-3333-3333-3333-333333333333'
);

COMMIT;

-- ============================================================================
-- VERIFY
-- ============================================================================
-- After running, hit /api/command-center/chat/health again. Every check
-- should be ok:true. The chat panel should render the seed message in
-- #mettle and the REALTIME ERROR badge should clear within ~3 seconds.
-- ============================================================================
SELECT
    (SELECT count(*) FROM channels WHERE tenant_id = '11111111-1111-1111-1111-111111111111') AS channels,
    (SELECT count(*) FROM messages WHERE tenant_id = '11111111-1111-1111-1111-111111111111') AS messages,
    (SELECT count(*) FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') AS messages_in_realtime,
    (SELECT count(*) FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'message_reactions') AS reactions_in_realtime;
