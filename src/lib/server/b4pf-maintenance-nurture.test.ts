import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { issueCsrfToken } from './csrf';

const { sessionVerifier, db } = vi.hoisted(() => ({
  sessionVerifier: vi.fn(),
  db: { client: null as unknown, ops: [] as Array<{ table: string; ops: unknown[][] }> },
}));
vi.mock('@/lib/firebase-admin', async (orig) => ({ ...(await orig<object>()), verifySessionCookie: sessionVerifier }));
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: () => db.client }));

type Row = { id: string; company: string; name: string | null; stage: string | null; value: number; meta: Record<string, unknown>; notes: string | null };

/** A tiny in-memory pipeline_leads table honoring .eq('id') + .in('stage', …) on UPDATE, like Postgres. */
function tableDb(rows: Row[], opts: { failUpdateFor?: string } = {}) {
  return {
    from(table: string) {
      const rec = { table, ops: [] as unknown[][] };
      db.ops.push(rec);
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'in', 'limit', 'insert', 'update']) chain[m] = (...a: unknown[]) => { rec.ops.push([m, ...a]); return chain; };
      chain.then = (ok: (v: unknown) => unknown) => {
        const upd = rec.ops.find((o) => o[0] === 'update')?.[1] as Partial<Row> | undefined;
        if (table === 'pipeline_leads' && upd) {
          const id = rec.ops.find((o) => o[0] === 'eq' && o[1] === 'id')?.[2];
          const inStage = rec.ops.find((o) => o[0] === 'in' && o[1] === 'stage')?.[2] as string[] | undefined;
          const eqStage = rec.ops.find((o) => o[0] === 'eq' && o[1] === 'stage');
          if (id === opts.failUpdateFor) return Promise.resolve({ data: null, error: { message: 'boom' } }).then(ok);
          const hit = rows.filter((r) => r.id === id && (!inStage || inStage.includes(String(r.stage))) && (!eqStage || r.stage === eqStage[2]));
          for (const r of hit) Object.assign(r, upd);
          return Promise.resolve({ data: hit.map((r) => ({ id: r.id })), error: null }).then(ok);
        }
        if (table === 'pipeline_leads') return Promise.resolve({ data: rows.map((r) => ({ ...r })), error: null }).then(ok);
        return Promise.resolve({ data: null, error: null }).then(ok);
      };
      return chain;
    },
  };
}

const OWNER = 'owner_fixture_only';
const COOKIE = 'fixture-session-'.repeat(5);
const ORIGIN = 'https://cockpit.example';
beforeEach(() => {
  vi.stubEnv('PARALLAX_OWNER_UID', OWNER);
  vi.stubEnv('PARALLAX_TRUSTED_ORIGINS', ORIGIN);
  vi.stubEnv('PARALLAX_CSRF_SECRET', 'fixture-not-a-real-secret-'.repeat(3));
  sessionVerifier.mockResolvedValue({ uid: OWNER, signInProvider: 'password' });
  db.ops = [];
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

async function runMaintenance() {
  const h: Record<string, string> = { cookie: `__session=${COOKIE}`, origin: ORIGIN, 'content-type': 'application/json' };
  const t = issueCsrfToken(COOKIE); if (t.ok) h['x-parallax-csrf'] = t.token;
  const { POST } = await import('@/app/api/command-center/pipeline/maintenance/route');
  const res = await POST(new NextRequest(`${ORIGIN}/api/command-center/pipeline/maintenance`, { method: 'POST', headers: h, body: '{}' }));
  return { status: res.status, body: (await res.json()) as { franchisesRemoved: number; removed: string[]; flaggedForReview: Array<{ id: string; stage: string }> } };
}
const lead = (id: string, company: string, stage: string | null, value: number, meta: Record<string, unknown> = { city: 'Miami, FL' }): Row =>
  ({ id, company, name: null, stage, value, meta: { ...meta }, notes: null });

describe('P05-B4 preflight: pipeline maintenance never destroys closed-won revenue', () => {
  it('a closed-won chain client keeps stage, value and recommendation', async () => {
    const won = lead('w1', "McDonald's of Coral Gables", 'closed', 12000, { city: 'Miami, FL', recommendation: { plan: 'x' } });
    db.client = tableDb([won]);
    const { status, body } = await runMaintenance();
    expect(status).toBe(200);
    expect(won).toMatchObject({ stage: 'closed', value: 12000, meta: { recommendation: { plan: 'x' } } });
    expect(won.meta.disqualified).toBeUndefined();
    expect(body.franchisesRemoved).toBe(0);
    expect(db.ops.filter((o) => o.table === 'pipeline_leads' && o.ops.some((x) => x[0] === 'update'))).toHaveLength(0);
  });
  it.each(['proposal', 'negotiation'])('a chain in %s is flagged for review, not changed', async (stage) => {
    const deal = lead('d1', "McDonald's Doral", stage, 9000);
    db.client = tableDb([deal]);
    const { body } = await runMaintenance();
    expect(deal).toMatchObject({ stage, value: 9000 });
    expect(body.flaggedForReview).toEqual([expect.objectContaining({ id: 'd1', stage })]);
  });
  it.each(['lost', 'won', 'archived', null])('stage %s (lost, or outside the live CHECK set / NOT NULL column) is never touched', async (stage) => {
    const r = lead('x1', "McDonald's", stage, 500);
    db.client = tableDb([r]);
    await runMaintenance();
    expect(r).toMatchObject({ stage, value: 500 });
  });
  it.each(['lead', 'qualified'])('legitimate behavior preserved: a chain prospect at stage %s is disqualified', async (stage) => {
    const p = lead('p1', "McDonald's Hialeah", stage, 7490);
    db.client = tableDb([p]);
    const { body } = await runMaintenance();
    expect(p).toMatchObject({ stage: 'lost', value: 0, meta: { disqualified: true, disqualifyCode: 'chain' } });
    expect(body.franchisesRemoved).toBe(1);
  });
  it('the UPDATE itself requires a sweepable stage, so a lead that closed after the read is untouched', async () => {
    const p = lead('race', "McDonald's Kendall", 'lead', 7490);
    const client = tableDb([p]);
    // Simulate the owner closing the deal between the read and the update.
    db.client = { from: (t: string) => { const c = client.from(t) as Record<string, unknown>; const upd = c.update as (...a: unknown[]) => unknown; c.update = (...a: unknown[]) => { p.stage = 'closed'; p.value = 15000; return upd(...a); }; return c; } };
    const { body } = await runMaintenance();
    expect(p).toMatchObject({ stage: 'closed', value: 15000 });
    expect(body.franchisesRemoved).toBe(0);
    const upd = db.ops.find((o) => o.ops.some((x) => x[0] === 'update'))!;
    expect(upd.ops).toContainEqual(['in', 'stage', ['lead', 'qualified']]);
  });
  it('a lead that closed mid-run with no city and fresh metadata is not overwritten from the stale read (Codex review)', async () => {
    const p = lead('race2', "McDonald's Westchester", 'lead', 7490, { recommendation: null });
    p.notes = '10 Main St, Miami, FL 33155';
    const client = tableDb([p]);
    db.client = { from: (t: string) => { const c = client.from(t) as Record<string, unknown>; const upd = c.update as (...a: unknown[]) => unknown; c.update = (...a: unknown[]) => { p.stage = 'closed'; p.value = 15000; p.meta = { recommendation: { plan: 'signed' } }; return upd(...a); }; return c; } };
    const { body } = await runMaintenance();
    expect(p).toMatchObject({ stage: 'closed', value: 15000, meta: { recommendation: { plan: 'signed' } } });
    expect(p.meta.city).toBeUndefined();
    expect(body.franchisesRemoved).toBe(0);
    expect(db.ops.filter((o) => o.table === 'pipeline_leads' && o.ops.some((x) => x[0] === 'update'))).toHaveLength(1); // only the refused sweep
  });
  it('city backfill is conditioned on the stage it read, so a stage change meanwhile is not overwritten', async () => {
    const indie = lead('i2', "Rosa's Taqueria", 'lead', 7490, {});
    indie.notes = '5 Oak Ave, Miami, FL 33130';
    const client = tableDb([indie]);
    db.client = { from: (t: string) => { const c = client.from(t) as Record<string, unknown>; const upd = c.update as (...a: unknown[]) => unknown; c.update = (...a: unknown[]) => { indie.stage = 'closed'; indie.meta = { recommendation: { plan: 'signed' } }; return upd(...a); }; return c; } };
    await runMaintenance();
    expect(indie.meta).toEqual({ recommendation: { plan: 'signed' } });
    const upd = db.ops.find((o) => o.ops.some((x) => x[0] === 'update'))!;
    expect(upd.ops).toContainEqual(['eq', 'stage', 'lead']);
  });
  it('an update error disqualifies nothing and writes no disqualification event', async () => {
    const p = lead('err', "McDonald's Aventura", 'lead', 7490);
    db.client = tableDb([p], { failUpdateFor: 'err' });
    const { body } = await runMaintenance();
    expect(body.franchisesRemoved).toBe(0);
    expect(p).toMatchObject({ stage: 'lead', value: 7490 });
    expect(db.ops.filter((o) => o.table === 'pipeline_events')).toHaveLength(0);
  });
  it('a skipped sweep (closed, review stage) writes no disqualification event', async () => {
    db.client = tableDb([lead('c1', "McDonald's", 'closed', 5000), lead('n1', "McDonald's", 'negotiation', 5000)]);
    await runMaintenance();
    expect(db.ops.filter((o) => o.table === 'pipeline_events')).toHaveLength(0);
  });
  it('an independent (non-chain) business is never disqualified, whatever its stage', async () => {
    const r = lead('i1', "Rosa's Taqueria", 'lead', 7490);
    db.client = tableDb([r]);
    await runMaintenance();
    expect(r).toMatchObject({ stage: 'lead', value: 7490 });
  });
  it('city backfill still runs for closed-won clients (non-destructive)', async () => {
    const won = lead('w2', "McDonald's Brickell", 'closed', 12000, {});
    won.notes = '123 Main St, Miami, FL 33130';
    db.client = tableDb([won]);
    await runMaintenance();
    expect(won).toMatchObject({ stage: 'closed', value: 12000 });
    expect(typeof won.meta.city).toBe('string');
  });
  it('requires the P03 owner mutation guard', async () => {
    db.client = tableDb([]);
    const { POST } = await import('@/app/api/command-center/pipeline/maintenance/route');
    const res = await POST(new NextRequest(`${ORIGIN}/api/command-center/pipeline/maintenance`, { method: 'POST', headers: { cookie: `__session=${COOKIE}`, origin: ORIGIN } }));
    expect(res.status).toBe(403);
  });
});

describe('P05-B4 preflight: nurture email 3 makes no unsupported claims', () => {
  it('the proof touch cites only the lead’s own audit, no other client, place, timeline or result', async () => {
    const { NURTURE_SEQUENCE } = await import('@/lib/nurture-sequence');
    const s = NURTURE_SEQUENCE.find((x) => x.key === 'proof')!;
    const l = { business: 'Fixture Co', name: 'Pat', gaps: ['No Google Business Profile'] };
    const subject = s.subject(l);
    const body = s.body(l);
    expect(body).toContain('From your audit, the first thing I would fix is this: No Google Business Profile.');
    for (const text of [subject, body]) {
      expect(text).not.toMatch(/another|near you|local spot|a business like|within|months?|weeks?|calls\/bookings|bookings followed|clients? (saw|got)|results?/i);
      expect(text).not.toMatch(/\d/); // no figures
      expect(text).not.toMatch(/[–—…]/); // brand voice
    }
  });
  it('without findings it still claims nothing', async () => {
    const { NURTURE_SEQUENCE } = await import('@/lib/nurture-sequence');
    const s = NURTURE_SEQUENCE.find((x) => x.key === 'proof')!;
    const body = s.body({ business: 'Fixture Co', gaps: [] });
    expect(body).not.toMatch(/another|near you|months?|results?|first thing I would fix/i);
  });
  it('the step key is unchanged, so existing gate drafts still match the duplicate check', async () => {
    const { NURTURE_SEQUENCE } = await import('@/lib/nurture-sequence');
    expect(NURTURE_SEQUENCE.map((x) => x.key)).toEqual(['deliver-audit', 'value-followup', 'proof', 'booking-ask', 'final']);
  });
});

describe('P05-B4 preflight: Next.js route modules export only handlers and route config', () => {
  it('no route.ts exports anything else (next build rejects extra exports)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const allowed = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'dynamic', 'dynamicParams', 'revalidate', 'fetchCache', 'runtime', 'preferredRegion', 'maxDuration', 'generateStaticParams']);
    const bad: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/^route\.(ts|tsx|js)$/.test(e.name)) {
          const t = fs.readFileSync(p, 'utf8');
          for (const m of t.matchAll(/^export\s+(?:async\s+)?(?:const|function|let|var|class)\s+([A-Za-z0-9_]+)/gm)) if (!allowed.has(m[1])) bad.push(`${p}:${m[1]}`);
          for (const m of t.matchAll(/^export\s*\{([^}]*)\}/gm)) for (const n of m[1].split(',').map((x) => x.trim().split(/\s+as\s+/).pop()!).filter(Boolean)) if (!allowed.has(n)) bad.push(`${p}:${n}`);
        }
      }
    };
    walk('src/app');
    expect(bad).toEqual([]);
  });
});
