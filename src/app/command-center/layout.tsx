'use client';

import { useState, useCallback } from 'react';
import Sidebar from '@/components/command-center/Sidebar';

const CORRECT_PIN = '2451';
const STORAGE_KEY = 'cc-pin-auth';
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

function getStoredAuth(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;
    const { ts } = JSON.parse(stored);
    return Date.now() - ts < THIRTY_DAYS;
  } catch {
    return false;
  }
}

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleKey = useCallback((digit: string) => {
    if (digit === 'clear') { setPin(''); setError(false); return; }
    if (digit === 'enter') {
      if (pin === CORRECT_PIN) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ts: Date.now() }));
        onUnlock();
      } else {
        setError(true);
        setPin('');
        setTimeout(() => setError(false), 600);
      }
      return;
    }
    if (pin.length < 6) setPin(prev => prev + digit);
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
        {[0,1,2,3].map(i => (
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
          }}>{k === 'clear' ? 'CLR' : k === 'enter' ? 'GO' : k}</button>
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
          #cc-content { margin-left: 0 !important; }
        }
      `}</style>
    </div>
  );
}
