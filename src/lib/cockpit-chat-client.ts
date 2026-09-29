/**
 * P05-B2: browser-side chat data access through owner-guarded server routes.
 *
 * Replaces the cockpit's direct anon-key Supabase reads, writes and Realtime
 * subscriptions on `messages`, `message_reactions`, `channels` and
 * `agent_profiles`. Result shapes mirror supabase-js (`{ data, error }`) and the
 * realtime adapter mirrors `.channel().on("postgres_changes", …).subscribe()` so
 * existing page logic keeps working unchanged.
 */
import { cockpitFetch } from "@/lib/cockpit-fetch";

export type Row = Record<string, unknown>;
export type DataResult<T> = { data: T | null; error: { message: string } | null };

async function readJson<T>(res: Response): Promise<T | null> {
  try { return (await res.json()) as T; } catch { return null; }
}

async function getData<T>(url: string): Promise<DataResult<T>> {
  try {
    const res = await cockpitFetch(url, { cache: "no-store" });
    const body = await readJson<{ data?: T; error?: { message: string } | null }>(res);
    if (!res.ok || !body) return { data: null, error: { message: body?.error?.message ?? `HTTP ${res.status}` } };
    return { data: (body.data ?? null) as T | null, error: body.error ?? null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : "network error" } };
  }
}

export const cockpitChatData = {
  async bootstrap(): Promise<{ channels: Row[] | null; agents: Row[] | null; error: { message: string } | null }> {
    try {
      const res = await cockpitFetch("/api/command-center/chat/bootstrap", { cache: "no-store" });
      const body = await readJson<{ channels?: Row[]; agents?: Row[]; error?: { message: string } | null }>(res);
      if (!res.ok || !body) return { channels: null, agents: null, error: { message: body?.error?.message ?? `HTTP ${res.status}` } };
      return { channels: body.channels ?? [], agents: body.agents ?? [], error: null };
    } catch (e) {
      return { channels: null, agents: null, error: { message: e instanceof Error ? e.message : "network error" } };
    }
  },
  messages(channelId: string, opts: { limit: number; order: "asc" | "desc" }): Promise<DataResult<Row[]>> {
    const q = new URLSearchParams({ channelId, limit: String(opts.limit), order: opts.order });
    return getData<Row[]>(`/api/command-center/chat/messages?${q.toString()}`);
  },
  reactions(messageIds: string[]): Promise<DataResult<Row[]>> {
    if (messageIds.length === 0) return Promise.resolve({ data: [], error: null });
    return getData<Row[]>(`/api/command-center/chat/reactions?messageIds=${encodeURIComponent(messageIds.slice(0, 200).join(","))}`);
  },
  async insertUserMessage(payload: {
    channelId: string;
    content: string;
    attachments: unknown[];
    threadParentId: string | null;
    metadata: Record<string, unknown>;
  }): Promise<DataResult<{ id: string }>> {
    try {
      const res = await cockpitFetch("/api/command-center/chat/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await readJson<{ data?: { id: string }; error?: { message: string } | null }>(res);
      if (!res.ok || !body?.data?.id) return { data: null, error: { message: body?.error?.message ?? `HTTP ${res.status}` } };
      return { data: body.data, error: null };
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : "network error" } };
    }
  },
  galleryOutputs(): Promise<Response> {
    return cockpitFetch("/api/command-center/gallery/outputs", { cache: "no-store" });
  },
};

/* ── Realtime adapter over the owner-only SSE relay ─────────────────────── */

type ChangeFilter = { event: "INSERT" | "UPDATE" | "DELETE" | "*"; schema?: string; table: string; filter?: string };
type ChangePayload = { eventType: string; new: Row | null; old: Row | null; table: string };
type Listener = { cfg: ChangeFilter; cb: (payload: ChangePayload) => void };
export type RealtimeStatus = "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED";

export class CockpitRealtimeChannel {
  private listeners: Listener[] = [];
  private source: EventSource | null = null;
  constructor(readonly name: string) {}

  on(_type: "postgres_changes", cfg: ChangeFilter, cb: (payload: ChangePayload) => void): this {
    this.listeners.push({ cfg, cb });
    return this;
  }

  /** Scope: a channel_id filter on `messages` → channel stream; otherwise the content-free pulse stream. */
  private streamUrl(): string {
    const f = this.listeners.map((l) => l.cfg.filter).find((x) => typeof x === "string" && x.startsWith("channel_id=eq."));
    if (f) return `/api/command-center/chat/events?channelId=${encodeURIComponent(f.slice("channel_id=eq.".length))}`;
    return "/api/command-center/chat/events?scope=pulse";
  }

  subscribe(onStatus?: (status: RealtimeStatus) => void): this {
    if (typeof EventSource === "undefined") { onStatus?.("CHANNEL_ERROR"); return this; }
    const es = new EventSource(this.streamUrl(), { withCredentials: true });
    this.source = es;
    es.addEventListener("ready", () => onStatus?.("SUBSCRIBED"));
    es.addEventListener("rt-error", (ev) => {
      let status: RealtimeStatus = "CHANNEL_ERROR";
      try { const s = JSON.parse((ev as MessageEvent).data).status; if (s === "TIMED_OUT" || s === "CLOSED") status = s; } catch { /* keep default */ }
      onStatus?.(status);
    });
    es.addEventListener("change", (ev) => {
      let p: ChangePayload;
      try { p = JSON.parse((ev as MessageEvent).data) as ChangePayload; } catch { return; }
      for (const l of this.listeners) {
        if (l.cfg.table !== p.table) continue;
        if (l.cfg.event !== "*" && l.cfg.event !== p.eventType) continue;
        l.cb(p);
      }
    });
    // EventSource reconnects automatically; surface the gap so the page's polling fallback engages.
    es.onerror = () => onStatus?.(es.readyState === EventSource.CLOSED ? "CLOSED" : "CHANNEL_ERROR");
    return this;
  }

  close(): void {
    this.source?.close();
    this.source = null;
  }
}

export const cockpitRealtime = {
  channel(name: string): CockpitRealtimeChannel {
    return new CockpitRealtimeChannel(name);
  },
  removeChannel(ch: CockpitRealtimeChannel | null): Promise<void> {
    ch?.close();
    return Promise.resolve();
  },
};
