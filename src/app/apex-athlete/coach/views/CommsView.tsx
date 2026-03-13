"use client";

import React, { useState } from "react";
import BgOrbs from "../components/BgOrbs";

const Card = ({ children, className = "", neon = false }: { children: React.ReactNode; className?: string; neon?: boolean }) => (
  <div style={{animation: 'glowBreathe 4s ease-in-out infinite'}} className={`game-panel game-panel-border game-panel-scan relative bg-[#06020f]/80 backdrop-blur-xl border border-[#00f0ff]/15 transition-all duration-300 hover:border-[#00f0ff]/30 hover:-translate-y-[1px] ${neon ? "shadow-[0_0_30px_rgba(0,240,255,0.1)]" : "shadow-[0_4px_24px_rgba(0,0,0,0.4)]"} ${className}`}>{children}</div>
);

interface Broadcast {
  id: string;
  message: string;
  timestamp: string;
  from: string;
  group: string;
}

interface AbsenceReport {
  id: string;
  athleteId: string;
  athleteName: string;
  reason: string;
  dateStart: string;
  dateEnd: string;
  note: string;
  submitted: string;
  group: string;
}

interface RosterGroup {
  id: string;
  name: string;
}

interface CommsViewProps {
  GameHUDHeader: React.ComponentType;
  commsMsg: string;
  setCommsMsg: (v: string) => void;
  commsGroup: string;
  setCommsGroup: (v: string) => void;
  allBroadcasts: Broadcast[];
  setAllBroadcasts: (v: Broadcast[]) => void;
  absenceReports: AbsenceReport[];
  ROSTER_GROUPS: readonly RosterGroup[];
}

export default function CommsView({
  GameHUDHeader, commsMsg, setCommsMsg, commsGroup, setCommsGroup,
  allBroadcasts, setAllBroadcasts, absenceReports, ROSTER_GROUPS,
}: CommsViewProps) {
  const BROADCAST_KEY = "apex-broadcasts-v1";

  const sendBroadcast = () => {
    if (!commsMsg.trim()) return;
    const bc: Broadcast = { id: `bc-${Date.now()}`, message: commsMsg, timestamp: new Date().toISOString(), from: "Coach", group: commsGroup };
    const updated = [...allBroadcasts, bc];
    setAllBroadcasts(updated);
    localStorage.setItem(BROADCAST_KEY, JSON.stringify(updated));
    setCommsMsg("");
  };

  return (
    <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
      <BgOrbs />
      <div className="w-full relative z-10 px-4 sm:px-6 lg:px-8 xl:px-10 pb-12">
        <GameHUDHeader />
        <h2 className="text-2xl font-black tracking-tight neon-text-cyan mb-1">Communications</h2>
        <p className="text-[#00f0ff]/30 text-xs font-mono mb-6">Broadcast to parents · View absence reports</p>

        {/* Send broadcast */}
        <Card className="p-5 mb-6" neon>
          <h3 className="text-sm font-bold text-white/60 mb-3 uppercase tracking-wider">Send to Parents</h3>
          <div className="flex gap-2 mb-3">
            <select value={commsGroup} onChange={e => setCommsGroup(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00f0ff]/40">
              <option value="all">All Groups</option>
              {ROSTER_GROUPS.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <input value={commsMsg} onChange={e => setCommsMsg(e.target.value)} placeholder="Type a message for parents..."
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/60 focus:outline-none focus:border-[#00f0ff]/40" style={{ fontSize: "16px" }}
              onKeyDown={e => { if (e.key === "Enter") sendBroadcast(); }} />
            <button onClick={sendBroadcast} disabled={!commsMsg.trim()}
              className="game-btn px-5 py-2.5 text-sm font-bold text-[#00f0ff] border border-[#00f0ff]/30 rounded-lg hover:bg-[#00f0ff]/10 disabled:opacity-30 transition-all">
              Send
            </button>
          </div>
        </Card>

        {/* Sent messages */}
        <Card className="p-5 mb-6" neon>
          <h3 className="text-sm font-bold text-white/60 mb-3 uppercase tracking-wider">Sent Messages</h3>
          {allBroadcasts.length === 0 ? (
            <p className="text-white/50 text-sm text-center py-4">No messages sent yet</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {allBroadcasts.slice().reverse().map(bc => (
                <div key={bc.id} className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-3">
                  <p className="text-sm text-white/70">{bc.message}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-white/60">
                    <span>{new Date(bc.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    <span>{new Date(bc.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="text-[#a855f7]">{bc.group === "all" ? "All Groups" : ROSTER_GROUPS.find(g => g.id === bc.group)?.name || bc.group}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Absence reports from parents */}
        <Card className="p-5" neon>
          <h3 className="text-sm font-bold text-white/60 mb-3 uppercase tracking-wider">Absence Reports</h3>
          {absenceReports.length === 0 ? (
            <p className="text-white/50 text-sm text-center py-4">No absences reported</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {absenceReports.slice().reverse().map(ab => (
                <div key={ab.id} className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white">{ab.athleteName}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-400/10 text-red-400">{ab.reason}</span>
                  </div>
                  <p className="text-xs text-white/60">{ab.dateStart}{ab.dateEnd !== ab.dateStart ? ` – ${ab.dateEnd}` : ""}</p>
                  {ab.note && <p className="text-xs text-white/60 mt-1">{ab.note}</p>}
                  <p className="text-xs text-white/40 mt-1">Reported: {new Date(ab.submitted).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
