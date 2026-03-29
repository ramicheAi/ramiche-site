'use client';

import { useState, useCallback, useEffect } from 'react';
import Sidebar from '@/components/command-center/Sidebar';

const MAX_PIN_DIGITS = 12;
/** Session + idle; PIN verified via /api/command-center/auth/pin (CC_PIN_HASH / CC_PIN in env). */
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

  const handleKey = useCallback((digit: string) => {
    if (digit === 'clear') { setPin(''); setError(false); return; }
    if (digit === 'enter') {
      if (pin.length < 1) return;
      setVerifying(true);
      void fetch('/api/command-center/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
        .then((res) => {
          if (res.ok) {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ok: true, ts: Date.now(), lastActivity: Date.now() }));
            onUnlock();
          } else {
            setError(true);
            setPin('');
            setTimeout(() => setError(false), 600);
          }
        })
        .catch(() => {
          setError(true);
          setPin('');
          setTimeout(() => setError(false), 600);
        })
        .finally(() => setVerifying(false));
      return;
    }
    if (pin.length < MAX_PIN_DIGITS) setPin(prev => prev + digit);
  }, [pin, onUnlock]);

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a', display: 'flex',
      alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
    }}>
      <h1 style={{ color: '#fff', fontSize: 24, marginBottom: 8, fontFamily: 'monospace' }}>
        ENTER ACCESS PIN
      </h1>
      <div style={{
        display: 'flex', gap: 12, marginBottom: 24,
        animation: error ? 'shake 0.4s ease-in-out' : 'none',
      }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{
            width: 20, height: 20, borderRadius: '50%',
            border: '2px solid #7c3aed',
            background: i < pin.length ? '#7c3aed' : 'transparent',
          }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 12 }}>
        {['1','2','3','4','5','6','7','8','9','clear','0','enter'].map(k => (
          <button key={k} onClick={() => handleKey(k)} style={{
            height: 56, borderRadius: 12, border: 'none', cursor: 'pointer',
            fontSize: k.length > 1 ? 12 : 22, fontWeight: 600, fontFamily: 'monospace',
            background: k === 'enter' ? '#7c3aed' : k === 'clear' ? '#1a1a2e' : '#1a1a2e',
            color: k === 'enter' ? '#fff' : k === 'clear' ? '#666' : '#fff',
          }}>{k === 'clear' ? 'CLR' : k === 'enter' ? (verifying ? '…' : 'GO') : k}</button>
        ))}
      </div>
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
  const [authed, setAuthed] = useState(getStoredAuth);

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

  if (!authed) {
    return <PinGate onUnlock={() => setAuthed(true)} />;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0a' }}>
      <Sidebar />
      <div
        id="cc-content"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: '100vh',
          marginLeft: 240,
          overflowX: 'hidden' as const,
        }}
      >
        {children}
      </div>
      <style>{`
        @media (max-width: 767px) {
          #cc-content {
            margin-left: 0 !important;
            padding-top: 48px;
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
