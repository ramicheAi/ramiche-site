'use client';

import React, { useState, useMemo, useCallback } from 'react';

// ============ TYPES ============
interface PracticeSet {
  id: number;
  category: string;
  reps: number;
  distance: number;
  stroke: string;
  intensity: string;
  interval: number;
  notes: string;
  totalYards: number;
  estSeconds: number;
}

// ============ CONSTANTS ============
const PACE_DATA: Record<string, Record<string, number>> = {
  novice:      { free:95, back:110, breast:115, fly:105, im:110, kick:140, drill:120, choice:100 },
  'age-group': { free:75, back:85,  breast:90,  fly:82,  im:85,  kick:110, drill:95,  choice:80  },
  senior:      { free:60, back:68,  breast:72,  fly:65,  im:68,  kick:90,  drill:75,  choice:65  },
  elite:       { free:50, back:56,  breast:60,  fly:54,  im:56,  kick:75,  drill:62,  choice:54  },
};

const INTENSITY_MULT: Record<string, number> = { easy:1.15, moderate:1.0, threshold:0.92, race:0.85, max:0.80 };
const INTENSITY_PCT: Record<string, string> = { easy:'60%', moderate:'75%', threshold:'85%', race:'95%', max:'100%' };
const STROKE_LABELS: Record<string, string> = { free:'Freestyle', back:'Backstroke', breast:'Breaststroke', fly:'Butterfly', im:'IM', kick:'Kick', drill:'Drill', choice:'Choice' };
const CAT_LABELS: Record<string, string> = { 'main':'Main Set', 'warm-up':'Warm-Up', 'pre-set':'Pre-Set', kick:'Kick Set', drill:'Drill Set', sprint:'Sprint Set', 'cool-down':'Cool-Down' };
const CATEGORIES = ['main','warm-up','pre-set','kick','drill','sprint','cool-down'];
const DISTANCES = [25,50,75,100,150,200,250,300,400,500];

const TEMPLATES: Record<string, Omit<PracticeSet, 'id' | 'totalYards' | 'estSeconds'>[]> = {
  warmup: [
    { category:'warm-up', reps:1, distance:200, stroke:'free', intensity:'easy', interval:180, notes:'Steady, focus on streamline' },
    { category:'warm-up', reps:4, distance:50, stroke:'drill', intensity:'easy', interval:70, notes:'25 drill / 25 swim' },
    { category:'warm-up', reps:4, distance:50, stroke:'kick', intensity:'moderate', interval:80, notes:'Board kick, build each 50' },
  ],
  sprint: [{ category:'sprint', reps:10, distance:50, stroke:'free', intensity:'race', interval:60, notes:'All-out, focus on turns' }],
  distance: [{ category:'main', reps:5, distance:200, stroke:'free', intensity:'threshold', interval:170, notes:'Descend 1-5, negative split each' }],
  im: [{ category:'main', reps:8, distance:100, stroke:'im', intensity:'moderate', interval:110, notes:'Focus on transitions' }],
  kick: [{ category:'kick', reps:6, distance:100, stroke:'kick', intensity:'moderate', interval:120, notes:'Odds streamline, evens with board' }],
  cooldown: [
    { category:'cool-down', reps:1, distance:200, stroke:'free', intensity:'easy', interval:240, notes:'Easy swim, stretch between laps' },
    { category:'cool-down', reps:4, distance:50, stroke:'choice', intensity:'easy', interval:70, notes:'Mix strokes, shake out' },
  ],
  full: [
    { category:'warm-up', reps:1, distance:400, stroke:'free', intensity:'easy', interval:360, notes:'Easy swim' },
    { category:'warm-up', reps:4, distance:50, stroke:'drill', intensity:'easy', interval:70, notes:'25 drill / 25 swim' },
    { category:'kick', reps:6, distance:50, stroke:'kick', intensity:'moderate', interval:70, notes:'Board kick, build' },
    { category:'pre-set', reps:4, distance:100, stroke:'free', intensity:'moderate', interval:100, notes:'Build to threshold pace' },
    { category:'main', reps:3, distance:200, stroke:'free', intensity:'threshold', interval:170, notes:'Descend 1-3' },
    { category:'main', reps:6, distance:100, stroke:'im', intensity:'threshold', interval:110, notes:'Strong fly, fast turns' },
    { category:'sprint', reps:8, distance:50, stroke:'free', intensity:'race', interval:60, notes:'Max effort, dive starts' },
    { category:'cool-down', reps:1, distance:200, stroke:'choice', intensity:'easy', interval:240, notes:'Easy, stretch' },
  ],
};

// ============ HELPERS ============
function fmtTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function fmtInterval(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

const strokeColor: Record<string, string> = {
  free: 'bg-blue-500/10 text-blue-400',
  back: 'bg-green-500/10 text-green-400',
  breast: 'bg-amber-500/10 text-amber-400',
  fly: 'bg-red-500/10 text-red-400',
  im: 'bg-purple-500/10 text-purple-400',
  kick: 'bg-cyan-500/10 text-cyan-400',
  drill: 'bg-violet-500/10 text-violet-400',
  choice: 'bg-slate-500/10 text-slate-400',
};

// ============ COMPONENT ============
export default function PracticeBuilderPage() {
  const [sets, setSets] = useState<PracticeSet[]>([]);
  const [selectedCat, setSelectedCat] = useState('main');
  const [reps, setReps] = useState(4);
  const [distance, setDistance] = useState(50);
  const [stroke, setStroke] = useState('free');
  const [intensity, setIntensity] = useState('moderate');
  const [interval, setInterval] = useState(90);
  const [notes, setNotes] = useState('');
  const [skillLevel, setSkillLevel] = useState('age-group');
  const [showExport, setShowExport] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [touchIdx, setTouchIdx] = useState<number | null>(null);
  const touchY = React.useRef<number>(0);

  const addSet = useCallback((overrides?: Partial<Omit<PracticeSet, 'id' | 'totalYards' | 'estSeconds'>>) => {
    const s = {
      category: overrides?.category ?? selectedCat,
      reps: overrides?.reps ?? reps,
      distance: overrides?.distance ?? distance,
      stroke: overrides?.stroke ?? stroke,
      intensity: overrides?.intensity ?? intensity,
      interval: overrides?.interval ?? interval,
      notes: overrides?.notes ?? notes,
    };
    const totalYards = s.reps * s.distance;
    const basePer100 = PACE_DATA[skillLevel]?.[s.stroke] ?? 75;
    const adjPer100 = basePer100 * (INTENSITY_MULT[s.intensity] ?? 1);
    const estSeconds = Math.round((s.distance / 100) * adjPer100 * s.reps + (s.reps - 1) * 10);

    setSets(prev => [...prev, { ...s, id: Date.now() + Math.random(), totalYards, estSeconds }]);
  }, [selectedCat, reps, distance, stroke, intensity, interval, notes, skillLevel]);

  const removeSet = (id: number) => setSets(prev => prev.filter(s => s.id !== id));

  const moveSet = (from: number, to: number) => {
    if (to < 0 || to >= sets.length) return;
    setSets(prev => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const loadTemplate = (name: string) => {
    const t = TEMPLATES[name];
    if (!t) return;
    t.forEach(s => addSet(s));
  };

  const summary = useMemo(() => {
    const totalYards = sets.reduce((a, s) => a + s.totalYards, 0);
    const totalSec = sets.reduce((a, s) => a + s.estSeconds, 0);
    const intMap: Record<string, number> = { easy:60, moderate:75, threshold:85, race:95, max:100 };
    const avgInt = sets.length ? Math.round(sets.reduce((a, s) => a + (intMap[s.intensity] ?? 75), 0) / sets.length) : 0;
    const strokeCounts: Record<string, number> = {};
    sets.forEach(s => { strokeCounts[s.stroke] = (strokeCounts[s.stroke] ?? 0) + s.totalYards; });
    const primary = Object.entries(strokeCounts).sort((a, b) => b[1] - a[1])[0];
    return { totalYards, totalSec, avgInt, primaryStroke: primary ? STROKE_LABELS[primary[0]] : '—' };
  }, [sets]);

  const exportText = useMemo(() => {
    if (sets.length === 0) return '';
    const date = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    let text = `═══════════════════════════════════════\n  METTLE // PRACTICE CARD\n  ${date}\n  Total: ${summary.totalYards.toLocaleString()} yards | Est: ${fmtTime(summary.totalSec)}\n═══════════════════════════════════════\n\n`;
    let currentCat = '';
    sets.forEach((s, i) => {
      if (s.category !== currentCat) {
        currentCat = s.category;
        text += `── ${(CAT_LABELS[currentCat] ?? currentCat).toUpperCase()} ──\n`;
      }
      text += `${i+1}. ${s.reps}×${s.distance} ${STROKE_LABELS[s.stroke]} @ ${fmtInterval(s.interval)}/100 [${INTENSITY_PCT[s.intensity]}] (${s.totalYards}yds, ~${fmtTime(s.estSeconds)})`;
      if (s.notes) text += `\n   → ${s.notes}`;
      text += '\n';
    });
    text += `\n═══════════════════════════════════════\n  Generated by METTLE Practice Builder\n═══════════════════════════════════════\n`;
    return text;
  }, [sets, summary]);

  const paces = PACE_DATA[skillLevel] ?? {};

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6">
      <header className="text-center pb-6 border-b-2 border-purple-500">
        <h1 className="text-2xl font-bold tracking-widest uppercase text-purple-400">METTLE <span className="text-amber-400">{'//'}&#8203;</span> Practice Builder</h1>
        <p className="text-slate-500 text-sm mt-2">Structured practice design for competitive swim coaches <span className="bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded ml-2">BETA</span></p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 mt-6">
        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {/* New Set Panel */}
          <div className="bg-slate-900 border-2 border-slate-700 rounded-lg p-4">
            <h3 className="text-amber-400 text-xs uppercase tracking-widest font-bold mb-3 flex items-center gap-2"><span className="w-2 h-2 bg-amber-400 rounded-full" />New Set</h3>

            <label className="block text-slate-500 text-[11px] uppercase tracking-wider mb-1">Category</label>
            <div className="flex gap-1 flex-wrap mb-3">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setSelectedCat(c)} className={`px-3 py-1.5 text-[11px] uppercase tracking-wider border rounded ${selectedCat === c ? 'border-purple-500 text-purple-400 bg-purple-500/10' : 'border-slate-700 text-slate-500'}`}>{c}</button>
              ))}
            </div>

            <label className="block text-slate-500 text-[11px] uppercase tracking-wider mb-1">Reps × Distance</label>
            <div className="grid grid-cols-[60px_10px_1fr] gap-1 items-center mb-3">
              <input type="number" value={reps} onChange={e => setReps(Math.max(1, +e.target.value))} className="bg-slate-800 border border-slate-700 text-slate-200 px-2 py-1.5 rounded text-sm" />
              <span className="text-center text-slate-500">×</span>
              <select value={distance} onChange={e => setDistance(+e.target.value)} className="bg-slate-800 border border-slate-700 text-slate-200 px-2 py-1.5 rounded text-sm">
                {DISTANCES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <label className="block text-slate-500 text-[11px] uppercase tracking-wider mb-1">Stroke</label>
            <select value={stroke} onChange={e => setStroke(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-slate-200 px-2 py-1.5 rounded text-sm mb-3">
              {Object.entries(STROKE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>

            <label className="block text-slate-500 text-[11px] uppercase tracking-wider mb-1">Intensity</label>
            <select value={intensity} onChange={e => setIntensity(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-slate-200 px-2 py-1.5 rounded text-sm mb-3">
              <option value="easy">Easy (60%)</option>
              <option value="moderate">Moderate (75%)</option>
              <option value="threshold">Threshold (85%)</option>
              <option value="race">Race Pace (95%)</option>
              <option value="max">Max Effort (100%)</option>
            </select>

            <label className="block text-slate-500 text-[11px] uppercase tracking-wider mb-1">Interval (sec/100)</label>
            <input type="number" value={interval} onChange={e => setInterval(+e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-slate-200 px-2 py-1.5 rounded text-sm mb-3" />

            <label className="block text-slate-500 text-[11px] uppercase tracking-wider mb-1">Notes</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g., descend 1-4" className="w-full bg-slate-800 border border-slate-700 text-slate-200 px-2 py-1.5 rounded text-sm mb-4" />

            <button onClick={() => addSet()} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs uppercase tracking-wider py-2.5 rounded-md border-2 border-purple-600 transition-all">+ Add Set</button>
          </div>

          {/* Pace Reference */}
          <div className="bg-slate-900 border-2 border-slate-700 rounded-lg p-4">
            <h3 className="text-amber-400 text-xs uppercase tracking-widest font-bold mb-3 flex items-center gap-2"><span className="w-2 h-2 bg-amber-400 rounded-full" />Pace Reference</h3>
            <select value={skillLevel} onChange={e => setSkillLevel(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-slate-200 px-2 py-1.5 rounded text-sm mb-3">
              <option value="novice">Novice (10 &amp; Under)</option>
              <option value="age-group">Age Group (11-14)</option>
              <option value="senior">Senior (15-18)</option>
              <option value="elite">Elite / College</option>
            </select>
            <div className="grid grid-cols-3 gap-1.5">
              {Object.entries(paces).map(([s, sec]) => (
                <button key={s} onClick={() => { setStroke(s); setInterval(Math.ceil(sec / 5) * 5); }} className="bg-slate-800 border border-slate-700 rounded p-1.5 text-center hover:border-amber-400 hover:text-amber-400 transition-all">
                  <div className="text-[9px] text-slate-500 uppercase">{STROKE_LABELS[s]}</div>
                  <div className="text-sm font-bold text-slate-200">{fmtInterval(sec)}/100</div>
                </button>
              ))}
            </div>
          </div>

          {/* Templates */}
          <div className="bg-slate-900 border-2 border-slate-700 rounded-lg p-4">
            <h3 className="text-amber-400 text-xs uppercase tracking-widest font-bold mb-3 flex items-center gap-2"><span className="w-2 h-2 bg-amber-400 rounded-full" />Quick Templates</h3>
            <div className="flex flex-col gap-1.5">
              {[['warmup','Standard Warm-Up (800)'],['sprint','Sprint Set (10×50)'],['distance','Distance Set (5×200)'],['im','IM Set (8×100 IM)'],['kick','Kick Set (6×100)'],['cooldown','Cool-Down (400)'],['full','Full Practice (4000)']].map(([k, label]) => (
                <button key={k} onClick={() => loadTemplate(k)} className="border-2 border-amber-400 text-amber-400 hover:bg-amber-400 hover:text-slate-950 text-xs uppercase tracking-wider font-bold py-2 px-3 rounded-md transition-all">{label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="flex flex-col gap-4">
          {/* Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-slate-900 border-2 border-purple-500 rounded-lg">
            <div className="text-center"><div className="text-2xl font-bold text-white">{summary.totalYards.toLocaleString()}</div><div className="text-[10px] text-slate-500 uppercase tracking-wider">Total Yards</div></div>
            <div className="text-center"><div className="text-2xl font-bold text-white">{sets.length}</div><div className="text-[10px] text-slate-500 uppercase tracking-wider">Sets</div></div>
            <div className="text-center"><div className="text-2xl font-bold text-white">{fmtTime(summary.totalSec)}</div><div className="text-[10px] text-slate-500 uppercase tracking-wider">Est. Time</div></div>
            <div className="text-center"><div className="text-2xl font-bold text-white">{sets.length ? summary.avgInt + '%' : '—'}</div><div className="text-[10px] text-slate-500 uppercase tracking-wider">Avg Intensity</div></div>
            <div className="text-center"><div className="text-2xl font-bold text-white">{summary.primaryStroke}</div><div className="text-[10px] text-slate-500 uppercase tracking-wider">Primary Stroke</div></div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <button onClick={() => { if (sets.length) setShowExport(true); }} className="border-2 border-amber-400 text-amber-400 hover:bg-amber-400 hover:text-slate-950 text-xs uppercase tracking-wider font-bold py-1.5 px-3 rounded-md transition-all">Export Text</button>
            <button onClick={() => window.print()} className="border-2 border-amber-400 text-amber-400 hover:bg-amber-400 hover:text-slate-950 text-xs uppercase tracking-wider font-bold py-1.5 px-3 rounded-md transition-all">Print Card</button>
            <button onClick={() => { if (sets.length && confirm('Clear all sets?')) setSets([]); }} className="border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white text-xs uppercase tracking-wider font-bold py-1.5 px-3 rounded-md transition-all">Clear All</button>
          </div>

          {/* Set List */}
          {sets.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-700 rounded-lg">
              <h3 className="text-slate-300 font-bold mb-2">No sets yet</h3>
              <p className="text-slate-500 text-sm">Add sets from the sidebar or load a template to get started.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sets.map((s, i) => (
                <div key={s.id}
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => { if (dragIdx !== null && dragIdx !== i) moveSet(dragIdx, i); setDragIdx(null); }}
                  onDragEnd={() => setDragIdx(null)}
                  onTouchStart={e => { setTouchIdx(i); touchY.current = e.touches[0].clientY; e.currentTarget.style.opacity = '0.6'; }}
                  onTouchMove={e => {
                    if (touchIdx === null) return;
                    e.preventDefault();
                    const dy = e.touches[0].clientY - touchY.current;
                    if (Math.abs(dy) > 40) {
                      const dir = dy > 0 ? 1 : -1;
                      const to = touchIdx + dir;
                      if (to >= 0 && to < sets.length) { moveSet(touchIdx, to); setTouchIdx(to); touchY.current = e.touches[0].clientY; }
                    }
                  }}
                  onTouchEnd={e => { setTouchIdx(null); e.currentTarget.style.opacity = '1'; }}
                  className={`bg-slate-900 border-2 rounded-lg p-4 transition-all ${dragIdx === i ? 'opacity-50 border-amber-400' : 'border-slate-700 hover:border-purple-500'}`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-3">
                      <span className="cursor-grab text-slate-500 select-none">⠿</span>
                      <span className="text-purple-400 font-bold text-sm">#{i+1}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${strokeColor[s.stroke] ?? 'bg-slate-500/10 text-slate-400'}`}>{STROKE_LABELS[s.stroke]}</span>
                      <span className="text-[11px] text-slate-500">{CAT_LABELS[s.category] ?? s.category}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => moveSet(i, i-1)} disabled={i === 0} className="border border-amber-400 text-amber-400 text-xs px-2 py-1 rounded disabled:opacity-30">↑</button>
                      <button onClick={() => moveSet(i, i+1)} disabled={i === sets.length-1} className="border border-amber-400 text-amber-400 text-xs px-2 py-1 rounded disabled:opacity-30">↓</button>
                      <button onClick={() => removeSet(s.id)} className="border border-red-500 text-red-500 text-xs px-2 py-1 rounded hover:bg-red-500 hover:text-white">✕</button>
                    </div>
                  </div>
                  <div className="text-sm text-slate-200 mb-2">{s.reps} × {s.distance} {STROKE_LABELS[s.stroke]}{s.notes ? ` — ${s.notes}` : ''}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      [s.totalYards.toString(), 'Yards'],
                      [fmtInterval(s.interval), 'Interval/100'],
                      [INTENSITY_PCT[s.intensity], 'Intensity'],
                      [fmtTime(s.estSeconds), 'Est. Time'],
                    ].map(([val, lbl]) => (
                      <div key={lbl} className="bg-slate-800 border border-slate-700 rounded p-1.5 text-center">
                        <div className="text-base font-bold text-white">{val}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider">{lbl}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Export Modal */}
      {showExport && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowExport(false)}>
          <div className="bg-slate-900 border-2 border-purple-500 rounded-xl p-6 w-[90%] max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-purple-400 text-lg font-bold uppercase tracking-widest mb-4">Export Practice</h2>
            <pre className="bg-slate-950 border border-slate-700 rounded-md p-4 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">{exportText}</pre>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => { navigator.clipboard.writeText(exportText); }} className="border-2 border-amber-400 text-amber-400 hover:bg-amber-400 hover:text-slate-950 text-xs uppercase tracking-wider font-bold py-2 px-4 rounded-md">Copy to Clipboard</button>
              <button onClick={() => setShowExport(false)} className="border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white text-xs uppercase tracking-wider font-bold py-2 px-4 rounded-md">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
