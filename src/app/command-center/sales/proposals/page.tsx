'use client'

import { useState, useMemo } from 'react'
import { InstrumentPage } from '@/components/command-center/po/Instrument'

/* ══════════════════════════════════════════════════════════════════════════════
   METTLE SALES PROPOSAL GENERATOR — Native React
   Restyled to the Parallax OS cockpit. All proposal/lead/ROI logic unchanged.
   ══════════════════════════════════════════════════════════════════════════════ */

const TIERS = {
  team: {
    name: 'Team', price: 149, athletes: 50,
    features: ['Gamified level system (15 levels)', 'Attendance & check-in', 'Basic parent portal', 'Meet results tracking', 'Team leaderboard'],
  },
  program: {
    name: 'Program', price: 349, athletes: 200,
    features: ['Everything in Team', 'Advanced analytics & splits', 'Seed time optimizer', 'Heat/lane assignments', 'Custom challenges & badges', 'Parent messaging portal', 'Hy-Tek integration'],
  },
  elite: {
    name: 'Elite', price: 549, athletes: 500,
    features: ['Everything in Program', 'Relay lineup optimizer', 'Multi-site management', 'Custom branding & white-label', 'API access & data export', 'Priority support (< 2hr)', 'Dedicated onboarding specialist'],
  },
}

const TEAM_TYPES: Record<string, string> = {
  club: 'Club/USS', 'high-school': 'High School', college: 'College/University', masters: 'Masters', rec: 'Recreation/YMCA',
}

export default function SalesProposalsPage() {
  const [teamName, setTeamName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactTitle, setContactTitle] = useState('Head Coach')
  const [athleteCount, setAthleteCount] = useState(120)
  const [teamType, setTeamType] = useState('club')
  const [currentSpend, setCurrentSpend] = useState(200)
  const [churnRate, setChurnRate] = useState(25)
  const [painPoints, setPainPoints] = useState('')
  const [recTier, setRecTier] = useState<'team' | 'program' | 'elite'>('program')
  const [discount, setDiscount] = useState(0)
  const [customNote, setCustomNote] = useState('')
  const [generated, setGenerated] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const tier = TIERS[recTier]
  const discountedPrice = Math.round(tier.price * (1 - discount / 100))

  const roi = useMemo(() => {
    const retentionImprovement = 0.20
    const savedAthletes = Math.round(athleteCount * (churnRate / 100) * retentionImprovement)
    const avgAthleteRevenue = 150
    const retentionRevenue = savedAthletes * avgAthleteRevenue * 12
    const timeSavedHours = Math.round(athleteCount * 0.15)
    const coachHourlyRate = 35
    const timeSavings = timeSavedHours * coachHourlyRate * 12
    const annualCost = discountedPrice * 12
    const totalValue = retentionRevenue + timeSavings
    const roiPct = annualCost > 0 ? Math.round(((totalValue - annualCost) / annualCost) * 100) : 0
    return { annualCost, savedAthletes, retentionRevenue, timeSavedHours, timeSavings, totalValue, roi: roiPct }
  }, [athleteCount, churnRate, discountedPrice])

  const leadData = useMemo(() => {
    const today = new Date()
    const validUntil = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    return {
      captured: today.toISOString(),
      team: teamName || 'Your Swim Team',
      contact: { name: contactName, email: contactEmail, title: contactTitle },
      teamType: TEAM_TYPES[teamType],
      athleteCount, currentSpend, churnRate,
      painPoints: painPoints.split(/[,\n]/).filter(p => p.trim()),
      recommendedTier: tier.name,
      monthlyPrice: discountedPrice,
      discount: discount + '%',
      projectedROI: roi.roi + '%',
      projectedRetainedAthletes: roi.savedAthletes,
      annualValue: roi.totalValue,
      proposalValidUntil: validUntil.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      source: 'METTLE Sales Proposal Generator',
      status: 'proposal_sent',
    }
  }, [teamName, contactName, contactEmail, contactTitle, athleteCount, teamType, currentSpend, churnRate, painPoints, tier.name, discountedPrice, discount, roi])

  const copyLeadJson = () => {
    navigator.clipboard.writeText(JSON.stringify(leadData, null, 2))
  }

  const saveToPipeline = async () => {
    if (!teamName && !contactEmail) { setSaveState('error'); return }
    setSaveState('saving')
    try {
      const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      const res = await fetch('/api/command-center/pipeline/proposals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product: 'METTLE',
          tier: tier.name,
          monthly_price: discountedPrice,
          discount_pct: discount,
          projected_roi_pct: roi.roi,
          annual_value: roi.totalValue,
          valid_until: validUntil,
          status: 'sent',
          // lead fields (endpoint creates + links the lead, advances stage to 'proposal')
          contact_name: contactName,
          company: teamName,
          contact_email: contactEmail,
          contact_title: contactTitle,
          source: 'proposal-generator',
          owner: 'mercury',
          meta: {
            athleteCount, teamType: TEAM_TYPES[teamType], currentSpend, churnRate,
            painPoints: painPoints.split(/[,\n]/).map(p => p.trim()).filter(Boolean),
          },
          terms: leadData,
        }),
      })
      setSaveState(res.ok ? 'saved' : 'error')
    } catch {
      setSaveState('error')
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', background: 'var(--ink-1)', border: '1px solid var(--line-2)',
    borderRadius: 6, color: 'var(--t-hi)', fontSize: 14, outline: 'none',
  }

  const labelStyle = { display: 'block' as const, fontSize: 12, color: 'var(--t-mid)', marginBottom: 6, marginTop: 14 }

  return (
    <InstrumentPage id="proposals" title="METTLE Proposal" section="Business" icon="proposals" accent="var(--c-amber)">
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          {/* Left — Input */}
          <div>
            {/* Team Info */}
            <div style={{ background: 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: 8, padding: 24, marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-amber)', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>
                Team Information
              </h3>
              <label style={labelStyle}>Team / Club Name</label>
              <input type="text" value={teamName} onChange={e => setTeamName(e.target.value)}
                placeholder="Saint Andrew's Aquatics" style={inputStyle} />

              <label style={labelStyle}>Contact Name</label>
              <input type="text" value={contactName} onChange={e => setContactName(e.target.value)}
                placeholder="Coach Sarah Williams" style={inputStyle} />

              <label style={labelStyle}>Contact Email</label>
              <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                placeholder="coach@swimteam.com" style={inputStyle} />

              <label style={labelStyle}>Contact Title</label>
              <input type="text" value={contactTitle} onChange={e => setContactTitle(e.target.value)}
                style={inputStyle} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Number of Athletes</label>
                  <input type="number" value={athleteCount} onChange={e => setAthleteCount(+e.target.value || 0)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Team Type</label>
                  <select value={teamType} onChange={e => setTeamType(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}>
                    {Object.entries(TEAM_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Current Monthly Software Spend</label>
                  <input type="number" value={currentSpend} onChange={e => setCurrentSpend(+e.target.value || 0)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Annual Athlete Churn (%)</label>
                  <input type="number" value={churnRate} min={0} max={100} onChange={e => setChurnRate(+e.target.value || 0)} style={inputStyle} />
                </div>
              </div>

              <label style={labelStyle}>Key Pain Points</label>
              <textarea value={painPoints} onChange={e => setPainPoints(e.target.value)}
                placeholder="Manual attendance tracking, no gamification, parents complain about lack of updates..."
                style={{ ...inputStyle, minHeight: 60, resize: 'vertical' as const }} />
            </div>

            {/* Proposal Settings */}
            <div style={{ background: 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: 8, padding: 24, marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-amber)', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>
                Proposal Settings
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Recommended Tier</label>
                  <select value={recTier} onChange={e => setRecTier(e.target.value as 'team' | 'program' | 'elite')}
                    style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="team">Team — $149/mo</option>
                    <option value="program">Program — $349/mo</option>
                    <option value="elite">Elite — $549/mo</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Discount (%)</label>
                  <input type="number" value={discount} min={0} max={30} onChange={e => setDiscount(+e.target.value || 0)} style={inputStyle} />
                </div>
              </div>
              <label style={labelStyle}>Custom Note</label>
              <textarea value={customNote} onChange={e => setCustomNote(e.target.value)}
                placeholder="We'd love to help your athletes reach the next level..."
                style={{ ...inputStyle, minHeight: 60, resize: 'vertical' as const }} />

              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button onClick={() => setGenerated(true)} style={{
                  flex: 1, padding: '12px 0', fontSize: 14, fontWeight: 700, borderRadius: 6, border: 'none',
                  cursor: 'pointer', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff',
                }}>Generate Proposal</button>
                <button onClick={copyLeadJson} style={{
                  padding: '12px 20px', fontSize: 14, fontWeight: 700, borderRadius: 6, cursor: 'pointer',
                  background: 'rgba(201,168,76,0.12)', color: '#C9A84C', border: '1px solid #C9A84C40',
                }}>Copy Lead JSON</button>
              </div>
              <button onClick={saveToPipeline} disabled={saveState === 'saving' || saveState === 'saved'} style={{
                width: '100%', marginTop: 12, padding: '12px 0', fontSize: 14, fontWeight: 700, borderRadius: 6,
                cursor: saveState === 'saving' || saveState === 'saved' ? 'default' : 'pointer',
                border: '1px solid #22c55e55',
                background: saveState === 'saved' ? 'rgba(34,197,94,0.15)' : saveState === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.10)',
                color: saveState === 'error' ? '#ef4444' : '#22c55e',
              }}>
                {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ Saved to Pipeline' : saveState === 'error' ? 'Save failed — retry' : 'Save to Pipeline'}
              </button>
            </div>

            {/* Lead JSON */}
            <div style={{ background: 'var(--ink-2)', border: '1px solid color-mix(in srgb, var(--c-amber) 19%, transparent)', borderRadius: 8, padding: 16 }}>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-amber)', marginBottom: 8 }}>Lead Capture Data (CRM-Ready)</h4>
              <pre className="mono" style={{
                background: 'var(--ink-1)', borderRadius: 6, padding: 12, fontSize: 11, color: 'var(--t-mid)',
                overflow: 'auto', maxHeight: 200, whiteSpace: 'pre-wrap' as const,
              }}>
                {generated ? JSON.stringify(leadData, null, 2) : 'Fill in team info and generate a proposal to see lead data here.'}
              </pre>
            </div>
          </div>

          {/* Right — Proposal Preview */}
          <div style={{ background: 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
            {!generated ? (
              <div style={{ padding: '80px 40px', textAlign: 'center' as const, color: 'var(--t-lo)' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>&#9744;</div>
                <p style={{ fontSize: 15, fontWeight: 600 }}>Fill in team details and click Generate Proposal</p>
                <p style={{ fontSize: 13, marginTop: 8 }}>The proposal will appear here</p>
              </div>
            ) : (
              <div>
                {/* Hero */}
                <div style={{
                  background: 'linear-gradient(135deg, #6B21A8, #2563EB)', padding: '40px 36px', color: '#fff',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <span style={{
                      width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(255,255,255,0.15)', fontSize: 16, fontWeight: 900,
                    }}>M</span>
                    <h2 style={{ fontSize: 22, fontWeight: 700 }}>METTLE for {teamName || 'Your Swim Team'}</h2>
                  </div>
                  <p style={{ fontSize: 14, opacity: 0.9 }}>The Gamified Athlete Development Platform</p>
                  <p style={{ fontSize: 12, opacity: 0.6, marginTop: 12 }}>
                    Prepared for {contactName || 'Coach'}, {contactTitle} · {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>

                {/* Pain Points */}
                {painPoints.trim() && (
                  <div style={{ padding: '24px 36px', borderBottom: '1px solid #27272a' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#a78bfa', marginBottom: 12 }}>We Heard You</h3>
                    <ul style={{ paddingLeft: 20, color: '#a1a1aa', fontSize: 13, lineHeight: 1.8 }}>
                      {painPoints.split(/[,\n]/).filter(p => p.trim()).map((p, i) => <li key={i}>{p.trim()}</li>)}
                    </ul>
                  </div>
                )}

                {/* Stats */}
                <div style={{ padding: '24px 36px', borderBottom: '1px solid #27272a' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#a78bfa', marginBottom: 16 }}>Your Team at a Glance</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    {[
                      { num: athleteCount.toString(), label: 'Athletes' },
                      { num: churnRate + '%', label: 'Annual Churn' },
                      { num: '$' + currentSpend, label: 'Current Spend/mo' },
                    ].map((s, i) => (
                      <div key={i} style={{
                        background: '#09090b', borderRadius: 8, padding: 16, textAlign: 'center' as const,
                        border: '1px solid #27272a',
                      }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: '#a78bfa' }}>{s.num}</div>
                        <div style={{ fontSize: 11, color: '#71717a', marginTop: 4 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pricing Tiers */}
                <div style={{ padding: '24px 36px', borderBottom: '1px solid #27272a' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#a78bfa', marginBottom: 16 }}>Investment & Pricing</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    {(Object.entries(TIERS) as [string, typeof TIERS['team']][]).map(([key, t]) => {
                      const isRec = key === recTier
                      const price = isRec ? discountedPrice : t.price
                      return (
                        <div key={key} style={{
                          borderRadius: 8, padding: 16, textAlign: 'center' as const, position: 'relative' as const,
                          border: isRec ? '1px solid #7c3aed' : '1px solid #27272a',
                          background: isRec ? 'rgba(124,58,237,0.08)' : '#09090b',
                        }}>
                          {isRec && (
                            <span style={{
                              position: 'absolute' as const, top: -10, left: '50%', transform: 'translateX(-50%)',
                              background: '#7c3aed', color: '#fff', fontSize: 9, fontWeight: 700,
                              padding: '2px 10px', borderRadius: 10, letterSpacing: 1,
                            }}>RECOMMENDED</span>
                          )}
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#a1a1aa' }}>{t.name}</div>
                          <div style={{ fontSize: 28, fontWeight: 800, color: isRec ? '#a78bfa' : '#e4e4e7', margin: '8px 0' }}>
                            ${price}<span style={{ fontSize: 13, color: '#71717a' }}>/mo</span>
                          </div>
                          {isRec && discount > 0 && (
                            <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>{discount}% launch discount</div>
                          )}
                          <div style={{ fontSize: 11, color: '#52525b' }}>Up to {t.athletes} athletes</div>
                          <ul style={{ textAlign: 'left' as const, marginTop: 12, paddingLeft: 0, listStyle: 'none' }}>
                            {t.features.map((f, i) => (
                              <li key={i} style={{ fontSize: 12, color: '#a1a1aa', padding: '3px 0' }}>
                                <span style={{ color: '#22c55e', marginRight: 6 }}>&#10003;</span>{f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ROI */}
                <div style={{ padding: '24px 36px', borderBottom: '1px solid #27272a' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#a78bfa', marginBottom: 16 }}>Your ROI Projection</h3>
                  <p style={{ fontSize: 13, color: '#71717a', marginBottom: 16 }}>
                    Based on {athleteCount} athletes, {churnRate}% churn, and {tier.name} tier at ${discountedPrice}/mo:
                  </p>
                  {/* ROI Bars */}
                  {[
                    { label: 'Annual METTLE Investment', value: roi.annualCost, pct: Math.min(100, Math.round((roi.annualCost / Math.max(roi.totalValue, 1)) * 100)), color: '#ef4444' },
                    { label: 'Projected Value Generated', value: roi.totalValue, pct: 100, color: '#22c55e' },
                  ].map((bar, i) => (
                    <div key={i} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#71717a', marginBottom: 4 }}>
                        <span>{bar.label}</span><span>${bar.value.toLocaleString()}</span>
                      </div>
                      <div style={{ background: '#27272a', borderRadius: 6, height: 28, overflow: 'hidden' }}>
                        <div style={{
                          width: `${bar.pct}%`, height: '100%', borderRadius: 6,
                          background: bar.color, display: 'flex', alignItems: 'center', paddingLeft: 10,
                          fontSize: 12, fontWeight: 600, color: '#fff', transition: 'width 0.5s ease',
                        }}>${bar.value.toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
                    {[
                      { num: roi.roi + '%', label: 'Projected ROI', color: '#22c55e' },
                      { num: roi.savedAthletes.toString(), label: 'Athletes Retained', color: '#22c55e' },
                      { num: roi.timeSavedHours + 'h', label: 'Monthly Time Saved', color: '#22c55e' },
                    ].map((s, i) => (
                      <div key={i} style={{
                        background: '#09090b', borderRadius: 8, padding: 16, textAlign: 'center' as const,
                        border: '1px solid #27272a',
                      }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.num}</div>
                        <div style={{ fontSize: 11, color: '#71717a', marginTop: 4 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom Note */}
                {customNote.trim() && (
                  <div style={{ padding: '24px 36px', borderBottom: '1px solid #27272a', background: 'rgba(124,58,237,0.04)' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#a78bfa', marginBottom: 8 }}>A Note from Us</h3>
                    <p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.7 }}>{customNote}</p>
                  </div>
                )}

                {/* CTA */}
                <div style={{
                  background: 'linear-gradient(135deg, #6B21A8, #7C3AED)', padding: '32px 36px',
                  textAlign: 'center' as const, color: '#fff',
                }}>
                  <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Ready to Transform {teamName || 'Your Team'}?</h3>
                  <p style={{ fontSize: 13, opacity: 0.9, marginBottom: 16 }}>Join 240+ athletes already using METTLE to level up.</p>
                  <a href={`mailto:ramichehq@gmail.com?subject=METTLE Demo Request — ${encodeURIComponent(teamName || 'Swim Team')}`}
                    style={{
                      display: 'inline-block', background: '#F59E0B', color: '#000', padding: '12px 28px',
                      borderRadius: 8, fontWeight: 700, fontSize: 15, textDecoration: 'none',
                    }}>Schedule Your Demo &rarr;</a>
                </div>

                <div style={{ padding: '12px 0', textAlign: 'center' as const, fontSize: 11, color: '#52525b' }}>
                  METTLE by Parallax · Confidential
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </InstrumentPage>
  )
}
