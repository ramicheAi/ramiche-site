'use client';

import { useState, useSyncExternalStore, useCallback } from 'react';
import Sidebar from '@/components/command-center/Sidebar';

const CC_PIN = '2451';
const CC_AUTH_KEY = 'cc_authenticated';
const CC_AUTH_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days

function checkAuth(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = localStorage.getItem(CC_AUTH_KEY);
    if (!stored) return false;
    const { ts } = JSON.parse(stored);
    if (Date.now() - ts < CC_AUTH_EXPIRY) return true;
    localStorage.removeItem(CC_AUTH_KEY);
  } catch { /* ignore */ }
  return false;
}

function subscribe(cb: () => void) {
  window.addEventListener('storage', cb);
  return () => window.removeEventListener('storage', cb);
}

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = () => {
    if (pin === CC_PIN) {
      localStorage.setItem(CC_AUTH_KEY, JSON.stringify({ ts: Date.now() }));
      onUnlock();
    } else {
      setError(true);
      setShake(true);
      setPin('');
      setTimeout(() => setShake(false), 500);
    }
  };

  const handleKeypad = (digit: string) => {
    if (pin.length < 6) setPin(prev => prev + digit);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#0a0a0a', fontFamily: 'monospace',
    }}>
      <div style={{
        textAlign: 'center', padding: 40,
        animation: shake ? 'shake 0.5s' : undefined,
      }}>
        <div style={{ fontSize: 14, color: '#666', letterSpacing: 4, marginBottom: 24 }}>
          PARALLAX COMMAND CENTER
        </div>
        <div style={{ fontSize: 12, color: '#444', marginBottom: 32 }}>
          ENTER ACCESS PIN
        </div>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 32 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              width: 16, height: 16, borderRadius: '50%',
              border: '2px solid #333',
              background: i < pin.length ? '#c084fc' : 'transparent',
              transition: 'background 0.15s',
            }} />
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 64px)', gap: 12, justifyContent: 'center' }}>
          {['1','2','3','4','5','6','7','8','9','','0',''].map((d, i) => (
            d ? (
              <button key={i} onClick={() => handleKeypad(d)} style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#1a1a1a', border: '1px solid #333', color: '#fff',
                fontSize: 24, cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#2a2a2a'; e.currentTarget.style.borderColor = '#c084fc'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.borderColor = '#333'; }}
              >
                {d}
              </button>
            ) : <div key={i} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 24 }}>
          <button onClick={() => setPin('')} style={{
            background: 'none', border: 'none', color: '#666', fontSize: 13, cursor: 'pointer',
          }}>CLEAR</button>
          <button onClick={handleSubmit} style={{
            background: 'none', border: 'none', color: '#c084fc', fontSize: 13, cursor: 'pointer', fontWeight: 700,
          }}>ENTER</button>
        </div>

        {error && (
          <div style={{ color: '#ef4444', fontSize: 12, marginTop: 16 }}>
            ACCESS DENIED
          </div>
        )}

        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-10px); }
            75% { transform: translateX(10px); }
          }
        `}</style>
      </div>
    </div>
  );
}

export default function CommandCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAuthed = useSyncExternalStore(subscribe, checkAuth, () => false);
  const [unlocked, setUnlocked] = useState(false);

  const handleUnlock = useCallback(() => {
    setUnlocked(true);
  }, []);

  if (!isAuthed && !unlocked) {
    return <PinGate onUnlock={handleUnlock} />;
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
