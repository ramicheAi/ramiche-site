"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { composeBriefing, type BriefingInput, type ComposedBriefing } from "@/lib/cc-briefing";
import { playVoiceReply, type VoicePlaybackHandle } from "@/lib/voice-playback";

const AUTO_KEY = "cc-briefing-auto";
const LAST_DATE_KEY = "cc-briefing-last-date";
const COMPOSE_CACHE_KEY = "cc-briefing-compose-cache";
const AUTO_DELAY_MS = 1800;
const COMPOSE_TTL_MS = 12 * 60 * 60 * 1000;

export type BriefingStatus = "idle" | "loading" | "ready" | "speaking" | "error";
export type BriefingSource = "deterministic" | "atlas";

export interface UseBriefingResult {
  status: BriefingStatus;
  open: boolean;
  setOpen: (open: boolean) => void;
  briefing: ComposedBriefing | null;
  source: BriefingSource;
  raw: BriefingInput | null;
  autoEnabled: boolean;
  setAutoEnabled: (v: boolean) => void;
  speak: () => Promise<void>;
  stop: () => void;
  refresh: () => Promise<void>;
  regenerate: () => Promise<void>;
  lastUpdated: string | null;
}

interface AgentsResponse {
  agents?: Array<{ id?: string; status?: string }>;
  count?: number;
  activeCount?: number;
}

interface RevenueResponse {
  subscriptions?: { mrr?: number; arr?: number };
  revenue?: { last30Days?: number };
}

interface CalendarResponse {
  events?: Array<{ time?: string; label?: string; agent?: string; enabled?: boolean }>;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadAutoEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(AUTO_KEY) !== "0";
  } catch {
    return true;
  }
}

function saveAutoEnabled(v: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUTO_KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function markSpokenToday(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_DATE_KEY, todayKey());
  } catch {
    /* ignore */
  }
}

function hasSpokenToday(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(LAST_DATE_KEY) === todayKey();
  } catch {
    return true;
  }
}

interface ComposeCacheEntry {
  date: string;
  cachedAt: number;
  spoken: string;
  bullets: string[];
  greeting: string;
  source: BriefingSource;
}

function loadComposeCache(): ComposeCacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COMPOSE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ComposeCacheEntry;
    if (parsed.date !== todayKey()) return null;
    if (Date.now() - parsed.cachedAt > COMPOSE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveComposeCache(entry: ComposeCacheEntry): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COMPOSE_CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* ignore */
  }
}

function clearComposeCache(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(COMPOSE_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

interface ComposeResponse {
  ok?: boolean;
  source?: BriefingSource;
  greeting?: string;
  spoken?: string;
  bullets?: string[];
}

export function useBriefing(): UseBriefingResult {
  const [status, setStatus] = useState<BriefingStatus>("idle");
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState<BriefingInput | null>(null);
  const [autoEnabled, setAutoEnabledState] = useState<boolean>(true);
  const [hydrated, setHydrated] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [override, setOverride] = useState<ComposedBriefing | null>(null);
  const [source, setSource] = useState<BriefingSource>("deterministic");
  const playbackRef = useRef<VoicePlaybackHandle | null>(null);
  const autoFiredRef = useRef(false);
  const composeInflightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    setHydrated(true);
    setAutoEnabledState(loadAutoEnabled());
    const cached = loadComposeCache();
    if (cached) {
      setOverride({ greeting: cached.greeting, spoken: cached.spoken, bullets: cached.bullets });
      setSource(cached.source);
    }
  }, []);

  const refresh = useCallback(async () => {
    setStatus((prev) => (prev === "speaking" ? prev : "loading"));
    try {
      const [aRes, rRes, cRes] = await Promise.allSettled([
        fetch("/api/command-center/agents", { cache: "no-store" }),
        fetch("/api/command-center/revenue", { cache: "no-store" }),
        fetch("/api/command-center/calendar", { cache: "no-store" }),
      ]);

      const agentsJson =
        aRes.status === "fulfilled" && aRes.value.ok
          ? ((await aRes.value.json()) as AgentsResponse)
          : null;
      const revenueJson =
        rRes.status === "fulfilled" && rRes.value.ok
          ? ((await rRes.value.json()) as RevenueResponse)
          : null;
      const calendarJson =
        cRes.status === "fulfilled" && cRes.value.ok
          ? ((await cRes.value.json()) as CalendarResponse)
          : null;

      const total = agentsJson?.count ?? agentsJson?.agents?.length ?? 0;
      const active = agentsJson?.activeCount ?? 0;
      const idleList = (agentsJson?.agents ?? [])
        .filter((a) => a.status === "idle" && a.id)
        .map((a) => a.id!)
        .slice(0, 3);

      const next: BriefingInput = {
        now: new Date(),
        agents: { active, total, idle: idleList },
        revenue: {
          mrr: Number(revenueJson?.subscriptions?.mrr ?? 0),
          arr: Number(revenueJson?.subscriptions?.arr ?? 0),
          last30: Number(revenueJson?.revenue?.last30Days ?? 0),
        },
        events: (calendarJson?.events ?? [])
          .filter((e) => e.enabled !== false)
          .map((e) => ({ time: e.time, label: e.label, agent: e.agent }))
          .slice(0, 8),
      };

      setRaw(next);
      setLastUpdated(new Date().toISOString());
      setStatus((prev) => (prev === "speaking" ? prev : "ready"));
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const baseline = useMemo(() => (raw ? composeBriefing(raw) : null), [raw]);
  const composed = useMemo<ComposedBriefing | null>(
    () => override ?? baseline,
    [override, baseline]
  );

  const runCompose = useCallback(
    async (force = false) => {
      if (!raw) return;
      if (composeInflightRef.current) return composeInflightRef.current;
      if (!force) {
        const cached = loadComposeCache();
        if (cached) {
          setOverride({ greeting: cached.greeting, spoken: cached.spoken, bullets: cached.bullets });
          setSource(cached.source);
          return;
        }
      }
      const task = (async () => {
        try {
          const res = await fetch("/api/command-center/briefing/compose", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ facts: raw }),
          });
          if (!res.ok) return;
          const data = (await res.json()) as ComposeResponse;
          if (!data.ok || !data.spoken || !data.greeting || !data.bullets) return;
          const next: ComposedBriefing = {
            greeting: data.greeting,
            spoken: data.spoken,
            bullets: data.bullets,
          };
          setOverride(next);
          setSource(data.source ?? "deterministic");
          if (data.source === "atlas") {
            saveComposeCache({
              date: todayKey(),
              cachedAt: Date.now(),
              greeting: next.greeting,
              spoken: next.spoken,
              bullets: next.bullets,
              source: "atlas",
            });
          }
        } catch {
          /* keep deterministic fallback */
        }
      })();
      composeInflightRef.current = task;
      try {
        await task;
      } finally {
        composeInflightRef.current = null;
      }
    },
    [raw]
  );

  useEffect(() => {
    if (!hydrated) return;
    if (!baseline) return;
    if (override) return;
    void runCompose(false);
  }, [hydrated, baseline, override, runCompose]);

  const regenerate = useCallback(async () => {
    clearComposeCache();
    setOverride(null);
    setSource("deterministic");
    await runCompose(true);
  }, [runCompose]);

  const stop = useCallback(() => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    setStatus((s) => (s === "speaking" ? "ready" : s));
  }, []);

  const speak = useCallback(async () => {
    if (!composed) return;
    stop();
    setStatus("speaking");
    const handle = playVoiceReply(composed.spoken);
    playbackRef.current = handle;
    try {
      await handle.done;
      markSpokenToday();
    } finally {
      if (playbackRef.current === handle) playbackRef.current = null;
      setStatus((s) => (s === "speaking" ? "ready" : s));
    }
  }, [composed, stop]);

  const setAutoEnabled = useCallback((v: boolean) => {
    setAutoEnabledState(v);
    saveAutoEnabled(v);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!autoEnabled) return;
    if (!composed) return;
    if (autoFiredRef.current) return;
    if (hasSpokenToday()) return;
    autoFiredRef.current = true;
    const t = window.setTimeout(() => {
      setOpen(true);
      void speak();
    }, AUTO_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [hydrated, autoEnabled, composed, speak]);

  useEffect(() => {
    return () => {
      playbackRef.current?.stop();
      playbackRef.current = null;
    };
  }, []);

  return {
    status,
    open,
    setOpen,
    briefing: composed,
    source,
    raw,
    autoEnabled,
    setAutoEnabled,
    speak,
    stop,
    refresh,
    regenerate,
    lastUpdated,
  };
}
