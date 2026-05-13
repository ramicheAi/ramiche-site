'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Sidebar from '@/components/command-center/Sidebar';
import { CommandHUD } from '@/components/command-center/CommandHUD';
import { BriefingDock } from '@/components/command-center/BriefingDock';
import { useBriefing } from '@/hooks/useBriefing';

const MAX_PIN_DIGITS = 12;
/** Session + idle; PIN verified via /api/command-center/auth/pin (`CC_PIN_HASH` / `CC_PIN`). Production requires one of them; local dev may use fallback when `NODE_ENV=development` or `CC_PIN_ALLOW_DEV=1`. */
const STORAGE_KEY = 'cc-pin-auth';
const IDLE_MS = 2 * 60 * 60 * 1000;

function getStoredAuth(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return false;
    const { ok, lastActivity } = JSON.parse(stored) as { ok?: boolean; lastActivity?: number };
    if (ok !== true) return false;
    if (typeof lastActivity === 'number' && Date.now() - lastActivity > IDLE_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function touchSession(): void {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const j = JSON.parse(raw) as { ok?: boolean; ts?: number; lastActivity?: number };
    j.lastActivity = Date.now();
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(j));
  } catch { /* ignore */ }
}

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [serverMsg, setServerMsg] = useState<string | null>(null);
  const [devPinHint, setDevPinHint] = useState(false);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const verifyingRef = useRef(false);

  useEffect(() => {
    void fetch("/api/command-center/auth/pin", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("pin-preflight-failed");
        return res.json() as Promise<{ ready?: boolean; localDevDefaultPin?: boolean }>;
      })
      .then((j) => {
        setDevPinHint(j.localDevDefaultPin === true);
        if (j.ready === false) {
          setServerMsg(
            "PIN is not configured on the server (production unlock is disabled). " +
              "In Vercel → Settings → Environment Variables, add CC_PIN_HASH (SHA-256 hex of your PIN) or CC_PIN. " +
              "Redeploy after saving. Temporary preview-only: CC_PIN_ALLOW_DEV=1 enables the documented dev PIN (use with care)."
          );
        }
      })
      .catch(() => {
        setServerMsg("Could not reach the server for PIN verification. Check your connection, deployment status, or try again.");
      });
  }, []);
  const handleKey = useCallback((digit: string) => {
    if (verifyingRef.current) return;
    if (digit === 'clear') { setPin(''); setError(false); setServerMsg(null); return; }
    if (digit === 'backspace') { setPin(prev => prev.slice(0, -1)); setError(false); setServerMsg(null); return; }
    if (digit === 'enter') {
      if (pin.length < 1) return;
      verifyingRef.current = true;
      setVerifying(true);
      setServerMsg(null);
      void fetch('/api/command-center/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
        .then(async (res) => {
          if (res.ok) {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ok: true, ts: Date.now(), lastActivity: Date.now() }));
            onUnlock();
          } else if (res.status === 503) {
            try {
              const j = (await res.json()) as { error?: string };
              setServerMsg(j.error || 'Set CC_PIN_HASH on the server');
            } catch {
              setServerMsg('Set CC_PIN_HASH on the server');
            }
          } else {
            setError(true);
            setPin('');
            setTimeout(() => setError(false), 600);
          }
        })
        .catch(() => {
          setError(true);
          setPin('');
          setServerMsg("Network error while verifying PIN. Check your connection and try again.");
          setTimeout(() => setError(false), 600);
        })
        .finally(() => {
          verifyingRef.current = false;
          setVerifying(false);
        });
      return;
    }
    if (pin.length < MAX_PIN_DIGITS) setPin(prev => prev + digit);
  }, [pin, onUnlock]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKey(e.key);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleKey('enter');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleKey('backspace');
      } else if (e.key === 'Delete' || e.key === 'Escape') {
        e.preventDefault();
        handleKey('clear');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    hiddenInputRef.current?.focus();
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleKey]);

  const dotCount = Math.max(4, pin.length);

  return (
    <div
      onClick={() => hiddenInputRef.current?.focus()}
      style={{
        minHeight: '100vh', background: '#0a0a0a', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
      }}
    >
      <input
        ref={hiddenInputRef}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        aria-label="PIN entry"
        value=""
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          for (const ch of v) {
            if (ch >= '0' && ch <= '9') handleKey(ch);
          }
        }}
        style={{
          position: 'absolute', opacity: 0, pointerEvents: 'none',
          width: 1, height: 1, left: -9999,
        }}
      />
      <h1 style={{ color: '#fff', fontSize: 24, marginBottom: 8, fontFamily: 'monospace' }}>
        ENTER ACCESS PIN
      </h1>
      {devPinHint && !serverMsg && (
        <p style={{ color: '#737373', fontSize: 11, maxWidth: 360, textAlign: 'center', marginBottom: 12, lineHeight: 1.5, fontFamily: 'monospace' }}>
          Local dev: default PIN is 2451 when CC_PIN_HASH / CC_PIN are unset.
        </p>
      )}
      {serverMsg && (
        <p style={{ color: '#f87171', fontSize: 12, maxWidth: 320, textAlign: 'center', marginBottom: 16, lineHeight: 1.5 }}>
          {serverMsg}
        </p>
      )}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap',
        justifyContent: 'center', maxWidth: 320,
        animation: error ? 'shake 0.4s ease-in-out' : 'none',
      }}>
        {Array.from({ length: dotCount }).map((_, i) => (
          <div key={i} style={{
            width: 20, height: 20, borderRadius: '50%',
            border: '2px solid #7c3aed',
            background: i < pin.length ? '#7c3aed' : 'transparent',
            transition: 'background 0.15s',
          }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 12 }}>
        {['1','2','3','4','5','6','7','8','9','clear','0','enter'].map(k => (
          <button key={k} onClick={() => handleKey(k)} disabled={verifying} style={{
            height: 56, borderRadius: 12, border: 'none', cursor: verifying ? 'not-allowed' : 'pointer',
            fontSize: k.length > 1 ? 12 : 22, fontWeight: 600, fontFamily: 'monospace',
            background: k === 'enter' ? '#7c3aed' : '#1a1a2e',
            color: k === 'enter' ? '#fff' : k === 'clear' ? '#666' : '#fff',
            opacity: verifying ? 0.6 : 1,
          }}>{k === 'clear' ? 'CLR' : k === 'enter' ? (verifying ? '…' : 'GO') : k}</button>
        ))}
      </div>
      <p style={{ color: '#666', fontSize: 11, marginTop: 16, fontFamily: 'monospace' }}>
        Type with keyboard · Backspace to delete · Enter to submit
      </p>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}

export default function CommandCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Always start with `false` on both server and client to avoid a hydration
  // mismatch (sessionStorage is client-only). Restore the stored session in
  // a post-mount effect.
  const [authed, setAuthed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const lock = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setAuthed(false);
  }, []);

  useEffect(() => {
    setHydrated(true);
    if (getStoredAuth()) setAuthed(true);
  }, []);

  useEffect(() => {
    if (!authed) return;
    const onAct = () => touchSession();
    window.addEventListener('keydown', onAct);
    window.addEventListener('click', onAct);
    const id = window.setInterval(() => {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const j = JSON.parse(raw) as { ok?: boolean; lastActivity?: number };
        if (j.ok && typeof j.lastActivity === 'number' && Date.now() - j.lastActivity > IDLE_MS) {
          sessionStorage.removeItem(STORAGE_KEY);
          setAuthed(false);
        }
      } catch { /* ignore */ }
    }, 60_000);
    return () => {
      window.removeEventListener('keydown', onAct);
      window.removeEventListener('click', onAct);
      window.clearInterval(id);
    };
  }, [authed]);

  // Until we've checked sessionStorage on the client, render a minimal
  // placeholder that matches the server output to keep hydration stable.
  if (!hydrated) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0a0a0a',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        <p
          style={{
            color: '#888888',
            fontSize: 11,
            fontFamily: 'monospace',
            letterSpacing: '0.18em',
            textTransform: 'uppercase' as const,
            margin: 0,
          }}
        >
          Command Center · Initializing
        </p>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: '2px solid rgba(124,58,237,0.35)',
            borderTopColor: '#7c3aed',
            animation: 'ccHydrateSpin 0.85s linear infinite',
          }}
        />
        <style>{`
          @keyframes ccHydrateSpin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (!authed) {
    return <PinGate onUnlock={() => setAuthed(true)} />;
  }

  return <CommandCenterShell onLock={lock}>{children}</CommandCenterShell>;
}

function CommandCenterShell({
  children,
  onLock,
}: {
  children: React.ReactNode;
  onLock: () => void;
}) {
  const briefingState = useBriefing();
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0a' }}>
      <Sidebar />
      <CommandHUD
        onLock={onLock}
        onToggleBriefing={() => briefingState.setOpen(!briefingState.open)}
        briefingOpen={briefingState.open}
        briefingSpeaking={briefingState.status === 'speaking'}
      />
      <BriefingDock briefingState={briefingState} />
      <div
        id="cc-content"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: '100vh',
          marginLeft: 240,
          paddingTop: 56,
          overflowX: 'hidden' as const,
        }}
      >
        {children}
      </div>
      <style>{`
        @media (max-width: 767px) {
          #cc-content {
            margin-left: 0 !important;
            padding-top: 56px !important;
          }
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
