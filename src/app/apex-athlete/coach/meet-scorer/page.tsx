"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { 
  ArrowLeft, Timer, Trophy, Activity, Check, Plus, Trash2, 
  Settings, Save, Search, Download, TrendingUp, AlertCircle 
} from "lucide-react";

// --- Types & Constants ---
const SCORING_FORMATS: Record<string, number[]> = {
  dual: [6, 4, 3, 2, 1],
  dual5: [5, 3, 1],
  champ: [20, 17, 16, 15, 14, 13, 12, 11],
  invitational: [16, 13, 12, 11, 10, 9, 8, 7],
  custom: []
};

const TEAM_COLORS = [
  "bg-violet-600", "bg-red-600", "bg-blue-600", "bg-emerald-600", "bg-amber-500"
];
const TEAM_TEXT_COLORS = [
  "text-violet-500", "text-red-500", "text-blue-500", "text-emerald-500", "text-amber-500"
];

interface Result {
  swimmer: string;
  teamIdx: number;
  place: number;
  time: string;
}

interface Event {
  num: number;
  name: string;
  type: "individual" | "relay";
  results: Result[];
}

// --- Main Component ---
export default function MeetScorerPage() {
  // State
  const [activeTab, setActiveTab] = useState<"scoring" | "summary" | "analysis">("scoring");
  const [meetName, setMeetName] = useState("Dual Meet");
  const [scoringFormat, setScoringFormat] = useState("dual");
  const [teams, setTeams] = useState<string[]>(["Home", "Visitor"]);
  const [events, setEvents] = useState<Event[]>([]);
  const [relayMulti, setRelayMulti] = useState(2);
  
  // UI State for new result inputs
  const [newEventNum, setNewEventNum] = useState(1);
  const [resultInputs, setResultInputs] = useState<Record<number, { swimmer: string; teamIdx: string; place: string; time: string }>>({});

  // Computed Scores
  const { scores, eventScores, teamStats } = useMemo(() => {
    const pts = SCORING_FORMATS[scoringFormat] || SCORING_FORMATS.dual;
    const teamTotals = teams.map(() => 0);
    const evScores = events.map(() => teams.map(() => 0));
    
    events.forEach((ev, eIdx) => {
      const mult = ev.type === "relay" ? relayMulti : 1;
      ev.results.forEach((r) => {
        const pIdx = r.place - 1;
        if (pIdx >= 0 && pIdx < pts.length) {
          const points = pts[pIdx] * mult;
          teamTotals[r.teamIdx] += points;
          evScores[eIdx][r.teamIdx] += points;
        }
      });
    });

    const maxScore = Math.max(...teamTotals, 1);
    const stats = teams.map((t, i) => ({
      name: t,
      score: teamTotals[i],
      wins: evScores.filter(es => es[i] === Math.max(...es) && es[i] > 0).length,
      pct: Math.round((teamTotals[i] / maxScore) * 100)
    }));
    
    return { scores: teamTotals, eventScores: evScores, teamStats: stats };
  }, [events, teams, scoringFormat, relayMulti]);

  // --- Actions ---
  const addTeam = () => {
    if (teams.length >= 5) return;
    setTeams([...teams, `Team ${teams.length + 1}`]);
  };

  const removeTeam = (idx: number) => {
    if (teams.length <= 1) return;
    const newTeams = [...teams];
    newTeams.splice(idx, 1);
    setTeams(newTeams);
    // Cleanup results for removed team
    setEvents(events.map(ev => ({
      ...ev,
      results: ev.results
        .filter(r => r.teamIdx !== idx)
        .map(r => ({ ...r, teamIdx: r.teamIdx > idx ? r.teamIdx - 1 : r.teamIdx }))
    })));
  };

  const addEvent = (name: string, type: "individual" | "relay") => {
    setEvents([...events, {
      num: events.length + 1,
      name: name || `Event ${events.length + 1}`,
      type,
      results: []
    }].sort((a, b) => a.num - b.num));
    setNewEventNum(prev => prev + 1);
  };

  const addResult = (evIdx: number) => {
    const input = resultInputs[evIdx] || { swimmer: "", teamIdx: "0", place: "", time: "" };
    if (!input.swimmer || !input.place) return;
    
    const newEvents = [...events];
    newEvents[evIdx].results.push({
      swimmer: input.swimmer,
      teamIdx: parseInt(input.teamIdx),
      place: parseInt(input.place),
      time: input.time
    });
    newEvents[evIdx].results.sort((a, b) => a.place - b.place);
    setEvents(newEvents);
    
    // Reset input for next entry
    setResultInputs({
      ...resultInputs,
      [evIdx]: { ...input, swimmer: "", place: (parseInt(input.place) + 1).toString(), time: "" }
    });
  };

  const loadTemplate = (type: "hs" | "age" | "sprint") => {
    const templates = {
      hs: [
        { num: 1, name: "200 Medley Relay", type: "relay" },
        { num: 2, name: "200 Free", type: "individual" },
        { num: 3, name: "200 IM", type: "individual" },
        { num: 4, name: "50 Free", type: "individual" },
        { num: 5, name: "100 Fly", type: "individual" },
        { num: 6, name: "100 Free", type: "individual" },
        { num: 7, name: "500 Free", type: "individual" },
        { num: 8, name: "200 Free Relay", type: "relay" },
        { num: 9, name: "100 Back", type: "individual" },
        { num: 10, name: "100 Breast", type: "individual" },
        { num: 11, name: "400 Free Relay", type: "relay" }
      ]
    };
    // Simplified for demo - just HS logic for now
    if (type === "hs") {
      setEvents(templates.hs.map(e => ({ ...e, results: [], type: e.type as "individual" | "relay" })));
      setScoringFormat("dual");
    }
  };

  // Win Condition Logic
  const winCondition = useMemo(() => {
    if (teamStats.length < 2) return null;
    const sorted = [...teamStats].sort((a, b) => b.score - a.score);
    const [leader, second] = sorted;
    const gap = leader.score - second.score;
    const unscored = events.filter(e => e.results.length === 0).length;
    const pts = SCORING_FORMATS[scoringFormat] || SCORING_FORMATS.dual;
    const maxPtsPerEvent = pts[0] * 1; // Simplify logic for now
    
    if (unscored === 0) return { status: "complete", msg: `Meet Complete: ${leader.name} Wins!` };
    if (gap > (maxPtsPerEvent * unscored)) return { status: "clinched", msg: `${leader.name} has clinched!` };
    return { status: "open", msg: `${second.name} can overtake (${gap} pts behind)` };
  }, [teamStats, events, scoringFormat]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 pb-24 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6 border-b border-violet-900/30 pb-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">
            METTLE <span className="text-violet-500 font-mono">//</span> Meet Scorer
          </h1>
          <div className="text-xs text-slate-500 font-mono tracking-widest uppercase">Real-Time Scoring Engine</div>
        </div>
        <div className="ml-auto flex gap-2">
          {winCondition && (
            <div className={cn(
              "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border",
              winCondition.status === "complete" ? "bg-emerald-950/30 border-emerald-800 text-emerald-400" :
              winCondition.status === "clinched" ? "bg-amber-950/30 border-amber-800 text-amber-400" :
              "bg-slate-900 border-slate-700 text-slate-400"
            )}>
              {winCondition.msg}
            </div>
          )}
          <Button size="sm" variant="outline" className="gap-2 border-slate-700 bg-slate-900/50">
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900/50 p-1 rounded-lg border border-slate-800 w-fit mb-6">
        {[
          { id: "scoring", label: "Scoring", icon: Activity },
          { id: "summary", label: "Summary", icon: Trophy },
          { id: "analysis", label: "Analysis", icon: TrendingUp }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-all",
              activeTab === tab.id 
                ? "bg-violet-600 text-white shadow-lg shadow-violet-900/20" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            )}
          >
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Score Cards - Always Visible */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {teamStats.map((team, idx) => (
          <div key={idx} className={cn(
            "relative p-4 rounded-xl border-2 transition-all overflow-hidden",
            idx === 0 && team.score > 0 ? "border-amber-500/50 bg-amber-950/10" : "border-slate-800 bg-slate-900/40"
          )}>
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("w-2 h-2 rounded-full", TEAM_COLORS[idx % 5])} />
              <h3 className="font-bold text-sm truncate">{team.name}</h3>
            </div>
            <div className="text-4xl font-black tabular-nums tracking-tight">{team.score}</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 mt-1">Total Points</div>
            {/* Progress Bar */}
            <div className="absolute bottom-0 left-0 h-1 bg-slate-800 w-full">
              <div 
                className={cn("h-full transition-all duration-500", TEAM_COLORS[idx % 5])} 
                style={{ width: `${team.pct}%` }} 
              />
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Col: Setup & Controls */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-slate-800 bg-slate-900/30">
            <CardHeader className="pb-3 border-b border-slate-800/50">
              <CardTitle className="text-sm font-medium uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Settings className="h-4 w-4" /> Setup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-mono">Meet Name</label>
                <Input 
                  value={meetName} 
                  onChange={(e) => setMeetName(e.target.value)} 
                  className="bg-slate-950 border-slate-800" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 font-mono">Format</label>
                  <Select value={scoringFormat} onValueChange={setScoringFormat}>
                    <SelectTrigger className="bg-slate-950 border-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dual">Dual (6-4-3)</SelectItem>
                      <SelectItem value="dual5">Dual 5 (5-3-1)</SelectItem>
                      <SelectItem value="champ">Champ (16pl)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 font-mono">Relay Mult</label>
                  <Select value={relayMulti.toString()} onValueChange={(v) => setRelayMulti(parseFloat(v))}>
                    <SelectTrigger className="bg-slate-950 border-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1x</SelectItem>
                      <SelectItem value="2">2x</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-mono">Teams</label>
                {teams.map((t, i) => (
                  <div key={i} className="flex gap-2">
                    <div className={cn("w-1 rounded-full", TEAM_COLORS[i % 5])} />
                    <Input 
                      value={t} 
                      onChange={(e) => {
                        const newTeams = [...teams];
                        newTeams[i] = e.target.value;
                        setTeams(newTeams);
                      }}
                      className="h-8 text-sm bg-slate-950 border-slate-800"
                    />
                    {teams.length > 2 && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-400" onClick={() => removeTeam(i)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                {teams.length < 5 && (
                  <Button variant="outline" size="sm" className="w-full border-dashed border-slate-800 hover:border-slate-700 text-slate-500" onClick={addTeam}>
                    <Plus className="h-3 w-3 mr-2" /> Add Team
                  </Button>
                )}
              </div>

              <div className="pt-4 border-t border-slate-800/50">
                <label className="text-xs text-slate-400 font-mono block mb-2">Quick Templates</label>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => loadTemplate('hs')}>HS Dual</Button>
                  <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => loadTemplate('hs')}>HS Champ</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Events & Scoring */}
        <div className="lg:col-span-2 space-y-4">
          {events.length === 0 && (
            <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/20">
              <Activity className="h-10 w-10 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-400">No events yet</h3>
              <p className="text-sm text-slate-600 mb-6">Load a template or add manual events</p>
              <Button onClick={() => loadTemplate('hs')}>Load HS Template</Button>
            </div>
          )}

          {events.map((ev, evIdx) => (
            <Card key={evIdx} className="border-slate-800 bg-slate-900/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-xs flex items-center justify-center font-mono text-slate-400">{ev.num}</span>
                  <span className="font-bold text-slate-200">{ev.name}</span>
                  {ev.type === 'relay' && (
                    <span className="text-[10px] bg-violet-900/30 text-violet-400 px-2 py-0.5 rounded border border-violet-800/50 uppercase tracking-wide">
                      Relay ×{relayMulti}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  {ev.results.length} Results
                </div>
              </div>
              
              <div className="p-0">
                {ev.results.length > 0 && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800/50 text-xs text-slate-500 uppercase tracking-wider text-left">
                        <th className="px-4 py-2 w-16">Pl</th>
                        <th className="px-4 py-2">Swimmer</th>
                        <th className="px-4 py-2">Team</th>
                        <th className="px-4 py-2">Time</th>
                        <th className="px-4 py-2 text-right">Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30">
                      {ev.results.map((r, rIdx) => {
                        const pts = (SCORING_FORMATS[scoringFormat][r.place-1] || 0) * (ev.type==='relay'?relayMulti:1);
                        return (
                          <tr key={rIdx} className="hover:bg-slate-800/30 group">
                            <td className={cn("px-4 py-2 font-mono font-bold", r.place <= 3 ? "text-amber-400" : "text-slate-500")}>{r.place}</td>
                            <td className="px-4 py-2 text-slate-300">{r.swimmer}</td>
                            <td className="px-4 py-2">
                              <span className={cn("inline-flex items-center gap-2 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-900/50 border border-slate-800", TEAM_TEXT_COLORS[r.teamIdx % 5])}>
                                <span className={cn("w-1.5 h-1.5 rounded-full", TEAM_COLORS[r.teamIdx % 5])} />
                                {teams[r.teamIdx]}
                              </span>
                            </td>
                            <td className="px-4 py-2 font-mono text-slate-400">{r.time || "—"}</td>
                            <td className={cn("px-4 py-2 text-right font-bold", TEAM_TEXT_COLORS[r.teamIdx % 5])}>+{pts}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {/* Add Result Row */}
                <div className="p-3 bg-slate-950/30 border-t border-slate-800/50 flex flex-wrap gap-2 items-end">
                   <div className="w-16">
                    <label className="text-[10px] text-slate-500 uppercase block mb-1">Place</label>
                    <Input 
                      type="number" 
                      className="h-8 bg-slate-900 border-slate-800 text-center font-mono"
                      value={resultInputs[evIdx]?.place || (ev.results.length + 1).toString()}
                      onChange={(e) => setResultInputs({...resultInputs, [evIdx]: {...(resultInputs[evIdx] || {}), place: e.target.value}})}
                    />
                   </div>
                   <div className="flex-1 min-w-[140px]">
                    <label className="text-[10px] text-slate-500 uppercase block mb-1">Swimmer</label>
                    <Input 
                      placeholder="Name" 
                      className="h-8 bg-slate-900 border-slate-800" 
                      value={resultInputs[evIdx]?.swimmer || ""}
                      onChange={(e) => setResultInputs({...resultInputs, [evIdx]: {...(resultInputs[evIdx] || {}), swimmer: e.target.value}})}
                    />
                   </div>
                   <div className="w-32">
                    <label className="text-[10px] text-slate-500 uppercase block mb-1">Team</label>
                    <Select 
                      value={resultInputs[evIdx]?.teamIdx || "0"}
                      onValueChange={(v) => setResultInputs({...resultInputs, [evIdx]: {...(resultInputs[evIdx] || {}), teamIdx: v}})}
                    >
                      <SelectTrigger className="h-8 bg-slate-900 border-slate-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((t, i) => (
                          <SelectItem key={i} value={i.toString()}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                   </div>
                   <div className="w-24">
                    <label className="text-[10px] text-slate-500 uppercase block mb-1">Time</label>
                    <Input 
                      placeholder="NT" 
                      className="h-8 bg-slate-900 border-slate-800 font-mono text-center" 
                      value={resultInputs[evIdx]?.time || ""}
                      onChange={(e) => setResultInputs({...resultInputs, [evIdx]: {...(resultInputs[evIdx] || {}), time: e.target.value}})}
                      onKeyDown={(e) => e.key === 'Enter' && addResult(evIdx)}
                    />
                   </div>
                   <Button size="sm" className="h-8 bg-violet-600 hover:bg-violet-700" onClick={() => addResult(evIdx)}>Add</Button>
                </div>
              </div>
            </Card>
          ))}

          {/* Add Event Button */}
          {events.length > 0 && (
            <div className="p-4 border-2 border-dashed border-slate-800 rounded-xl flex items-center justify-center gap-4 bg-slate-900/20 hover:bg-slate-900/40 transition-colors cursor-pointer" onClick={() => addEvent("", "individual")}>
              <Plus className="h-5 w-5 text-slate-500" />
              <span className="text-sm font-medium text-slate-400">Add Next Event</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
