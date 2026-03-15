'use client';

import { useState } from 'react';
import ParticleField from '../../../components/ParticleField';

const C = { navy: '#1a237e', navyLight: '#283593', navyDark: '#0d1452', gold: '#ffd700', goldDim: '#c9a800', white: '#ffffff', bg: '#060818', cardBg: '#0c1230' };

interface Registration {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
  race: string;
  team: string;
  emergencyName: string;
  emergencyPhone: string;
  medical: string;
  paymentStatus: string;
  date: string;
}

export default function PowerChallengeAdminPage() {
  const [search, setSearch] = useState('');
  const [pin, setPin] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async (adminPin: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/power-challenge/admin', {
        headers: { 'x-admin-pin': adminPin },
      });
      if (!res.ok) {
        if (res.status === 401) { setError('Invalid PIN'); setAuthenticated(false); }
        else { setError('Failed to load data'); }
        return;
      }
      const data = await res.json();
      setRegistrations(data.registrations || []);
      setAuthenticated(true);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(pin);
  };

  if (!authenticated) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <ParticleField variant="gold" count={30} speed={0.2} opacity={0.3} />
        <form onSubmit={handleLogin} style={{ position: 'relative', zIndex: 1, background: C.cardBg, border: `2px solid ${C.navyLight}`, borderRadius: 12, padding: 40, textAlign: 'center', minWidth: 320 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: C.gold, marginBottom: 24 }}>Admin Access</h1>
          <input type="password" placeholder="Enter PIN" value={pin} onChange={(e) => setPin(e.target.value)} style={{ width: '100%', padding: '12px 16px', marginBottom: 16, background: C.bg, border: `1px solid ${C.navyLight}`, borderRadius: 8, color: C.white, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          {error && <div style={{ color: '#ff5252', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px 16px', background: C.gold, color: C.navyDark, border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{loading ? 'Loading...' : 'Enter'}</button>
        </form>
      </div>
    );
  }

  const filtered = registrations.filter((r) => {
    const q = search.toLowerCase();
    return `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
  });

  const total = registrations.length;
  const count500 = registrations.filter((r) => r.race === '500m').length;
  const count15k = registrations.filter((r) => r.race === '1.5K').length;
  const revenue = registrations.reduce((sum, r) => {
    if (r.paymentStatus !== 'paid') return sum;
    return sum + (r.race === '1.5K' ? 65 : 45);
  }, 0);

  const stats = [
    { label: 'Total Registrations', value: total },
    { label: '500m Count', value: count500 },
    { label: '1.5K Count', value: count15k },
    { label: 'Total Revenue', value: `$${revenue}` },
  ];

  const thStyle: React.CSSProperties = { padding: '12px 16px', textAlign: 'left', borderBottom: `2px solid ${C.gold}`, color: C.gold, fontWeight: 600, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' };
  const tdStyle: React.CSSProperties = { padding: '10px 16px', borderBottom: `1px solid ${C.navyDark}`, color: C.white, fontSize: 14 };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.white, position: 'relative', fontFamily: 'system-ui, sans-serif' }}>
      <ParticleField variant="gold" count={30} speed={0.2} opacity={0.3} />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: C.gold, margin: 0 }}>Power Challenge Admin</h1>
          <button
            onClick={() => window.open(`/api/power-challenge/export?pin=${encodeURIComponent(pin)}`, '_blank')}
            style={{ padding: '10px 24px', background: C.navy, color: C.gold, border: `1px solid ${C.gold}`, borderRadius: 6, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
          >
            Export CSV
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ background: C.cardBg, border: `1px solid ${C.navyLight}`, borderRadius: 10, padding: '20px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.gold }}>{s.value}</div>
              <div style={{ fontSize: 13, color: C.goldDim, marginTop: 6 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '12px 16px', marginBottom: 24, background: C.cardBg, border: `1px solid ${C.navyLight}`, borderRadius: 8, color: C.white, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
        />

        <div style={{ overflowX: 'auto', background: C.cardBg, borderRadius: 10, border: `1px solid ${C.navyLight}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Race</th>
                <th style={thStyle}>Team</th>
                <th style={thStyle}>Payment Status</th>
                <th style={thStyle}>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={`${r.email}-${r.date}`} style={{ transition: 'background 0.2s' }}>
                  <td style={tdStyle}>{r.firstName} {r.lastName}</td>
                  <td style={tdStyle}>{r.email}</td>
                  <td style={tdStyle}>
                    <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: r.race === '500m' ? C.navyLight : C.navyDark, color: C.gold }}>
                      {r.race}
                    </span>
                  </td>
                  <td style={tdStyle}>{r.team}</td>
                  <td style={tdStyle}>
                    <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: r.paymentStatus === 'paid' ? '#1b5e20' : '#b8860b', color: C.white }}>
                      {r.paymentStatus}
                    </span>
                  </td>
                  <td style={tdStyle}>{new Date(r.date).toLocaleDateString()}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', padding: 32, color: C.goldDim }}>No registrations found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
