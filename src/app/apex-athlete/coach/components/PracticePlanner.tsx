"use client";

import React, { useState, useCallback, useMemo } from "react";

// ── Types ────────────────────────────────────────────────────

interface SetItem {
  id: number;
  reps: number;
  distance: number;
  stroke: string;
  interval: string;
  zone: string;
  notes: string;
}

interface SetGroup {
  id: number;
  type: string;
  name: string;
  items: SetItem[];
}

interface Practice {
  title: string;
  date: string;
  group: string;
  focus: string;
  course: "SCY" | "SCM" | "LCM";
  groups: SetGroup[];
}

interface PracticePlannerProps {
  rosterGroups?: string[];
  onSave?: (practice: Practice) => void;
  onClose?: () => void;
}

// ── Constants ────────────────────────────────────────────────

const ZONES: Record<string, { label: string; color: string; bpm: string; desc: string }> = {
  EN1: { label: "EN1 — Aerobic", color: "#3B82F6", bpm: "120-140", desc: "Easy/moderate" },
  EN2: { label: "EN2 — Threshold", color: "#8B5CF6", bpm: "140-160", desc: "Steady threshold" },
  EN3: { label: "EN3 — VO₂max", color: "#EC4899", bpm: "160-175", desc: "Hard aerobic" },
  SP1: { label: "SP1 — Lactate", color: "#F59E0B", bpm: "170-185", desc: "Race pace" },
  SP2: { label: "SP2 — Power", color: "#EF4444", bpm: "180-190", desc: "Near max" },
  SP3: { label: "SP3 — Max Speed", color: "#DC2626", bpm: "190+", desc: "All out" },
  REC: { label: "REC — Recovery", color: "#10B981", bpm: "<120", desc: "Easy recovery" },
};

const STROKES = ["Free", "Back", "Breast", "Fly", "IM", "Choice", "Kick", "Pull", "Drill"];

const GROUP_COLORS: Record<string, string> = {
  "Warm-Up": "#F59E0B",
  "Pre-Set": "#8B5CF6",
  "Main Set": "#DC2626",
  Kick: "#10B981",
  Pull: "#3B82F6",
  Drill: "#6366F1",
  Sprint: "#EF4444",
  "Cool-Down": "#06B6D4",
  "Test Set": "#F97316",
};

const GROUP_TYPES = Object.keys(GROUP_COLORS);

const TEMPLATES: Record<string, { type: string; name: string; items: Omit<SetItem, "id">[] }> = {
  warmup: {
    type: "Warm-Up", name: "Warm-Up",
    items: [
      { reps: 1, distance: 200, stroke: "Free", interval: "", zone: "REC", notes: "Easy" },
      { reps: 1, distance: 200, stroke: "IM", interval: "", zone: "REC", notes: "Drill/Swim by 50" },
      { reps: 4, distance: 50, stroke: "Choice", interval: "1:00", zone: "EN1", notes: "Build" },
    ],
  },
  main: {
    type: "Main Set", name: "Main Set",
    items: [
      { reps: 4, distance: 100, stroke: "Free", interval: "1:30", zone: "EN2", notes: "Descend 1-4" },
      { reps: 4, distance: 100, stroke: "Free", interval: "1:25", zone: "EN3", notes: "Hold pace" },
    ],
  },
  kick: {
    type: "Kick", name: "Kick Set",
    items: [
      { reps: 6, distance: 50, stroke: "Kick", interval: "1:00", zone: "EN1", notes: "w/ board" },
      { reps: 4, distance: 25, stroke: "Kick", interval: "0:30", zone: "SP1", notes: "Fast" },
    ],
  },
  sprint: {
    type: "Sprint", name: "Sprint Set",
    items: [
      { reps: 6, distance: 25, stroke: "Free", interval: "0:45", zone: "SP3", notes: "MAX" },
      { reps: 2, distance: 50, stroke: "Free", interval: "1:30", zone: "SP2", notes: "Fast" },
    ],
  },
  cooldown: {
    type: "Cool-Down", name: "Cool-Down",
    items: [{ reps: 1, distance: 300, stroke: "Choice", interval: "", zone: "REC", notes: "Easy swim" }],
  },
};

// ── Helpers ──────────────────────────────────────────────────

let nextId = 1;
const genId = () => nextId++;

function calcGroupVolume(group: SetGroup): number {
  return group.items.reduce((sum, item) => sum + item.reps * item.distance, 0);
}

// ── Component ────────────────────────────────────────────────

export default function PracticePlanner({ rosterGroups = ["Senior", "Junior", "Age Group"], onSave, onClose }: PracticePlannerProps) {
  const [practice, setPractice] = useState<Practice>({
    title: "",
    date: new Date().toISOString().split("T")[0],
    group: rosterGroups[0] || "Senior",
    focus: "Distance",
    course: "SCY",
    groups: [],
  });

  const totalVolume = useMemo(() => practice.groups.reduce((sum, g) => sum + calcGroupVolume(g), 0), [practice.groups]);

  const zoneDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    Object.keys(ZONES).forEach((z) => (dist[z] = 0));
    practice.groups.forEach((g) =>
      g.items.forEach((item) => {
        dist[item.zone] = (dist[item.zone] || 0) + item.reps * item.distance;
      })
    );
    return dist;
  }, [practice.groups]);

  const updatePractice = useCallback((updates: Partial<Practice>) => {
    setPractice((p) => ({ ...p, ...updates }));
  }, []);

  const addGroup = useCallback((type: string) => {
    setPractice((p) => ({
      ...p,
      groups: [
        ...p.groups,
        {
          id: genId(),
          type,
          name: type,
          items: [
            {
              id: genId(),
              reps: 1,
              distance: type === "Sprint" ? 50 : type === "Cool-Down" ? 200 : 100,
              stroke: type === "Kick" ? "Kick" : type === "Pull" ? "Pull" : type === "Drill" ? "Drill" : "Free",
              interval: "",
              zone: type === "Warm-Up" || type === "Cool-Down" ? "REC" : type === "Sprint" ? "SP2" : "EN1",
              notes: "",
            },
          ],
        },
      ],
    }));
  }, []);

  const addTemplate = useCallback((key: string) => {
    const tmpl = TEMPLATES[key];
    if (!tmpl) return;
    setPractice((p) => ({
      ...p,
      groups: [
        ...p.groups,
        {
          id: genId(),
          type: tmpl.type,
          name: tmpl.name,
          items: tmpl.items.map((item) => ({ ...item, id: genId() })),
        },
      ],
    }));
  }, []);

  const removeGroup = useCallback((gi: number) => {
    setPractice((p) => ({ ...p, groups: p.groups.filter((_, i) => i !== gi) }));
  }, []);

  const moveGroup = useCallback((gi: number, dir: number) => {
    setPractice((p) => {
      const groups = [...p.groups];
      const newIdx = gi + dir;
      if (newIdx < 0 || newIdx >= groups.length) return p;
      [groups[gi], groups[newIdx]] = [groups[newIdx], groups[gi]];
      return { ...p, groups };
    });
  }, []);

  const addItem = useCallback((gi: number) => {
    setPractice((p) => {
      const groups = [...p.groups];
      const group = { ...groups[gi], items: [...groups[gi].items] };
      const last = group.items[group.items.length - 1];
      group.items.push({
        id: genId(),
        reps: last?.reps || 1,
        distance: last?.distance || 100,
        stroke: last?.stroke || "Free",
        interval: last?.interval || "",
        zone: last?.zone || "EN1",
        notes: "",
      });
      groups[gi] = group;
      return { ...p, groups };
    });
  }, []);

  const removeItem = useCallback((gi: number, ii: number) => {
    setPractice((p) => {
      const groups = [...p.groups];
      const group = { ...groups[gi], items: groups[gi].items.filter((_, i) => i !== ii) };
      if (group.items.length === 0) return { ...p, groups: groups.filter((_, i) => i !== gi) };
      groups[gi] = group;
      return { ...p, groups };
    });
  }, []);

  const updateItem = useCallback((gi: number, ii: number, field: keyof SetItem, value: string | number) => {
    setPractice((p) => {
      const groups = [...p.groups];
      const group = { ...groups[gi], items: [...groups[gi].items] };
      group.items[ii] = {
        ...group.items[ii],
        [field]: field === "reps" || field === "distance" ? parseInt(String(value)) || 1 : value,
      };
      groups[gi] = group;
      return { ...p, groups };
    });
  }, []);

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-[10px] text-white/40 uppercase font-bold">Title</label>
          <input
            value={practice.title}
            onChange={(e) => updatePractice({ title: e.target.value })}
            placeholder="Practice title..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 placeholder-white/30 focus:border-[#00f0ff]/40 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] text-white/40 uppercase font-bold">Date</label>
          <input
            type="date"
            value={practice.date}
            onChange={(e) => updatePractice({ date: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 focus:border-[#00f0ff]/40 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] text-white/40 uppercase font-bold">Group</label>
          <select
            value={practice.group}
            onChange={(e) => updatePractice({ group: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 focus:border-[#00f0ff]/40 focus:outline-none"
          >
            {rosterGroups.map((g) => (
              <option key={g} value={g} className="bg-[#0a0015]">{g}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-white/40 uppercase font-bold">Course</label>
          <select
            value={practice.course}
            onChange={(e) => updatePractice({ course: e.target.value as "SCY" | "SCM" | "LCM" })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 focus:border-[#00f0ff]/40 focus:outline-none"
          >
            <option value="SCY" className="bg-[#0a0015]">SCY (25 yd)</option>
            <option value="SCM" className="bg-[#0a0015]">SCM (25 m)</option>
            <option value="LCM" className="bg-[#0a0015]">LCM (50 m)</option>
          </select>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 bg-white/[0.03] rounded-xl border border-white/[0.06] px-4 py-3">
        <div className="text-center">
          <div className="text-lg font-bold text-[#00f0ff]">{totalVolume.toLocaleString()}</div>
          <div className="text-[9px] text-white/40 uppercase">Total Yards</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-purple-400">{practice.groups.length}</div>
          <div className="text-[9px] text-white/40 uppercase">Sets</div>
        </div>
        <div className="flex-1 flex items-center gap-0.5 h-4 rounded-full overflow-hidden bg-white/5">
          {Object.entries(zoneDistribution)
            .filter(([, v]) => v > 0)
            .map(([zone, vol]) => (
              <div
                key={zone}
                style={{ width: `${totalVolume > 0 ? (vol / totalVolume) * 100 : 0}%`, backgroundColor: ZONES[zone]?.color }}
                className="h-full transition-all duration-300"
                title={`${zone}: ${vol} yds (${totalVolume > 0 ? Math.round((vol / totalVolume) * 100) : 0}%)`}
              />
            ))}
        </div>
      </div>

      {/* Zone legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(ZONES).map(([key, z]) => (
          <div key={key} className="flex items-center gap-1.5 text-[10px] text-white/50">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: z.color }} />
            <span>{key}</span>
            {zoneDistribution[key] > 0 && <span className="text-white/30">({zoneDistribution[key]})</span>}
          </div>
        ))}
      </div>

      {/* Add set group buttons */}
      <div className="flex flex-wrap gap-2">
        {GROUP_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => addGroup(type)}
            className="text-[10px] px-3 py-1.5 rounded-lg font-bold border transition-all active:scale-95 hover:brightness-125"
            style={{ borderColor: GROUP_COLORS[type] + "40", color: GROUP_COLORS[type], background: GROUP_COLORS[type] + "10" }}
          >
            + {type}
          </button>
        ))}
      </div>

      {/* Templates */}
      <div className="flex flex-wrap gap-2">
        <span className="text-[10px] text-white/30 uppercase font-bold self-center">Templates:</span>
        {Object.keys(TEMPLATES).map((key) => (
          <button
            key={key}
            onClick={() => addTemplate(key)}
            className="text-[10px] px-2.5 py-1 rounded-md font-medium bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/70 transition-all active:scale-95"
          >
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      {/* Set groups */}
      <div className="space-y-3">
        {practice.groups.map((group, gi) => {
          const color = GROUP_COLORS[group.type] || "#6B7280";
          const groupVol = calcGroupVolume(group);
          return (
            <div key={group.id} className="rounded-xl border overflow-hidden" style={{ borderColor: color + "30" }}>
              {/* Group header */}
              <div className="flex items-center justify-between px-4 py-2.5" style={{ background: color + "15" }}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="text-sm font-bold text-white/90">{group.name}</span>
                  <span className="text-[10px] text-white/40 font-mono">{groupVol} yds</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => moveGroup(gi, -1)} className="text-white/30 hover:text-white/60 px-1 text-xs">▲</button>
                  <button onClick={() => moveGroup(gi, 1)} className="text-white/30 hover:text-white/60 px-1 text-xs">▼</button>
                  <button onClick={() => removeGroup(gi)} className="text-red-400/50 hover:text-red-400 px-1 text-xs">✕</button>
                </div>
              </div>

              {/* Items */}
              <div className="divide-y divide-white/[0.04]">
                {group.items.map((item, ii) => (
                  <div key={item.id} className="flex items-center gap-2 px-4 py-2 bg-white/[0.01] hover:bg-white/[0.03] transition-colors">
                    <input
                      type="number"
                      value={item.reps}
                      onChange={(e) => updateItem(gi, ii, "reps", e.target.value)}
                      className="w-12 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 text-center focus:border-[#00f0ff]/40 focus:outline-none"
                      min={1}
                    />
                    <span className="text-white/30 text-xs">×</span>
                    <input
                      type="number"
                      value={item.distance}
                      onChange={(e) => updateItem(gi, ii, "distance", e.target.value)}
                      className="w-16 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 text-center focus:border-[#00f0ff]/40 focus:outline-none"
                      min={25}
                      step={25}
                    />
                    <select
                      value={item.stroke}
                      onChange={(e) => updateItem(gi, ii, "stroke", e.target.value)}
                      className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 focus:border-[#00f0ff]/40 focus:outline-none"
                    >
                      {STROKES.map((s) => (
                        <option key={s} value={s} className="bg-[#0a0015]">{s}</option>
                      ))}
                    </select>
                    <input
                      value={item.interval}
                      onChange={(e) => updateItem(gi, ii, "interval", e.target.value)}
                      placeholder="Int"
                      className="w-14 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 text-center placeholder-white/20 focus:border-[#00f0ff]/40 focus:outline-none"
                    />
                    <select
                      value={item.zone}
                      onChange={(e) => updateItem(gi, ii, "zone", e.target.value)}
                      className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs font-bold focus:border-[#00f0ff]/40 focus:outline-none"
                      style={{ color: ZONES[item.zone]?.color }}
                    >
                      {Object.keys(ZONES).map((z) => (
                        <option key={z} value={z} className="bg-[#0a0015]">{z}</option>
                      ))}
                    </select>
                    <input
                      value={item.notes}
                      onChange={(e) => updateItem(gi, ii, "notes", e.target.value)}
                      placeholder="Notes"
                      className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/60 placeholder-white/20 focus:border-[#00f0ff]/40 focus:outline-none"
                    />
                    <span className="text-[10px] text-white/30 font-mono w-12 text-right">{item.reps * item.distance}</span>
                    <button onClick={() => removeItem(gi, ii)} className="text-red-400/40 hover:text-red-400 text-xs px-1">✕</button>
                  </div>
                ))}
              </div>

              {/* Add item */}
              <button
                onClick={() => addItem(gi)}
                className="w-full text-[10px] py-1.5 text-white/30 hover:text-white/50 hover:bg-white/[0.03] transition-all font-bold uppercase tracking-wider"
              >
                + Add Set
              </button>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      {practice.groups.length > 0 && (
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-white/40">
            {practice.groups.length} groups · {practice.groups.reduce((s, g) => s + g.items.length, 0)} sets · {totalVolume.toLocaleString()} yds
          </div>
          <div className="flex gap-2">
            {onClose && (
              <button onClick={onClose} className="text-xs px-4 py-2 rounded-lg font-bold text-white/50 border border-white/10 hover:bg-white/5 transition-all">
                Cancel
              </button>
            )}
            {onSave && (
              <button
                onClick={() => onSave(practice)}
                className="text-xs px-4 py-2 rounded-lg font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all active:scale-95"
              >
                Save Practice
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
