-- Optional CC Chat enhancements (run in Supabase SQL editor when ready)
-- See docs/CC-CHAT-OPENCLAW-INTEGRATION-SPEC.md

ALTER TABLE messages ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS thread_parent_id UUID REFERENCES messages(id);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS mentioned_agents TEXT[];

CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Enable Realtime for `message_reactions` (Database → Replication) for live reaction counts.
-- RLS: allow SELECT for anon if the UI loads reactions with the anon key; writes go via API + service role.

-- Storage: public bucket for chat file uploads (`POST /api/command-center/chat/upload`)
-- In Supabase Dashboard → Storage → New bucket → name `chat-attachments` → Public.
-- Policy (example): allow authenticated/service uploads; public read for `chat-attachments` objects.
