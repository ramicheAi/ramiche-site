"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { playVoiceReply, type VoicePlaybackHandle } from "@/lib/voice-playback";

const TOKENS = {
  bg: "rgba(10,10,10,0.96)",
  border: "#1e1e1e",
  text: "#e5e5e5",
  textDim: "#888888",
  textMuted: "#555555",
  cyan: "#00f0ff",
  gold: "#C9A84C",
  purple: "#a855f7",
  red: "#ef4444",
};

const AGENT_TINTS: Record<string, string> = {
  atlas: TOKENS.gold,
  triage: "#22c55e",
  shuri: "#10b981",
  nova: "#f97316",
  simons: "#22d3ee",
  mercury: "#34d399",
  vee: "#f472b6",
  ink: "#a78bfa",
  echo: "#fb923c",
  haven: "#38bdf8",
  widow: "#ef4444",
  "dr-strange": "#a855f7",
  kiyosaki: "#fbbf24",
  michael: "#3b82f6",
  selah: "#c4b5fd",
  prophets: "#fbbf24",
  themaestro: "#ec4899",
  themis: "#818cf8",
  aetherion: "#8b5cf6",
  proximon: "#06b6d4",
  archivist: "#9ca3af",
};

interface PushPayload {
  messageId: string;
  channelId: string;
  agentId: string;
  content: string;
  createdAt: string;
}

interface ToastItem extends PushPayload {
  id: string;
  speakRequested: boolean;
}

const DEFAULT_DURATION_MS = 12_000;

function ucFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function tintFor(agentId: string): string {
  return AGENT_TINTS[agentId.toLowerCase()] ?? TOKENS.purple;
}

/**
 * Listens for agent push broadcasts on the Supabase `cc-push` channel and pops
 * a transient toast with a Speak / Open chat CTA. Auto-speaks when the
 * broadcast carries `speak: true`. Toasts auto-dismiss after 12 s.
 */
export function PushToast() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const playbackRef = useRef<Map<string, VoicePlaybackHandle>>(new Map());

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    const handle = playbackRef.current.get(id);
    if (handle) {
      handle.stop();
      playbackRef.current.delete(id);
    }
  }, []);

  const speak = useCallback(async (item: ToastItem) => {
    const handle = playVoiceReply(item.content);
    playbackRef.current.set(item.id, handle);
    try {
      await handle.done;
    } finally {
      playbackRef.current.delete(item.id);
    }
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const channel = client
      .channel("cc-push")
      .on("broadcast", { event: "agent.speak" }, (payload) => {
        const raw = (payload?.payload ?? {}) as Partial<PushPayload> & { speak?: boolean };
        if (!raw.messageId || !raw.agentId || !raw.content) return;
        const item: ToastItem = {
          id: `${raw.messageId}-${Date.now()}`,
          messageId: String(raw.messageId),
          channelId: String(raw.channelId ?? ""),
          agentId: String(raw.agentId),
          content: String(raw.content),
          createdAt: String(raw.createdAt ?? new Date().toISOString()),
          speakRequested: true,
        };
        setItems((prev) => [...prev, item].slice(-3));
        void speak(item);
      })
      .subscribe();
    return () => {
      try {
        client.removeChannel(channel);
      } catch {
        /* ignore */
      }
    };
  }, [speak]);

  useEffect(() => {
    if (items.length === 0) return;
    const timers = items.map((item) =>
      window.setTimeout(() => dismiss(item.id), DEFAULT_DURATION_MS)
    );
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [items, dismiss]);

  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 80,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxWidth: "min(360px, calc(100vw - 40px))",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        pointerEvents: "none",
      }}
    >
      {items.map((item) => {
        const tint = tintFor(item.agentId);
        return (
          <div
            key={item.id}
            role="status"
            style={{
              pointerEvents: "auto" as const,
              background: TOKENS.bg,
              border: `1px solid ${tint}55`,
              borderLeft: `3px solid ${tint}`,
              borderRadius: 10,
              padding: "12px 14px",
              boxShadow: `0 12px 36px rgba(0,0,0,0.55), 0 0 32px ${tint}33`,
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              color: TOKENS.text,
              animation: "ccPushIn 280ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span
                aria-hidden
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: `${tint}22`,
                  border: `1px solid ${tint}66`,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontFamily: "monospace",
                  fontWeight: 700,
                  color: tint,
                }}
              >
                {item.agentId.slice(0, 2).toUpperCase()}
              </span>
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase" as const,
                  color: tint,
                  fontWeight: 700,
                }}
              >
                {ucFirst(item.agentId.replace(/-/g, " "))} · push
              </span>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss"
                style={{
                  marginLeft: "auto",
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  border: `1px solid ${TOKENS.border}`,
                  background: "transparent",
                  color: TOKENS.textDim,
                  fontSize: 12,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.5,
                color: TOKENS.text,
                display: "-webkit-box",
                WebkitBoxOrient: "vertical" as const,
                WebkitLineClamp: 4,
                overflow: "hidden",
                marginBottom: 10,
              }}
            >
              {item.content}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                onClick={() => void speak(item)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: `1px solid ${tint}55`,
                  background: `${tint}1a`,
                  color: tint,
                  cursor: "pointer",
                  fontFamily: "monospace",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase" as const,
                }}
              >
                Speak
              </button>
              <Link
                href={`/command-center/chat#msg=${item.messageId}`}
                onClick={() => dismiss(item.id)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: `1px solid ${TOKENS.border}`,
                  background: "transparent",
                  color: TOKENS.textDim,
                  textDecoration: "none",
                  fontFamily: "monospace",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase" as const,
                }}
              >
                Open
              </Link>
              <span
                style={{
                  marginLeft: "auto",
                  fontFamily: "monospace",
                  fontSize: 10,
                  color: TOKENS.textMuted,
                }}
              >
                {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        );
      })}
      <style>{`
        @keyframes ccPushIn {
          from { transform: translateX(28px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
