// Command Center - YOLO Build - Nerve Center (Experiment Log Dashboard)
// Status: ALPHA — wired to /api/command-center/yolo-builds

"use client";

import { useState, useEffect } from "react";
import { InstrumentPage, Panel } from "@/components/command-center/po/Instrument";

interface BuildMeta {
  date: string;
  name: string;
  idea: string;
  status: "working" | "partial" | "failed";
  takeaway: string;
  folder: string;
  agent: string;
  files: string[];
  verified?: boolean;
}

function statusLabel(s: string): string {
  if (s === "working") return "SUCCESS";
  if (s === "partial") return "PROGRESS";
  return "FAILED";
}

export default function NerveCenterPage() {
  const [builds, setBuilds] = useState<BuildMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/command-center/yolo-builds")
      .then(async (r) => {
        if (!r.ok) throw new Error(`yolo-builds ${r.status}`);
        return r.json() as Promise<BuildMeta[]>;
      })
      .then((data) => setBuilds(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error("Failed to load yolo-builds:", err);
        setBuilds([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const successCount = builds.filter(b => b.status === "working").length;
  const rate = builds.length ? Math.round((successCount / builds.length) * 100) : 0;

  return (
    <InstrumentPage
      id="nerve"
      title="Nerve Center"
      section="Operations"
      icon="nerve"
      accent="var(--c-purple)"
    >
      <p className="text-xs tracking-widest uppercase mb-6" style={{ color: "var(--t-lo)", fontFamily: "var(--f-mono)" }}>/yolo/nerve-center :: EXPERIMENT_LOG_V1</p>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ fontFamily: "var(--f-mono)" }}>
        {/* LEFT COL: METRICS */}
        <section className="col-span-1 space-y-6">
          <Panel title="Throughput" icon="pulse">
            <div className="p-5">
              <div className="flex items-baseline space-x-2">
                <span className="text-5xl font-black" style={{ color: "var(--accent)" }}>{loading ? "—" : rate}</span>
                <span className="text-sm font-bold" style={{ color: "var(--t-mid)" }}>%</span>
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--t-lo)" }}>Build Success Rate</p>
            </div>
          </Panel>

          <Panel title="Velocity" icon="bolt">
            <div className="p-5">
              <div className="flex items-baseline space-x-2">
                <span className="text-5xl font-black" style={{ color: "var(--accent)" }}>{loading ? "—" : builds.length}</span>
                <span className="text-sm font-bold" style={{ color: "var(--t-mid)" }}>total</span>
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--t-lo)" }}>YOLO Builds Tracked</p>
            </div>
          </Panel>

          <Panel>
            <div className="p-5 flex items-center justify-between">
              <div>
                <div className="text-xs" style={{ color: "var(--t-lo)" }}>UPTIME</div>
                <div className="text-xl font-bold" style={{ color: "var(--t-hi)" }}>99.9%</div>
              </div>
              <div className="flex space-x-2 items-center">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--c-green)" }}></span>
                <span className="text-xs uppercase tracking-widest" style={{ color: "var(--t-lo)" }}>Live</span>
              </div>
            </div>
          </Panel>
        </section>

        {/* RIGHT COL: FEED */}
        <section className="col-span-1 lg:col-span-2">
          <Panel title="Active Experiments" icon="dispatch">
            <div className="space-y-3 p-4">
              {loading && (
                <div className="text-sm animate-pulse" style={{ color: "var(--t-mid)" }}>Loading builds...</div>
              )}
              {builds.map((exp) => {
                const label = statusLabel(exp.status);
                const labelColor = label === "SUCCESS" ? "var(--c-green)" : label === "PROGRESS" ? "var(--c-amber)" : "var(--t-lo)";
                return (
                <div key={exp.folder} className="group relative p-4 transition-all duration-300" style={{ background: "var(--ink-1)", borderLeft: "2px solid var(--line-2)", borderRadius: "var(--r-sm)" }}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ color: "var(--t-mid)", background: "var(--ink-3)" }}>{exp.agent}</span>
                      <h4 className="font-bold text-lg transition-colors" style={{ color: "var(--t-hi)" }}>{exp.name}</h4>
                    </div>
                    <span className="text-xs font-bold px-2 py-1 rounded" style={{ color: labelColor, border: `1px solid ${labelColor}`, background: "var(--ink-2)" }}>
                      {label}
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                      <p className="text-sm" style={{ color: "var(--t-mid)", fontFamily: "var(--f-mono)" }}>Result: {exp.takeaway || exp.idea || "—"}</p>
                      <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: "var(--t-lo)" }}>{exp.date}</span>
                  </div>
                </div>
                );
              })}
            </div>
          </Panel>
        </section>
      </main>
    </InstrumentPage>
  );
}
