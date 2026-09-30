-- ════════════════════════════════════════════════════════════════════════════
-- Pipeline Spine — leads → proposals → events
-- ════════════════════════════════════════════════════════════════════════════
-- Purpose: a real DB-backed lead→proposal→delivery pipeline for the Command
-- Center, replacing the file-backed `data/sales-pipeline.json` and the
-- clipboard-only proposal generator.
--
-- Shapes are deliberately matched to what already exists in the app:
--   • pipeline_leads  ← sales page `PipelineLead` + studio-inquiry intake
--   • pipeline_proposals ← the METTLE proposal generator's `leadData` object
--   • pipeline_events ← lightweight timeline for leading-indicator metrics
--
-- Safe to apply: additive only, all `IF NOT EXISTS`. RLS is enabled with no
-- anon/authenticated policies — this CRM data is reachable ONLY through the
-- service-role API routes under /api/command-center/pipeline/*.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Reuse the tenant model from the chat migration if present; default tenant id
-- matches `command-center-migration.sql` ('Ramiches'). FK is intentionally soft
-- (no REFERENCES) so this migration applies whether or not `tenants` exists.
DO $$ BEGIN END $$;

-- ─── 1. LEADS (the opportunity / deal, carries the stage) ──────────────────────
CREATE TABLE IF NOT EXISTS pipeline_leads (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id     UUID DEFAULT '11111111-1111-1111-1111-111111111111',
    name          TEXT,                       -- contact name
    company       TEXT,                       -- team / club / company
    contact_email TEXT,
    contact_title TEXT,
    product       TEXT,                        -- which Parallax product/service
    stage         TEXT NOT NULL DEFAULT 'lead'
                  CHECK (stage IN ('lead','qualified','proposal','negotiation','closed','lost')),
    value         NUMERIC DEFAULT 0,           -- opportunity value (monthly or one-time)
    source        TEXT,                        -- 'proposal-generator','studio-inquiry','manual',...
    owner         TEXT,                        -- agent owner: mercury / haven
    tags          TEXT[] DEFAULT '{}',
    notes         TEXT,
    meta          JSONB DEFAULT '{}'::jsonb,   -- intake extras: athleteCount, budget, timeline, painPoints
    last_contact  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── 2. PROPOSALS (1:N per lead) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_proposals (
    id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id         UUID DEFAULT '11111111-1111-1111-1111-111111111111',
    lead_id           UUID REFERENCES pipeline_leads(id) ON DELETE SET NULL,
    product           TEXT,
    tier              TEXT,
    monthly_price     NUMERIC,
    discount_pct      NUMERIC DEFAULT 0,
    projected_roi_pct NUMERIC,
    annual_value      NUMERIC,
    valid_until       DATE,
    status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','sent','accepted','declined','expired')),
    terms             JSONB DEFAULT '{}'::jsonb,  -- full computed leadData snapshot
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now()
);

-- ─── 3. EVENTS (timeline → leading-indicator metrics) ──────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_events (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id    UUID REFERENCES pipeline_leads(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,                  -- stage_change | contact | proposal_sent | note
    detail     JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_stage     ON pipeline_leads (stage);
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_created    ON pipeline_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_proposals_lead   ON pipeline_proposals (lead_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_proposals_status ON pipeline_proposals (status);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_lead      ON pipeline_events (lead_id, created_at DESC);

-- ─── updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pipeline_set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pipeline_leads_updated ON pipeline_leads;
CREATE TRIGGER trg_pipeline_leads_updated
    BEFORE UPDATE ON pipeline_leads
    FOR EACH ROW EXECUTE FUNCTION pipeline_set_updated_at();

DROP TRIGGER IF EXISTS trg_pipeline_proposals_updated ON pipeline_proposals;
CREATE TRIGGER trg_pipeline_proposals_updated
    BEFORE UPDATE ON pipeline_proposals
    FOR EACH ROW EXECUTE FUNCTION pipeline_set_updated_at();

-- ─── RLS: deny-by-default. Only the service role (API routes) can read/write. ──
ALTER TABLE pipeline_leads     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_events    ENABLE ROW LEVEL SECURITY;
-- (No anon/authenticated policies on purpose. The service-role key used by the
--  pipeline API routes bypasses RLS; the browser anon client cannot reach this.)

COMMIT;
