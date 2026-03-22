'use client';

import { useState, useMemo, useCallback } from 'react';

// ============ TYPES ============
interface Athlete {
  id: number;
  name: string;
  group: string;
  primaryEvent: string;
  monthsOnTeam: number;
  monthlyRev: number;
  riskScore: number;
  signals: { practiceAttendance: number; meetParticipation: number; parentEngagement: number; pbTrend: number; socialActivity: number };
  timing: { weeksSinceLastPractice: number; weeksSinceLastMeet: number; weeksSinceLastPB: number };
  churnReasons: string[];
}

interface WinbackStep {
  channel: string;
  message: string;
  timing: string;
}

// ============ DATA GENERATION ============
const FIRST_NAMES = ['Emma','Liam','Sophia','Noah','Olivia','Mason','Ava','Ethan','Isabella','Lucas','Mia','Aiden','Charlotte','Logan','Amelia','Jackson','Harper','Sebastian','Ella','Jack','Grace','Owen','Chloe','Henry','Lily','Alexander','Riley','James','Aria','Benjamin','Zoe','Caleb','Nora','Ryan','Addison','Nathan','Hannah','Dylan','Leah','Luke'];
const LAST_NAMES = ['Johnson','Williams','Brown','Davis','Martinez','Garcia','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Thompson','White','Harris','Clark','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Hill','Green','Adams','Baker'];
const GROUPS = ['Senior','Senior','Junior','Junior','Age Group','Age Group','Age Group','Pre-Comp'];
const EVENTS = ['50 Free','100 Free','200 Free','500 Free','100 Back','100 Breast','100 Fly','200 IM'];
const REV_MAP: Record<string, number> = { Senior:175, Junior:150, 'Age Group':125, 'Pre-Comp':100 };

function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

function getChurnReasons(pa: number, mp: number, pe: number, pb: number, wlp: number, wlm: number, wlpb: number): string[] {
  const reasons: string[] = [];
  if (pa < 30) reasons.push('Practice attendance dropped below 30%');
  if (mp < 25) reasons.push('Skipping meets — disengaged from competition');
  if (pe < 30) reasons.push('Parent communication has gone cold');
  if (pb < 20) reasons.push('No personal bests in months — plateau frustration');
  if (wlp >= 4) reasons.push(`${wlp} weeks since last practice — ghost risk`);
  if (wlm >= 8) reasons.push(`${wlm} weeks since last meet — checked out`);
  if (wlpb >= 16) reasons.push('16+ weeks without a PB — motivation crisis');
  if (reasons.length === 0) reasons.push('No critical warning signals detected');
  return reasons;
}

function generateAthletes(n: number): Athlete[] {
  const rng = seededRandom(42);
  const athletes: Athlete[] = [];
  for (let i = 0; i < n; i++) {
    const fn = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
    const ln = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
    const group = GROUPS[Math.floor(rng() * GROUPS.length)];
    const event = EVENTS[Math.floor(rng() * EVENTS.length)];
    const monthsOnTeam = Math.floor(rng() * 36) + 1;
    const pa = Math.floor(rng() * 100);
    const mp = Math.floor(rng() * 100);
    const pe = Math.floor(rng() * 100);
    const pb = Math.floor(rng() * 100);
    const sa = Math.floor(rng() * 100);
    const wlp = Math.floor(rng() * 8);
    const wlm = Math.floor(rng() * 12);
    const wlpb = Math.floor(rng() * 24);

    let risk = 0;
    risk += (100 - pa) * 0.25;
    risk += (100 - mp) * 0.20;
    risk += (100 - pe) * 0.15;
    risk += (100 - pb) * 0.15;
    risk += wlp * 3;
    risk += wlm * 1.5;
    if (monthsOnTeam < 6) risk += 10;
    if (wlpb > 16) risk += 8;
    risk = Math.min(100, Math.max(0, Math.round(risk)));

    athletes.push({
      id: i, name: `${fn} ${ln}`, group, primaryEvent: event, monthsOnTeam,
      monthlyRev: REV_MAP[group] ?? 125, riskScore: risk,
      signals: { practiceAttendance: pa, meetParticipation: mp, parentEngagement: pe, pbTrend: pb, socialActivity: sa },
      timing: { weeksSinceLastPractice: wlp, weeksSinceLastMeet: wlm, weeksSinceLastPB: wlpb },
      churnReasons: getChurnReasons(pa, mp, pe, pb, wlp, wlm, wlpb),
    });
  }
  return athletes.sort((a, b) => b.riskScore - a.riskScore);
}

function generateWinback(a: Athlete): WinbackStep[] {
  const seq: WinbackStep[] = [];
  const name = a.name.split(' ')[0];

  if (a.timing.weeksSinceLastPractice >= 4) {
    seq.push({ channel: 'Coach Text', message: `Hey ${name}, Coach noticed you've been away. We miss having you on deck. Everything okay? No pressure — just checking in.`, timing: 'Day 1 — within 24 hours of risk detection' });
  } else if (a.signals.practiceAttendance < 40) {
    seq.push({ channel: 'Coach Text', message: `${name}, wanted to reach out personally. I've been working on some new sets I think you'd really enjoy. Would love to see you at practice this week.`, timing: 'Day 1 — personal touch' });
  } else {
    seq.push({ channel: 'Coach Email', message: `Hi ${name}, just wanted to let you know about some exciting things coming up on the team. We have a fun meet weekend coming up and I think you'd really shine in the ${a.primaryEvent}.`, timing: 'Day 1 — warm outreach' });
  }

  if (a.signals.parentEngagement < 40) {
    seq.push({ channel: 'Parent Email', message: `Hi [Parent Name], I wanted to personally reach out about ${name}'s journey on the team. Swimming teaches resilience, discipline, and teamwork — and ${name} has shown real growth in the ${a.primaryEvent}. I'd love to schedule a quick 10-minute call to discuss how we can keep ${name} motivated and progressing.`, timing: 'Day 3 — engage the decision-maker' });
  } else {
    seq.push({ channel: 'Parent App Notification', message: `${name}'s progress report is ready! See their ${a.primaryEvent} times, attendance streak, and upcoming meet schedule in the METTLE parent portal.`, timing: 'Day 3 — value reinforcement' });
  }

  if (a.signals.meetParticipation < 30) {
    seq.push({ channel: 'Team Group Chat', message: `Shoutout to the ${a.group} squad — next meet is going to be fire. Who's racing ${a.primaryEvent}? Tag your lane mates!`, timing: 'Day 5 — FOMO + social belonging' });
  } else {
    seq.push({ channel: 'Team Event', message: `Invite ${name} to the upcoming team social/pizza party/movie night. Peer connection reduces churn more than coaching alone.`, timing: 'Day 5 — social anchor' });
  }

  if (a.signals.pbTrend < 30) {
    seq.push({ channel: 'Coach 1-on-1', message: `Schedule a 15-min technique session with ${name} focused on ${a.primaryEvent} turns and underwaters. Show them a concrete path to their next PB. Athletes who see improvement pathways are 3x less likely to quit.`, timing: 'Day 7 — progress catalyst' });
  } else {
    seq.push({ channel: 'App Achievement', message: `Unlock a milestone badge for ${name}: "${a.monthsOnTeam >= 12 ? 'Year-Round Warrior' : 'Rising Competitor'}" — celebrate consistency, not just speed.`, timing: 'Day 7 — gamification hook' });
  }

  if (a.riskScore >= 75) {
    seq.push({ channel: 'Coach Call', message: `Direct phone call from head coach to parent. Topic: "${name}'s future in swimming." Frame it as investment in the athlete's development, not retention. Offer a modified schedule or payment plan if needed.`, timing: 'Day 10 — executive escalation' });
  }

  return seq;
}

// ============ HELPERS ============
function riskLabel(score: number) { return score >= 75 ? 'Critical' : score >= 40 ? 'Warning' : 'Low'; }
function riskColor(score: number) { return score >= 75 ? 'text-red-500' : score >= 40 ? 'text-amber-400' : 'text-green-400'; }
function riskBg(score: number) { return score >= 75 ? 'bg-red-500/15 text-red-400' : score >= 40 ? 'bg-amber-500/15 text-amber-400' : 'bg-green-500/15 text-green-400'; }
function riskBarColor(score: number) { return score >= 75 ? 'bg-red-500' : score >= 40 ? 'bg-amber-400' : 'bg-green-400'; }
function sigClass(val: number) { return val < 30 ? 'text-red-500' : val < 60 ? 'text-amber-400' : 'text-green-400'; }
function borderClass(score: number) { return score >= 75 ? 'border-l-red-500' : score >= 40 ? 'border-l-amber-400' : 'border-l-green-400'; }

// ============ COMPONENT ============
export default function ChurnDetectorPage() {
  const [tab, setTab] = useState<'dashboard' | 'roster' | 'winback' | 'simulate'>('dashboard');
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);
  const [riskFilter, setRiskFilter] = useState('all');
  const [sortBy, setSortBy] = useState('risk');
  const [groupFilter, setGroupFilter] = useState('all');
  const [simTeamSize, setSimTeamSize] = useState(240);
  const [simAvgRev, setSimAvgRev] = useState(125);
  const [simChurnRate, setSimChurnRate] = useState(5);
  const [simWinback, setSimWinback] = useState(30);
  const [simResults, setSimResults] = useState<{ months: { size: number; lost: number; saved: number }[]; noIntervention: number; withIntervention: number; totalSaved: number; totalRevSaved: number } | null>(null);

  const roster = useMemo(() => generateAthletes(240), []);

  const stats = useMemo(() => {
    const critical = roster.filter(a => a.riskScore >= 75).length;
    const warning = roster.filter(a => a.riskScore >= 40 && a.riskScore < 75).length;
    const low = roster.filter(a => a.riskScore < 40).length;
    const avgRisk = Math.round(roster.reduce((s, a) => s + a.riskScore, 0) / roster.length);
    const atRisk = roster.filter(a => a.riskScore >= 60);
    const monthlyAtRisk = atRisk.reduce((s, a) => s + a.monthlyRev * (a.riskScore / 100), 0);
    return { critical, warning, low, avgRisk, total: roster.length, monthlyAtRisk: Math.round(monthlyAtRisk), atRiskCount: atRisk.length };
  }, [roster]);

  const cohorts = useMemo(() => {
    const defs = [
      { label: '0-3 months', filter: (a: Athlete) => a.monthsOnTeam <= 3 },
      { label: '4-6 months', filter: (a: Athlete) => a.monthsOnTeam > 3 && a.monthsOnTeam <= 6 },
      { label: '7-12 months', filter: (a: Athlete) => a.monthsOnTeam > 6 && a.monthsOnTeam <= 12 },
      { label: '1-2 years', filter: (a: Athlete) => a.monthsOnTeam > 12 && a.monthsOnTeam <= 24 },
      { label: '2+ years', filter: (a: Athlete) => a.monthsOnTeam > 24 },
    ];
    return defs.map(c => {
      const members = roster.filter(c.filter);
      const avgRisk = members.length ? Math.round(members.reduce((s, a) => s + a.riskScore, 0) / members.length) : 0;
      return { label: c.label, count: members.length, avgRisk };
    });
  }, [roster]);

  const filteredRoster = useMemo(() => {
    let filtered = [...roster];
    if (riskFilter === 'critical') filtered = filtered.filter(a => a.riskScore >= 75);
    else if (riskFilter === 'warning') filtered = filtered.filter(a => a.riskScore >= 40 && a.riskScore < 75);
    else if (riskFilter === 'low') filtered = filtered.filter(a => a.riskScore < 40);
    if (groupFilter !== 'all') filtered = filtered.filter(a => a.group === groupFilter);
    if (sortBy === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'revenue') filtered.sort((a, b) => b.monthlyRev - a.monthlyRev);
    else filtered.sort((a, b) => b.riskScore - a.riskScore);
    return filtered;
  }, [roster, riskFilter, sortBy, groupFilter]);

  const runSimulation = useCallback(() => {
    const churnRate = simChurnRate / 100;
    const winbackRate = simWinback / 100;
    let currentSize = simTeamSize;
    let totalLost = 0;
    let totalSaved = 0;
    let totalRevSaved = 0;
    const months: { size: number; lost: number; saved: number }[] = [];

    for (let m = 0; m < 12; m++) {
      const churning = Math.round(currentSize * churnRate);
      const saved = Math.round(churning * winbackRate);
      const netLost = churning - saved;
      currentSize -= netLost;
      totalLost += netLost;
      totalSaved += saved;
      totalRevSaved += saved * simAvgRev * 12;
      months.push({ size: currentSize, lost: netLost, saved });
    }

    const noIntervention = simTeamSize - Math.round(simTeamSize * Math.pow(1 - churnRate, 12));
    setSimResults({ months, noIntervention, withIntervention: totalLost, totalSaved, totalRevSaved });
  }, [simTeamSize, simAvgRev, simChurnRate, simWinback]);

  const exportCSV = () => {
    let csv = 'Name,Group,Event,Risk Score,Risk Level,Monthly Rev,Practice %,Meet %,Parent %,PB Trend,Weeks Since Practice,Weeks Since Meet,Top Churn Reason\n';
    roster.forEach(a => {
      csv += `"${a.name}",${a.group},${a.primaryEvent},${a.riskScore},${riskLabel(a.riskScore)},${a.monthlyRev},${a.signals.practiceAttendance},${a.signals.meetParticipation},${a.signals.parentEngagement},${a.signals.pbTrend},${a.timing.weeksSinceLastPractice},${a.timing.weeksSinceLastMeet},"${a.churnReasons[0]}"\n`;
    });
    downloadFile('mettle-churn-report.csv', csv, 'text/csv');
  };

  const exportJSON = () => {
    const leads = roster.filter(a => a.riskScore >= 40).map(a => ({
      athlete_name: a.name, group: a.group, risk_score: a.riskScore, risk_level: riskLabel(a.riskScore),
      monthly_revenue: a.monthlyRev, annual_revenue_at_risk: a.monthlyRev * 12,
      churn_reasons: a.churnReasons,
      winback_sequence: generateWinback(a).map(s => ({ channel: s.channel, message: s.message, timing: s.timing })),
      signals: a.signals, timing: a.timing,
    }));
    downloadFile('mettle-churn-leads.json', JSON.stringify(leads, null, 2), 'application/json');
  };

  function downloadFile(name: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const AthleteCard = ({ a }: { a: Athlete }) => (
    <div onClick={() => setSelectedAthlete(a)} className={`bg-slate-900 border border-slate-700 border-l-4 ${borderClass(a.riskScore)} rounded-xl p-4 cursor-pointer transition-all hover:border-purple-500 hover:-translate-y-0.5`}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-base font-semibold text-white">{a.name}</span>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${riskBg(a.riskScore)}`}>{riskLabel(a.riskScore)} — {a.riskScore}</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full mb-3 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${riskBarColor(a.riskScore)}`} style={{ width: `${a.riskScore}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="text-xs text-slate-500 flex justify-between">Practice <span className={`font-semibold ${sigClass(a.signals.practiceAttendance)}`}>{a.signals.practiceAttendance}%</span></div>
        <div className="text-xs text-slate-500 flex justify-between">Meets <span className={`font-semibold ${sigClass(a.signals.meetParticipation)}`}>{a.signals.meetParticipation}%</span></div>
        <div className="text-xs text-slate-500 flex justify-between">Parent <span className={`font-semibold ${sigClass(a.signals.parentEngagement)}`}>{a.signals.parentEngagement}%</span></div>
        <div className="text-xs text-slate-500 flex justify-between">PB Trend <span className={`font-semibold ${sigClass(a.signals.pbTrend)}`}>{a.signals.pbTrend}%</span></div>
      </div>
      <div className="text-[11px] text-slate-500 mt-2">{a.group} · {a.primaryEvent} · {a.monthsOnTeam}mo · ${a.monthlyRev}/mo</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6">
      <h1 className="text-2xl font-bold text-white"><span className="text-purple-500 font-semibold">METTLE</span> {'// Churn Risk Detector'}</h1>
      <p className="text-slate-500 text-sm mb-6">Identify at-risk athletes before they quit. Generate personalized win-back sequences.</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['dashboard','roster','winback','simulate'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm border transition-all ${tab === t ? 'bg-purple-600 text-white border-purple-600' : 'border-slate-700 text-slate-500 hover:bg-purple-600 hover:text-white hover:border-purple-600'}`}>
            {t === 'winback' ? 'Win-Back Center' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* DASHBOARD */}
      {tab === 'dashboard' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 text-center"><div className="text-3xl font-bold text-red-500">{stats.critical}</div><div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Critical Risk</div></div>
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 text-center"><div className="text-3xl font-bold text-amber-400">{stats.warning}</div><div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Warning</div></div>
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 text-center"><div className="text-3xl font-bold text-green-400">{stats.low}</div><div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Low Risk</div></div>
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 text-center"><div className="text-3xl font-bold text-purple-400">{stats.avgRisk}</div><div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Avg Risk Score</div></div>
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 text-center"><div className="text-3xl font-bold text-white">{stats.total}</div><div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Total Athletes</div></div>
          </div>

          {/* Revenue at Risk */}
          <div className="bg-gradient-to-br from-purple-500/10 to-red-500/10 border border-purple-500 rounded-xl p-5 mb-6">
            <div className="text-sm text-purple-400 font-semibold mb-1">Revenue at Risk (Monthly)</div>
            <div className="text-4xl font-bold text-red-500">${stats.monthlyAtRisk.toLocaleString()}</div>
            <div className="text-sm text-slate-500 mt-1">{stats.atRiskCount} athletes at elevated risk × weighted revenue probability. Annual: ${(stats.monthlyAtRisk * 12).toLocaleString()}</div>
          </div>

          {/* Cohort Chart */}
          <h2 className="text-lg font-semibold text-white mb-4">Churn Cohort Breakdown</h2>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 mb-6">
            {cohorts.map(c => (
              <div key={c.label} className="flex items-center gap-3 mb-2">
                <div className="w-24 text-sm text-slate-500 text-right shrink-0">{c.label}</div>
                <div className="flex-1 h-6 bg-slate-700 rounded-md overflow-hidden relative">
                  <div className={`h-full rounded-md flex items-center pl-2 text-[11px] font-semibold text-white transition-all duration-700 ${riskBarColor(c.avgRisk)}`} style={{ width: `${c.avgRisk}%` }}>{c.count} athletes</div>
                </div>
                <div className={`w-12 text-sm font-semibold text-right ${riskColor(c.avgRisk)}`}>{c.avgRisk}%</div>
              </div>
            ))}
          </div>

          {/* Critical Athletes */}
          <h2 className="text-lg font-semibold text-white mb-4">Critical Risk Athletes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
            {roster.filter(a => a.riskScore >= 75).slice(0, 6).map(a => <AthleteCard key={a.id} a={a} />)}
          </div>
        </>
      )}

      {/* ROSTER */}
      {tab === 'roster' && (
        <>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 mb-6">
            <div className="flex gap-3 flex-wrap items-end">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs text-slate-500 mb-1">Filter by Risk</label>
                <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg text-sm">
                  <option value="all">All</option>
                  <option value="critical">Critical (75-100)</option>
                  <option value="warning">Warning (40-74)</option>
                  <option value="low">Low (0-39)</option>
                </select>
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs text-slate-500 mb-1">Sort By</label>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg text-sm">
                  <option value="risk">Risk Score</option>
                  <option value="name">Name A-Z</option>
                  <option value="revenue">Revenue</option>
                </select>
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs text-slate-500 mb-1">Group</label>
                <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg text-sm">
                  <option value="all">All Groups</option>
                  <option value="Senior">Senior</option>
                  <option value="Junior">Junior</option>
                  <option value="Age Group">Age Group</option>
                  <option value="Pre-Comp">Pre-Comp</option>
                </select>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
            {filteredRoster.map(a => <AthleteCard key={a.id} a={a} />)}
          </div>
          <div className="flex gap-2">
            <button onClick={exportCSV} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm">Export CSV</button>
            <button onClick={exportJSON} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm">Export JSON (CRM)</button>
          </div>
        </>
      )}

      {/* WIN-BACK */}
      {tab === 'winback' && (
        <>
          <h2 className="text-lg font-semibold text-white mb-2">Personalized Win-Back Sequences</h2>
          <p className="text-sm text-slate-500 mb-5">Click any at-risk athlete to generate a multi-touch re-engagement sequence tailored to their churn signals.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {roster.filter(a => a.riskScore >= 40).map(a => <AthleteCard key={a.id} a={a} />)}
          </div>
        </>
      )}

      {/* SIMULATE */}
      {tab === 'simulate' && (
        <>
          <h2 className="text-lg font-semibold text-white mb-4">Churn Scenario Simulator</h2>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 mb-6">
            <div className="flex gap-3 flex-wrap items-end">
              <div className="flex-1 min-w-[180px]"><label className="block text-xs text-slate-500 mb-1">Team Size</label><input type="number" value={simTeamSize} onChange={e => setSimTeamSize(+e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg text-sm" /></div>
              <div className="flex-1 min-w-[180px]"><label className="block text-xs text-slate-500 mb-1">Avg Monthly / Athlete</label><input type="number" value={simAvgRev} onChange={e => setSimAvgRev(+e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg text-sm" /></div>
              <div className="flex-1 min-w-[180px]"><label className="block text-xs text-slate-500 mb-1">Current Churn Rate (%/mo)</label><input type="number" value={simChurnRate} onChange={e => setSimChurnRate(+e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg text-sm" /></div>
              <div className="flex-1 min-w-[180px]"><label className="block text-xs text-slate-500 mb-1">Win-Back Success Rate (%)</label><input type="number" value={simWinback} onChange={e => setSimWinback(+e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg text-sm" /></div>
            </div>
            <button onClick={runSimulation} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm mt-4">Run 12-Month Simulation</button>
          </div>

          {simResults && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4">12-Month Churn Simulation</h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-12 gap-2 mb-6">
                {simResults.months.map((m, i) => (
                  <div key={i} className="bg-slate-950 rounded-lg p-2 text-center">
                    <div className="text-[11px] text-slate-500">Mo {i+1}</div>
                    <div className="text-lg font-bold text-white">{m.size}</div>
                    <div className="text-[11px] text-red-500">-{m.lost}</div>
                    <div className="text-[11px] text-green-400">+{m.saved}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center"><div className="text-3xl font-bold text-red-500">{simResults.noIntervention}</div><div className="text-xs text-slate-500">Lost without METTLE</div></div>
                <div className="text-center"><div className="text-3xl font-bold text-amber-400">{simResults.withIntervention}</div><div className="text-xs text-slate-500">Lost with win-back</div></div>
                <div className="text-center"><div className="text-3xl font-bold text-green-400">{simResults.totalSaved}</div><div className="text-xs text-slate-500">Athletes saved</div></div>
              </div>
              <div className="bg-gradient-to-br from-green-500/10 to-purple-500/10 rounded-xl p-4 text-center">
                <div className="text-sm text-slate-500">Revenue Preserved by Win-Back</div>
                <div className="text-4xl font-bold text-green-400">${simResults.totalRevSaved.toLocaleString()}</div>
                <div className="text-xs text-slate-500">over 12 months at ${simAvgRev}/athlete/month</div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Overlay */}
      {selectedAthlete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setSelectedAthlete(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-[90%] max-h-[85vh] overflow-y-auto p-7" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedAthlete(null)} className="float-right text-slate-500 hover:text-white text-2xl">×</button>
            <h2 className="text-xl font-bold text-white">{selectedAthlete.name}</h2>
            <p className="text-sm text-slate-500 mb-3">{selectedAthlete.group} · {selectedAthlete.primaryEvent} · {selectedAthlete.monthsOnTeam} months on team · ${selectedAthlete.monthlyRev}/mo</p>
            <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${riskBg(selectedAthlete.riskScore)}`}>{riskLabel(selectedAthlete.riskScore)} Risk — {selectedAthlete.riskScore}/100</span>

            {/* Signals */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-3">Engagement Signals</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Practice Attendance', selectedAthlete.signals.practiceAttendance, '%'],
                  ['Meet Participation', selectedAthlete.signals.meetParticipation, '%'],
                  ['Parent Engagement', selectedAthlete.signals.parentEngagement, '%'],
                  ['PB Trend', selectedAthlete.signals.pbTrend, '%'],
                  ['Social Activity', selectedAthlete.signals.socialActivity, '%'],
                  ['Last Practice', selectedAthlete.timing.weeksSinceLastPractice, 'w ago'],
                  ['Last Meet', selectedAthlete.timing.weeksSinceLastMeet, 'w ago'],
                  ['Last PB', selectedAthlete.timing.weeksSinceLastPB, 'w ago'],
                ].map(([label, val, suffix]) => (
                  <div key={label as string} className="text-xs text-slate-500 flex justify-between">
                    {label as string} <span className={`font-semibold ${typeof val === 'number' && suffix === '%' ? sigClass(val) : (typeof val === 'number' && val >= 8 ? 'text-red-500' : typeof val === 'number' && val >= 4 ? 'text-amber-400' : 'text-green-400')}`}>{val}{suffix}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Churn Reasons */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-3">Churn Risk Factors</h3>
              <div className="pl-5 border-l-2 border-slate-700">
                {selectedAthlete.churnReasons.map((r, i) => (
                  <div key={i} className="mb-3 relative">
                    <div className="absolute -left-[25px] top-1 w-2.5 h-2.5 rounded-full border-2 border-purple-500 bg-slate-950" />
                    <div className="text-sm text-slate-200">{r}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Win-Back */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-3">Personalized Win-Back Sequence</h3>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                {generateWinback(selectedAthlete).map((s, i) => (
                  <div key={i} className="flex gap-3 mb-3">
                    <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold shrink-0">{i+1}</div>
                    <div>
                      <div className="text-[11px] text-purple-400 font-semibold uppercase">{s.channel}</div>
                      <div className="text-sm text-slate-200 leading-relaxed">{s.message}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{s.timing}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => {
                const seq = generateWinback(selectedAthlete);
                let text = `WIN-BACK SEQUENCE: ${selectedAthlete.name} (Risk: ${selectedAthlete.riskScore}/100)\n${'='.repeat(50)}\n\n`;
                seq.forEach((s, i) => { text += `Step ${i+1} — ${s.channel}\nTiming: ${s.timing}\nMessage: ${s.message}\n\n`; });
                navigator.clipboard.writeText(text);
              }} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2 rounded-lg text-sm mt-3">Copy Sequence to Clipboard</button>
            </div>

            {/* Revenue Impact */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-3">Revenue Impact</h3>
              <p className="text-sm">Losing {selectedAthlete.name} costs <strong className="text-red-500">${(selectedAthlete.monthlyRev * 12).toLocaleString()}/year</strong>. With a {selectedAthlete.group} replacement cost of ~${(selectedAthlete.monthlyRev * 2).toLocaleString()} in acquisition spend, total impact: <strong className="text-red-500">${(selectedAthlete.monthlyRev * 14).toLocaleString()}</strong>.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
