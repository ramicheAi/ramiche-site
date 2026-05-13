"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import type { ChatPulse, PulseRecent } from "@/hooks/useChatPulse";

const TOKENS = {
  bg: "rgba(10,10,10,0.96)",
  card: "rgba(255,255,255,0.03)",
  cardHot: "rgba(124,58,237,0.10)",
  border: "#1e1e1e",
  borderAccent: "rgba(0,240,255,0.35)",
  text: "#e5e5e5",
  textDim: "#888888",
  textMuted: "#555555",
  purple: "#7c3aed",
  purpleSoft: "#a855f7",
  gold: "#C9A84C",
  cyan: "#00f0ff",
  green: "#10b981",
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

interface PulseDockProps {
  open: boolean;
  pulse: ChatPulse;
  onClose: () => void;
}

function tintFor(agentId: string | null): string {
  if (!agentId) return TOKENS.purpleSoft;
  return AGENT_TINTS[agentId.toLowerCase()] ?? TOKENS.purpleSoft;
}

function ucFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatRelative(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ms).toLocaleDateString();
}

function senderLabel(r: PulseRecent): string {
  if (r.senderType === "user") return "You";
  if (r.agentId) return ucFirst(r.agentId.replace(/-/g, " "));
  return "System";
}

export function PulseDock({ open, pulse, onClose }: PulseDockProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const lastReadMs = useMemo(() => (pulse.lastReadAt ? Date.parse(pulse.lastReadAt) : 0), [pulse.lastReadAt]);

  return (
    <aside
      aria-hidden={!open}
      aria-label="Chat pulse"
      style={{
        position: "fixed",
        top: 56,
        right: 0,
        bottom: 0,
        width: "min(400px, 96vw)",
        zIndex: 60,
        background: TOKENS.bg,
        borderLeft: `1px solid ${TOKENS.border}`,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
        boxShadow: open ? `0 0 60px rgba(0,240,255,0.10), -2px 0 0 ${TOKENS.borderAccent}` : "none",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        color: TOKENS.text,
      }}
    >
      <header
        style={{
          flexShrink: 0,
          padding: "12px 14px",
          borderBottom: `1px solid ${TOKENS.border}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "linear-gradient(180deg, rgba(0,240,255,0.05) 0%, transparent 100%)",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: TOKENS.cyan,
            boxShadow: `0 0 12px ${TOKENS.cyan}, 0 0 22px ${TOKENS.cyan}55`,
          }}
        />
        <h2
          style={{
            margin: 0,
            fontFamily: "monospace",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.24em",
            textTransform: "uppercase" as const,
            color: TOKENS.cyan,
          }}
        >
          Chat Pulse
        </h2>
        <span
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 8px",
            borderRadius: 999,
            border: `1px solid ${pulse.unread > 0 ? `${TOKENS.cyan}66` : TOKENS.border}`,
            background: pulse.unread > 0 ? "rgba(0,240,255,0.10)" : TOKENS.card,
            color: pulse.unread > 0 ? TOKENS.cyan : TOKENS.textDim,
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: "0.14em",
          }}
        >
          {pulse.unread} UNREAD
        </span>
        <button
          type="button"
          onClick={() => pulse.refresh()}
          aria-label="Refresh pulse"
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            border: `1px solid ${TOKENS.border}`,
            background: TOKENS.card,
            color: TOKENS.textDim,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          ↻
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close pulse"
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            border: `1px solid ${TOKENS.border}`,
            background: TOKENS.card,
            color: TOKENS.textDim,
            cursor: "pointer",
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </header>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 16 }}>
        {!pulse.available ? (
          <div
            style={{
              padding: 14,
              background: TOKENS.card,
              border: `1px solid ${TOKENS.border}`,
              borderRadius: 8,
              color: TOKENS.textDim,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            Pulse is offline. Set <code style={{ color: TOKENS.cyan }}>SUPABASE_SERVICE_ROLE_KEY</code> on the server to enable.
          </div>
        ) : (
          <>
            <section>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    color: TOKENS.textDim,
                    textTransform: "uppercase" as const,
                  }}
                >
                  Latest activity
                </span>
                {pulse.unread > 0 && (
                  <button
                    type="button"
                    onClick={() => pulse.markRead()}
                    style={{
                      padding: "3px 8px",
                      borderRadius: 6,
                      border: `1px solid ${TOKENS.border}`,
                      background: TOKENS.card,
                      color: TOKENS.cyan,
                      fontFamily: "monospace",
                      fontSize: 10,
                      letterSpacing: "0.12em",
                      cursor: "pointer",
                      textTransform: "uppercase" as const,
                    }}
                  >
                    Mark read
                  </button>
                )}
              </div>
              {pulse.recent.length === 0 ? (
                <div
                  style={{
                    padding: 12,
                    color: TOKENS.textMuted,
                    fontSize: 12,
                    textAlign: "center" as const,
                  }}
                >
                  No recent messages.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {pulse.recent.map((r) => {
                    const isUnread = lastReadMs > 0 && Date.parse(r.createdAt) > lastReadMs;
                    const tint = tintFor(r.agentId);
                    return (
                      <Link
                        key={r.id}
                        href={`/command-center/chat#msg=${r.id}`}
                        onClick={onClose}
                        style={{
                          display: "flex",
                          gap: 8,
                          padding: "8px 10px",
                          background: isUnread ? TOKENS.cardHot : TOKENS.card,
                          border: `1px solid ${isUnread ? `${TOKENS.cyan}33` : TOKENS.border}`,
                          borderLeft: `3px solid ${tint}`,
                          borderRadius: 6,
                          textDecoration: "none",
                          color: "inherit",
                          transition: "background 150ms ease, border-color 150ms ease",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              marginBottom: 2,
                            }}
                          >
                            <span style={{ fontSize: 12, fontWeight: 700, color: tint }}>
                              {senderLabel(r)}
                            </span>
                            {r.pinned && (
                              <span
                                style={{
                                  fontFamily: "monospace",
                                  fontSize: 9,
                                  letterSpacing: "0.1em",
                                  color: TOKENS.gold,
                                  textTransform: "uppercase" as const,
                                }}
                              >
                                PIN
                              </span>
                            )}
                            <span
                              style={{
                                marginLeft: "auto",
                                fontFamily: "monospace",
                                fontSize: 10,
                                color: TOKENS.textMuted,
                              }}
                            >
                              {formatRelative(r.createdAt)}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: TOKENS.text,
                              lineHeight: 1.4,
                              display: "-webkit-box",
                              WebkitBoxOrient: "vertical" as const,
                              WebkitLineClamp: 2,
                              overflow: "hidden",
                            }}
                          >
                            {r.content || "(empty)"}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    color: TOKENS.textDim,
                    textTransform: "uppercase" as const,
                  }}
                >
                  Pinned
                </span>
                <span style={{ fontFamily: "monospace", fontSize: 10, color: TOKENS.textMuted }}>
                  {pulse.pinnedCount} total
                </span>
              </div>
              {pulse.pinned.length === 0 ? (
                <div
                  style={{
                    padding: 12,
                    color: TOKENS.textMuted,
                    fontSize: 12,
                    textAlign: "center" as const,
                  }}
                >
                  Nothing pinned right now.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {pulse.pinned.map((p) => {
                    const tint = tintFor(p.agentId);
                    return (
                      <Link
                        key={p.id}
                        href={`/command-center/chat#msg=${p.id}`}
                        onClick={onClose}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          padding: "8px 10px",
                          background: TOKENS.card,
                          border: `1px solid ${TOKENS.border}`,
                          borderLeft: `3px solid ${TOKENS.gold}`,
                          borderRadius: 6,
                          textDecoration: "none",
                          color: "inherit",
                        }}
                      >
                        <span
                          aria-hidden
                          style={{
                            fontFamily: "monospace",
                            fontSize: 9,
                            letterSpacing: "0.1em",
                            color: TOKENS.gold,
                            textTransform: "uppercase" as const,
                          }}
                        >
                          PIN
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: tint, fontWeight: 700, marginBottom: 2 }}>
                            {p.agentId ? ucFirst(p.agentId.replace(/-/g, " ")) : "System"}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: TOKENS.text,
                              lineHeight: 1.4,
                              display: "-webkit-box",
                              WebkitBoxOrient: "vertical" as const,
                              WebkitLineClamp: 2,
                              overflow: "hidden",
                            }}
                          >
                            {p.content || "(empty)"}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <footer
        style={{
          flexShrink: 0,
          padding: "8px 12px",
          borderTop: `1px solid ${TOKENS.border}`,
          fontFamily: "monospace",
          fontSize: 10,
          color: TOKENS.textMuted,
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span>
          Last read · {pulse.lastReadAt ? new Date(pulse.lastReadAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
        </span>
        <Link
          href="/command-center/chat"
          onClick={onClose}
          style={{ color: TOKENS.cyan, textDecoration: "none", letterSpacing: "0.12em" }}
        >
          OPEN CHAT →
        </Link>
      </footer>
    </aside>
  );
}
