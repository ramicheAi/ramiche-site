"use client";
import { useState, useEffect, useCallback } from "react";

interface Athlete {
  name: string;
  group: string;
  present: boolean;
  xp: number;
  streak: number;
  level: number;
  pin?: string;
}

interface Props {
  roster: Athlete[];
  onCheckin: (name: string) => void;
}

const LEVEL_NAMES = ["Rookie", "Contender", "Warrior", "Elite", "Captain", "Legend"];
const LEVEL_COLORS = ["#2563EB", "#4338CA", "#6B21A8", "#D97706", "#DC2626", "#6B21A8"];

export default function AthleteCheckinKiosk({ roster, onCheckin }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<Athlete | null>(null);
  const [tab, setTab] = useState<"checkin" | "roster" | "leaderboard" | "stats">("checkin");
  const [search, setSearch] = useState("");
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const iv = setInterval(tick, 30000);
    return () => clearInterval(iv);
  }, []);

  const enterDigit = useCallback((d: string) => {
    if (pin.length >= 4) return;
    setPin(p => p + d);
    setError("");
  }, [pin]);

  const clearPin = () => { setPin(""); setError(""); };
  const backspace = () => setPin(p => p.slice(0, -1));

  const doCheckin = useCallback(() => {
    if (pin.length !== 4) return;
    const found = roster.find(a => a.pin === pin);
    if (!found) { setError("PIN not found. Try again."); setPin(""); return; }
    if (found.present) { setError(`${found.name} is already checked in.`); setPin(""); return; }
    onCheckin(found.name);
    setSuccess(found);
    setPin("");
    setTimeout(() => setSuccess(null), 4000);
  }, [pin, roster, onCheckin]);

  useEffect(() => { if (pin.length === 4) doCheckin(); }, [pin, doCheckin]);

  const presentCount = roster.filter(a => a.present).length;
  const filteredRoster = roster.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));
  const sorted = [...roster].sort((a, b) => b.streak - a.streak || b.xp - a.xp);

  const tabs = [
    { id: "checkin" as const, label: "Check In", icon: "🏊" },
    { id: "roster" as const, label: "Roster", icon: "📋" },
    { id: "leaderboard" as const, label: "Streaks", icon: "🔥" },
    { id: "stats" as const, label: "Stats", icon: "📊" },
  ];

  return (
    <div className="w-full min-h-[70vh]">
      {/* Header */}
      <div className="rounded-xl p-5 mb-4" style={{ background: "linear-gradient(135deg, #6B21A8, #7C3AED)" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-wide">METTLE</h2>
            <p className="text-xs text-white/70 mt-0.5">Athlete Check-In Kiosk</p>
          </div>
          <div className="text-3xl font-bold text-white tabular-nums">{clock}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b-2 border-white/10 mb-4">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-center text-sm font-semibold transition-all border-b-2 ${
              tab === t.id ? "text-[#a855f7] border-[#a855f7]" : "text-[#f8fafc]/40 border-transparent hover:text-[#f8fafc]/60"
            }`}>
            <span className="mr-1">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* CHECK-IN TAB */}
      {tab === "checkin" && !success && (
        <div className="max-w-sm mx-auto text-center">
          <div className="text-5xl mb-3">🏊</div>
          <h3 className="text-xl font-bold text-[#f8fafc]">Welcome to Practice</h3>
          <p className="text-sm text-[#f8fafc]/50 mt-1 mb-6">Enter your 4-digit athlete PIN</p>

          {/* PIN display */}
          <div className="flex gap-3 justify-center mb-4">
            {[0,1,2,3].map(i => (
              <div key={i} className={`w-14 h-16 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                pin[i] ? "border-[#a855f7] text-[#a855f7] bg-[#a855f7]/10" : "border-white/10 text-[#f8fafc]/30"
              }`}>
                {pin[i] ? "●" : ""}
              </div>
            ))}
          </div>

          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <button key={n} onClick={() => enterDigit(String(n))}
                className="py-4 text-xl font-semibold rounded-xl border-2 border-white/10 text-[#f8fafc] hover:border-[#a855f7]/50 hover:bg-[#a855f7]/10 active:scale-95 transition-all touch-manipulation">
                {n}
              </button>
            ))}
            <button onClick={clearPin} className="py-4 text-sm font-bold rounded-xl border-2 border-white/10 text-red-400 hover:border-red-400/30 active:scale-95 transition-all touch-manipulation">CLEAR</button>
            <button onClick={() => enterDigit("0")} className="py-4 text-xl font-semibold rounded-xl border-2 border-white/10 text-[#f8fafc] hover:border-[#a855f7]/50 hover:bg-[#a855f7]/10 active:scale-95 transition-all touch-manipulation">0</button>
            <button onClick={backspace} className="py-4 text-xl font-semibold rounded-xl border-2 border-white/10 text-[#f8fafc]/60 hover:border-white/20 active:scale-95 transition-all touch-manipulation">⌫</button>
          </div>
        </div>
      )}

      {/* SUCCESS OVERLAY */}
      {tab === "checkin" && success && (
        <div className="max-w-sm mx-auto text-center animate-fadeIn">
          <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-4">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h3 className="text-2xl font-extrabold text-emerald-400">Checked In!</h3>
          <p className="text-lg font-semibold text-[#f8fafc] mt-1">{success.name}</p>
          <div className="inline-block mt-3 px-5 py-2 rounded-full text-base font-bold text-white" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 0 20px rgba(245,158,11,0.4)" }}>
            +25 XP
          </div>
          <div className="mt-4 p-3 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/10">
            <div className="text-3xl font-extrabold text-emerald-400">{success.streak + 1}</div>
            <div className="text-xs text-[#f8fafc]/50 uppercase tracking-widest">Day Streak</div>
          </div>
          <p className="text-sm text-[#f8fafc]/50 mt-3">Level: <strong className="text-[#a855f7]">{LEVEL_NAMES[Math.min(success.level, 5)]}</strong></p>
        </div>
      )}

      {/* ROSTER TAB */}
      {tab === "roster" && (
        <div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full p-3 rounded-xl border-2 border-white/10 bg-white/5 text-[#f8fafc] placeholder:text-[#f8fafc]/30 mb-4 focus:border-[#a855f7]/50 outline-none"
            placeholder="Search athletes..." />
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-[#f8fafc]">Today&apos;s Practice</h3>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#a855f7] text-white">{presentCount} / {roster.length}</span>
          </div>
          <div className="space-y-2">
            {filteredRoster.map(a => (
              <div key={a.name} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                a.present ? "border-emerald-500/30 bg-emerald-500/10" : "border-white/10"
              }`}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm" style={{ background: LEVEL_COLORS[Math.min(a.level, 5)] }}>
                  {a.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-[#f8fafc] truncate">{a.name}</div>
                  <div className="text-xs text-[#f8fafc]/40">{a.group} · {a.xp} XP · {a.streak}🔥</div>
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded-lg ${a.present ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-[#f8fafc]/30"}`}>
                  {a.present ? "IN" : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LEADERBOARD TAB */}
      {tab === "leaderboard" && (
        <div className="space-y-2">
          {sorted.slice(0, 15).map((a, i) => {
            const medal = i === 0 ? "border-[#f59e0b] bg-[#f59e0b]/10" : i === 1 ? "border-gray-400 bg-gray-400/10" : i === 2 ? "border-[#d97706] bg-[#d97706]/10" : "border-white/10";
            return (
              <div key={a.name} className={`flex items-center gap-3 p-3.5 rounded-xl border-2 ${medal}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-sm text-white ${
                  i === 0 ? "bg-[#f59e0b]" : i === 1 ? "bg-gray-400" : i === 2 ? "bg-[#d97706]" : "bg-white/10 !text-[#f8fafc]/40"
                }`}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-[#f8fafc] truncate">{a.name}</div>
                  <div className="text-xs text-[#f8fafc]/40">{a.streak} day streak</div>
                </div>
                <div className="font-bold text-[#f59e0b] text-sm">{a.xp} XP</div>
              </div>
            );
          })}
        </div>
      )}

      {/* STATS TAB */}
      {tab === "stats" && (
        <div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: "Present", val: presentCount, color: "#a855f7" },
              { label: "Absent", val: roster.length - presentCount, color: "#DC2626" },
              { label: "Total XP Today", val: roster.reduce((s, a) => s + a.xp, 0), color: "#f59e0b" },
              { label: "Avg Streak", val: Math.round(roster.reduce((s, a) => s + a.streak, 0) / (roster.length || 1)), color: "#10B981" },
            ].map(s => (
              <div key={s.label} className="p-4 rounded-xl border-2 border-white/10 text-center">
                <div className="text-2xl font-extrabold" style={{ color: s.color }}>{s.val}</div>
                <div className="text-xs text-[#f8fafc]/40 uppercase tracking-widest mt-1">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="p-4 rounded-xl border-2 border-white/10">
            <h4 className="text-sm font-bold text-[#f8fafc] mb-3">Attendance This Week</h4>
            <div className="flex gap-1">
              {["Mon","Tue","Wed","Thu","Fri"].map((d, i) => {
                const rate = Math.random(); // placeholder — replace with real data
                return (
                  <div key={d} className="flex-1 text-center">
                    <div className="h-7 rounded-md mb-1" style={{ background: rate > 0.5 ? "#DCFCE7" : rate > 0 ? "#FEE2E2" : "#1c1917" }} />
                    <div className="text-[10px] text-[#f8fafc]/30">{d}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
