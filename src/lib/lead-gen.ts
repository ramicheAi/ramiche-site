// /Users/admin/ramiche-site/src/lib/lead-gen.ts
// Shared engine for long agent generations (intel research, sales kit) tied to a
// lead. Fire-and-forget: the HTTP request returns instantly with a status, the
// generation runs in the background (we're on a persistent `next start` node, so
// this completes), and the result is written to the lead's meta for the UI to poll.
import type { SupabaseClient } from "@supabase/supabase-js";

// Read proxy config at CALL TIME, not module-load. In the long-running `next start`
// server the module-level const evaluated before env was fully applied, freezing the
// token to "not-needed" → HTTP 401 on every intel/kit generation (the prep "snag").
// cc-approve-synthesis reads at call time and works — match it. Also strip stray
// surrounding quotes/whitespace (Vercel-pulled .env.production.local quotes values).
function proxyConfig(): { url: string; token: string } {
  const clean = (v: string | undefined, fallback: string) =>
    ((v ?? "").trim().replace(/^["']|["']$/g, "").trim() || fallback);
  return {
    url: clean(process.env.CLAUDE_MAX_PROXY_URL, "http://127.0.0.1:3456/v1/chat/completions"),
    token: clean(process.env.CLAUDE_MAX_PROXY_TOKEN, "not-needed"),
  };
}

// Prevent a poll from kicking off a duplicate generation for the same field.
const inFlight = new Set<string>();

/** Call the local Claude Max proxy and parse a JSON object out of the reply. */
export async function callProxyJSON(
  system: string,
  user: string,
  opts: { model?: string; timeoutMs?: number } = {},
): Promise<unknown> {
  const { url, token } = proxyConfig();
  const once = async (): Promise<unknown> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 180_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ model: opts.model ?? "claude-sonnet-4-5", stream: false, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`agent proxy HTTP ${res.status}`);
      const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const raw = (j.choices?.[0]?.message?.content || "").trim();
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      const jsonStr = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
      return JSON.parse(jsonStr);
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    return await once();
  } catch (e) {
    // The model occasionally emits slightly-malformed JSON (esp. large kits) → a
    // SyntaxError from JSON.parse. Retry once with a fresh generation. Do NOT retry
    // proxy HTTP/network errors (auth/down) — surface those immediately.
    if (e instanceof SyntaxError) return await once();
    throw e;
  }
}

async function readMeta(db: SupabaseClient, leadId: string): Promise<Record<string, unknown>> {
  const { data } = await db.from("pipeline_leads").select("meta").eq("id", leadId).single();
  return (data?.meta && typeof data.meta === "object" ? data.meta : {}) as Record<string, unknown>;
}

/**
 * Kick off a background generation that writes `meta[field]` when done. Returns
 * immediately. Set `meta[field+"Status"]` to generating|done|error for polling.
 */
export async function startBackgroundGen(
  db: SupabaseClient,
  leadId: string,
  field: string,
  generate: () => Promise<unknown>,
): Promise<"generating"> {
  const key = `${leadId}:${field}`;
  if (inFlight.has(key)) return "generating";
  inFlight.add(key);

  const meta = await readMeta(db, leadId);
  await db.from("pipeline_leads").update({ meta: { ...meta, [`${field}Status`]: "generating" } }).eq("id", leadId);

  // Intentionally NOT awaited — runs to completion on the persistent node server.
  void (async () => {
    try {
      const result = await generate();
      const m = await readMeta(db, leadId);
      await db.from("pipeline_leads").update({ meta: { ...m, [field]: result, [`${field}Status`]: "done", [`${field}At`]: new Date().toISOString() } }).eq("id", leadId);
    } catch (e) {
      const m = await readMeta(db, leadId);
      await db.from("pipeline_leads").update({ meta: { ...m, [`${field}Status`]: "error", [`${field}Error`]: e instanceof Error ? e.message : "failed" } }).eq("id", leadId);
    } finally {
      inFlight.delete(key);
    }
  })();

  return "generating";
}
