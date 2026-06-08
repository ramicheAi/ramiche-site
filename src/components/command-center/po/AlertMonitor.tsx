'use client';

/* ============================================================================
 * PARALLAX OS — AlertMonitor. Feeds the global alert ticker with REAL criticals
 * (not mock): errored/stuck jobs and failed Stripe charges. Polls every 30s,
 * reconciles the bus (clears keys that no longer apply). Renders nothing.
 * High-signal only — the cockpit should interrupt the founder, never cry wolf.
 * ========================================================================== */

import { useEffect, useRef } from 'react';
import { poAlertBus } from '@/lib/po-alert-bus';
import { serialFor } from '@/components/command-center/po/Instrument';

const POLL_MS = 30_000;
const STUCK_MS = 20 * 60 * 1000; // a running job older than 20m is "stuck"

type Job = { id: string; title?: string; status?: string; created_at?: string; error?: string | null };
type Tx = { id: string; description?: string; amount?: number; status?: string };

export default function AlertMonitor() {
  // keys we set on the previous cycle, so we can clear ones that recovered
  const owned = useRef<Set<string>>(new Set());

  useEffect(() => {
    let stopped = false;

    async function tick() {
      const next = new Set<string>();
      const get = (p: string) =>
        fetch(p, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

      const [jobsRes, revRes] = await Promise.all([
        get('/api/command-center/jobs'),
        get('/api/command-center/stripe-revenue'),
      ]);
      if (stopped) return;

      // --- errored / stuck jobs ---
      const jobs: Job[] = jobsRes?.jobs ?? [];
      const now = Date.now();
      for (const j of jobs) {
        const st = (j.status ?? '').toLowerCase();
        const failed = st === 'error' || st === 'failed';
        const startedAt = j.created_at ? Date.parse(j.created_at) : NaN;
        const running = st === 'running' || st === 'working' || st === 'active' || st === 'in_progress';
        const stuck = running && Number.isFinite(startedAt) && now - startedAt > STUCK_MS;
        if (failed || stuck) {
          const key = `job:${j.id}`;
          next.add(key);
          poAlertBus.set(key, {
            label: failed ? 'JOB FAILED' : 'JOB STUCK',
            value: (j.title || 'untitled job').slice(0, 60),
            page: 'jobs',
            pageLabel: 'Jobs',
            serial: serialFor(j.id),
          });
        }
      }

      // --- failed Stripe charges ---
      const txs: Tx[] = revRes?.recentTransactions ?? [];
      for (const t of txs) {
        if ((t.status ?? '').toLowerCase() === 'failed') {
          const key = `pay:${t.id}`;
          next.add(key);
          poAlertBus.set(key, {
            label: 'PAYMENT FAILED',
            value: `${t.description || 'charge'}${t.amount ? ` · $${Math.round(t.amount)}` : ''}`.slice(0, 60),
            page: 'finance',
            pageLabel: 'Finance HQ',
            serial: serialFor(t.id),
          });
        }
      }

      // --- reconcile: clear anything we set last cycle that recovered ---
      for (const key of owned.current) if (!next.has(key)) poAlertBus.clear(key);
      owned.current = next;
    }

    void tick();
    const iv = setInterval(() => void tick(), POLL_MS);
    return () => {
      stopped = true;
      clearInterval(iv);
      for (const key of owned.current) poAlertBus.clear(key);
      owned.current = new Set();
    };
  }, []);

  return null;
}
