-- ════════════════════════════════════════════════════════════════════════════
-- Jobs/Runs backbone — every Command Center action becomes a tracked job:
-- queued → running → done/failed, dispatched to the fleet, result streamed back.
-- Additive + RLS deny-by-default (reachable only via the service-role jobs API).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS jobs (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id   UUID DEFAULT '11111111-1111-1111-1111-111111111111',
    title       TEXT NOT NULL,
    kind        TEXT NOT NULL DEFAULT 'generic'
                CHECK (kind IN ('generic','dev','design','prospect','outreach','content','analysis')),
    agent       TEXT,
    status      TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','running','done','failed','canceled')),
    source      TEXT,
    input       JSONB DEFAULT '{}'::jsonb,
    result      TEXT,
    error       TEXT,
    progress    TEXT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    started_at  TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS job_events (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id     UUID REFERENCES jobs(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL DEFAULT 'log',
    detail     JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status     ON jobs (status);
CREATE INDEX IF NOT EXISTS idx_jobs_created     ON jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_events_job   ON job_events (job_id, created_at);

CREATE OR REPLACE FUNCTION jobs_set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jobs_updated ON jobs;
CREATE TRIGGER trg_jobs_updated BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION jobs_set_updated_at();

ALTER TABLE jobs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_events ENABLE ROW LEVEL SECURITY;
COMMIT;
