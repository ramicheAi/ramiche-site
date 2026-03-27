// Command Center - YOLO Build - Nerve Center (Experiment Log Dashboard)
// Status: ALPHA
// Description: Live view of all active/past experiments
// Created by: PROXIMON

import { Suspense } from 'react';

// Mock data to start - will wire real data later
const EXPERIMENTS = [
  { id: 'E-001', name: 'Gateway Timeout', status: 'SUCCESS', delta: '300s -> 1800s', created: '2026-03-13' },
  { id: 'E-002', name: 'OpenRouter Cost', status: 'SUCCESS', delta: '-88% cost', created: '2026-03-13' },
  { id: 'E-003', name: 'Coach Page Decomp', status: 'PROGRESS', delta: '5.5k -> 4k lines', created: '2026-03-14' },
  { id: 'E-004', name: 'Zombie Prune', status: 'SUCCESS', delta: '-109 sessions', created: '2026-03-13' },
  { id: 'E-005', name: 'Meet Mobile Scrape', status: 'Design', delta: 'TBD', created: '2026-03-17' },
];

export default function NerveCenterPage() {
  return (
    <div className="min-h-screen bg-black text-green-500 font-mono p-8 selection:bg-green-900 overflow-x-hidden">
      <header className="mb-12 border-b border-green-900 pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold tracking-tighter uppercase mb-2">Nerve Center</h1>
          <p className="text-green-700 text-sm tracking-widest uppercase">/yolo/nerve-center :: EXPERIMENT_LOG_V1</p>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-xs text-green-700">UPTIME</div>
          <div className="text-xl font-bold">99.9%</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COL: METRICS */}
        <section className="col-span-1 space-y-8">
          <div className="bg-green-950/10 border border-green-900/50 p-6 rounded-sm">
            <h3 className="text-green-700 text-xs font-bold mb-4 uppercase tracking-widest border-b border-green-900/30 pb-2">Throughput</h3>
            <div className="flex items-baseline space-x-2">
              <span className="text-5xl font-black text-green-400">88</span>
              <span className="text-green-800 text-sm font-bold">%</span>
            </div>
            <p className="text-xs text-green-800 mt-2">Cost Reduction (Last 72h)</p>
          </div>

          <div className="bg-green-950/10 border border-green-900/50 p-6 rounded-sm">
            <h3 className="text-green-700 text-xs font-bold mb-4 uppercase tracking-widest border-b border-green-900/30 pb-2">Velocity</h3>
            <div className="flex items-baseline space-x-2">
              <span className="text-5xl font-black text-green-400">5</span>
              <span className="text-green-800 text-sm font-bold">/day</span>
            </div>
            <p className="text-xs text-green-800 mt-2">Experiments Deployed</p>
          </div>
        </section>

        {/* RIGHT COL: FEED */}
        <section className="col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-green-700 text-xs font-bold uppercase tracking-widest">Active Experiments</h3>
            <div className="flex space-x-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-xs text-green-800 uppercase tracking-widest">Live</span>
            </div>
          </div>

          <div className="space-y-4">
            {EXPERIMENTS.map((exp) => (
              <div key={exp.id} className="group relative bg-green-950/5 hover:bg-green-900/10 border-l-2 border-green-900 hover:border-green-500 p-4 transition-all duration-300">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-bold text-green-800 bg-green-950/30 px-2 py-0.5 rounded">{exp.id}</span>
                    <h4 className="font-bold text-lg group-hover:text-green-300 transition-colors">{exp.name}</h4>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded border ${
                    exp.status === 'SUCCESS' ? 'border-green-600 text-green-400 bg-green-900/20' :
                    exp.status === 'PROGRESS' ? 'border-yellow-600 text-yellow-500 bg-yellow-900/20' :
                    'border-gray-800 text-gray-600'
                  }`}>
                    {exp.status}
                  </span>
                </div>
                <div className="flex justify-between items-end">
                    <p className="text-sm text-green-600/80 font-mono">Result: {exp.delta}</p>
                    <span className="text-[10px] text-green-900 uppercase font-bold tracking-wider">{exp.created}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
