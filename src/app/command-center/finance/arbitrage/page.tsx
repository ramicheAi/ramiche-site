'use client'

import { useState, useMemo } from 'react'
import { InstrumentPage, Panel } from '@/components/command-center/po/Instrument'

/* ══════════════════════════════════════════════════════════════════════════════
   ARBITRAGE YIELD CALCULATOR — Native React
   Restyled to the Parallax OS cockpit. Logic unchanged.
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
    <InstrumentPage id="arbitrage" title="Arbitrage" section="Business" icon="arbitrage" accent="var(--c-gold)">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        {/* Input Panel */}
        <Panel title="Parameters" icon="spark">
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--t-mid)', marginBottom: 6 }}>Monthly Human/Agency Spend</label>
            <input type="number" value={humanSpend} onChange={e => setHumanSpend(+e.target.value || 0)}
              style={{
                width: '100%', padding: '12px 16px', background: 'var(--ink-1)', border: '1px solid var(--line-2)',
                borderRadius: 'var(--r-sm)', color: 'var(--t-hi)', fontSize: 18, fontWeight: 700, outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--t-mid)', marginBottom: 6 }}>Human Hours Spent (Monthly)</label>
            <input type="number" value={humanHours} onChange={e => setHumanHours(+e.target.value || 0)}
              style={{
                width: '100%', padding: '12px 16px', background: 'var(--ink-1)', border: '1px solid var(--line-2)',
                borderRadius: 'var(--r-sm)', color: 'var(--t-hi)', fontSize: 18, fontWeight: 700, outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--t-mid)', marginBottom: 6 }}>Agent Tier</label>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {TIERS.map((tier, i) => (
                <button key={i} onClick={() => setTierIdx(i)} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px', borderRadius: 'var(--r-sm)', cursor: 'pointer', textAlign: 'left' as const,
                  border: tierIdx === i ? '1px solid color-mix(in srgb, var(--c-green) 40%, transparent)' : '1px solid var(--line-2)',
                  background: tierIdx === i ? 'rgba(34,197,94,0.08)' : 'var(--ink-1)',
                  color: tierIdx === i ? 'var(--c-green)' : 'var(--t-mid)',
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: tierIdx === i ? 'var(--t-hi)' : 'var(--t-mid)' }}>{tier.label}</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>{tier.desc}</div>
                  </div>
                  {tierIdx === i && <span style={{ fontSize: 16 }}>◈</span>}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--t-mid)', marginBottom: 8 }}>
              <span>Agent Speed Multiplier</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-green)' }}>{speedMultiplier}x</span>
            </label>
            <input type="range" min={2} max={50} value={speedMultiplier}
              onChange={e => setSpeedMultiplier(+e.target.value)}
              style={{ width: '100%', accentColor: '#22c55e' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--t-lo)', marginTop: 4 }}>
              <span>2x</span><span>50x</span>
            </div>
          </div>
        </Panel>

        {/* Output Panel */}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 16 }}>
          {/* Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{
              background: 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 24, textAlign: 'center' as const,
            }}>
              <div style={{ fontSize: 12, color: 'var(--t-mid)', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Agent Cost</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--t-hi)' }}>{fmt(calc.agentCost)}</div>
              <div style={{ fontSize: 12, color: 'var(--t-lo)', marginTop: 4 }}>{calc.agentHours.toFixed(1)} hrs work</div>
            </div>
            <div style={{
              background: 'var(--ink-2)', borderRadius: 'var(--r-md)', padding: 24, textAlign: 'center' as const,
              border: `1px solid ${positive ? 'color-mix(in srgb, var(--c-green) 30%, transparent)' : 'color-mix(in srgb, var(--c-red) 30%, transparent)'}`,
              boxShadow: positive ? '0 0 20px rgba(34,197,94,0.1)' : '0 0 20px rgba(239,68,68,0.1)',
            }}>
              <div style={{ fontSize: 12, color: 'var(--t-mid)', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Net Savings</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: positive ? 'var(--c-green)' : 'var(--c-red)' }}>{fmt(calc.savings)}</div>
              <div style={{ fontSize: 12, color: 'var(--t-lo)', marginTop: 4 }}>{calc.savingsPercent}% reduction</div>
            </div>
          </div>

          <div style={{
            background: 'var(--ink-2)', border: '1px solid color-mix(in srgb, var(--c-sky) 25%, transparent)', borderRadius: 'var(--r-md)',
            padding: 24, textAlign: 'center' as const,
            boxShadow: '0 0 20px rgba(59,130,246,0.08)',
          }}>
            <div style={{ fontSize: 12, color: 'var(--t-mid)', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Time Returned to Business</div>
            <div style={{ fontSize: 48, fontWeight: 800, color: '#3b82f6' }}>{Math.round(calc.timeSaved)} hrs</div>
            <div style={{ fontSize: 12, color: 'var(--t-lo)', marginTop: 4 }}>per month</div>
          </div>

          {/* Bar Chart */}
          <div style={{
            background: 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 24, flex: 1,
          }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-mid)', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 20 }}>
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
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-red)', marginTop: 8 }}>HUMAN</span>
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
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-green)', marginTop: 8 }}>AGENT</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </InstrumentPage>
  )
}
