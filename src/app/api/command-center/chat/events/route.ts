import { randomUUID } from "node:crypto";
import { guardPrivateRead } from "@/lib/server/protected-mutation";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { UUID_RE, noStoreJson, verifyPushSignature } from "@/lib/server/cockpit-chat-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_MS = 25_000;
/** Re-check the owner session on open streams (Codex finding 2). */
const REAUTH_MS = 5 * 60_000;
/** Hard stream lifetime; EventSource reconnects and passes the guard again with the current cookie. */
const MAX_STREAM_MS = 30 * 60_000;

/**
 * P05-B2: owner-only Server-Sent Events relay for chat changes.
 *
 * The browser no longer subscribes to Supabase Realtime with the anon key.
 * This route subscribes server-side with the service role, scoped narrowly:
 *   ?channelId=<uuid>  -> INSERT/UPDATE on that channel's messages + reaction changes
 *   ?scope=pulse       -> one notification per new message: { channel_id } only (no content)
 *   ?scope=push        -> agent messages inserted with metadata.speak = true, as `push`
 *                         events for the layout toast (replaces the public cc-push broadcast)
 *
 * Events: `ready` (server subscription live), `change` ({ table, eventType, new, old }),
 * `rt-error` ({ status }). Comment lines are heartbeats.
 */
export async function GET(req: Request) {
  const p03Guard = await guardPrivateRead(req);
  if (!p03Guard.ok) return p03Guard.response;
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope");
  const pulse = scope === "pulse";
  const push = scope === "push";
  const channelId = url.searchParams.get("channelId") ?? "";
  if (!pulse && !push && !UUID_RE.test(channelId)) return noStoreJson({ error: "channelId must be a UUID" }, 400);
  const svc = getSupabaseAdmin();
  if (!svc) return noStoreJson({ error: "Supabase not configured" }, 503);

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const write = (chunk: string) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(chunk)); } catch { cleanup?.(); }
      };
      const send = (event: string, data: unknown) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      const scopeName = pulse ? "pulse" : push ? "push" : "channel";
      const rt = svc.channel(`cc-sse-${pulse || push ? scopeName : channelId}-${randomUUID()}`);
      if (push) {
        rt.on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "sender_type=eq.agent" }, (p) => {
          const row = (p.new ?? {}) as Record<string, unknown>;
          const meta = (row.metadata ?? {}) as Record<string, unknown>;
          if (meta.speak !== true) return;
          // Only rows written by the authenticated push route carry a valid signature.
          if (!verifyPushSignature(row.id, row.channel_id, meta.agentId, row.content, meta.pushSig, meta.pushTs)) return;
          send("push", {
            messageId: row.id ?? null,
            channelId: row.channel_id ?? null,
            agentId: typeof meta.agentId === "string" ? meta.agentId : null,
            content: row.content ?? null,
            createdAt: row.created_at ?? null,
          });
        });
      } else if (pulse) {
        rt.on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
          const row = (p.new ?? {}) as Record<string, unknown>;
          send("change", { table: "messages", eventType: "INSERT", new: { channel_id: row.channel_id ?? null }, old: null });
        });
      } else {
        rt.on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` }, (p) => {
          send("change", { table: "messages", eventType: p.eventType, new: p.new ?? null, old: p.old ?? null });
        }).on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (p) => {
          const pick = (r: unknown) => {
            const o = (r ?? {}) as Record<string, unknown>;
            return typeof o.message_id === "string" && UUID_RE.test(o.message_id) ? { message_id: o.message_id } : null;
          };
          const n = pick(p.new);
          const o = pick(p.old);
          const messageId = n?.message_id ?? o?.message_id;
          // Forward only reactions on this channel's messages (Codex finding 4). Events with no
          // message_id (a DELETE under default replica identity) cannot be attributed to a
          // channel and the page ignores them, so they are dropped; the polling fallback
          // reconciles removed reactions.
          if (!messageId) return;
          void Promise.resolve(svc.from("messages").select("channel_id").eq("id", messageId).maybeSingle())
            .then(({ data }) => {
              if ((data as { channel_id?: string } | null)?.channel_id !== channelId) return;
              send("change", { table: "message_reactions", eventType: p.eventType, new: n, old: o });
            })
            .catch(() => {});
        });
      }
      rt.subscribe((status) => {
        if (status === "SUBSCRIBED") send("ready", { scope: scopeName });
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") send("rt-error", { status });
      });
      let disposed = false;
      const heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);
      const reauth = setInterval(() => {
        void guardPrivateRead(req).then((g) => {
          if (!g.ok) { send("rt-error", { status: "CLOSED", reason: "reauth_failed" }); cleanup?.(); }
        }).catch(() => cleanup?.());
      }, REAUTH_MS);
      const lifetime = setTimeout(() => cleanup?.(), MAX_STREAM_MS);

      // Dispose exactly once, independent of whether writes already failed (Codex finding 5).
      cleanup = () => {
        if (disposed) return;
        disposed = true;
        closed = true;
        clearInterval(heartbeat);
        clearInterval(reauth);
        clearTimeout(lifetime);
        void svc.removeChannel(rt).catch(() => {});
        try { controller.close(); } catch { /* already closed */ }
      };
      if (req.signal.aborted) { cleanup(); return; }
      req.signal.addEventListener("abort", () => cleanup?.(), { once: true });
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
