"use client";

import { useState, useEffect } from "react";

interface Build {
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

export default function NerveCenterPage() {
  const [builds, setBuilds] = useState<Build[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/command-center/yolo-builds");
        if (!res.ok) return;
        const data: Build[] = await res.json();
        setBuilds(data);
      } catch {}
    };
    load();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, []);

  const successCount = builds.filter((b) => b.status === "working").length;
  const totalCount = builds.length;
  const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-black text-green-500 font-mono p-8 selection:bg-green-900 overflow-x-hidden">
      <header className="mb-12 border-b border-green-900 pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold tracking-tighter uppercase mb-2">Nerve Center</h1>
          <p className="text-green-700 text-sm tracking-widest uppercase">/yolo/nerve-center :: EXPERIMENT_LOG_V1</p>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-xs text-green-700">SUCCESS RATE</div>
          <div className="text-xl font-bold">{successRate}%</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COL: METRICS */}
        <section className="col-span-1 space-y-8">
          <div className="bg-green-950/10 border border-green-900/50 p-6 rounded-sm">
            <h3 className="text-green-700 text-xs font-bold mb-4 uppercase tracking-widest border-b border-green-900/30 pb-2">Throughput</h3>
            <div className="flex items-baseline space-x-2">
              <span className="text-5xl font-black text-green-400">{successRate}</span>
              <span className="text-green-800 text-sm font-bold">%</span>
            </div>
            <p className="text-xs text-green-800 mt-2">Success Rate ({successCount}/{totalCount})</p>
          </div>

          <div className="bg-green-950/10 border border-green-900/50 p-6 rounded-sm">
            <h3 className="text-green-700 text-xs font-bold mb-4 uppercase tracking-widest border-b border-green-900/30 pb-2">Velocity</h3>
            <div className="flex items-baseline space-x-2">
              <span className="text-5xl font-black text-green-400">{totalCount}</span>
              <span className="text-green-800 text-sm font-bold">total</span>
            </div>
            <p className="text-xs text-green-800 mt-2">Experiments Deployed</p>
          </div>
        </section>

        {/* RIGHT COL: FEED */}
        <section className="col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-green-700 text-xs font-bold uppercase tracking-widest">Experiment History</h3>
            <div className="flex space-x-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-xs text-green-800 uppercase tracking-widest">Live</span>
            </div>
          </div>

          {builds.length === 0 && (
            <div className="text-green-800 text-sm py-8 text-center">Loading builds...</div>
          )}

          <div className="space-y-4">
            {builds.map((b, i) => (
              <div key={b.folder} className="group relative bg-green-950/5 hover:bg-green-900/10 border-l-2 border-green-900 hover:border-green-500 p-4 transition-all duration-300">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-bold text-green-800 bg-green-950/30 px-2 py-0.5 rounded">E-{String(i + 1).padStart(3, "0")}</span>
                    <h4 className="font-bold text-lg group-hover:text-green-300 transition-colors">{b.name}</h4>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded border ${
                    b.status === "working" ? "border-green-600 text-green-400 bg-green-900/20" :
                    b.status === "partial" ? "border-yellow-600 text-yellow-500 bg-yellow-900/20" :
                    "border-red-800 text-red-600 bg-red-900/20"
                  }`}>
                    {b.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    {b.takeaway && <p className="text-sm text-green-600/80 font-mono">Result: {b.takeaway}</p>}
                    {!b.takeaway && b.idea && <p className="text-sm text-green-600/80 font-mono">{b.idea}</p>}
                    <p className="text-[10px] text-green-900 mt-1">Agent: {b.agent} · {b.files.length} files</p>
                  </div>
                  <span className="text-[10px] text-green-900 uppercase font-bold tracking-wider">{b.date}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
