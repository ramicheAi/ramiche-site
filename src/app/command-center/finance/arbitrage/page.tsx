'use client'

import { useState, useMemo } from 'react'

/* ══════════════════════════════════════════════════════════════════════════════
   ARBITRAGE YIELD CALCULATOR — Native React
   Command Center aesthetic: #09090b bg, thin borders, accent glows.
   ══════════════════════════════════════════════════════════════════════════════ */

const TIERS = [
  { label: 'Standard ($100/hr)', rate: 100, desc: 'Routine tasks — data entry, scheduling, research' },
  { label: 'Advanced ($250/hr)', rate: 250, desc: 'Complex workflows — coding, analysis, strategy' },
  { label: 'Elite ($500/hr)', rate: 500, desc: 'Custom deployment — full-stack agent, white-glove' },
]

export default function ArbitrageCalculatorPage() {
  const [humanSpend, setHumanSpend] = useState(5000)
  const [humanHours, setHumanHours] = useState(80)
  const [tierIdx, setTierIdx] = useState(1)
  const [speedMultiplier, setSpeedMultiplier] = useState(10)

  const calc = useMemo(() => {
    const rate = TIERS[tierIdx].rate
    const agentHours = humanHours / speedMultiplier
    const agentCost = agentHours * rate
    const savings = humanSpend - agentCost
    const timeSaved = humanHours - agentHours
    const savingsPercent = humanSpend > 0 ? Math.round((savings / humanSpend) * 100) : 0
    const humanBarPct = 100
    const agentBarPct = humanSpend > 0 ? Math.max(3, Math.round((agentCost / humanSpend) * 100)) : 3
    return { agentCost, savings, timeSaved, savingsPercent, humanBarPct, agentBarPct, agentHours }
  }, [humanSpend, humanHours, tierIdx, speedMultiplier])

  const fmt = (n: number) => '$' + Math.round(n).toLocaleString()
  const positive = calc.savings >= 0

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#e4e4e7' }}>
      {/* Header */}
      <div style={{
        padding: '32px 48px', borderBottom: '1px solid rgba(34,197,94,0.2)',
        background: 'linear-gradient(180deg, rgba(34,197,94,0.06) 0%, transparent 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{
            padding: '4px 12px', fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
            textTransform: 'uppercase' as const, background: 'rgba(34,197,94,0.12)',
            color: '#4ade80', borderRadius: 4,
          }}>Verified Agent Business</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>Arbitrage Yield Calculator</h1>
        <p style={{ color: '#71717a', fontSize: 14, marginTop: 4 }}>Compare human labor cost vs. AI agent deployment</p>
      </div>

      <div style={{ padding: '32px 48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          {/* Input Panel */}
          <div style={{ background: '#111113', border: '1px solid #27272a', borderRadius: 8, padding: 28 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#4ade80', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 24 }}>
              Parameters
            </h3>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#71717a', marginBottom: 6 }}>Monthly Human/Agency Spend</label>
              <input type="number" value={humanSpend} onChange={e => setHumanSpend(+e.target.value || 0)}
                style={{
                  width: '100%', padding: '12px 16px', background: '#09090b', border: '1px solid #27272a',
                  borderRadius: 6, color: '#e4e4e7', fontSize: 18, fontWeight: 700, outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#71717a', marginBottom: 6 }}>Human Hours Spent (Monthly)</label>
              <input type="number" value={humanHours} onChange={e => setHumanHours(+e.target.value || 0)}
                style={{
                  width: '100%', padding: '12px 16px', background: '#09090b', border: '1px solid #27272a',
                  borderRadius: 6, color: '#e4e4e7', fontSize: 18, fontWeight: 700, outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#71717a', marginBottom: 6 }}>Agent Tier</label>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                {TIERS.map((tier, i) => (
                  <button key={i} onClick={() => setTierIdx(i)} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 16px', borderRadius: 6, cursor: 'pointer', textAlign: 'left' as const,
                    border: tierIdx === i ? '1px solid #22c55e40' : '1px solid #27272a',
                    background: tierIdx === i ? 'rgba(34,197,94,0.08)' : '#09090b',
                    color: tierIdx === i ? '#4ade80' : '#71717a',
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: tierIdx === i ? '#e4e4e7' : '#a1a1aa' }}>{tier.label}</div>
                      <div style={{ fontSize: 11, marginTop: 2 }}>{tier.desc}</div>
                    </div>
                    {tierIdx === i && <span style={{ fontSize: 16 }}>◈</span>}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#71717a', marginBottom: 8 }}>
                <span>Agent Speed Multiplier</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#4ade80' }}>{speedMultiplier}x</span>
              </label>
              <input type="range" min={2} max={50} value={speedMultiplier}
                onChange={e => setSpeedMultiplier(+e.target.value)}
                style={{ width: '100%', accentColor: '#22c55e' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#52525b', marginTop: 4 }}>
                <span>2x</span><span>50x</span>
              </div>
            </div>
          </div>

          {/* Output Panel */}
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 16 }}>
            {/* Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{
                background: '#111113', border: '1px solid #27272a', borderRadius: 8, padding: 24, textAlign: 'center' as const,
              }}>
                <div style={{ fontSize: 12, color: '#71717a', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Agent Cost</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#e4e4e7' }}>{fmt(calc.agentCost)}</div>
                <div style={{ fontSize: 12, color: '#52525b', marginTop: 4 }}>{calc.agentHours.toFixed(1)} hrs work</div>
              </div>
              <div style={{
                background: '#111113', borderRadius: 8, padding: 24, textAlign: 'center' as const,
                border: `1px solid ${positive ? '#22c55e30' : '#ef444430'}`,
                boxShadow: positive ? '0 0 20px rgba(34,197,94,0.1)' : '0 0 20px rgba(239,68,68,0.1)',
              }}>
                <div style={{ fontSize: 12, color: '#71717a', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Net Savings</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: positive ? '#22c55e' : '#ef4444' }}>{fmt(calc.savings)}</div>
                <div style={{ fontSize: 12, color: '#52525b', marginTop: 4 }}>{calc.savingsPercent}% reduction</div>
              </div>
            </div>

            <div style={{
              background: '#111113', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8,
              padding: 24, textAlign: 'center' as const,
              boxShadow: '0 0 20px rgba(59,130,246,0.08)',
            }}>
              <div style={{ fontSize: 12, color: '#71717a', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Time Returned to Business</div>
              <div style={{ fontSize: 48, fontWeight: 800, color: '#3b82f6' }}>{Math.round(calc.timeSaved)} hrs</div>
              <div style={{ fontSize: 12, color: '#52525b', marginTop: 4 }}>per month</div>
            </div>

            {/* Bar Chart */}
            <div style={{
              background: '#111113', border: '1px solid #27272a', borderRadius: 8, padding: 24, flex: 1,
            }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: '#71717a', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 20 }}>
                Cost Comparison
              </h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 32, height: 200, paddingBottom: 32 }}>
                {/* Human Bar */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{
                    width: '100%', height: `${calc.humanBarPct}%`, minHeight: 20,
                    background: 'linear-gradient(180deg, #ef4444, #dc2626)', borderRadius: '4px 4px 0 0',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 8,
                    transition: 'height 0.4s ease',
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{fmt(humanSpend)}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', marginTop: 8 }}>HUMAN</span>
                </div>
                {/* Agent Bar */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{
                    width: '100%', height: `${Math.min(calc.agentBarPct, 100)}%`, minHeight: 20,
                    background: 'linear-gradient(180deg, #22c55e, #16a34a)', borderRadius: '4px 4px 0 0',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 8,
                    transition: 'height 0.4s ease',
                    boxShadow: '0 0 15px rgba(34,197,94,0.3)',
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{fmt(calc.agentCost)}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#22c55e', marginTop: 8 }}>AGENT</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
