// /Users/admin/ramiche-site/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * Throttled reconnect schedule for Supabase Realtime.
 *
 * Default supabase-js retries: 1s → 2s → 5s → 10s. When the Cloudflare-fronted
 * Realtime tenant rejects the browser's WebSocket handshake (we've observed
 * intermittent CHANNEL_ERROR / failed handshake on some Chrome installs
 * even though Node connects fine from the same machine), the default schedule
 * spams hundreds of failed attempts per hour and floods DevTools with
 * "WebSocket connection ... failed" lines.
 *
 * This schedule slows that down massively: 5s for the first couple tries
 * (in case it's a transient blip), then 30s, then 60s and stays there.
 * Combined with the REST polling fallback on the chat page, the user gets
 * live message updates regardless of whether the WS ever recovers — and
 * we don't hammer Cloudflare in the meantime.
 */
function reconnectAfterMs(tries: number): number {
  if (tries <= 1) return 5_000
  if (tries <= 3) return 30_000
  return 60_000
}

function createSafeClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null
  try {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
        heartbeatIntervalMs: 30_000,
        reconnectAfterMs,
      },
    })
  } catch {
    console.warn('Supabase client init failed')
    return null
  }
}

export const supabase = createSafeClient()