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
    <div className="py-8">
      <div className="flex flex-wrap gap-4 justify-center px-4">
        {groups.filter(g => accessibleGroups.includes(g.id)).map(g => {
          const isActive = selectedGroup === g.id;
          const count = roster.filter(a => a.group === g.id).length;
          return (
            <button key={g.id} onClick={() => onSwitchGroup(g.id)}
              className={`game-btn px-6 py-4 text-xs sm:text-sm font-bold font-mono tracking-wider transition-all duration-200 min-h-[52px] min-w-[140px] rounded-xl ${
                isActive
                  ? "bg-[#00f0ff]/15 text-[#00f0ff] border-2 border-[#00f0ff]/40 shadow-[0_0_24px_rgba(0,240,255,0.25)]"
                  : "bg-[#06020f]/60 text-white/60 border-2 border-white/10 hover:text-[#00f0ff]/60 hover:border-[#00f0ff]/20"
              }`}>
              <span className="mr-2.5">{g.icon}</span>
              <span>{g.name.toUpperCase()}</span>
              <span className="ml-3 text-xs opacity-50">{count}</span>
            </button>
          );
        })}
      </div>
      <div className="text-center mt-5 text-xs font-mono text-white/50">
        {currentGroupDef.icon} {currentGroupDef.name} — {currentGroupDef.sport.toUpperCase()} — {filteredRosterCount} athletes
      </div>
    </div>
  );
}
