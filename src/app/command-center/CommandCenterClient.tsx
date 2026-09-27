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

/** wake status union accepted by the HUD (covers cloud + local hook statuses) */
type WakeStatus =
  | 'idle'
  | 'listening'
  | 'triggered'
  | 'unsupported'
  | 'denied'
  | 'evaluating';

import { cockpitFetch } from '@/lib/cockpit-fetch';

export default function CommandCenterClient({children}: {children: React.ReactNode}) {
  const [error, setError] = useState('');
  const lock = useCallback(async () => {
    try {
      const result = await cockpitFetch('/api/auth/session', {method: 'DELETE'});
      if (!result.ok) throw new Error('Sign out could not be verified. Please try again.');
      window.location.assign('/command-login');
    } catch { setError('Sign out could not be verified. Please try again.'); }
  }, []);
  return <>{error && <p role="alert">{error}</p>}<CommandCenterShell onLock={lock}>{children}</CommandCenterShell></>;
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
    </div>
  );
}
