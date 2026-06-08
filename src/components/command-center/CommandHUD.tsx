"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CommandPalette } from "./CommandPalette";
import { StatusDock, type StatusTab } from "./StatusDock";
import { useSystemStatus, type ServiceState } from "@/hooks/useSystemStatus";
import type { ChatPulse } from "@/hooks/useChatPulse";
import { Icon } from "@/components/command-center/po/Brand";
import { usePoTheme } from "@/components/command-center/PoShell";
import { VITALS } from "@/lib/po-data";

/* ──────────────────────────────────────────────────────────────────────────
   Parallax OS — top HUD (64px). Restyled in place onto the ported `.po-top`
   surface. Every existing prop/hook/handler is preserved; the wake / briefing /
   pulse / lock controls are kept and restyled as `.po-icbtn`s.
   ────────────────────────────────────────────────────────────────────────── */

const SIDEBAR_W = 244;

function fmtTime(d: Date): { hms: string; ss: string } {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return { hms: `${hh}:${mm}`, ss };
}

function fmtMoney(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `$${(n / 1000).toFixed(1)}k`;
  if (n >= 1_000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

/** small square icon button that maps onto `.po-icbtn` but supports state tint */
function HudIconBtn({
  children,
  onClick,
  title,
  ariaLabel,
  pressed,
  disabled,
  tint,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  ariaLabel: string;
  pressed?: boolean;
  disabled?: boolean;
  tint?: string;
}) {
  const style: React.CSSProperties = {};
  if (tint) {
    style.color = tint;
    style.borderColor = `color-mix(in oklab, ${tint} 55%, transparent)`;
    style.background = `color-mix(in oklab, ${tint} 12%, transparent)`;
    style.boxShadow = `0 0 14px color-mix(in oklab, ${tint} 40%, transparent)`;
  }
  return (
    <button
      type="button"
      className="po-icbtn"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      disabled={disabled}
      style={style}
    >
      {children}
    </button>
  );
}

interface CommandHUDProps {
  onLock: () => void;
  onToggleBriefing?: () => void;
  briefingOpen?: boolean;
  briefingSpeaking?: boolean;
  wakeEnabled?: boolean;
  wakeStatus?: "idle" | "listening" | "triggered" | "unsupported" | "denied" | "evaluating";
  wakeMode?: "cloud" | "local";
  wakeLevel?: number;
  onToggleWake?: () => void;
  onCycleWakeMode?: () => void;
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
  wakeMode,
  wakeLevel,
  onToggleWake,
  onCycleWakeMode,
  onTogglePulse,
  pulseOpen,
  pulse,
}: CommandHUDProps) {
  const status = useSystemStatus();
  const router = useRouter();
  const { toggleTheme } = usePoTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [dockTab, setDockTab] = useState<StatusTab | null>(null);

  const openDock = useCallback((tab: StatusTab) => {
    setDockTab((current) => (current === tab ? null : tab));
  }, []);

  const closeDock = useCallback(() => setDockTab(null), []);

  // live ticking clock (cleared on unmount)
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // ⌘K / Ctrl-K toggles the palette anywhere
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

  // live readouts: agents + gateway from the real status feed; MRR prefers the
  // real revenue feed, falls back to the VITALS showpiece number.
  const readouts = useMemo(() => {
    const agentsVal =
      status.agents.total > 0 ? `${status.agents.active}/${status.agents.total}` : "19/20";
    const gatewayState: ServiceState = status.gateway.state;
    const gatewayVal =
      gatewayState === "ok"
        ? "ONLINE"
        : gatewayState === "degraded"
          ? "DEGRADED"
          : gatewayState === "offline"
            ? "OFFLINE"
            : "—";
    const gatewayColor =
      gatewayState === "ok"
        ? "var(--c-green)"
        : gatewayState === "degraded"
          ? "var(--c-amber)"
          : gatewayState === "offline"
            ? "var(--c-red)"
            : "var(--t-mid)";
    const mrrVital = VITALS.find((v) => v.lab === "MRR");
    const mrrVal =
      status.revenue.mrr > 0 ? fmtMoney(status.revenue.mrr) : mrrVital?.num ?? "$48.2k";
    return { agentsVal, gatewayVal, gatewayColor, mrrVal };
  }, [status]);

  const t = now ? fmtTime(now) : { hms: "--:--", ss: "--" };

  const wakeTint =
    wakeStatus === "triggered"
      ? "var(--c-gold)"
      : wakeEnabled && wakeStatus === "listening"
        ? "var(--c-cyan)"
        : undefined;

  return (
    <>
      <header
        id="cc-hud"
        role="banner"
        className="po-top"
        style={{
          position: "fixed",
          top: 0,
          left: SIDEBAR_W,
          right: 0,
          zIndex: 70,
          marginLeft: 0,
        }}
      >
        {/* ⌘K command bar → opens the palette */}
        <button type="button" className="po-cmdbar" onClick={() => setPaletteOpen(true)} aria-label="Open command palette">
          <Icon name="search" size={16} style={{ color: "var(--accent)" }} />
          <span className="txt">Jump to anything · ask ATLAS · run a command</span>
          <span className="kbd">⌘K</span>
        </button>

        <div className="po-readouts">
          {/* Agents */}
          <button
            type="button"
            className="po-ro"
            onClick={() => openDock("agents")}
            aria-label="Agents status"
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
          >
            <Icon name="agents" size={15} style={{ color: "var(--t-lo)" }} />
            <div>
              <div className="lab">Agents</div>
              <div className="val" style={{ color: "var(--c-purple-l)" }}>
                <span className="po-livedot" style={{ background: "var(--c-purple-l)" }} />
                {readouts.agentsVal}
              </div>
            </div>
          </button>

          {/* Gateway */}
          <button
            type="button"
            className="po-ro"
            onClick={() => openDock("gateway")}
            aria-label="Gateway status"
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
          >
            <Icon name="gateway" size={15} style={{ color: "var(--t-lo)" }} />
            <div>
              <div className="lab">Gateway</div>
              <div className="val" style={{ color: readouts.gatewayColor }}>
                <span className="po-livedot" style={{ background: readouts.gatewayColor }} />
                {readouts.gatewayVal}
              </div>
            </div>
          </button>

          {/* MRR */}
          <button
            type="button"
            className="po-ro"
            onClick={() => openDock("revenue")}
            aria-label="Monthly recurring revenue"
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
          >
            <Icon name="finance" size={15} style={{ color: "var(--t-lo)" }} />
            <div>
              <div className="lab">MRR</div>
              <div className="val" style={{ color: "var(--gold-l)" }}>
                {readouts.mrrVal}
              </div>
            </div>
          </button>

          {/* live clock */}
          <span className="po-clock tnum">
            {t.hms}
            <span style={{ opacity: 0.4 }}>:{t.ss}</span>
          </span>

          {/* pulse (preserved) */}
          {onTogglePulse && (
            <HudIconBtn
              onClick={onTogglePulse}
              ariaLabel={pulseOpen ? "Close chat pulse" : "Open chat pulse"}
              pressed={pulseOpen}
              title={
                pulse?.available === false
                  ? "Chat pulse offline (no service role)"
                  : `${pulse?.unread ?? 0} unread · ${pulse?.pinnedCount ?? 0} pinned`
              }
              tint={pulseOpen ? "var(--c-cyan)" : undefined}
            >
              <span style={{ position: "relative", display: "grid", placeItems: "center" }}>
                <Icon name="pulse" size={16} />
                {pulse && pulse.unread > 0 && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: -9,
                      right: -10,
                      minWidth: 15,
                      height: 15,
                      padding: "0 4px",
                      borderRadius: 999,
                      background: "var(--c-cyan)",
                      color: "#001318",
                      fontFamily: "var(--f-mono)",
                      fontSize: 9,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {pulse.unread > 99 ? "99+" : pulse.unread}
                  </span>
                )}
              </span>
            </HudIconBtn>
          )}

          {/* wake word (preserved, restyled) */}
          {onToggleWake && (
            <div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <HudIconBtn
                onClick={onToggleWake}
                ariaLabel={wakeEnabled ? "Disable wake word" : "Enable wake word"}
                pressed={wakeEnabled}
                disabled={wakeStatus === "unsupported"}
                tint={wakeTint}
                title={
                  wakeStatus === "unsupported"
                    ? "Wake word not supported in this browser"
                    : wakeStatus === "denied"
                      ? "Microphone permission denied"
                      : wakeEnabled
                        ? `Wake word listening — say 'Atlas' (${wakeMode === "local" ? "local · privacy mode" : "cloud · Web Speech"})`
                        : "Enable wake word"
                }
              >
                <span style={{ position: "relative", display: "grid", placeItems: "center" }}>
                  <Icon name="mic" size={16} />
                  {wakeEnabled && (wakeStatus === "listening" || wakeStatus === "evaluating") && (
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        top: -7,
                        right: -7,
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: wakeStatus === "evaluating" ? "var(--c-gold)" : "var(--c-cyan)",
                        boxShadow: `0 0 8px ${wakeStatus === "evaluating" ? "var(--c-gold)" : "var(--c-cyan)"}`,
                        animation:
                          wakeStatus === "evaluating"
                            ? "po-blink 0.6s steps(1) infinite"
                            : "po-blink 1.8s steps(1) infinite",
                      }}
                    />
                  )}
                  {wakeEnabled && wakeMode === "local" && typeof wakeLevel === "number" && (
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        inset: -3,
                        borderRadius: 7,
                        pointerEvents: "none",
                        boxShadow: `inset 0 0 0 ${Math.min(1 + wakeLevel * 8, 9)}px color-mix(in oklab, var(--c-cyan) ${Math.round(
                          Math.min(wakeLevel * 4, 1) * 60
                        )}%, transparent)`,
                        transition: "box-shadow 90ms linear",
                      }}
                    />
                  )}
                </span>
              </HudIconBtn>
              {onCycleWakeMode && wakeEnabled && wakeStatus !== "unsupported" && (
                <button
                  type="button"
                  onClick={onCycleWakeMode}
                  aria-label={`Switch wake mode (current: ${wakeMode})`}
                  title={
                    wakeMode === "local"
                      ? "Local · audio stays on device. Click to switch to cloud (faster, uses Web Speech)."
                      : "Cloud · streams to Web Speech. Click to switch to local privacy mode (energy VAD + Whisper)."
                  }
                  className="kbd"
                  style={{
                    cursor: "pointer",
                    height: 34,
                    width: 30,
                    display: "grid",
                    placeItems: "center",
                    color: wakeMode === "local" ? "var(--c-cyan)" : "var(--t-mid)",
                  }}
                >
                  {wakeMode === "local" ? "LCL" : "CLD"}
                </button>
              )}
            </div>
          )}

          {/* briefing (preserved) */}
          {onToggleBriefing && (
            <HudIconBtn
              onClick={onToggleBriefing}
              ariaLabel={briefingOpen ? "Close Atlas briefing" : "Open Atlas briefing"}
              pressed={briefingOpen}
              title="Atlas briefing"
              tint={briefingOpen ? "var(--c-gold)" : undefined}
            >
              <span style={{ position: "relative", display: "grid", placeItems: "center" }}>
                <Icon name="spark" size={16} />
                {briefingSpeaking && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: -7,
                      right: -7,
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "var(--c-gold)",
                      boxShadow: "0 0 8px var(--c-gold)",
                      animation: "po-blink 0.85s steps(1) infinite",
                    }}
                  />
                )}
              </span>
            </HudIconBtn>
          )}

          {/* theme toggle (sun) */}
          <HudIconBtn onClick={toggleTheme} ariaLabel="Toggle light / dark" title="Toggle light / dark">
            <Icon name="sun" size={16} />
          </HudIconBtn>

          {/* lock (preserved) */}
          <HudIconBtn onClick={handleLock} ariaLabel="Lock Command Center" title="Lock Command Center" tint="var(--c-red)">
            <Icon name="security" size={16} />
          </HudIconBtn>

          {/* Ask ATLAS → chat */}
          <button type="button" className="po-atlasbtn" onClick={() => router.push("/command-center/chat")}>
            <span className="holo-orb" style={{ width: 26, height: 26 }}>
              <span className="ring2" />
              <span className="sheen" />
              <span className="core" />
            </span>
            <span className="lab">Ask ATLAS</span>
          </button>
        </div>
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
