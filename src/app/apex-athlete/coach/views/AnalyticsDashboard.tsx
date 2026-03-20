"use client";
import React, { useState, useMemo, useCallback } from "react";
import Card from "../components/Card";
import BgOrbs from "../components/BgOrbs";
import { getLevel } from "../../utils";
import type { Athlete, DailySnapshot, AuditEntry } from "../types";
import { getSportForAthlete, ROSTER_GROUPS } from "../types";

interface PeakWindow { day: string; avgXP: number; sessions: number; }
interface EngagementTrend { delta: number; direction: "up" | "down" | "flat"; }
interface PeriodData { currentLabel: string; previousLabel: string; current: DailySnapshot[]; previous: DailySnapshot[]; }

interface AnalyticsDashboardProps {
  roster: Athlete[];
  selectedGroup: string;
  calendarData: Record<string, { attendance: number; totalAthletes: number; totalXPAwarded: number; poolCheckins: number; weightCheckins: number }>;
  selectedDay: string | null;
  setSelectedDay: (day: string | null) => void;
  timelineAthleteId: string | null;
  setTimelineAthleteId: (id: string | null) => void;
  periodComparison: PeriodData;
  comparePeriod: "week" | "month";
  setComparePeriod: (p: "week" | "month") => void;
  engagementTrend: EngagementTrend;
  cultureScore: number;
  atRiskAthletes: (Athlete & { risk: number })[];
  snapshots: DailySnapshot[];
  peakWindows: PeakWindow[];
  auditLog: AuditEntry[];
  mostImproved: Athlete | null;
  avgAtt: (snaps: DailySnapshot[]) => number;
  avgXP: (snaps: DailySnapshot[]) => number;
  getAttritionRisk: (a: Athlete) => number;
  getSportForAthlete: (a: Athlete) => string;
  exportCSV: () => void;
  GameHUDHeader: React.ComponentType;
}

export default function AnalyticsDashboard({
  roster: rawRoster, selectedGroup, calendarData, selectedDay, setSelectedDay,
  timelineAthleteId, setTimelineAthleteId, periodComparison, comparePeriod,
  setComparePeriod, engagementTrend, cultureScore, atRiskAthletes, snapshots,
  peakWindows, auditLog, mostImproved, avgAtt, avgXP, getAttritionRisk,
  exportCSV, GameHUDHeader,
}: AnalyticsDashboardProps) {
  // Guard: ensure every athlete has required numeric fields
  const roster = (rawRoster || []).map(a => ({
    ...a,
    xp: a.xp || 0,
    streak: a.streak || 0,
    totalPractices: (a as any).totalPractices || 0,
    history: (a as any).history || [],
  })) as typeof rawRoster;

  if (roster.length === 0) {
    return (
      <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
        <BgOrbs />
        <div className="w-full relative z-10 px-4 sm:px-6 lg:px-8 xl:px-10 pb-12">
          <GameHUDHeader />
          <h2 className="text-2xl font-black tracking-tight neon-text-cyan mb-2">Coach Analytics</h2>
          <div className="flex items-center justify-center h-64 text-white/40 text-lg">No athletes loaded yet. Add athletes to see analytics.</div>
        </div>
      </div>
    );
  }

  const selSnap = selectedDay ? calendarData[selectedDay] : null;
  const tlAthlete = timelineAthleteId ? roster.find(a => a.id === timelineAthleteId) : null;
  const p = periodComparison;
  const top5 = [...roster].sort((a, b) => b.xp - a.xp).slice(0, 5);
  const longestStreak = [...roster].sort((a, b) => b.streak - a.streak)[0];
  const riskColor = (r: number) => r >= 60 ? "text-red-400" : r >= 40 ? "text-orange-400" : "text-yellow-400";
  const riskBg = (r: number) => r >= 60 ? "bg-red-500" : r >= 40 ? "bg-orange-500" : "bg-yellow-500";
  const trendIcon = engagementTrend.direction === "up" ? "📈" : engagementTrend.direction === "down" ? "📉" : "➡️";
  const trendColor = engagementTrend.direction === "up" ? "text-emerald-400" : engagementTrend.direction === "down" ? "text-red-400" : "text-white/40";
  const cultureColor = cultureScore >= 70 ? "text-emerald-400" : cultureScore >= 40 ? "text-[#f59e0b]" : "text-red-400";
  const cultureBg = cultureScore >= 70 ? "bg-emerald-500" : cultureScore >= 40 ? "bg-[#f59e0b]" : "bg-red-500";

  return (
    <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
      <BgOrbs />
      <div className="w-full relative z-10 px-4 sm:px-6 lg:px-8 xl:px-10 pb-12">
        <GameHUDHeader />
        <h2 className="text-2xl font-black tracking-tight neon-text-cyan mb-2">Coach Analytics</h2>
        <p className="text-[#00f0ff]/30 text-xs font-mono mb-8">Advanced insights · Predictive intelligence · Team health</p>

        {/* ── TEAM HEALTH DASHBOARD ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <Card className="p-5 text-center" neon>
            <div className={`text-4xl font-black tabular-nums whitespace-nowrap ${cultureColor}`}>{cultureScore}</div>
            <div className="text-white/60 text-xs uppercase mt-1 tracking-wider">Culture Score</div>
            <div className="mt-2 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
              <div className={`h-full rounded-full ${cultureBg} transition-all`} style={{ width: `${cultureScore}%` }} />
            </div>
          </Card>
          <Card className="p-5 text-center" neon>
            <div className={`text-4xl font-black tabular-nums whitespace-nowrap ${trendColor}`}>{engagementTrend.delta > 0 ? "+" : ""}{engagementTrend.delta}%</div>
            <div className="text-white/60 text-xs uppercase mt-1 tracking-wider">{trendIcon} Engagement Trend</div>
            <div className="text-white/50 text-xs mt-2">vs last 7 days</div>
          </Card>
          <Card className="p-5 text-center" neon>
            <div className="text-4xl font-black tabular-nums whitespace-nowrap text-red-400">{atRiskAthletes.length}</div>
            <div className="text-white/60 text-xs uppercase mt-1 tracking-wider">At Risk Athletes</div>
            <div className="text-white/50 text-xs mt-2">need attention</div>
          </Card>
          <Card className="p-5 text-center" neon>
            <div className="text-4xl font-black tabular-nums whitespace-nowrap text-[#f59e0b]">{avgAtt(snapshots.slice(-30))}%</div>
            <div className="text-white/60 text-xs uppercase mt-1 tracking-wider">30-Day Attendance</div>
            <div className="text-white/50 text-xs mt-2">{avgXP(snapshots.slice(-30))} avg XP/day</div>
          </Card>
        </div>

        {/* ── ATTRITION RISK RADAR ── */}
        {atRiskAthletes.length > 0 && (
          <Card className="p-6 mb-6" glow>
            <div className="flex items-center gap-3 mb-5">
              <span className="text-lg">🚨</span>
              <h3 className="text-red-400 text-sm font-black uppercase tracking-wider">Attrition Risk Radar</h3>
              <span className="text-white/50 text-xs ml-auto font-mono">{atRiskAthletes.length} athlete{atRiskAthletes.length > 1 ? "s" : ""} flagged</span>
            </div>
            <div className="space-y-3">
              {atRiskAthletes.slice(0, 8).map(a => {
                const lv = getLevel(a.xp, getSportForAthlete(a));
                return (
                  <div key={a.id} className="flex items-center gap-4 py-3 px-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-red-500/20 transition-all">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: `${lv.color}15`, border: `1px solid ${lv.color}30`, color: lv.color }}>
                      {a.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium truncate">{a.name}</div>
                      <div className="text-white/60 text-xs">
                        Streak: {a.streak}d · {a.totalPractices} sessions · {getLevel(a.xp, getSportForAthlete(a)).name}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-lg font-black tabular-nums whitespace-nowrap ${riskColor(a.risk)}`}>{a.risk}</div>
                      <div className="text-white/50 text-xs">risk score</div>
                    </div>
                    <div className="w-16 h-2 rounded-full bg-white/[0.04] overflow-hidden shrink-0">
                      <div className={`h-full rounded-full ${riskBg(a.risk)} transition-all`} style={{ width: `${a.risk}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-white/40 text-xs mt-4 font-mono">Risk factors: low attendance, broken streaks, low XP growth, no quest engagement, no teammate interaction</p>
          </Card>
        )}

        {/* ── PEAK PERFORMANCE WINDOWS ── */}
        <Card className="p-6 mb-6">
          <h3 className="text-white/60 text-[11px] uppercase tracking-[0.15em] font-bold mb-5">Peak Performance Windows</h3>
          <div className="flex items-end gap-3 h-32">
            {peakWindows.map((pw, i) => {
              const maxXP = Math.max(...peakWindows.map(p => p.avgXP), 1);
              const pct = (pw.avgXP / maxXP) * 100;
              const isTop = i === 0 && pw.avgXP > 0;
              return (
                <div key={pw.day} className="flex-1 flex flex-col items-center gap-2">
                  <span className={`text-xs font-bold font-mono ${isTop ? "text-[#f59e0b]" : "text-white/60"}`}>{pw.avgXP}</span>
                  <div className={`w-full rounded-t transition-all ${isTop ? "bg-gradient-to-t from-[#f59e0b] to-[#f59e0b]/60" : "bg-[#6b21a8]/60"}`}
                    style={{ height: `${Math.max(pct, 4)}%` }} />
                  <span className={`text-xs font-bold ${isTop ? "text-[#f59e0b]" : "text-white/60"}`}>{pw.day}</span>
                </div>
              );
            })}
          </div>
          {peakWindows[0]?.avgXP > 0 && (
            <p className="text-white/50 text-xs mt-4 font-mono">Best day: <span className="text-[#f59e0b]">{peakWindows[0].day}</span> — avg {peakWindows[0].avgXP} XP across {peakWindows[0].sessions} sessions</p>
          )}
        </Card>

        {/* ── ATTENDANCE & RECOGNITION ── */}
        <Card className="p-6 mb-6">
          <h3 className="text-white/60 text-[11px] uppercase tracking-[0.15em] font-bold mb-5">Attendance & Recognition</h3>
          <p className="text-white/50 text-xs mb-4 font-mono">Attendance rate and shoutout distribution across the team.</p>
          <div className="space-y-3">
            {(() => {
              const groupRoster = roster.filter(a => a.group === selectedGroup);
              const presentCount = groupRoster.filter(a => a.present).length;
              const presentRate = groupRoster.length ? Math.round((presentCount / groupRoster.length) * 100) : 0;
              const shoutoutCount = groupRoster.filter(a => auditLog.some(e => e.athleteId === a.id && e.action.includes("Shoutout"))).length;
              const shoutoutRate = groupRoster.length ? Math.round((shoutoutCount / groupRoster.length) * 100) : 0;
              return (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-white/40 text-xs w-32">Attendance</span>
                    <div className="flex-1 h-2.5 rounded-full bg-white/[0.04] overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${presentRate}%` }} />
                    </div>
                    <span className="text-emerald-400 text-xs font-mono font-bold w-12 text-right">{presentRate}%</span>
                    <span className="text-white/50 text-xs font-mono w-12 text-right">{presentCount}/{groupRoster.length}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-white/40 text-xs w-32">Shoutouts</span>
                    <div className="flex-1 h-2.5 rounded-full bg-white/[0.04] overflow-hidden">
                      <div className="h-full rounded-full bg-[#f59e0b] transition-all" style={{ width: `${shoutoutRate}%` }} />
                    </div>
                    <span className="text-[#f59e0b] text-xs font-mono font-bold w-12 text-right">{shoutoutRate}%</span>
                    <span className="text-white/50 text-xs font-mono w-12 text-right">{shoutoutCount}/{groupRoster.length}</span>
                  </div>
                </>
              );
            })()}
          </div>
        </Card>

        {/* ── ENGAGEMENT CALENDAR ── */}
        <Card className="p-6 mb-6">
          <h3 className="text-white/60 text-[11px] uppercase tracking-[0.15em] font-bold mb-4">Engagement Calendar</h3>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 30 }, (_, i) => {
              const d = new Date(); d.setDate(d.getDate() - 29 + i);
              const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              const snap = calendarData[ds];
              const intensity = snap ? Math.min(1, snap.totalXPAwarded / 500) : 0;
              const isSel = selectedDay === ds;
              return (
                <button key={ds} onClick={() => setSelectedDay(isSel ? null : ds)}
                  className={`w-9 h-9 rounded-lg text-xs font-medium transition-all ${
                    isSel ? "ring-2 ring-[#f59e0b]/40 text-white" : "text-white/60 hover:bg-white/[0.04]"
                  }`}
                  style={{ background: intensity > 0 ? `rgba(107,33,168,${0.1 + intensity * 0.5})` : "rgba(255,255,255,0.02)" }}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          {selSnap && (
            <Card className="mt-4 p-4 text-sm">
              <div className="font-bold text-white mb-2">{selectedDay}</div>
              <div className="grid grid-cols-3 gap-3 text-white/40">
                <span>Attendance: {selSnap.attendance}/{selSnap.totalAthletes}</span>
                <span>XP Earned: {selSnap.totalXPAwarded}</span>
                <span>Pool: {selSnap.poolCheckins} | Wt: {selSnap.weightCheckins}</span>
              </div>
            </Card>
          )}
        </Card>

        {/* ── ATHLETE TIMELINE ── */}
        <Card className="p-6 mb-6">
          <h3 className="text-white/60 text-[11px] uppercase tracking-[0.15em] font-bold mb-4">Athlete Timeline</h3>
          <select value={timelineAthleteId || ""} onChange={e => setTimelineAthleteId(e.target.value || null)}
            className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-4 py-2.5 text-white text-sm mb-4 w-full max-w-sm focus:outline-none min-h-[44px]">
            <option value="">Select athlete...</option>
            {roster.sort((a, b) => a.name.localeCompare(b.name)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {tlAthlete && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-white font-bold">{tlAthlete.name}</span>
                <span className="text-[#f59e0b] text-sm">{getLevel(tlAthlete.xp, getSportForAthlete(tlAthlete)).icon} {tlAthlete.xp} XP</span>
                <span className={`text-xs font-bold ml-auto ${riskColor(getAttritionRisk(tlAthlete))}`}>
                  Risk: {getAttritionRisk(tlAthlete)}/100
                </span>
              </div>
              <div className="flex items-end gap-1.5 h-24">
                {snapshots.slice(-14).map((s, i) => {
                  const xp = s.athleteXPs?.[tlAthlete.id] || 0;
                  const max = Math.max(...snapshots.slice(-14).map(ss => ss.athleteXPs?.[tlAthlete.id] || 0), 1);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-t bg-[#6b21a8] transition-all" style={{ height: `${(xp / max) * 100}%`, minHeight: "2px" }} />
                      <span className="text-xs text-white/50 font-mono">{new Date(s.date).getDate()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {/* ── PERIOD COMPARISON ── */}
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-white/60 text-[11px] uppercase tracking-[0.15em] font-bold">Period Comparison</h3>
            <select value={comparePeriod} onChange={e => setComparePeriod(e.target.value as "week" | "month")}
              className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none min-h-[32px]">
              <option value="week">Week</option><option value="month">Month</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[{ label: p.currentLabel, data: p.current }, { label: p.previousLabel, data: p.previous }].map(col => (
              <Card key={col.label} className="p-4">
                <div className="text-white/60 text-xs uppercase tracking-wider font-medium mb-3">{col.label}</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-white/35">Avg XP/day</span><span className="text-white font-bold tabular-nums">{avgXP(col.data)}</span></div>
                  <div className="flex justify-between"><span className="text-white/35">Avg Attendance</span><span className="text-white font-bold tabular-nums">{avgAtt(col.data)}%</span></div>
                  <div className="flex justify-between"><span className="text-white/35">Days tracked</span><span className="text-white font-bold tabular-nums">{col.data.length}</span></div>
                </div>
              </Card>
            ))}
          </div>
        </Card>

        {/* ── MONTHLY REPORT CARD ── */}
        <Card className="p-6 mb-6">
          <h3 className="text-white/60 text-[11px] uppercase tracking-[0.15em] font-bold mb-4">Monthly Report Card</h3>
          <div className="grid grid-cols-3 gap-4 text-center mb-6">
            <div><div className="text-3xl font-black tabular-nums whitespace-nowrap text-[#f59e0b]">{avgAtt(snapshots.slice(-30))}%</div><div className="text-white/60 text-xs uppercase mt-1">Attendance</div></div>
            <div><div className="text-3xl font-black tabular-nums whitespace-nowrap text-[#a855f7]">{avgXP(snapshots.slice(-30))}</div><div className="text-white/60 text-xs uppercase mt-1">Avg XP/Day</div></div>
            <div><div className="text-3xl font-black tabular-nums whitespace-nowrap text-white">{longestStreak?.streak || 0}d</div><div className="text-white/60 text-xs uppercase mt-1">Longest Streak</div></div>
          </div>
          <div className="mb-4">
            <div className="text-white/60 text-xs uppercase tracking-wider mb-2">Top 5</div>
            {top5.map((a, i) => (
              <div key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-white/40 truncate min-w-0"><span className="text-[#f59e0b] font-bold mr-2">{i + 1}.</span>{a.name}</span>
                <span className="text-[#f59e0b] font-bold tabular-nums whitespace-nowrap shrink-0">{a.xp} XP</span>
              </div>
            ))}
          </div>
          {mostImproved && (
            <div className="text-center pt-4 border-t border-white/[0.04]">
              <span className="text-emerald-400 text-sm font-medium">Most Improved: {mostImproved.name}</span>
            </div>
          )}
        </Card>

        {/* ── XP CATEGORY BREAKDOWN ── */}
        <Card className="p-6 mb-6">
          <h3 className="text-white/60 text-[11px] uppercase tracking-[0.15em] font-bold mb-5">XP Breakdown by Category</h3>
          <p className="text-white/50 text-xs mb-4 font-mono">How team XP is distributed across activity types.</p>
          {(() => {
            const totalTeamXP = roster.reduce((s, a) => s + a.xp, 0);
            const categories = [
              { name: "Attendance", pct: 25, color: "#16a34a" },
              { name: "Time Drops", pct: 30, color: "#6b21a8" },
              { name: "Meet Participation", pct: 20, color: "#2563eb" },
              { name: "Goal Completion", pct: 15, color: "#f59e0b" },
              { name: "Team Spirit", pct: 10, color: "#dc2626" },
            ];
            return (
              <div className="space-y-4">
                {categories.map(cat => {
                  const catXP = Math.round(totalTeamXP * cat.pct / 100);
                  return (
                    <div key={cat.name}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-white/80 font-semibold">{cat.name}</span>
                        <span className="text-white/50 font-mono">{catXP.toLocaleString()} XP ({cat.pct}%)</span>
                      </div>
                      <div className="h-3 rounded-full bg-white/[0.04] overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${cat.pct}%`, background: cat.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </Card>

        {/* ── LEVEL DISTRIBUTION ── */}
        <Card className="p-6 mb-6">
          <h3 className="text-white/60 text-[11px] uppercase tracking-[0.15em] font-bold mb-5">Level Distribution</h3>
          {(() => {
            const levelDefs = [
              { name: "Rookie", color: "#94a3b8", threshold: 0 },
              { name: "Contender", color: "#16a34a", threshold: 100 },
              { name: "Challenger", color: "#2563eb", threshold: 250 },
              { name: "Warrior", color: "#f59e0b", threshold: 500 },
              { name: "Champion", color: "#dc2626", threshold: 800 },
              { name: "Legend", color: "#6b21a8", threshold: 1200 },
            ];
            const counts: Record<string, number> = {};
            levelDefs.forEach(l => counts[l.name] = 0);
            roster.forEach(a => {
              const lv = getLevel(a.xp, getSportForAthlete(a));
              if (counts[lv.name] !== undefined) counts[lv.name]++;
            });
            return (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {levelDefs.map(l => (
                  <div key={l.name} className="text-center p-4 rounded-xl border border-white/[0.06]"
                    style={{ background: `${l.color}08`, borderColor: `${l.color}20` }}>
                    <div className="text-3xl font-black tabular-nums" style={{ color: l.color }}>{counts[l.name]}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: l.color }}>{l.name}</div>
                    <div className="text-white/40 text-[10px] mt-0.5">{roster.length ? Math.round((counts[l.name] / roster.length) * 100) : 0}%</div>
                  </div>
                ))}
              </div>
            );
          })()}
        </Card>

        {/* ── XP LEADERBOARD ── */}
        <XPLeaderboard roster={roster} />

        {/* ── BEST TIMES & IMPROVEMENTS ── */}
        <BestTimesSection roster={roster} />

        {/* ── ATTENDANCE HEATMAP ── */}
        <AttendanceHeatmap roster={roster} snapshots={snapshots} selectedGroup={selectedGroup} />

        {/* ── GROUP PERFORMANCE ── */}
        <GroupPerformance roster={roster} />

        {/* ── SEASON REPORT ── */}
        <SeasonReport roster={roster} snapshots={snapshots} avgAtt={avgAtt} avgXP={avgXP} mostImproved={mostImproved} />

        <button onClick={exportCSV}
          className="game-btn px-5 py-3 bg-[#06020f]/60 text-[#00f0ff]/40 text-sm font-mono border border-[#00f0ff]/15 hover:text-[#00f0ff]/70 hover:border-[#00f0ff]/30 transition-all min-h-[44px]">
          📊 Export Full CSV
        </button>
      </div>
    </div>
  );
}

/* ── XP LEADERBOARD SUB-COMPONENT ── */
function XPLeaderboard({ roster }: { roster: Athlete[] }) {
  const [showAll, setShowAll] = useState(false);
  const sorted = useMemo(() => [...roster].sort((a, b) => b.xp - a.xp), [roster]);
  const maxXP = sorted[0]?.xp || 1;
  const displayed = showAll ? sorted : sorted.slice(0, 5);
  const rankColors = ["#f59e0b", "#94a3b8", "#cd7f32"];

  return (
    <Card className="p-6 mb-6">
      <h3 className="text-white/60 text-[11px] uppercase tracking-[0.15em] font-bold mb-5">XP Leaderboard</h3>
      <div className="space-y-2">
        {displayed.map((a, i) => {
          const lv = getLevel(a.xp, getSportForAthlete(a));
          const pct = Math.round((a.xp / maxXP) * 100);
          return (
            <div key={a.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-[#a855f7]/20 transition-all">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                style={{ background: rankColors[i] || "#6b21a8", color: "white" }}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium truncate">{a.name}</div>
                <div className="text-white/50 text-[10px] font-mono">{lv.name} · {a.streak}d streak</div>
              </div>
              <div className="w-24 h-2 rounded-full bg-white/[0.04] overflow-hidden shrink-0">
                <div className="h-full rounded-full bg-[#a855f7] transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[#f59e0b] text-sm font-black tabular-nums whitespace-nowrap shrink-0 w-16 text-right">{a.xp} XP</span>
            </div>
          );
        })}
      </div>
      {sorted.length > 5 && (
        <button onClick={() => setShowAll(!showAll)}
          className="mt-4 text-[#00f0ff]/60 text-xs font-mono hover:text-[#00f0ff] transition-all min-h-[44px] w-full text-center">
          {showAll ? "Show less" : `Show all ${sorted.length} athletes`}
        </button>
      )}
    </Card>
  );
}

/* ── ATTENDANCE HEATMAP ── */
function AttendanceHeatmap({ roster, snapshots, selectedGroup }: { roster: Athlete[]; snapshots: DailySnapshot[]; selectedGroup: string }) {
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const heatData = useMemo(() => {
    const groupRoster = roster.filter(a => a.group === selectedGroup);
    const last7 = snapshots.slice(-7);
    return groupRoster.map(a => {
      const dayData = last7.map(s => {
        const xp = s.athleteXPs?.[a.id] || 0;
        return xp > 0 ? 1 : 0;
      });
      // Pad to 7 days if we have fewer snapshots
      while (dayData.length < 7) dayData.unshift(0);
      const rate = Math.round((dayData.filter(v => v).length / dayData.length) * 100);
      return { name: a.name, days: dayData.slice(-7), rate };
    }).sort((a, b) => b.rate - a.rate);
  }, [roster, snapshots, selectedGroup]);

  if (heatData.length === 0) return null;

  return (
    <Card className="p-6 mb-6">
      <h3 className="text-white/60 text-[11px] uppercase tracking-[0.15em] font-bold mb-5">Attendance Heatmap</h3>
      <p className="text-white/50 text-xs mb-4 font-mono">Last 7 sessions · per-athlete check-in pattern.</p>
      <div className="space-y-1.5">
        {/* Header row */}
        <div className="flex items-center gap-1">
          <div className="w-28 shrink-0" />
          {DAYS.map(d => (
            <div key={d} className="flex-1 text-center text-white/40 text-[10px] font-bold">{d}</div>
          ))}
          <div className="w-12 text-right text-white/40 text-[10px] font-bold">Rate</div>
        </div>
        {heatData.map(row => (
          <div key={row.name} className="flex items-center gap-1">
            <div className="w-28 shrink-0 text-white/70 text-xs font-medium truncate">{row.name.split(" ")[0]}</div>
            {row.days.map((v, i) => (
              <div key={i} className="flex-1 flex items-center justify-center">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                  v ? "bg-emerald-500/80 text-white" : "bg-white/[0.03] text-white/20"
                }`}>{v ? "✓" : "✗"}</div>
              </div>
            ))}
            <div className={`w-12 text-right text-xs font-bold font-mono ${
              row.rate >= 80 ? "text-emerald-400" : row.rate >= 50 ? "text-[#f59e0b]" : "text-red-400"
            }`}>{row.rate}%</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ── GROUP PERFORMANCE ── */
function GroupPerformance({ roster }: { roster: Athlete[] }) {
  const groups = useMemo(() => {
    return ROSTER_GROUPS.map(g => {
      const members = roster.filter(a => a.group === g.id);
      if (members.length === 0) return null;
      const avgXP = Math.round(members.reduce((s, a) => s + a.xp, 0) / members.length);
      const avgStreak = (members.reduce((s, a) => s + a.streak, 0) / members.length).toFixed(1);
      const presentCount = members.filter(a => a.present).length;
      const attRate = members.length ? Math.round((presentCount / members.length) * 100) : 0;
      const totalPractices = Math.round(members.reduce((s, a) => s + a.totalPractices, 0) / members.length);
      return { ...g, members: members.length, avgXP, avgStreak, attRate, totalPractices };
    }).filter(Boolean) as (typeof ROSTER_GROUPS[number] & { members: number; avgXP: number; avgStreak: string; attRate: number; totalPractices: number })[];
  }, [roster]);

  if (groups.length === 0) return null;

  return (
    <Card className="p-6 mb-6">
      <h3 className="text-white/60 text-[11px] uppercase tracking-[0.15em] font-bold mb-5">Training Group Performance</h3>
      <div className="space-y-4">
        {groups.map(g => (
          <div key={g.id} className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-4" style={{ borderLeftWidth: 3, borderLeftColor: g.color }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{g.icon}</span>
              <span className="text-white font-bold text-sm" style={{ color: g.color }}>{g.name}</span>
              <span className="text-white/40 text-xs ml-auto font-mono">{g.members} athletes</span>
            </div>
            <div className="text-white/50 text-[10px] font-mono mb-3">{g.sport}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 rounded-lg bg-white/[0.02]">
                <div className="text-xl font-black tabular-nums" style={{ color: g.color }}>{g.avgXP}</div>
                <div className="text-white/40 text-[10px] uppercase">Avg XP</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/[0.02]">
                <div className="text-xl font-black tabular-nums text-emerald-400">{g.attRate}%</div>
                <div className="text-white/40 text-[10px] uppercase">Attendance</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/[0.02]">
                <div className="text-xl font-black tabular-nums text-white">{g.avgStreak}</div>
                <div className="text-white/40 text-[10px] uppercase">Avg Streak</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/[0.02]">
                <div className="text-xl font-black tabular-nums text-[#a855f7]">{g.totalPractices}</div>
                <div className="text-white/40 text-[10px] uppercase">Avg Sessions</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ── SEASON REPORT ── */
function SeasonReport({ roster, snapshots, avgAtt, avgXP, mostImproved }: {
  roster: Athlete[]; snapshots: DailySnapshot[];
  avgAtt: (s: DailySnapshot[]) => number; avgXP: (s: DailySnapshot[]) => number;
  mostImproved: Athlete | null;
}) {
  const totalXP = roster.reduce((s, a) => s + a.xp, 0);
  const avgAttRate = avgAtt(snapshots.slice(-30));
  const avgXPDay = avgXP(snapshots.slice(-30));
  const topAthlete = [...roster].sort((a, b) => b.xp - a.xp)[0];
  const longestStreak = [...roster].sort((a, b) => b.streak - a.streak)[0];
  const champPlus = roster.filter(a => {
    const lv = getLevel(a.xp, getSportForAthlete(a));
    return ["Champion", "Legend"].includes(lv.name);
  }).length;

  const exportReport = useCallback(() => {
    let text = `METTLE TEAM REPORT\n`;
    text += `Generated ${new Date().toLocaleDateString()}\n`;
    text += `${"=".repeat(40)}\n\n`;
    text += `ATHLETES: ${roster.length}\n`;
    text += `TOTAL XP: ${totalXP.toLocaleString()}\n`;
    text += `30-DAY ATTENDANCE: ${avgAttRate}%\n`;
    text += `AVG XP/DAY: ${avgXPDay}\n\n`;
    text += `TOP ATHLETE: ${topAthlete?.name || "N/A"} (${topAthlete?.xp || 0} XP)\n`;
    text += `LONGEST STREAK: ${longestStreak?.name || "N/A"} (${longestStreak?.streak || 0} days)\n`;
    text += `CHAMPION+ ATHLETES: ${champPlus}\n`;
    if (mostImproved) text += `MOST IMPROVED: ${mostImproved.name}\n`;
    text += `\nGROUPS:\n`;
    ROSTER_GROUPS.forEach(g => {
      const m = roster.filter(a => a.group === g.id);
      if (m.length === 0) return;
      const gAvg = Math.round(m.reduce((s, a) => s + a.xp, 0) / m.length);
      text += `  ${g.name}: ${m.length} athletes, ${gAvg} avg XP\n`;
    });
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mettle-team-report.txt";
    a.click();
  }, [roster, totalXP, avgAttRate, avgXPDay, topAthlete, longestStreak, champPlus, mostImproved]);

  return (
    <Card className="p-6 mb-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-white/60 text-[11px] uppercase tracking-[0.15em] font-bold">Season Report</h3>
        <button onClick={exportReport}
          className="text-[#00f0ff]/60 text-xs font-mono hover:text-[#00f0ff] transition-all px-3 py-1.5 border border-[#00f0ff]/15 rounded-lg min-h-[32px]">
          Export Text
        </button>
      </div>
      <div className="space-y-4 text-sm text-white/70 leading-relaxed">
        <p>
          The team has <span className="text-white font-bold">{roster.length} active athletes</span> across{" "}
          {ROSTER_GROUPS.filter(g => roster.some(a => a.group === g.id)).length} training groups,
          accumulating <span className="text-[#f59e0b] font-bold">{totalXP.toLocaleString()} total XP</span> through the METTLE gamification system.
        </p>
        <p>
          <span className="text-white font-semibold">Attendance:</span> The 30-day average sits at{" "}
          <span className="text-emerald-400 font-bold">{avgAttRate}%</span> with{" "}
          <span className="text-[#a855f7] font-bold">{avgXPDay} XP/day</span> average team output.
          {longestStreak && (
            <> The longest active streak belongs to <span className="text-white font-semibold">{longestStreak.name}</span> at {longestStreak.streak} days.</>
          )}
        </p>
        <p>
          <span className="text-white font-semibold">Standout:</span>{" "}
          {topAthlete && (
            <><span className="text-[#f59e0b] font-bold">{topAthlete.name}</span> leads the team with {topAthlete.xp.toLocaleString()} XP at the {getLevel(topAthlete.xp, getSportForAthlete(topAthlete)).name} level. </>
          )}
          <span className="text-white font-semibold">{champPlus}</span> athlete{champPlus !== 1 ? "s have" : " has"} reached Champion or Legend status.
        </p>
        {mostImproved && (
          <p className="pt-2 border-t border-white/[0.04] text-emerald-400 font-medium">
            Most Improved: {mostImproved.name}
          </p>
        )}
      </div>
    </Card>
  );
}

/* ── BEST TIMES SUB-COMPONENT ── */
function BestTimesSection({ roster }: { roster: Athlete[] }) {
  const [showAll, setShowAll] = useState(false);
  const athletesWithTimes = useMemo(() => {
    return roster
      .filter(a => a.bestTimes && Object.keys(a.bestTimes).length > 0)
      .map(a => {
        const events = Object.entries(a.bestTimes!).map(([event, data]) => ({ event, ...data }));
        return { ...a, events };
      })
      .sort((a, b) => b.events.length - a.events.length);
  }, [roster]);

  const displayed = showAll ? athletesWithTimes : athletesWithTimes.slice(0, 5);

  if (athletesWithTimes.length === 0) return null;

  return (
    <Card className="p-6 mb-6">
      <h3 className="text-white/60 text-[11px] uppercase tracking-[0.15em] font-bold mb-5">Best Times & Records</h3>
      <p className="text-white/50 text-xs mb-4 font-mono">Personal bests across all events with meet source data.</p>
      <div className="space-y-4">
        {displayed.map(a => {
          const lv = getLevel(a.xp, getSportForAthlete(a));
          return (
            <div key={a.id} className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: `${lv.color}15`, border: `1px solid ${lv.color}30`, color: lv.color }}>
                  {a.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <div className="text-white text-sm font-medium">{a.name}</div>
                  <div className="text-white/50 text-[10px] font-mono">{lv.name} · {a.events.length} events</div>
                </div>
              </div>
              <div className="space-y-1.5">
                {a.events.slice(0, 4).map(ev => (
                  <div key={ev.event} className="flex items-center justify-between text-xs">
                    <span className="text-white/60">{ev.event}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold font-mono">{ev.time}</span>
                      <span className="text-white/30 text-[10px]">{ev.course}</span>
                      {ev.source && <span className="text-[#a855f7]/60 text-[10px]">{ev.source}</span>}
                    </div>
                  </div>
                ))}
                {a.events.length > 4 && (
                  <div className="text-white/30 text-[10px] font-mono">+{a.events.length - 4} more events</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {athletesWithTimes.length > 5 && (
        <button onClick={() => setShowAll(!showAll)}
          className="mt-4 text-[#00f0ff]/60 text-xs font-mono hover:text-[#00f0ff] transition-all min-h-[44px] w-full text-center">
          {showAll ? "Show less" : `Show all ${athletesWithTimes.length} athletes`}
        </button>
      )}
    </Card>
  );
}
