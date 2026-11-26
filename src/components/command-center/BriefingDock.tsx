"use client";

import { useEffect, useState } from "react";
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

/** "3m ago" / "2h ago" — never a bare number, so it can't be mistaken for a count of anything else. */
function ageLabel(epochMs: number): string {
  // Clamped at 0: `epochMs` in the future (a system clock change between when it was recorded and
  // now, since both sides use the same client's Date.now()) must never read as "just now" — that
  // would claim freshness for a timestamp this function can't actually vouch for either way.
  const diffMs = Math.max(0, Date.now() - epochMs);
  if (diffMs < 60_000) return "just now";
  const m = Math.floor(diffMs / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

/**
 * Fallback reasons that are an expected, by-design state — no Atlas gateway is configured at all,
 * which is normal outside a fully wired deployment — rather than a live degradation. Anything else
 * (an empty or too-short reply, a transport error, the compose request itself failing) is worth
 * naming rather than silently looking identical to "Atlas was never going to run here".
 */
const BORING_FALLBACK_REASONS = new Set(["gateway_not_configured"]);

export function BriefingDock({ briefingState }: BriefingDockProps) {
  const {
    open,
    setOpen,
    status,
    briefing,
    source,
    provenance,
    composedAt,
    fallbackReason,
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

  // A plain render-time read of Date.now() would never update while the dock sits open with
  // nothing else re-rendering it — independent review caught exactly that: "Atlas · Live" and the
  // aria-label "composed just now" never aged, so a tab left open for hours kept claiming a
  // freshness it no longer had. Ticking every 30s is enough resolution for a label measured in
  // minutes/hours; it does not need to be exact to the second.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const ageMs = composedAt ? nowTick - composedAt : null;
  /** Only count as "Live" for a short window after composing — after that, say how old it is, same as a cache hit. */
  const LIVE_THRESHOLD_MS = 90_000;

  // The honest provenance of what's ON SCREEN right now — never what's merely plausible. A
  // 12h-old cached Atlas script and one that just came back are NOT the same claim to make, and
  // neither is a live reply from 20 minutes ago still sitting there unlabeled as "Live".
  const isFreshLive = source === "atlas" && provenance === "fresh" && (ageMs === null || ageMs < LIVE_THRESHOLD_MS);
  const isFreshAged = source === "atlas" && provenance === "fresh" && ageMs !== null && ageMs >= LIVE_THRESHOLD_MS;
  const isCachedAtlas = source === "atlas" && provenance === "cached";
  const badgeLabel = isFreshLive
    ? "Atlas · Live"
    : isFreshAged || isCachedAtlas
      ? `Atlas · ${composedAt ? ageLabel(composedAt) : "cached"}`
      : "Deterministic";
  const badgeAriaLabel = isFreshLive
    ? "Atlas-personalised brief, composed just now"
    : isFreshAged
      ? `Atlas-personalised brief, composed ${composedAt ? ageLabel(composedAt) : "earlier"}`
      : isCachedAtlas
        ? `Atlas-personalised brief, cached ${composedAt ? ageLabel(composedAt) : "earlier"}`
        : "Deterministic brief (no live Atlas rewrite)";
  const notableFallback =
    source === "deterministic" && fallbackReason && !BORING_FALLBACK_REASONS.has(fallbackReason)
      ? fallbackReason
      : null;

  return (
    <aside
      className="atlas-briefing"
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
          role="status"
          aria-live="polite"
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
            aria-label={badgeAriaLabel}
            title={badgeAriaLabel}
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
            {badgeLabel}
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
            {notableFallback && (
              <div
                role="status"
                style={{
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: `1px solid ${TOKENS.red}33`,
                  background: "rgba(239,68,68,0.06)",
                  color: TOKENS.textDim,
                  fontSize: 11,
                  lineHeight: 1.4,
                }}
              >
                Atlas did not rewrite this brief ({notableFallback}) — showing the deterministic
                version instead.
              </div>
            )}
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
        {/* Two clocks, both labeled, because they are not the same clock: `lastUpdated` is when
            the raw agents/revenue/calendar facts were last pulled; `composedAt` is when THIS
            spoken script was produced (which, for a cached Atlas reply, can be hours earlier
            than the facts below it — see BriefingProvenance in useBriefing.ts). Showing one
            unlabeled number next to cached text previously implied a freshness neither clock
            actually claims on its own. */}
        <span style={{ display: "flex", gap: 10 }}>
          <span title="When the underlying agents/revenue/calendar facts were last pulled">
            Facts {lastUpdated ? new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"}
          </span>
          <span title="When this spoken script was produced (fresh, or a cached Atlas reply)">
            Brief {composedAt ? new Date(composedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"}
          </span>
        </span>
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
