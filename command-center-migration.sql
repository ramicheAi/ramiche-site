-- Command Center HQ Chat System - Complete Migration
-- Run this entire file in Supabase SQL Editor
-- Dependency order handled automatically

BEGIN;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TENANTS (White‑label isolation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    theme JSONB DEFAULT '{"primary": "#7C3AED", "secondary": "#A78BFA", "dark": "#0F172A"}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Default tenant (Ramiches)
INSERT INTO tenants (id, name, slug, logo_url) 
VALUES ('11111111-1111-1111-1111-111111111111', 'Ramiches', 'ramiches', '/logos/ramiche.png')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 2. USER PROFILES (Extends Supabase Auth)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) DEFAULT '11111111-1111-1111-1111-111111111111',
    name TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 3. AGENT PROFILES (AI agents)
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) DEFAULT '11111111-1111-1111-1111-111111111111',
    name TEXT NOT NULL,
    handle TEXT UNIQUE NOT NULL,
    model TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'idle', 'offline', 'busy')),
    color_hex TEXT DEFAULT '#7C3AED',
    avatar_url TEXT,
    skills JSONB DEFAULT '[]'::jsonb,
    system_prompt TEXT,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 4. CHANNELS (Chat rooms)
-- ============================================================================
CREATE TABLE IF NOT EXISTS channels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) DEFAULT '11111111-1111-1111-1111-111111111111',
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('channel', 'dm', 'project')),
    project_id TEXT,
    description TEXT,
    is_private BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    last_activity_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, slug)
);

-- ============================================================================
-- 5. CHANNEL MEMBERS (Fixed: surrogate PK + unique index)
-- ============================================================================
CREATE TABLE IF NOT EXISTS channel_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agent_profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
    joined_at TIMESTAMPTZ DEFAULT now(),
    last_read_at TIMESTAMPTZ DEFAULT now(),
    notifications BOOLEAN DEFAULT true,
    CHECK (
        (user_id IS NOT NULL AND agent_id IS NULL) OR
        (user_id IS NULL AND agent_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_channel_member_unique ON channel_members (
    channel_id, 
    (COALESCE(user_id, agent_id))
);

-- ============================================================================
-- 6. MESSAGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) DEFAULT '11111111-1111-1111-1111-111111111111',
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    sender_agent_id UUID REFERENCES agent_profiles(id) ON DELETE SET NULL,
    sender_type TEXT GENERATED ALWAYS AS (
        CASE 
            WHEN sender_user_id IS NOT NULL THEN 'user'
            WHEN sender_agent_id IS NOT NULL THEN 'agent'
            ELSE 'system'
        END
    ) STORED,
    content TEXT NOT NULL,
    thread_parent_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    attachments JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}',
    is_edited BOOLEAN DEFAULT false,
    is_pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CHECK (
        (sender_user_id IS NOT NULL AND sender_agent_id IS NULL) OR
        (sender_user_id IS NULL AND sender_agent_id IS NOT NULL)
    )
);

-- ============================================================================
-- 7. THREADS
-- ============================================================================
CREATE TABLE IF NOT EXISTS threads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) DEFAULT '11111111-1111-1111-1111-111111111111',
    parent_message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    reply_count INTEGER DEFAULT 0,
    last_reply_at TIMESTAMPTZ DEFAULT now(),
    is_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 8. TYPING INDICATORS (Fixed)
-- ============================================================================
CREATE TABLE IF NOT EXISTS typing_indicators (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agent_profiles(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '5 seconds',
    CHECK (
        (user_id IS NOT NULL AND agent_id IS NULL) OR
        (user_id IS NULL AND agent_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_typing_indicators_unique ON typing_indicators (
    channel_id, 
    (COALESCE(user_id, agent_id))
);

-- ============================================================================
-- 9. REACTIONS (Fixed)
-- ============================================================================
CREATE TABLE IF NOT EXISTS reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) DEFAULT '11111111-1111-1111-1111-111111111111',
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agent_profiles(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CHECK (
        (user_id IS NOT NULL AND agent_id IS NULL) OR
        (user_id IS NULL AND agent_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_reactions_unique ON reactions (
    message_id, 
    emoji, 
    (COALESCE(user_id, agent_id))
);

-- ============================================================================
-- INDEXES (Performance)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_channels_tenant_slug ON channels(tenant_id, slug);
CREATE INDEX IF NOT EXISTS idx_channels_last_activity ON channels(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_channel_members_agent ON channel_members(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread_parent ON messages(thread_parent_id) WHERE thread_parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_tenant ON messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_threads_channel ON threads(channel_id);
CREATE INDEX IF NOT EXISTS idx_threads_last_reply ON threads(last_reply_at DESC);
CREATE INDEX IF NOT EXISTS idx_typing_indicators_expires ON typing_indicators(expires_at);
CREATE INDEX IF NOT EXISTS idx_reactions_message ON reactions(message_id);

COMMIT;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - Run after tables exist
-- ============================================================================
DO $$ 
BEGIN
    -- Enable RLS on all tables
    EXECUTE 'ALTER TABLE tenants ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE agent_profiles ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE channels ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE threads ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE reactions ENABLE ROW LEVEL SECURITY';
EXCEPTION 
    WHEN undefined_table THEN 
        NULL; -- Table doesn't exist yet, skip
END $$;

-- ============================================================================
-- SEED DATA
-- ============================================================================
-- Insert default channels
INSERT INTO channels (id, tenant_id, name, slug, type, description, is_private) VALUES
    ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'General', 'general', 'channel', 'Main discussion channel', false),
    ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'METTLE', 'mettle', 'channel', 'Apex Athlete development', false),
    ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Parallax', 'parallax', 'channel', 'Brand system & design', false),
    ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Verified Agents', 'verified-agents', 'channel', 'Official agent communications', false),
    ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Dev', 'dev', 'channel', 'Technical discussions', false)
ON CONFLICT (tenant_id, slug) DO NOTHING;

-- Insert 19 agents (Ramiches agent roster)
INSERT INTO agent_profiles (id, tenant_id, name, handle, model, status, color_hex, avatar_url, skills, system_prompt) VALUES
    -- Core Team
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Atlas', 'atlas', 'claude-3-5-sonnet-20241022', 'active', '#7C3AED', '/avatars/atlas.png', '["coordination", "strategy", "decision-making"]', 'You are Atlas, the orchestrator.'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Proximon', 'proximon', 'gemini-2.0-flash-thinking-exp', 'active', '#10B981', '/avatars/proximon.png', '["architecture", "systems", "schema-design"]', 'You are Proximon, the architect.'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Aetherion', 'aetherion', 'claude-3-5-haiku-20241022', 'active', '#F59E0B', '/avatars/aetherion.png', '["design", "branding", "visual-systems"]', 'You are Aetherion, the designer.'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'Shuri', 'shuri', 'gemini-2.0-flash-exp', 'active', '#EF4444', '/avatars/shuri.png', '["frontend", "ui", "react", "nextjs"]', 'You are Shuri, the frontend engineer.'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'TheMAESTRO', 'themaestro', 'claude-3-5-sonnet-20241022', 'active', '#8B5CF6', '/avatars/themaestro.png', '["music", "audio", "production", "creative"]', 'You are TheMAESTRO, the music producer.'),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', 'Simons', 'simons', 'gemini-2.0-pro-exp', 'active', '#06B6D4', '/avatars/simons.png', '["data", "analytics", "pricing", "numbers"]', 'You are Simons, the data analyst.'),
    ('gggggggg-gggg-gggg-gggg-gggggggggggg', '11111111-1111-1111-1111-111111111111', 'Vee', 'vee', 'claude-3-5-haiku-20241022', 'active', '#EC4899', '/avatars/vee.png', '["marketing", "copy", "social", "comms"]', 'You are Vee, the marketing strategist.'),
    ('hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh', '11111111-1111-1111-1111-111111111111', 'Widow', 'widow', 'gemini-2.0-flash-thinking-exp', 'active', '#1E293B', '/avatars/widow.png', '["security", "infrastructure", "devops"]', 'You are Widow, the security specialist.'),
    
    -- Support Agents
    ('iiiiiiii-iiii-iiii-iiii-iiiiiiiiiiii', '11111111-1111-1111-1111-111111111111', 'Ramon', 'ramon', 'claude-3-5-sonnet-20241022', 'active', '#000000', '/avatars/ramon.png', '["leadership", "vision", "brand"]', 'You are Ramon, the operator.'),
    ('jjjjjjjj-jjjj-jjjj-jjjj-jjjjjjjjjjjj', '11111111-1111-1111-1111-111111111111', 'Ramon (Gemini)', 'ramon-gemini', 'gemini-2.0-pro-exp', 'idle', '#1D4ED8', '/avatars/ramon-gemini.png', '["strategy", "product", "vision"]', 'You are Ramon on Gemini.'),
    ('kkkkkkkk-kkkk-kkkk-kkkk-kkkkkkkkkkkk', '11111111-1111-1111-1111-111111111111', 'Oracle', 'oracle', 'claude-3-5-sonnet-20241022', 'active', '#F97316', '/avatars/oracle.png', '["research", "analysis", "synthesis"]', 'You are Oracle, the knowledge engine.'),
    ('llllllll-llll-llll-llll-llllllllllll', '11111111-1111-1111-1111-111111111111', 'Codex', 'codex', 'claude-3-5-sonnet-20241022', 'active', '#84CC16', '/avatars/codex.png', '["coding", "debugging", "refactoring"]', 'You are Codex, the coding assistant.'),
    ('mmmmmmmm-mmmm-mmmm-mmmm-mmmmmmmmmmmm', '11111111-1111-1111-1111-111111111111', 'Claude Code', 'claude-code', 'claude-3-5-sonnet-20241022', 'active', '#FACC15', '/avatars/claude-code.png', '["programming", "typescript", "react"]', 'You are Claude Code.'),
    
    -- Specialized
    ('nnnnnnnn-nnnn-nnnn-nnnn-nnnnnnnnnnnn', '11111111-1111-1111-1111-111111111111', 'Gemini', 'gemini', 'gemini-2.0-pro-exp', 'active', '#4285F4', '/avatars/gemini.png', '["reasoning", "analysis", "generation"]', 'You are Gemini.'),
    ('oooooooo-oooo-oooo-oooo-oooooooooooo', '11111111-1111-1111-1111-111111111111', 'OpenAI', 'openai', 'gpt-4o', 'active', '#10A37F', '/avatars/openai.png', '["conversation", "analysis", "generation"]', 'You are OpenAI assistant.'),
    ('pppppppp-pppp-pppp-pppp-pppppppppppp', '11111111-1111-1111-1111-111111111111', 'DeepSeek', 'deepseek', 'deepseek-chat', 'active', '#6366F1', '/avatars/deepseek.png', '["reasoning", "coding", "analysis"]', 'You are DeepSeek.'),
    ('qqqqqqqq-qqqq-qqqq-qqqq-qqqqqqqqqqqq', '11111111-1111-1111-1111-111111111111', 'Pi', 'pi', 'pi', 'active', '#C084FC', '/avatars/pi.png', '["conversation", "support", "reasoning"]', 'You are Pi.'),
    
    -- Experimental
    ('rrrrrrrr-rrrr-rrrr-rrrr-rrrrrrrrrrrr', '11111111-1111-1111-1111-111111111111', 'Nano Banana Pro', 'nano-banana-pro', 'gemini-2.0-flash-exp', 'idle', '#FBBF24', '/avatars/nano-banana-pro.png', '["image-generation", "creative"]', 'You are Nano Banana Pro.'),
    ('ssssssss-ssss-ssss-ssss-ssssssssssss', '11111111-1111-1111-1111-111111111111', 'Flash Lite', 'flash-lite', 'gemini-2.0-flash-lite-exp', 'active', '#60A5FA', '/avatars/flash-lite.png', '["fast-response", "summarization"]', 'You are Flash Lite.')
ON CONFLICT (handle) DO UPDATE SET
    name = EXCLUDED.name,
    model = EXCLUDED.model,
    color_hex = EXCLUDED.color_hex,
    skills = EXCLUDED.skills;

-- Add all agents to #verified-agents channel
INSERT INTO channel_members (channel_id, agent_id, role)
SELECT 
    '55555555-5555-5555-5555-555555555555',
    id,
    'member'
FROM agent_profiles
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
SELECT '✅ Command Center HQ Chat System schema created successfully' AS result;