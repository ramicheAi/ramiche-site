"use client";
import React from "react";

interface Coach {
  id: string;
  name: string;
  pin: string;
  role: "head" | "assistant";
  groups: string[];
  email?: string;
}

interface RosterGroup {
  id: string;
  name: string;
  icon: string;
  color: string;
  sport?: string;
}

interface StaffViewProps {
  isAdmin: boolean;
  coaches: Coach[];
  editingCoachId: string | null;
  setEditingCoachId: (id: string | null) => void;
  removeCoach: (id: string) => void;
  updateCoach: (id: string, updates: Partial<Coach>) => void;
  addCoach: () => void;
  ROSTER_GROUPS: readonly RosterGroup[];
  newCoachName: string;
  setNewCoachName: (v: string) => void;
  newCoachEmail: string;
  setNewCoachEmail: (v: string) => void;
  newCoachRole: "head" | "assistant";
  setNewCoachRole: (v: "head" | "assistant") => void;
  newCoachGroups: readonly string[] | string[];
  setNewCoachGroups: React.Dispatch<React.SetStateAction<any>>;
  addCoachOpen: boolean;
  setAddCoachOpen: (v: boolean) => void;
  toggleCoachGroup: (groupId: string) => void;
  GameHUDHeader: React.ComponentType;
  BgOrbs: React.ComponentType;
}

export default function StaffView({
  isAdmin, coaches, editingCoachId, setEditingCoachId, removeCoach, updateCoach, addCoach,
  ROSTER_GROUPS, newCoachName, setNewCoachName, newCoachEmail, setNewCoachEmail,
  newCoachRole, setNewCoachRole, newCoachGroups, setNewCoachGroups,
  addCoachOpen, setAddCoachOpen, toggleCoachGroup, GameHUDHeader, BgOrbs
}: StaffViewProps) {
  return (
    <div className="min-h-screen bg-[#06020f] text-white relative overflow-x-hidden">
      <BgOrbs />
      <div className="w-full relative z-10 px-4 sm:px-6 lg:px-8 xl:px-10">
        <GameHUDHeader />
        <h2 className="text-2xl font-black tracking-tight neon-text-cyan mb-1">Coach Staff</h2>
        <p className="text-[#00f0ff]/25 text-xs mb-8 font-mono">Manage coaching staff &amp; group access</p>

        {/* Current coaches list */}
        <div className="space-y-4 mb-8">
          {coaches.length === 0 && (
            <div className="game-panel game-panel-border bg-[#06020f]/80 backdrop-blur-2xl p-8 text-center">
              <p className="text-white/60 text-sm font-mono">No coaches added yet.</p>
              <p className="text-white/40 text-xs font-mono mt-2">Master PIN has full access to all groups.</p>
            </div>
          )}
          {coaches.map(c => {
            const isEditing = editingCoachId === c.id;
            return (
              <div key={c.id} className="game-panel game-panel-border bg-[#06020f]/80 backdrop-blur-2xl border border-[#00f0ff]/10 p-5" style={{ isolation: 'isolate' }}>
                <div className="relative z-[5] flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black ${
                      c.role === "head" ? "bg-[#f59e0b]/20 border border-[#f59e0b]/30 text-[#f59e0b]" : "bg-[#00f0ff]/10 border border-[#00f0ff]/20 text-[#00f0ff]"
                    }`}>
                      {c.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-white font-bold text-sm">{c.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          c.role === "head" ? "bg-[#f59e0b]/15 text-[#f59e0b]" : "bg-[#00f0ff]/10 text-[#00f0ff]/70"
                        }`}>
                          {c.role === "head" ? "HEAD COACH" : "ASSISTANT"}
                        </span>
                        <span className="text-white/50 text-xs font-mono">PIN: {c.pin}</span>
                      </div>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button onClick={() => setEditingCoachId(isEditing ? null : c.id)}
                        className="game-btn px-3 py-1.5 text-xs font-mono tracking-wider text-white/60 border border-white/[0.06] hover:text-[#00f0ff]/60 hover:border-[#00f0ff]/20 transition-all min-h-[32px]">
                        {isEditing ? "CANCEL" : "EDIT"}
                      </button>
                      <button onClick={() => removeCoach(c.id)}
                        className="game-btn px-3 py-1.5 text-xs font-mono tracking-wider text-red-400/30 border border-red-400/10 hover:text-red-400/70 hover:border-red-400/30 transition-all min-h-[32px]">
                        REMOVE
                      </button>
                    </div>
                  )}
                </div>

                {/* Group assignments */}
                <div className="mt-3">
                  <span className="text-white/60 text-xs font-mono uppercase tracking-wider">Groups: </span>
                  {c.role === "head" ? (
                    <span className="text-[#f59e0b]/60 text-xs font-mono">ALL GROUPS (Head Coach)</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {ROSTER_GROUPS.map(g => {
                        const assigned = c.groups.includes(g.id);
                        if (isEditing) {
                          return (
                            <button key={g.id} onClick={() => {
                              const newGroups = assigned ? c.groups.filter(x => x !== g.id) : [...c.groups, g.id];
                              updateCoach(c.id, { groups: newGroups });
                              setEditingCoachId(c.id);
                            }}
                              className={`px-2.5 py-1 text-xs font-mono rounded-md transition-all min-h-[28px] ${
                                assigned
                                  ? "bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30"
                                  : "bg-white/[0.03] text-white/60 border border-white/[0.06] hover:border-[#00f0ff]/20"
                              }`}>
                              {g.icon} {g.name}
                            </button>
                          );
                        }
                        return assigned ? (
                          <span key={g.id} className="px-2.5 py-1 text-xs font-mono bg-[#00f0ff]/10 text-[#00f0ff]/60 rounded-md border border-[#00f0ff]/15">
                            {g.icon} {g.name}
                          </span>
                        ) : null;
                      })}
                      {c.groups.length === 0 && !isEditing && (
                        <span className="text-red-400/40 text-xs font-mono">No groups assigned</span>
                      )}
                    </div>
                  )}
                </div>

                {c.email && (
                  <div className="mt-2 text-white/50 text-xs font-mono">{c.email}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add Coach Form */}
        {isAdmin && (
          <div className="mb-10">
            {!addCoachOpen ? (
              <button onClick={() => setAddCoachOpen(true)}
                className="game-btn px-5 py-3 bg-gradient-to-r from-[#00f0ff]/15 to-[#a855f7]/15 border border-[#00f0ff]/20 text-[#00f0ff]/70 text-sm font-mono tracking-wider hover:shadow-[0_0_20px_rgba(0,240,255,0.2)] transition-all min-h-[44px]">
                + ADD COACH
              </button>
            ) : (
              <div className="game-panel game-panel-border bg-[#06020f]/80 backdrop-blur-2xl border border-[#00f0ff]/20 p-6 space-y-4" style={{ isolation: 'isolate' }}>
                <div className="relative z-[5] space-y-4">
                <h3 className="text-[#00f0ff]/40 text-[11px] uppercase tracking-[0.2em] font-bold font-mono">// Add New Coach</h3>

                <div>
                  <label className="text-white/60 text-xs font-mono uppercase tracking-wider block mb-1.5">Name</label>
                  <input value={newCoachName} onChange={e => setNewCoachName(e.target.value)}
                    placeholder="Coach name"
                    className="relative z-10 w-full bg-[#06020f]/80 border border-white/[0.08] rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-[#00f0ff]/40 focus:ring-1 focus:ring-[#00f0ff]/20 transition-all min-h-[44px] font-mono"
                    style={{ fontSize: '16px', WebkitAppearance: 'none' }} />
                </div>

                <div>
                  <label className="text-white/60 text-xs font-mono uppercase tracking-wider block mb-1.5">Email (optional)</label>
                  <input value={newCoachEmail} onChange={e => setNewCoachEmail(e.target.value)}
                    placeholder="coach@email.com" type="email"
                    className="relative z-10 w-full bg-[#06020f]/80 border border-white/[0.08] rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-[#00f0ff]/40 focus:ring-1 focus:ring-[#00f0ff]/20 transition-all min-h-[44px] font-mono"
                    style={{ fontSize: '16px', WebkitAppearance: 'none' }} />
                </div>

                <div>
                  <label className="text-white/60 text-xs font-mono uppercase tracking-wider block mb-1.5">Role</label>
                  <div className="flex gap-2">
                    {(["head", "assistant"] as const).map(r => (
                      <button key={r} onClick={() => setNewCoachRole(r)}
                        className={`game-btn flex-1 px-4 py-3 text-sm font-mono tracking-wider transition-all min-h-[44px] ${
                          newCoachRole === r
                            ? r === "head"
                              ? "bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/40"
                              : "bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40"
                            : "bg-[#06020f]/60 text-white/60 border border-white/[0.08] hover:text-white/50"
                        }`}>
                        {r === "head" ? "HEAD COACH" : "ASSISTANT"}
                      </button>
                    ))}
                  </div>
                </div>

                {newCoachRole === "assistant" && (
                  <div>
                    <label className="text-white/60 text-xs font-mono uppercase tracking-wider block mb-1.5">Assign Groups</label>
                    <div className="flex flex-wrap gap-2">
                      {ROSTER_GROUPS.map(g => (
                        <button key={g.id} onClick={() => toggleCoachGroup(g.id)}
                          className={`game-btn px-3 py-2 text-xs font-mono transition-all min-h-[36px] ${
                            newCoachGroups.includes(g.id)
                              ? "bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30"
                              : "bg-[#06020f]/60 text-white/60 border border-white/[0.06] hover:border-[#00f0ff]/20"
                          }`}>
                          {g.icon} {g.name}
                        </button>
                      ))}
                    </div>
                    {newCoachGroups.length === 0 && (
                      <p className="text-[#f59e0b]/40 text-xs font-mono mt-1">Select at least one group</p>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={addCoach}
                    disabled={!newCoachName.trim() || (newCoachRole === "assistant" && newCoachGroups.length === 0)}
                    className="game-btn flex-1 py-3 bg-gradient-to-r from-[#00f0ff]/20 to-[#a855f7]/20 border border-[#00f0ff]/30 text-[#00f0ff] font-bold text-sm tracking-widest uppercase hover:shadow-[0_0_20px_rgba(0,240,255,0.3)] transition-all min-h-[44px] disabled:opacity-30 disabled:cursor-not-allowed">
                    ADD COACH
                  </button>
                  <button onClick={() => { setAddCoachOpen(false); setNewCoachName(""); setNewCoachEmail(""); setNewCoachRole("assistant"); setNewCoachGroups([]); }}
                    className="game-btn px-4 py-3 text-white/60 border border-white/[0.06] text-sm font-mono hover:text-white/40 transition-all min-h-[44px]">
                    CANCEL
                  </button>
                </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Access control info */}
        <div className="game-panel game-panel-border bg-[#06020f]/80 backdrop-blur-2xl border border-[#a855f7]/10 p-5 mb-10">
          <h3 className="text-[#a855f7]/40 text-[11px] uppercase tracking-[0.2em] font-bold font-mono mb-3">// Access Control</h3>
          <div className="space-y-2 text-[11px] text-white/60 font-mono">
            <p><span className="text-[#f59e0b]/60">Master PIN</span> — Full admin access to all groups</p>
            <p><span className="text-[#f59e0b]/60">Head Coach</span> — Access to all groups</p>
            <p><span className="text-[#00f0ff]/60">Assistant</span> — Access only to assigned groups</p>
          </div>
        </div>
      </div>
    </div>
  );
}
