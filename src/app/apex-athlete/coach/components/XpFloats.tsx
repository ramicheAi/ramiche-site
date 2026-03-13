"use client";

export interface XpFloat {
  id: string;
  xp: number;
  x: number;
  y: number;
}

export default function XpFloats({ floats }: { floats: XpFloat[] }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-[200]">
      {floats.map(f => (
        <div key={f.id} className="xp-float absolute text-[#f59e0b] font-black text-lg" style={{ left: f.x, top: f.y }}>
          +{f.xp} XP
        </div>
      ))}
    </div>
  );
}
