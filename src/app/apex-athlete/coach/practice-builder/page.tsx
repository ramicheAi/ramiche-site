"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { 
  ArrowLeft, Copy, Printer, Trash2, Plus, Download, Activity, Timer, 
  FileText, MoveUp, MoveDown, Check
} from "lucide-react";

// --- Constants ---
const PACE_DATA: Record<string, Record<string, number>> = {
  novice:    { free:95,  back:110, breast:115, fly:105, im:110, kick:140, drill:120, choice:100 },
  'age-group':{ free:75,  back:85,  breast:90,  fly:82,  im:85,  kick:110, drill:95,  choice:80  },
  senior:    { free:60,  back:68,  breast:72,  fly:65,  im:68,  kick:90,  drill:75,  choice:65  },
  elite:     { free:50,  back:56,  breast:60,  fly:54,  im:56,  kick:75,  drill:62,  choice:54  }
};

const INTENSITY_MULT: Record<string, number> = { easy:1.15, moderate:1.0, threshold:0.92, race:0.85, max:0.80 };
const INTENSITY_PCT: Record<string, string> = { easy:'60%', moderate:'75%', threshold:'85%', race:'95%', max:'100%' };
const STROKE_LABELS: Record<string, string> = { free:'Freestyle', back:'Backstroke', breast:'Breaststroke', fly:'Butterfly', im:'IM', kick:'Kick', drill:'Drill', choice:'Choice' };
const CAT_LABELS: Record<string, string> = { 'main':'Main Set', 'warm-up':'Warm-Up', 'pre-set':'Pre-Set', kick:'Kick Set', drill:'Drill Set', sprint:'Sprint Set', 'cool-down':'Cool-Down' };

interface SetItem {
  id: number;
  category: string;
  reps: number;
  distance: number;
  stroke: string;
  intensity: string;
  interval: number;
  notes: string;
}

export default function PracticeBuilderPage() {
  const [sets, setSets] = useState<SetItem[]>([]);
  const [selectedCat, setSelectedCat] = useState("main");
  const [skillLevel, setSkillLevel] = useState("age-group");
  
  // New Set Inputs
  const [reps, setReps] = useState(4);
  const [dist, setDist] = useState(50);
  const [stroke, setStroke] = useState("free");
  const [intensity, setIntensity] = useState("moderate");
  const [interval, setInterval] = useState(90);
  const [notes, setNotes] = useState("");

  // Summary Calc
  const summary = useMemo(() => {
    const totalYards = sets.reduce((a,s) => a + (s.reps * s.distance), 0);
    const totalSec = sets.reduce((a,s) => {
      const base = PACE_DATA[skillLevel][s.stroke] || 75;
      const adj = base * (INTENSITY_MULT[s.intensity] || 1);
      const est = (s.distance / 100) * adj * s.reps + (s.reps - 1) * 10;
      return a + est;
    }, 0);
    const m = Math.floor(totalSec / 60);
    const s = Math.floor(totalSec % 60);
    const timeStr = `${m}:${s.toString().padStart(2, '0')}`;
    return { totalYards, timeStr };
  }, [sets, skillLevel]);

  // Actions
  const addSet = () => {
    const newSet: SetItem = {
      id: Date.now(),
      category: selectedCat,
      reps, distance: dist, stroke, intensity, interval, notes
    };
    setSets([...sets, newSet]);
  };

  const removeSet = (id: number) => setSets(sets.filter(s => s.id !== id));
  
  const moveSet = (idx: number, dir: -1 | 1) => {
    if (idx + dir < 0 || idx + dir >= sets.length) return;
    const newSets = [...sets];
    const [item] = newSets.splice(idx, 1);
    newSets.splice(idx + dir, 0, item);
    setSets(newSets);
  };

  const loadTemplate = (type: string) => {
    // Simplified templates for demo
    if (type === 'warmup') {
      const t: SetItem[] = [
        { id:1, category:'warm-up', reps:1, distance:200, stroke:'free', intensity:'easy', interval:180, notes:'Steady swim' },
        { id:2, category:'warm-up', reps:4, distance:50, stroke:'drill', intensity:'easy', interval:70, notes:'Drill/Swim by 25' }
      ];
      setSets([...sets, ...t.map(s => ({...s, id: Math.random()}))]);
    }
  };

  const copyToClipboard = () => {
    let txt = `METTLE PRACTICE // ${new Date().toLocaleDateString()}\nTotal: ${summary.totalYards}yds | Est: ${summary.timeStr}\n\n`;
    sets.forEach((s,i) => {
      txt += `${i+1}. ${s.reps}x${s.distance} ${STROKE_LABELS[s.stroke]} @ ${s.interval}s (${INTENSITY_PCT[s.intensity]}) ${s.notes ? '- ' + s.notes : ''}\n`;
    });
    navigator.clipboard.writeText(txt);
    alert('Copied to clipboard');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            METTLE <span className="text-slate-500 font-mono">//</span> Practice Builder
          </h1>
          <p className="text-slate-500 text-sm">Design structured workouts · Estimate timelines · Export to PDF</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Sidebar Controls */}
        <div className="space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader><CardTitle className="text-sm uppercase tracking-widest text-slate-500">Config</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(CAT_LABELS).map(([k,v]) => (
                  <button
                    key={k}
                    onClick={() => setSelectedCat(k)}
                    className={cn(
                      "text-[10px] uppercase font-bold py-2 rounded border transition-all",
                      selectedCat === k ? "bg-purple-600 border-purple-500 text-white" : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700"
                    )}
                  >
                    {k}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Reps</label>
                  <Input type="number" value={reps} onChange={e => setReps(parseInt(e.target.value))} className="bg-slate-950 border-slate-800" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Distance</label>
                  <Select value={dist.toString()} onValueChange={v => setDist(parseInt(v))}>
                    <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[25,50,75,100,150,200,300,400,500].map(d => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Stroke</label>
                  <Select value={stroke} onValueChange={setStroke}>
                    <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STROKE_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Intensity</label>
                  <Select value={intensity} onValueChange={setIntensity}>
                    <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(INTENSITY_PCT).map(([k,v]) => <SelectItem key={k} value={k}>{k} ({v})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1">Interval (sec)</label>
                <Input type="number" value={interval} onChange={e => setInterval(parseInt(e.target.value))} className="bg-slate-950 border-slate-800" />
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1">Notes</label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Descend 1-4" className="bg-slate-950 border-slate-800" />
              </div>

              <Button onClick={addSet} className="w-full bg-purple-600 hover:bg-purple-700 font-bold">
                <Plus className="mr-2 h-4 w-4" /> Add Set
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4">
              <h3 className="text-xs text-slate-500 uppercase tracking-widest mb-3">Templates</h3>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => loadTemplate('warmup')} className="bg-slate-950 border-slate-800 text-slate-400">Warmup</Button>
                <Button variant="outline" size="sm" className="bg-slate-950 border-slate-800 text-slate-400">Sprint</Button>
                <Button variant="outline" size="sm" className="bg-slate-950 border-slate-800 text-slate-400">Distance</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Workout View */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Bar */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <div className="text-3xl font-black text-white">{summary.totalYards}</div>
              <div className="text-xs uppercase tracking-widest text-slate-500">Total Yards</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <div className="text-3xl font-black text-purple-400">{sets.length}</div>
              <div className="text-xs uppercase tracking-widest text-slate-500">Sets</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <div className="text-3xl font-black text-emerald-400">{summary.timeStr}</div>
              <div className="text-xs uppercase tracking-widest text-slate-500">Est. Time</div>
            </div>
          </div>

          {/* Set List */}
          <div className="space-y-3 min-h-[400px]">
            {sets.length === 0 && (
              <div className="border-2 border-dashed border-slate-800 rounded-xl p-12 text-center text-slate-500">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No sets added yet. Use the sidebar to build your practice.</p>
              </div>
            )}
            
            {sets.map((s, idx) => (
              <div key={s.id} className="group bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-purple-500/50 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="text-slate-500 font-mono font-bold pt-1">{idx+1}</div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400">{s.category}</span>
                        <span className="text-lg font-bold text-white">
                          {s.reps} <span className="text-slate-500">×</span> {s.distance}
                        </span>
                        <span className="text-slate-300">{STROKE_LABELS[s.stroke]}</span>
                      </div>
                      <div className="text-sm text-slate-400 flex gap-4">
                        <span>@ {s.interval}s</span>
                        <span>{INTENSITY_PCT[s.intensity]} Effort</span>
                      </div>
                      {s.notes && <div className="text-sm text-purple-400 mt-1">→ {s.notes}</div>}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" onClick={() => moveSet(idx, -1)} disabled={idx===0} className="h-8 w-8 text-slate-500"><MoveUp className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => moveSet(idx, 1)} disabled={idx===sets.length-1} className="h-8 w-8 text-slate-500"><MoveDown className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => removeSet(s.id)} className="h-8 w-8 text-red-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action Footer */}
          <div className="border-t border-slate-800 pt-6 flex justify-end gap-3">
            <Button variant="outline" className="border-slate-800 text-slate-400 hover:text-white bg-slate-900" onClick={() => setSets([])}>
              Clear
            </Button>
            <Button variant="outline" className="border-slate-800 text-purple-400 hover:text-purple-300 bg-slate-900" onClick={copyToClipboard}>
              <Copy className="mr-2 h-4 w-4" /> Copy Text
            </Button>
            <Button variant="outline" className="border-slate-800 text-emerald-400 hover:text-emerald-300 bg-slate-900">
              <Download className="mr-2 h-4 w-4" /> PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
