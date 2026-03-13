"use client";

interface TeamCulture {
  teamName: string; mission: string; seasonalGoal: string;
  goalTarget: number; goalCurrent: number; weeklyQuote: string;
}

interface CultureHeaderProps {
  culture: TeamCulture;
  editingCulture: boolean;
  currentGroupDef: { icon: string; name: string };
  view: string;
  onCultureChange: (c: TeamCulture) => void;
  onToggleEdit: () => void;
}

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div style={{animation: 'glowBreathe 4s ease-in-out infinite'}} className={`game-panel game-panel-border game-panel-scan relative bg-[#06020f]/80 backdrop-blur-xl border border-[#00f0ff]/15 transition-all duration-300 hover:border-[#00f0ff]/30 hover:-translate-y-[1px] shadow-[0_4px_24px_rgba(0,0,0,0.4)] ${className}`}>{children}</div>
);

export default function CultureHeader({ culture, editingCulture, currentGroupDef, view, onCultureChange, onToggleEdit }: CultureHeaderProps) {
  return (
    <Card className="p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white font-bold text-lg">Saint Andrew&apos;s Aquatics — {currentGroupDef.icon} {currentGroupDef.name}</h2>
          {editingCulture ? (
            <input value={culture.mission} onChange={e => onCultureChange({ ...culture, mission: e.target.value })}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1 text-[#f59e0b] text-sm mt-1 w-full focus:outline-none" />
          ) : (
            <p className="text-[#f59e0b] text-sm mt-1">{culture.mission}</p>
          )}
        </div>
        {view === "coach" && (
          <button onClick={onToggleEdit}
            className="text-white/60 text-xs hover:text-white/50 px-3 py-1.5 rounded-lg border border-white/[0.06] transition-colors min-h-[36px]">
            {editingCulture ? "Save" : "Edit"}
          </button>
        )}
      </div>
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-white/40">
            {editingCulture ? (
              <input value={culture.seasonalGoal} onChange={e => onCultureChange({ ...culture, seasonalGoal: e.target.value })}
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-0.5 text-white/50 w-52 focus:outline-none" />
            ) : culture.seasonalGoal}
          </span>
          <span className="text-[#f59e0b] font-bold">{culture.goalCurrent}%<span className="text-white/60">/{culture.goalTarget}%</span></span>
        </div>
        <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
          <div className="h-full rounded-full xp-shimmer transition-all duration-700" style={{ width: `${Math.min(100, (culture.goalCurrent / culture.goalTarget) * 100)}%` }} />
        </div>
      </div>
      <div className="border-t border-white/[0.04] pt-3">
        {editingCulture ? (
          <input value={culture.weeklyQuote} onChange={e => onCultureChange({ ...culture, weeklyQuote: e.target.value })}
            className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-white/60 text-sm italic w-full focus:outline-none" />
        ) : (
          <p className="text-white/60 text-sm italic text-center">&ldquo;{culture.weeklyQuote}&rdquo;</p>
        )}
      </div>
      {editingCulture && (
        <div className="mt-3 flex gap-3 text-xs items-center">
          <label className="text-white/60">Goal %: <input type="number" value={culture.goalTarget}
            onChange={e => onCultureChange({ ...culture, goalTarget: parseInt(e.target.value) || 0 })}
            className="ml-1 w-16 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-white/50 focus:outline-none" /></label>
        </div>
      )}
    </Card>
  );
}
