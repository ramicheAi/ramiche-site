"use client";

import React from "react";
import type { AuditEntry } from "../types";

interface AuditViewProps {
  auditLog: AuditEntry[];
  GameHUDHeader: React.ComponentType;
  BgOrbs: React.ComponentType;
}

export default function AuditView({ auditLog, GameHUDHeader, BgOrbs }: AuditViewProps) {
  return (
    <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
      <BgOrbs />
      <div className="w-full relative z-10 px-4 sm:px-6 lg:px-8 xl:px-10">
        <GameHUDHeader />
        <h2 className="text-2xl font-black tracking-tight neon-text-cyan mb-6">Audit Log</h2>
        <div className="game-panel game-panel-border bg-[#06020f]/80 backdrop-blur-2xl p-2 max-h-[70vh] overflow-y-auto shadow-[0_8px_60px_rgba(0,0,0,0.4)]">
          {!auditLog.length && <p className="text-white/60 text-sm p-6 font-mono">No actions recorded yet.</p>}
          {auditLog.slice(0, 200).map((e, i) => (
            <div key={i} className="flex items-center gap-3 py-3 px-5 text-sm hover:bg-[#00f0ff]/[0.03] transition-colors border-b border-[#00f0ff]/5 last:border-0">
              <span className="text-[#00f0ff]/25 text-xs w-36 shrink-0 font-mono">{new Date(e.timestamp).toLocaleString()}</span>
              <span className="text-white/50 flex-1 truncate font-mono">{e.athleteName}: {e.action}</span>
              {e.xpDelta > 0 && <span className="neon-text-gold font-bold text-sm font-mono">+{e.xpDelta}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
