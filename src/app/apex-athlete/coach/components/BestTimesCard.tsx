"use client";
import { useState, useEffect } from "react";
import { Card } from "@/app/apex-athlete/components/Card";
import { saveBestTimes, getBestTimes } from "@/lib/firestore-times";
import { QUALIFYING_STANDARDS, parseTimeToSeconds, formatSeconds, normalizeEvent } from "@/lib/qualifying-standards";

interface BestTimesData {
  times: Array<{ event: string; stroke: string; time: string; course: string; meet: string; date: string }>;
  swimmer?: string;
  team?: string;
  swimmerUrl?: string;
  count?: number;
  cached?: boolean;
  message?: string;
  error?: string;
}

export default function BestTimesCard({ athleteId, athleteName, usaSwimmingId, athleteGender }: { athleteId: string; athleteName: string; usaSwimmingId?: string; athleteGender?: "M" | "F" }) {
  const [btState, setBtState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [btData, setBtData] = useState<BestTimesData | null>(null);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    if (!athleteId) return;
    getBestTimes(athleteId).then((stored) => {
      if (stored && stored.times.length > 0) {
        setBtData({ ...stored, cached: true });
        setBtState("done");
        setFromCache(true);
      }
    });
  }, [athleteId]);

  const fetchBestTimes = async () => {
    setBtState("loading");
    setFromCache(false);
    try {
      const res = await fetch("/api/swimcloud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: athleteName, usaSwimmingId }),
      });
      const data = await res.json();
      setBtData(data);
      setBtState(data.error ? "error" : "done");
      if (!data.error && data.times?.length > 0 && athleteId) {
        saveBestTimes(athleteId, {
          times: data.times,
          swimmer: data.swimmer,
          team: data.team,
          swimmerUrl: data.swimmerUrl,
          count: data.count,
        });
      }
    } catch {
      setBtState("error");
      setBtData({ times: [], error: "Network error" });
    }
  };

  const courseColors: Record<string, string> = { SCY: "#00f0ff", LCM: "#a855f7", SCM: "#f59e0b" };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[#f8fafc]/60 text-[11px] uppercase tracking-[0.15em] font-bold">Best Times</h3>
          {fromCache && btState === "done" && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#a855f7]/15 text-[#a855f7] border border-[#a855f7]/20 uppercase tracking-wider">Cached</span>
          )}
        </div>
        <button onClick={fetchBestTimes} disabled={btState === "loading"}
          className="text-xs font-bold px-3 py-1.5 rounded-full border border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/10 transition-colors disabled:opacity-40 min-h-[32px]">
          {btState === "loading" ? "Fetching…" : btState === "done" ? "Refresh" : "Fetch from SwimCloud"}
        </button>
      </div>
      {btState === "loading" && (
        <Card className="p-6 text-center">
          <div className="text-[#f8fafc]/40 text-sm animate-pulse">Searching SwimCloud for {athleteName}…</div>
        </Card>
      )}
      {btState === "error" && (
        <Card className="p-5">
          <div className="text-red-400 text-sm">{btData?.error || "Failed to fetch times"}</div>
          {btData?.message && <div className="text-[#f8fafc]/40 text-xs mt-1">{btData.message}</div>}
        </Card>
      )}
      {btState === "done" && btData && (
        <Card className="divide-y divide-white/[0.04]">
          {btData.swimmer && (
            <div className="px-5 py-3 flex items-center justify-between">
              <div className="text-[#f8fafc]/50 text-xs">
                {btData.swimmer} · {btData.team || ""}
                {btData.cached && <span className="text-[#f8fafc]/30 ml-2">(cached)</span>}
              </div>
              {btData.swimmerUrl && (
                <a href={btData.swimmerUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[#00f0ff]/60 text-xs hover:text-[#00f0ff] transition-colors">View Profile →</a>
              )}
            </div>
          )}
          {btData.times.length === 0 ? (
            <div className="px-5 py-4 text-[#f8fafc]/40 text-sm text-center">
              {btData.message || "No times found"}
            </div>
          ) : (
            btData.times.map((t, i) => {
              const eventKey = normalizeEvent(t.event, t.stroke);
              const standard = QUALIFYING_STANDARDS[t.course]?.[eventKey];
              const gender = athleteGender || "M";
              const cutoff = typeof standard === "number" ? standard : (standard as Record<string, number> | undefined)?.[gender] ?? null;
              const athleteSecs = parseTimeToSeconds(t.time);
              const gap = cutoff !== null && athleteSecs !== null ? athleteSecs - cutoff : null;
              return (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ color: courseColors[t.course] || "#fff", background: `${courseColors[t.course] || "#fff"}15` }}>
                    {t.course}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[#f8fafc] text-sm font-medium">{t.event} {t.stroke}</div>
                    {(t.meet || t.date) && <div className="text-[#f8fafc]/30 text-[10px] truncate">{t.meet}{t.date ? ` · ${t.date}` : ""}</div>}
                  </div>
                  <div className="text-right">
                    <span className="text-[#f8fafc] font-black text-lg tabular-nums">{t.time}</span>
                    {gap !== null && (
                      <div className={`text-[10px] font-bold tabular-nums ${gap <= 0 ? "text-emerald-400" : "text-[#f59e0b]"}`}>
                        {gap <= 0 ? `✓ CUT (−${formatSeconds(Math.abs(gap))})` : `+${formatSeconds(gap)} to cut`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </Card>
      )}
    </div>
  );
}
