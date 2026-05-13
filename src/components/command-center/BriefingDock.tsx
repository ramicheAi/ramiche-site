"use client";

import { useEffect } from "react";
import type { UseBriefingResult } from "@/hooks/useBriefing";

const TOKENS = {
  bg: "rgba(10,10,10,0.94)",
  card: "rgba(255,255,255,0.04)",
  border: "#1e1e1e",
  borderAccent: "rgba(201,168,76,0.45)",
  text: "#e5e5e5",
  textDim: "#888888",
  textMuted: "#555555",
  purple: "#7c3aed",
  purpleSoft: "#a855f7",
  gold: "#C9A84C",
  green: "#10b981",
  red: "#ef4444",
};

interface BriefingDockProps {
  briefingState: UseBriefingResult;
}

export function BriefingDock({ briefingState }: BriefingDockProps) {
  const {
    open,
    setOpen,
    status,
    briefing,
    source,
    autoEnabled,
    setAutoEnabled,
    speak,
    stop,
    refresh,
    regenerate,
    lastUpdated,
  } = briefingState;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const speaking = status === "speaking";
  const loading = status === "loading";

  return (
    <aside
      aria-hidden={!open}
      aria-label="Atlas briefing"
      style={{
        position: "fixed",
        top: 56,
        right: 0,
        bottom: 0,
        width: "min(380px, 96vw)",
        zIndex: 60,
        background: TOKENS.bg,
        borderLeft: `1px solid ${TOKENS.border}`,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
        boxShadow: open ? `0 0 60px rgba(201,168,76,0.10), -2px 0 0 ${TOKENS.borderAccent}` : "none",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        color: TOKENS.text,
      }}
    >
      <header
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 16px",
          borderBottom: `1px solid ${TOKENS.border}`,
          background: "linear-gradient(180deg, rgba(201,168,76,0.07) 0%, transparent 100%)",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: TOKENS.gold,
            boxShadow: `0 0 12px ${TOKENS.gold}, 0 0 26px ${TOKENS.gold}80`,
            animation: speaking ? "ccBriefPulse 0.85s ease-in-out infinite" : undefined,
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
            color: TOKENS.gold,
          }}
        >
          Atlas Briefing
        </h2>
        <span
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "monospace",
            fontSize: 10,
            color: TOKENS.textMuted,
            letterSpacing: "0.08em",
          }}
        >
          <span
            aria-label={source === "atlas" ? "Atlas-personalised brief" : "Deterministic brief"}
            style={{
              padding: "2px 6px",
              borderRadius: 4,
              border: `1px solid ${source === "atlas" ? `${TOKENS.gold}66` : TOKENS.border}`,
              background: source === "atlas" ? `${TOKENS.gold}1a` : "transparent",
              color: source === "atlas" ? TOKENS.gold : TOKENS.textDim,
              fontSize: 9,
              letterSpacing: "0.16em",
              textTransform: "uppercase" as const,
              fontWeight: 700,
            }}
          >
            {source === "atlas" ? "Atlas" : "Auto"}
          </span>
          {speaking ? "SPEAKING" : loading ? "SYNCING" : status === "error" ? "ERROR" : "READY"}
        </span>
        <button
          type="button"
          aria-label="Close briefing"
          onClick={() => {
            stop();
            setOpen(false);
          }}
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

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {briefing ? (
          <>
            <section>
              <div
                style={{
                  fontSize: 11,
                  fontFamily: "monospace",
                  letterSpacing: "0.16em",
                  color: TOKENS.textDim,
                  textTransform: "uppercase" as const,
                  marginBottom: 8,
                }}
              >
                Greeting
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: TOKENS.text,
                }}
              >
                {briefing.greeting}
              </p>
            </section>

            <section>
              <div
                style={{
                  fontSize: 11,
                  fontFamily: "monospace",
                  letterSpacing: "0.16em",
                  color: TOKENS.textDim,
                  textTransform: "uppercase" as const,
                  marginBottom: 8,
                }}
              >
                Status sweep
              </div>
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {briefing.bullets.map((b, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 10px",
                      background: TOKENS.card,
                      border: `1px solid ${TOKENS.border}`,
                      borderRadius: 8,
                      fontSize: 13,
                      lineHeight: 1.4,
                      color: TOKENS.text,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: TOKENS.gold,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ minWidth: 0 }}>{b}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section
              style={{
                padding: 12,
                background: "rgba(124,58,237,0.06)",
                border: `1px solid rgba(124,58,237,0.25)`,
                borderRadius: 8,
                fontSize: 12,
                lineHeight: 1.55,
                color: TOKENS.textDim,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "monospace",
                  letterSpacing: "0.16em",
                  color: TOKENS.purpleSoft,
                  textTransform: "uppercase" as const,
                  marginBottom: 6,
                }}
              >
                Spoken script
              </div>
              {briefing.spoken}
            </section>
          </>
        ) : (
          <div
            style={{
              padding: 18,
              background: TOKENS.card,
              border: `1px solid ${TOKENS.border}`,
              borderRadius: 8,
              color: TOKENS.textDim,
              fontSize: 13,
            }}
          >
            {status === "error" ? "Could not load CC telemetry." : "Synchronising telemetry…"}
          </div>
        )}
      </div>

      <footer
        style={{
          flexShrink: 0,
          padding: 12,
          borderTop: `1px solid ${TOKENS.border}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(0,0,0,0.45)",
        }}
      >
        <button
          type="button"
          onClick={() => (speaking ? stop() : void speak())}
          disabled={!briefing}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 8,
            border: `1px solid ${speaking ? `${TOKENS.red}55` : `${TOKENS.gold}55`}`,
            background: speaking ? "rgba(239,68,68,0.12)" : "rgba(201,168,76,0.12)",
            color: speaking ? TOKENS.red : TOKENS.gold,
            cursor: briefing ? "pointer" : "not-allowed",
            opacity: briefing ? 1 : 0.55,
            fontWeight: 700,
            fontFamily: "monospace",
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase" as const,
            transition: "border-color 150ms ease, background 150ms ease",
          }}
        >
          {speaking ? "Stop" : "Speak briefing"}
        </button>

        <button
          type="button"
          onClick={() => void regenerate()}
          aria-label="Regenerate via Atlas"
          title="Ask Atlas to rewrite the brief"
          style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            border: `1px solid ${TOKENS.border}`,
            background: TOKENS.card,
            color: TOKENS.gold,
            cursor: "pointer",
            fontSize: 12,
            fontFamily: "monospace",
            fontWeight: 700,
            letterSpacing: "0.08em",
            lineHeight: 1,
          }}
        >
          ATL
        </button>

        <button
          type="button"
          onClick={() => void refresh()}
          aria-label="Refresh briefing data"
          style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            border: `1px solid ${TOKENS.border}`,
            background: TOKENS.card,
            color: TOKENS.textDim,
            cursor: "pointer",
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          ↻
        </button>
      </footer>

      <div
        style={{
          flexShrink: 0,
          padding: "8px 14px",
          borderTop: `1px solid ${TOKENS.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          fontSize: 10,
          fontFamily: "monospace",
          color: TOKENS.textMuted,
          letterSpacing: "0.06em",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={autoEnabled}
            onChange={(e) => setAutoEnabled(e.target.checked)}
            style={{ accentColor: TOKENS.gold }}
          />
          <span style={{ textTransform: "uppercase" as const }}>Auto-brief once per day</span>
        </label>
        <span>{lastUpdated ? new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"}</span>
      </div>

      <style>{`
        @keyframes ccBriefPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.7); opacity: 0.6; }
        }
      `}</style>
    </aside>
  );
}
