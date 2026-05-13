"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const READ_KEY = "cc-chat-read-at";
const POLL_MS = 25_000;

export interface PulseRecent {
  id: string;
  channelId: string | null;
  content: string;
  senderType: string | null;
  agentId: string | null;
  createdAt: string;
  pinned: boolean;
}

export interface PulsePinned {
  id: string;
  channelId: string | null;
  content: string;
  agentId: string | null;
  createdAt: string;
}

export interface ChatPulse {
  available: boolean;
  unread: number;
  recent: PulseRecent[];
  pinned: PulsePinned[];
  pinnedCount: number;
  latestAt: string | null;
  lastReadAt: string | null;
  refresh: () => void;
  markRead: () => void;
}

interface PulseResponse {
  available: boolean;
  unread?: number;
  recent?: PulseRecent[];
  pinned?: PulsePinned[];
  pinnedCount?: number;
  latestAt?: string | null;
}

function loadReadAt(): string {
  if (typeof window === "undefined") return new Date(0).toISOString();
  try {
    const v = window.localStorage.getItem(READ_KEY);
    if (v && !Number.isNaN(Date.parse(v))) return v;
  } catch {
    /* ignore */
  }
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

function saveReadAt(iso: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(READ_KEY, iso);
  } catch {
    /* ignore */
  }
}

export function useChatPulse(): ChatPulse {
  const [available, setAvailable] = useState(true);
  const [unread, setUnread] = useState(0);
  const [recent, setRecent] = useState<PulseRecent[]>([]);
  const [pinned, setPinned] = useState<PulsePinned[]>([]);
  const [pinnedCount, setPinnedCount] = useState(0);
  const [latestAt, setLatestAt] = useState<string | null>(null);
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);

  const readRef = useRef<string>(loadReadAt());

  useEffect(() => {
    setLastReadAt(readRef.current);
  }, []);

  const fetchPulse = useCallback(async () => {
    try {
      const since = readRef.current;
      const res = await fetch(
        `/api/command-center/chat/pulse?since=${encodeURIComponent(since)}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = (await res.json()) as PulseResponse;
      if (!data.available) {
        setAvailable(false);
        return;
      }
      setAvailable(true);
      setUnread(data.unread ?? 0);
      setRecent(data.recent ?? []);
      setPinned(data.pinned ?? []);
      setPinnedCount(data.pinnedCount ?? data.pinned?.length ?? 0);
      setLatestAt(data.latestAt ?? null);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void fetchPulse();
    const id = window.setInterval(() => void fetchPulse(), POLL_MS);
    return () => window.clearInterval(id);
  }, [fetchPulse]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const channel = client
      .channel("cc-pulse")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          void fetchPulse();
        }
      )
      .subscribe();
    return () => {
      try {
        client.removeChannel(channel);
      } catch {
        /* ignore */
      }
    };
  }, [fetchPulse]);

  const markRead = useCallback(() => {
    const now = new Date().toISOString();
    readRef.current = now;
    saveReadAt(now);
    setLastReadAt(now);
    setUnread(0);
  }, []);

  return {
    available,
    unread,
    recent,
    pinned,
    pinnedCount,
    latestAt,
    lastReadAt,
    refresh: fetchPulse,
    markRead,
  };
}
