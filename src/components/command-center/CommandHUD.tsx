"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CommandPalette } from "./CommandPalette";
import { StatusDock, type StatusTab } from "./StatusDock";
import { useSystemStatus, type ServiceState } from "@/hooks/useSystemStatus";
import type { ChatPulse } from "@/hooks/useChatPulse";

const TOKENS = {
  bg: "rgba(10,10,10,0.78)",
  bgSolid: "#0a0a0a",
  card: "rgba(255,255,255,0.02)",
  border: "#1e1e1e",
  borderAccent: "rgba(124,58,237,0.28)",
  text: "#e5e5e5",
  textDim: "#888888",
  textMuted: "#555555",
  purple: "#7c3aed",
  purpleSoft: "#a855f7",
  gold: "#C9A84C",
  cyan: "#00f0ff",
  green: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
};

const STATE_COLOR: Record<ServiceState, string> = {
  ok: TOKENS.green,
  degraded: TOKENS.amber,
  offline: TOKENS.red,
  unknown: TOKENS.textMuted,
};

const STATE_LABEL: Record<ServiceState, string> = {
  ok: "OK",
  degraded: "DEGR",
  offline: "OFFL",
  unknown: "...",
};

function fmtTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function fmtMoney(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `$${(n / 1000).toFixed(0)}K`;
  if (n >= 1_000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

function Pill({
  label,
  value,
  state,
  accent,
  hint,
  onClick,
  active,
}: {
  label: string;
  value: string;
  state: ServiceState;
  accent?: string;
  hint?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const dot = STATE_COLOR[state];
  const accentColor = accent ?? dot;
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      aria-label={`${label} status: open detail`}
      aria-pressed={active}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 10px",
        background: active ? `${accentColor}1a` : "rgba(255,255,255,0.02)",
        border: `1px solid ${active ? `${accentColor}66` : TOKENS.border}`,
        borderRadius: 999,
        fontFamily: "monospace",
        fontSize: 10,
        letterSpacing: "0.06em",
        whiteSpace: "nowrap" as const,
        height: 28,
        boxSizing: "border-box" as const,
        color: TOKENS.text,
        cursor: onClick ? "pointer" : "default",
        boxShadow: active ? `0 0 12px ${accentColor}44` : "none",
        transition: "border-color 150ms ease, background 150ms ease, box-shadow 150ms ease",
      }}
      onMouseEnter={(e) => {
        if (!onClick || active) return;
        e.currentTarget.style.borderColor = `${accentColor}55`;
      }}
      onMouseLeave={(e) => {
        if (!onClick || active) return;
        e.currentTarget.style.borderColor = TOKENS.border;
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: dot,
          boxShadow: `0 0 6px ${dot}aa`,
          flexShrink: 0,
        }}
      />
      <span style={{ color: TOKENS.textDim, textTransform: "uppercase" as const }}>{label}</span>
      <span style={{ color: accentColor, fontWeight: 700 }}>{value}</span>
      <span style={{ color: TOKENS.textMuted, fontSize: 9 }}>{STATE_LABEL[state]}</span>
    </button>
  );
}

interface CommandHUDProps {
  onLock: () => void;
  onToggleBriefing?: () => void;
  briefingOpen?: boolean;
  briefingSpeaking?: boolean;
  wakeEnabled?: boolean;
  wakeStatus?: "idle" | "listening" | "triggered" | "unsupported" | "denied";
  onToggleWake?: () => void;
  onTogglePulse?: () => void;
  pulseOpen?: boolean;
  pulse?: ChatPulse;
}

export function CommandHUD({
  onLock,
  onToggleBriefing,
  briefingOpen,
  briefingSpeaking,
  wakeEnabled,
  wakeStatus,
  onToggleWake,
  onTogglePulse,
  pulseOpen,
  pulse,
}: CommandHUDProps) {
  const status = useSystemStatus();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [dockTab, setDockTab] = useState<StatusTab | null>(null);

  const openDock = useCallback((tab: StatusTab) => {
    setDockTab((current) => (current === tab ? null : tab));
  }, []);

  const closeDock = useCallback(() => setDockTab(null), []);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleLock = useCallback(() => {
    onLock();
  }, [onLock]);

  const handleRefresh = useCallback(() => {
    status.refresh();
  }, [status]);

  const pills = useMemo<Array<{
    key: StatusTab;
    label: string;
    value: string;
    state: ServiceState;
    accent: string;
    hint: string;
  }>>(
    () => [
      {
        key: "agents",
        label: "Agents",
        value:
          status.agents.total > 0
            ? `${status.agents.active}/${status.agents.total}`
            : "—",
        state: status.agents.state,
        accent: TOKENS.gold,
        hint: `${status.agents.active} active of ${status.agents.total}`,
      },
      {
        key: "gateway",
        label: "Gateway",
        value:
          status.gateway.state === "ok"
            ? "LIVE"
            : status.gateway.state === "degraded"
              ? "WAIT"
              : status.gateway.state === "offline"
                ? "DOWN"
                : "—",
        state: status.gateway.state,
        accent: TOKENS.purpleSoft,
        hint: "OpenClaw gateway reachability",
      },
      {
        key: "revenue",
        label: "MRR",
        value: fmtMoney(status.revenue.mrr),
        state: status.revenue.state,
        accent: TOKENS.amber,
        hint: `30d ${fmtMoney(status.revenue.last30)} · ARR ${fmtMoney(status.revenue.arr)}`,
      },
      {
        key: "network",
        label: "Net",
        value: status.network.online ? "ON" : "OFF",
        state: status.network.state,
        accent: TOKENS.cyan,
        hint: "Browser network status",
      },
    ],
    [status]
  );

  return (
    <>
      <header
        id="cc-hud"
        role="banner"
        style={{
          position: "fixed",
          top: 0,
          left: 240,
          right: 0,
          height: 56,
          zIndex: 70,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 18px 0 18px",
          background: TOKENS.bg,
          borderBottom: `1px solid ${TOKENS.border}`,
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "linear-gradient(90deg, rgba(124,58,237,0.07) 0%, rgba(201,168,76,0.03) 50%, rgba(0,240,255,0.05) 100%)",
            opacity: 0.55,
          }}
        />

        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: TOKENS.gold,
              boxShadow: `0 0 10px ${TOKENS.gold}, 0 0 22px ${TOKENS.gold}66`,
              animation: "ccHudPulse 2.4s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 11,
              letterSpacing: "0.22em",
              color: TOKENS.text,
              fontWeight: 700,
              textTransform: "uppercase" as const,
            }}
          >
            RAMICHE · COMMAND
          </span>
        </div>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Open command palette"
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flex: "1 1 320px",
            maxWidth: 480,
            minWidth: 0,
            height: 32,
            padding: "0 12px",
            background: TOKENS.card,
            border: `1px solid ${TOKENS.border}`,
            borderRadius: 8,
            color: TOKENS.textDim,
            fontFamily: "inherit",
            fontSize: 12,
            cursor: "pointer",
            textAlign: "left",
            transition: "border-color 150ms ease, color 150ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = TOKENS.borderAccent;
            e.currentTarget.style.color = TOKENS.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = TOKENS.border;
            e.currentTarget.style.color = TOKENS.textDim;
          }}
        >
          <span aria-hidden style={{ fontFamily: "monospace", color: TOKENS.purpleSoft }}>⌘K</span>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            Jump to anything · ask an agent · run a command
          </span>
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 9,
              padding: "2px 6px",
              border: `1px solid ${TOKENS.border}`,
              borderRadius: 4,
              color: TOKENS.textMuted,
            }}
          >
            ⌘K
          </span>
        </button>

        <div
          id="cc-hud-pills"
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          {pills.map((p) => (
            <Pill
              key={p.key}
              label={p.label}
              value={p.value}
              state={p.state}
              accent={p.accent}
              hint={p.hint}
              onClick={() => openDock(p.key)}
              active={dockTab === p.key}
            />
          ))}
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
            marginLeft: "auto",
          }}
        >
          {onTogglePulse && (
            <button
              type="button"
              onClick={onTogglePulse}
              aria-label={pulseOpen ? "Close chat pulse" : "Open chat pulse"}
              aria-pressed={pulseOpen}
              title={
                pulse?.available === false
                  ? "Chat pulse offline (no service role)"
                  : `${pulse?.unread ?? 0} unread · ${pulse?.pinnedCount ?? 0} pinned`
              }
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: 8,
                border: `1px solid ${pulseOpen ? `${TOKENS.cyan}66` : TOKENS.border}`,
                background: pulseOpen ? "rgba(0,240,255,0.14)" : TOKENS.card,
                color: pulse?.available === false ? TOKENS.textMuted : TOKENS.cyan,
                cursor: "pointer",
                fontSize: 13,
                boxShadow: pulseOpen ? `0 0 14px ${TOKENS.cyan}55` : "none",
                transition: "border-color 150ms ease, background 150ms ease, box-shadow 150ms ease",
              }}
            >
              <span aria-hidden style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.16em", fontWeight: 700 }}>
                ◐
              </span>
              {pulse && pulse.unread > 0 && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: -5,
                    right: -5,
                    minWidth: 16,
                    height: 16,
                    padding: "0 4px",
                    borderRadius: 999,
                    background: TOKENS.cyan,
                    color: "#001318",
                    fontFamily: "monospace",
                    fontSize: 9,
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    letterSpacing: "0.04em",
                    boxShadow: `0 0 10px ${TOKENS.cyan}88`,
                  }}
                >
                  {pulse.unread > 99 ? "99+" : pulse.unread}
                </span>
              )}
            </button>
          )}

          {onToggleWake && (
            <button
              type="button"
              onClick={onToggleWake}
              aria-label={wakeEnabled ? "Disable wake word" : "Enable wake word"}
              aria-pressed={wakeEnabled}
              title={
                wakeStatus === "unsupported"
                  ? "Wake word not supported in this browser"
                  : wakeStatus === "denied"
                    ? "Microphone permission denied"
                    : wakeEnabled
                      ? "Wake word listening — say 'Atlas'"
                      : "Enable wake word"
              }
              disabled={wakeStatus === "unsupported"}
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: 8,
                border: `1px solid ${
                  wakeStatus === "triggered"
                    ? `${TOKENS.gold}88`
                    : wakeEnabled && wakeStatus === "listening"
                      ? `${TOKENS.cyan}66`
                      : TOKENS.border
                }`,
                background:
                  wakeEnabled && wakeStatus === "listening"
                    ? "rgba(0,240,255,0.12)"
                    : wakeStatus === "triggered"
                      ? "rgba(201,168,76,0.18)"
                      : TOKENS.card,
                color:
                  wakeStatus === "triggered"
                    ? TOKENS.gold
                    : wakeStatus === "denied" || wakeStatus === "unsupported"
                      ? TOKENS.textMuted
                      : wakeEnabled
                        ? TOKENS.cyan
                        : TOKENS.textDim,
                cursor: wakeStatus === "unsupported" ? "not-allowed" : "pointer",
                fontSize: 13,
                boxShadow:
                  wakeEnabled && wakeStatus === "listening"
                    ? `0 0 12px ${TOKENS.cyan}55`
                    : wakeStatus === "triggered"
                      ? `0 0 18px ${TOKENS.gold}88`
                      : "none",
                transition: "border-color 150ms ease, background 150ms ease, box-shadow 150ms ease",
              }}
            >
              <span aria-hidden style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.16em", fontWeight: 700 }}>
                WAKE
              </span>
              {wakeEnabled && wakeStatus === "listening" && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: -3,
                    right: -3,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: TOKENS.cyan,
                    boxShadow: `0 0 8px ${TOKENS.cyan}`,
                    animation: "ccHudPulse 1.8s ease-in-out infinite",
                  }}
                />
              )}
            </button>
          )}

          {onToggleBriefing && (
            <button
              type="button"
              onClick={onToggleBriefing}
              aria-label={briefingOpen ? "Close Atlas briefing" : "Open Atlas briefing"}
              aria-pressed={briefingOpen}
              title="Atlas briefing"
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: 8,
                border: `1px solid ${briefingOpen ? `${TOKENS.gold}66` : TOKENS.border}`,
                background: briefingOpen ? "rgba(201,168,76,0.16)" : TOKENS.card,
                color: TOKENS.gold,
                cursor: "pointer",
                fontSize: 13,
                boxShadow: briefingOpen ? `0 0 14px ${TOKENS.gold}55` : `0 0 6px ${TOKENS.gold}22`,
                transition: "border-color 150ms ease, box-shadow 150ms ease, background 150ms ease",
              }}
            >
              <span aria-hidden style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.16em", fontWeight: 700 }}>
                ATL
              </span>
              {briefingSpeaking && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: -3,
                    right: -3,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: TOKENS.gold,
                    boxShadow: `0 0 8px ${TOKENS.gold}`,
                    animation: "ccHudPulse 0.85s ease-in-out infinite",
                  }}
                />
              )}
            </button>
          )}

          <Link
            href="/command-center/chat"
            aria-label="Open chat with voice"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 8,
              border: `1px solid ${TOKENS.border}`,
              background: TOKENS.card,
              color: TOKENS.gold,
              textDecoration: "none",
              fontSize: 13,
              boxShadow: `0 0 8px ${TOKENS.gold}22`,
              transition: "border-color 150ms ease, box-shadow 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = `${TOKENS.gold}66`;
              e.currentTarget.style.boxShadow = `0 0 14px ${TOKENS.gold}55`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = TOKENS.border;
              e.currentTarget.style.boxShadow = `0 0 8px ${TOKENS.gold}22`;
            }}
          >
            ◉
          </Link>

          <div
            id="cc-hud-clock"
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: `1px solid ${TOKENS.border}`,
              background: "rgba(255,255,255,0.02)",
              color: TOKENS.text,
              fontFamily: "monospace",
              fontSize: 11,
              letterSpacing: "0.08em",
              minWidth: 76,
              textAlign: "center" as const,
            }}
          >
            {now ? fmtTime(now) : "--:--:--"}
          </div>

          <button
            type="button"
            onClick={handleLock}
            aria-label="Lock Command Center"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 8,
              border: `1px solid ${TOKENS.border}`,
              background: TOKENS.card,
              color: TOKENS.textDim,
              cursor: "pointer",
              fontSize: 13,
              transition: "color 150ms ease, border-color 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = TOKENS.red;
              e.currentTarget.style.borderColor = `${TOKENS.red}44`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = TOKENS.textDim;
              e.currentTarget.style.borderColor = TOKENS.border;
            }}
          >
            ◆
          </button>
        </div>

        <style>{`
          @keyframes ccHudPulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.65; transform: scale(0.85); }
          }
          @media (max-width: 1180px) {
            #cc-hud-pills > div:nth-child(n+4) { display: none; }
          }
          @media (max-width: 980px) {
            #cc-hud-pills > div:nth-child(n+3) { display: none; }
          }
          @media (max-width: 880px) {
            #cc-hud-pills { display: none !important; }
          }
          @media (max-width: 767px) {
            #cc-hud {
              left: 0 !important;
              padding-left: 60px !important;
            }
            #cc-hud-clock { display: none; }
          }
          @media (max-width: 520px) {
            #cc-hud { gap: 8px !important; padding-right: 10px !important; }
          }
        `}</style>
      </header>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onLock={handleLock}
        onRefresh={handleRefresh}
      />

      <StatusDock
        open={dockTab !== null}
        tab={dockTab ?? "agents"}
        status={status}
        onTabChange={setDockTab}
        onClose={closeDock}
      />
    </>
  );
}
