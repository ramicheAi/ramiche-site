'use client';

import { useState, useCallback, useEffect } from 'react';
// Parallax OS stylesheet layer — load order mirrors the prototype HTML.
import './po/po-theme.css';
import './po/po-holo.css';
import './po/po-canopy.css';
import './po/po-ui.css';
import './po/po-command.css';
import './po/po-stage.css';
import './po/po-avatar.css';
import './po/po-chat.css';
import './po/po-console.css';
import './po/po-pages.css';
import './po/po-sanctuary.css';
import './po/po-boot.css';
import './po/po-mobile.css';
import PoShell, { usePoTheme } from '@/components/command-center/PoShell';
import Sidebar from '@/components/command-center/Sidebar';
import { CommandHUD } from '@/components/command-center/CommandHUD';
import { BriefingDock } from '@/components/command-center/BriefingDock';
import { PulseDock } from '@/components/command-center/PulseDock';
import { PushToast } from '@/components/command-center/PushToast';
import AlertTicker from '@/components/command-center/AlertTicker';
import AlertMonitor from '@/components/command-center/po/AlertMonitor';
import Boot from '@/components/command-center/Boot';
import { initPoSound } from '@/lib/po-sound';
import { useBriefing } from '@/hooks/useBriefing';
import { useChatPulse, type ChatPulse } from '@/hooks/useChatPulse';
import { useWakeWord } from '@/hooks/useWakeWord';
import { useLocalWake } from '@/hooks/useLocalWake';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthEntryPath } from '@/lib/command-center-auth-entry';

/** wake status union accepted by the HUD (covers cloud + local hook statuses) */
type WakeStatus =
  | 'idle'
  | 'listening'
  | 'triggered'
  | 'unsupported'
  | 'denied'
  | 'evaluating';

export default function CommandCenterClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // The unlock and bootstrap pages ARE the credential entry points. They must
  // render bare: no cockpit shell (which itself calls owner-gated APIs) and no
  // client-side PIN gate. Before this, a browser with no device cookie was
  // sent here by middleware and then stopped by the layout's legacy PIN gate —
  // which it could never satisfy, making first-device enrollment unreachable.
  // Every OTHER Command Center page has already passed the server-side owner
  // guard in middleware.ts, so a second client PIN prompt here was both
  // redundant (a double prompt after /unlock) and not a security control
  // (sessionStorage is client-writable; the server cookies are authoritative).
  const lock = useCallback(() => {
    // The unlock cookie is httpOnly, so only the server can clear it;
    // middleware handles ?lock=1 when rendering the unlock page.
    window.location.assign('/command-center/unlock?lock=1');
  }, []);

  if (isAuthEntryPath(pathname)) {
    return <>{children}</>;
  }

  return <CommandCenterShell onLock={lock}>{children}</CommandCenterShell>;
}

const WAKE_PREF_KEY = 'cc-wake-enabled';
const WAKE_MODE_KEY = 'cc-wake-mode';
const WAKE_TRIGGER_KEY = 'cc-wake-trigger';

type WakeMode = 'cloud' | 'local';

function CommandCenterShell({
  children,
  onLock,
}: {
  children: React.ReactNode;
  onLock: () => void;
}) {
  const briefingState = useBriefing();
  const pulse = useChatPulse();
  const router = useRouter();
  const pathname = usePathname();
  const [wakeEnabled, setWakeEnabled] = useState(false);
  const [wakeMode, setWakeModeState] = useState<WakeMode>('cloud');
  const [pulseOpen, setPulseOpen] = useState(false);

  useEffect(() => {
    try {
      setWakeEnabled(window.localStorage.getItem(WAKE_PREF_KEY) === '1');
      const m = window.localStorage.getItem(WAKE_MODE_KEY);
      if (m === 'local' || m === 'cloud') setWakeModeState(m);
    } catch {
      /* ignore */
    }
  }, []);

  const setWakeMode = useCallback((m: WakeMode) => {
    setWakeModeState(m);
    try {
      window.localStorage.setItem(WAKE_MODE_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  const handleWake = useCallback(
    (heard: string) => {
      try {
        sessionStorage.setItem(WAKE_TRIGGER_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
      if (pathname !== '/command-center/chat') {
        router.push('/command-center/chat#dm=atlas&voice=auto');
      } else {
        window.dispatchEvent(new CustomEvent('cc:wake', { detail: { heard } }));
      }
    },
    [pathname, router]
  );

  const cloudWake = useWakeWord({ enabled: wakeEnabled && wakeMode === 'cloud', onWake: handleWake });
  const localWake = useLocalWake({ enabled: wakeEnabled && wakeMode === 'local', onWake: handleWake });

  const activeStatus = wakeMode === 'local' ? localWake.status : cloudWake.status;
  const wakeLevel = wakeMode === 'local' ? localWake.level : 0;

  const cycleWakeMode = useCallback(() => {
    setWakeMode(wakeMode === 'cloud' ? 'local' : 'cloud');
  }, [wakeMode, setWakeMode]);

  const toggleWake = useCallback(() => {
    setWakeEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(WAKE_PREF_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <PoShell>
      <Cockpit
        onLock={onLock}
        briefingState={briefingState}
        pulse={pulse}
        pulseOpen={pulseOpen}
        setPulseOpen={setPulseOpen}
        wakeEnabled={wakeEnabled}
        activeStatus={activeStatus}
        wakeMode={wakeMode}
        wakeLevel={wakeLevel}
        toggleWake={toggleWake}
        cycleWakeMode={cycleWakeMode}
      >
        {children}
      </Cockpit>
    </PoShell>
  );
}

/* The cockpit body. Lives INSIDE <PoShell> so it can read usePoTheme() for the
 * motion toggles, which the ported CSS expects on an element under .po-shell
 * (the `.po-app` wrapper carries `.po-still`). */
function Cockpit({
  children,
  onLock,
  briefingState,
  pulse,
  pulseOpen,
  setPulseOpen,
  wakeEnabled,
  activeStatus,
  wakeMode,
  wakeLevel,
  toggleWake,
  cycleWakeMode,
}: {
  children: React.ReactNode;
  onLock: () => void;
  briefingState: ReturnType<typeof useBriefing>;
  pulse: ChatPulse;
  pulseOpen: boolean;
  setPulseOpen: React.Dispatch<React.SetStateAction<boolean>>;
  wakeEnabled: boolean;
  activeStatus: WakeStatus;
  wakeMode: WakeMode;
  wakeLevel: number;
  toggleWake: () => void;
  cycleWakeMode: () => void;
}) {
  const { still } = usePoTheme();

  // Initialize the sound bridge once (autoplay-safe; off unless enabled).
  useEffect(() => {
    initPoSound();
  }, []);

  return (
    <div
      className={`po-app${still ? ' po-still' : ''}`}
      style={{
        // .po-app in the prototype is fixed/inset-0/overflow-hidden (its own
        // internal scroll). This codebase uses fixed sidebar + HUD over a
        // document-scrolling #cc-content, so neutralize those three props and
        // keep only the .po-still descendant hook + flex flow.
        position: 'static',
        inset: 'auto',
        overflow: 'visible',
        display: 'flex',
        minHeight: '100vh',
      }}
    >
      <Sidebar />
      <CommandHUD
        onLock={onLock}
        onToggleBriefing={() => briefingState.setOpen(!briefingState.open)}
        briefingOpen={briefingState.open}
        briefingSpeaking={briefingState.status === 'speaking'}
        wakeEnabled={wakeEnabled}
        wakeStatus={activeStatus}
        wakeMode={wakeMode}
        wakeLevel={wakeLevel}
        onToggleWake={toggleWake}
        onCycleWakeMode={cycleWakeMode}
        onTogglePulse={() => {
          setPulseOpen((o) => !o);
        }}
        pulseOpen={pulseOpen}
        pulse={pulse}
      />
      <AlertTicker />
      <AlertMonitor />
      <BriefingDock briefingState={briefingState} />
      <PulseDock open={pulseOpen} pulse={pulse} onClose={() => setPulseOpen(false)} />
      <PushToast />
      <Boot />
      <div
        id="cc-content"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: '100vh',
          marginLeft: 244,
          paddingTop: 64,
          overflowX: 'hidden' as const,
        }}
      >
        {children}
      </div>
      <style>{`
        /* sidebar collapses to a 66px icon rail ≤1024, 56px ≤640 (po-mobile.css).
           The HUD + alert ticker are position:fixed, so their left offset must
           track the rail width at each breakpoint. */
        @media (max-width: 1024px) {
          #cc-content { margin-left: 66px; }
          #cc-hud, #cc-alertbar { left: 66px !important; }
        }
        @media (min-width: 768px) and (max-width: 1024px) {
          .po-hud-secondary { display: none !important; }
          .po-shell .po-icbtn { width: 44px; height: 44px; }
          .po-shell .po-atlasbtn { height: 44px; }
          .po-shell button { min-height: 44px; min-width: 44px; }
          .po-shell .pg-head-act a { min-height: 44px; display: inline-flex; align-items: center; }
          .po-shell .pg-head, .po-shell .instrument-head { flex-wrap: wrap !important; }
          .po-shell .pg-head-act { width: 100%; flex-wrap: wrap; }
          .po-shell .ag-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .po-shell .arb-grid { grid-template-columns: 1fr !important; }
          .po-shell .sw-main { display: flex !important; flex-direction: column-reverse !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
          .po-shell .sw-main > div:first-child { max-height: 180px; overflow-y: auto; border-right: none !important; border-bottom: 1px solid var(--line); }
          .po-shell .sw-main > div:last-child { min-height: 420px; }
          .po-shell .sw-main > div:last-child > div:first-child { display: none !important; }
          .po-shell .sw-filter-row { flex-wrap: wrap; margin-left: 0 !important; width: 100%; }
          .po-shell .sw-filter-row button { min-height: 44px; padding: 6px 10px; }
          .po-shell .chat-input-area button, .po-shell .chat-header-bar button { min-width: 44px; }
          .po-shell .chat-inline-symbol { display: none !important; }
          .po-shell .chat-input-textarea { padding-right: 118px !important; }
          .po-shell .chat-top-nav a { min-height: 44px; display: inline-flex; align-items: center; }
          body:has(#cc-alertbar) .chat-root { height: calc(100dvh - 102px - env(safe-area-inset-top)) !important; }
          .po-shell .sanc-star { padding: 12px 14px; margin: -12px -14px; }
        }
        @media (max-width: 767px) {
          .po-shell .sanc-star { padding: 12px 14px; margin: -12px -14px; }
        }
        @media (max-width: 430px) {
          .po-shell .instrument-head > div, .po-shell .pg-head > div { flex-wrap: wrap; min-width: 0; }
          .po-shell .sanc-tele, .po-shell .sanc-rays, .po-shell .sanc-halo, .po-shell .sanc-reticle { display: none !important; }
        }
        @media (max-width: 400px) {
          .po-shell .sanc-truths { font-size: 10px; gap: 6px 10px; }
          .po-shell .sanc-truths .t:last-of-type, .po-shell .sanc-truths .sep:last-of-type { display: none; }
          .po-shell .sanc-constellation { transform: translateY(30px); }
        }
        @media (max-width: 640px) {
          #cc-content { margin-left: 56px; }
          #cc-hud, #cc-alertbar { left: 56px !important; }
          /* HUD shrinks to 56px on phones (po-mobile.css) — ride the ticker up */
          #cc-alertbar { top: 56px !important; }
        }
        @media (max-width: 767px) {
          #cc-content {
            margin-left: 0 !important;
            padding-top: 56px !important;
          }
          /* phone: sidebar is off-canvas; HUD/ticker span full width with room
             for the floating ☰ toggle */
          #cc-hud { left: 0 !important; padding-left: 60px !important; }
          #cc-alertbar { left: 0 !important; }
          #cc-content h1 {
            font-size: 24px !important;
          }
          #cc-content [style*="maxWidth: 1400"],
          #cc-content [style*="max-width: 1400"],
          #cc-content [style*="maxWidth: 1200"],
          #cc-content [style*="max-width: 1200"] {
            padding-left: 12px !important;
            padding-right: 12px !important;
          }
        }
        @media (max-width: 480px) {
          #cc-content {
            font-size: 14px;
          }
          #cc-content h1 {
            font-size: 20px !important;
          }
          #cc-content h2 {
            font-size: 13px !important;
          }
        }
        @media (max-width: 767px) {
          .cc-responsive-grid {
            grid-template-columns: 1fr !important;
          }
          .cc-responsive-flex {
            flex-direction: column !important;
          }
        }
      `}</style>

      <style>{`
        /* ── phone shell: safe areas, one navigator, no controls hidden under chrome ── */
        #cc-hud { height: calc(64px + env(safe-area-inset-top)) !important; padding-top: env(safe-area-inset-top); }
        #cc-content { padding-top: calc(64px + env(safe-area-inset-top)) !important; padding-bottom: env(safe-area-inset-bottom); }
        body:has(#cc-alertbar) #cc-content { padding-top: calc(64px + 38px + env(safe-area-inset-top)) !important; }
        #cc-alertbar { top: calc(64px + env(safe-area-inset-top)) !important; }
        .po-menu-btn { display: none; }
        .po-hud-secondary { display: inline-flex; align-items: center; }
        .po-shell .pg-head-meta { flex-wrap: wrap; min-width: 0; }
        .po-shell .pg-serial { min-width: 0; overflow-wrap: anywhere; }
        @media (max-width: 360px) {
          .po-shell .po-cmdbar { justify-content: center; padding: 0 10px; }
        }
        .po-side-close { display: none; }
        @media (max-width: 767px) {
          #cc-hud { left: 0 !important; height: calc(56px + env(safe-area-inset-top)) !important; padding: env(safe-area-inset-top) 8px 0 !important; gap: 8px !important; }
          #cc-content { margin-left: 0 !important; padding-top: calc(56px + env(safe-area-inset-top)) !important; padding-bottom: calc(env(safe-area-inset-bottom) + 12px); }
          body:has(#cc-alertbar) #cc-content { padding-top: calc(56px + 38px + env(safe-area-inset-top)) !important; }
          #cc-alertbar { left: 0 !important; top: calc(56px + env(safe-area-inset-top)) !important; }
          .po-menu-btn { display: grid; width: 44px; height: 44px; flex: 0 0 44px; place-items: center; border-radius: 10px; border: 1px solid var(--line); background: var(--panel-glass); color: var(--accent); font: inherit; cursor: pointer; }
          .po-hud-secondary { display: none !important; }
          .po-shell .po-icbtn { width: 44px; height: 44px; }
          .po-shell .po-atlasbtn { height: 44px; padding: 0 8px; }
          .po-shell .po-cmdbar { height: 44px; min-width: 0; }
          .po-shell .po-cmdbar .txt { font-size: 0; }
          .po-shell .po-cmdbar .txt::after { content: "Search"; font-size: 12px; }
          .po-shell .po-cmdbar .kbd { display: none; }
          .po-side { z-index: 80 !important; height: 100dvh !important; padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); }
          .po-nav-overlay { z-index: 75 !important; }
          .po-side-head { padding-right: 56px; }
          .po-side-close { display: grid; position: absolute; top: calc(env(safe-area-inset-top) + 6px); right: 10px; width: 44px; height: 44px; place-items: center; z-index: 2; border-radius: 10px; border: 1px solid var(--line); background: var(--panel-glass); color: var(--t-hi); font: inherit; cursor: pointer; }
          .po-shell .po-navitem { min-height: 44px; }
          .po-shell .atlas-briefing { top: calc(56px + env(safe-area-inset-top)) !important; width: 100vw !important; max-width: 100vw !important; z-index: 80 !important; padding-bottom: env(safe-area-inset-bottom); }
          .po-shell .atlas-briefing button { min-width: 44px; min-height: 44px; }
        }
        @media (max-width: 640px) {
          .po-shell .ag-grid { grid-template-columns: 1fr !important; }
          .po-shell .coll-card { min-width: 0; width: 100%; }
          .po-shell .arb-grid, .po-shell .arb-stats { grid-template-columns: 1fr !important; }
          .po-shell .sw-main { grid-template-columns: 1fr !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
          .po-shell .sw-main > div:first-child { max-height: 180px; overflow-y: auto; border-right: none !important; border-bottom: 1px solid var(--line); }
          .po-shell .sw-filter-row { flex-wrap: wrap; margin-left: 0 !important; width: 100%; }
          .po-shell .sw-filter-row button { min-height: 44px; padding: 6px 10px; }
          .po-shell .decision-stats { grid-template-columns: repeat(2, 1fr) !important; }
          .po-shell .sw-stats { display: flex !important; overflow-x: auto; }
          .po-shell .sw-stats > div { flex: 0 0 110px !important; border-right: 1px solid var(--line); border-bottom: none; }
          .po-shell .health-process-row { grid-template-columns: 44px 38px 38px 1fr !important; gap: 8px !important; }
          .po-shell .health-process-cmd { white-space: normal !important; overflow: visible !important; text-overflow: clip !important; word-break: break-word; }
          .po-shell .sw-main { display: flex !important; flex-direction: column-reverse !important; }
          .po-shell .sw-main > div:last-child { min-height: 420px; }
          .po-shell .sw-main > div:last-child > div:first-child { display: none !important; }
          .po-shell button { min-height: 44px; min-width: 44px; }
          .po-shell .pg-head-act a { min-height: 44px; display: inline-flex; align-items: center; }
          .po-shell .chat-input-area button, .po-shell .chat-header-bar button { min-width: 44px; }
          .po-shell .stage .orbit-node, .po-shell .stage .orbit-chip { display: none !important; }
          .po-shell .task-head { flex-wrap: wrap; }
          .po-shell .task-progress { max-width: 100%; }
          .po-shell .pg-head, .po-shell .instrument-head { flex-wrap: wrap !important; }
          .po-shell .pg-head-act { width: 100%; flex-wrap: wrap; }
        }
      `}</style>
    </div>
  );
}
