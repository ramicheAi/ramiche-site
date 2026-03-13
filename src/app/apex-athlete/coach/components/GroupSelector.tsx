"use client";

import React from "react";

export interface RosterGroup {
  readonly id: string;
  readonly name: string;
  readonly sport: string;
  readonly color: string;
  readonly icon: string;
}

interface GroupSelectorProps<T extends string = string> {
  groups: readonly (RosterGroup & { readonly id: T })[];
  accessibleGroups: T[];
  selectedGroup: T;
  roster: { group: string }[];
  currentGroupDef: RosterGroup;
  filteredRosterCount: number;
  onSwitchGroup: (groupId: T) => void;
}

export default function GroupSelector<T extends string = string>({
  groups,
  accessibleGroups,
  selectedGroup,
  roster,
  currentGroupDef,
  filteredRosterCount,
  onSwitchGroup,
}: GroupSelectorProps<T>) {
  return (
    <div className="py-4">
      <div className="flex flex-wrap gap-2 justify-center">
        {groups.filter(g => accessibleGroups.includes(g.id)).map(g => {
          const isActive = selectedGroup === g.id;
          const count = roster.filter(a => a.group === g.id).length;
          return (
            <button key={g.id} onClick={() => onSwitchGroup(g.id)}
              className={`game-btn px-4 py-3 text-xs sm:text-sm font-bold font-mono tracking-wider transition-all min-h-[44px] ${
                isActive
                  ? "bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40 shadow-[0_0_20px_rgba(0,240,255,0.3)]"
                  : "bg-[#06020f]/60 text-white/60 border border-white/10 hover:text-[#00f0ff]/60 hover:border-[#00f0ff]/20"
              }`}>
              <span className="mr-1">{g.icon}</span>
              <span>{g.name.toUpperCase()}</span>
              <span className="ml-2 text-xs opacity-60">{count}</span>
            </button>
          );
        })}
      </div>
      <div className="text-center mt-3 text-xs font-mono text-white/60">
        {currentGroupDef.icon} {currentGroupDef.name} — {currentGroupDef.sport.toUpperCase()} — {filteredRosterCount} athletes
      </div>
    </div>
  );
}
