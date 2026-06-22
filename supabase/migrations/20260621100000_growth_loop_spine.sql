-- Phase 0a — Growth Loop measurement spine.
-- Extends the existing pipeline_* tables with: per-FEED attribution, the BATCH-GATE
-- (the human checkpoint that makes autonomy safe), and a REAL leading-indicator view
-- (replaces the command center's mock revenue cards). Idempotent.

-- 1. FEED + attribution on every opportunity ---------------------------------
ALTER TABLE pipeline_leads ADD COLUMN IF NOT EXISTS feed TEXT NOT NULL DEFAULT 'agency';
-- which revenue factory: agency | mettle | galactik | content | services
ALTER TABLE pipeline_leads ADD COLUMN IF NOT EXISTS source_signal TEXT;  -- what sourced it: 'prospector:osm','content:reel-42','referral'
ALTER TABLE pipeline_leads ADD COLUMN IF NOT EXISTS closed_signal TEXT;  -- what actually converted it (for 70/20/10)
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_feed ON pipeline_leads (feed);

-- 2. THE BATCH-GATE: everything an agent wants to do that needs Ramon's yes ---
-- Agents WRITE drafts here (insert pending); Ramon approves/rejects one-click;
-- only then does the orchestrator execute. This is the brake on send/spend/publish.
CREATE TABLE IF NOT EXISTS pipeline_gate (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at    TIMESTAMPTZ DEFAULT now(),
    feed          TEXT,
    lead_id       UUID REFERENCES pipeline_leads(id) ON DELETE SET NULL,
    kind          TEXT NOT NULL CHECK (kind IN ('send','publish','spend','price','close','other')),
    title         TEXT NOT NULL,                 -- one-line "what"
    why           TEXT,                          -- why now
    dollar_impact NUMERIC DEFAULT 0,             -- $ at stake (for prioritising the queue)
    payload       JSONB DEFAULT '{}'::jsonb,     -- the actual draft: email body / post / order / price
    requested_by  TEXT,                          -- which agent drafted it
    status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected','expired','executed')),
    decided_at    TIMESTAMPTZ,
    decided_by    TEXT
);
CREATE INDEX IF NOT EXISTS idx_pipeline_gate_status ON pipeline_gate (status, created_at DESC);

-- 3. LEADING INDICATORS per feed (the cockpit reads THIS, never mock data) -----
CREATE OR REPLACE VIEW pipeline_metrics AS
SELECT
  feed,
  count(*)                                                   AS total_leads,
  count(*) FILTER (WHERE stage = 'qualified')                AS qualified,
  count(*) FILTER (WHERE stage = 'proposal')                 AS proposals,
  count(*) FILTER (WHERE stage = 'closed')                   AS closed_won,
  count(*) FILTER (WHERE stage = 'lost')                     AS lost,
  coalesce(sum(value) FILTER (WHERE stage = 'closed'), 0)    AS revenue_won,
  coalesce(sum(value) FILTER (WHERE stage NOT IN ('closed','lost')), 0) AS pipeline_value,
  round(100.0 * count(*) FILTER (WHERE stage = 'closed')
        / nullif(count(*) FILTER (WHERE stage <> 'lead'), 0), 1)        AS close_rate_pct
FROM pipeline_leads
GROUP BY feed;

-- gate queue is service-role only (agents write via admin client; Ramon reads in the cockpit)
ALTER TABLE pipeline_gate ENABLE ROW LEVEL SECURITY;
