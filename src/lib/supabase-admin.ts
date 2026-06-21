// /Users/admin/ramiche-site/src/lib/supabase-admin.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service-role key.
 *
 * Bypasses RLS — NEVER import this into client components. Used by the
 * Command Center pipeline API routes, which are the only path to the
 * RLS-locked pipeline_* tables.
 *
 * Returns null when env is missing so routes can degrade to a clear 503
 * instead of throwing at import time.
 */
// Cache one client per process so rapid bursts (auto-prep batches) reuse the same
// connection pool instead of spinning up a new client + connections per request.
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
