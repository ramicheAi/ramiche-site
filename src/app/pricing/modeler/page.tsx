"use client";

import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";

export default function PricingModelerPage() {
  const [hourlyRate, setHourlyRate] = useState(150);
  const [hoursPerWeek, setHoursPerWeek] = useState(10);
  const [agents, setAgents] = useState(1);
  const [markup, setMarkup] = useState(30);

  const baseCost = hourlyRate * hoursPerWeek * agents * 4;
  const clientPrice = baseCost * (1 + markup / 100);
  const profit = clientPrice - baseCost;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-slate-800 transition">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Verified Agents // Pricing Simulator
            </h1>
            <p className="text-slate-500 text-sm">Model your fleet costs and margins</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Controls */}
          <div className="space-y-6">
            <div className="bg-slate-900/50 border-2 border-slate-800 rounded-2xl p-6 space-y-8">
              <h2 className="text-sm uppercase tracking-widest text-slate-500 font-semibold">Inputs</h2>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <label className="text-sm font-medium">Hourly Rate (Cost)</label>
                  <span className="font-mono text-emerald-400">${hourlyRate}/hr</span>
                </div>
                <input type="range" value={hourlyRate} onChange={e => setHourlyRate(+e.target.value)} min={50} max={500} step={10}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <label className="text-sm font-medium">Hours / Week</label>
                  <span className="font-mono text-blue-400">{hoursPerWeek} hrs</span>
                </div>
                <input type="range" value={hoursPerWeek} onChange={e => setHoursPerWeek(+e.target.value)} min={1} max={40} step={1}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <label className="text-sm font-medium">Agent Count</label>
                  <span className="font-mono text-violet-400">{agents} agents</span>
                </div>
                <input type="range" value={agents} onChange={e => setAgents(+e.target.value)} min={1} max={20} step={1}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500" />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <label className="text-sm font-medium">Margin</label>
                  <span className="font-mono text-amber-400">{markup}%</span>
                </div>
                <input type="range" value={markup} onChange={e => setMarkup(+e.target.value)} min={10} max={100} step={5}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500" />
              </div>
            </div>
          </div>

          {/* Outputs */}
          <div className="space-y-6">
            <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-violet-500" />
              <div className="p-6 space-y-6">
                <h2 className="text-sm uppercase tracking-widest text-slate-500 font-semibold">Monthly Projection</h2>

                <div className="p-4 rounded-xl bg-slate-950 border-2 border-slate-800">
                  <div className="text-xs text-slate-500 uppercase mb-1">Client Invoice (Monthly)</div>
                  <div className="text-4xl font-black text-slate-100 tracking-tight">
                    ${clientPrice.toLocaleString()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-emerald-950/20 border-2 border-emerald-900/50">
                    <div className="text-xs text-emerald-500 uppercase mb-1">Net Profit</div>
                    <div className="text-2xl font-bold text-emerald-400">
                      +${profit.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900/50 border-2 border-slate-800">
                    <div className="text-xs text-slate-500 uppercase mb-1">Base Cost</div>
                    <div className="text-2xl font-bold text-slate-400">
                      ${baseCost.toLocaleString()}
                    </div>
                  </div>
                </div>

                <button className="w-full bg-slate-100 text-slate-950 hover:bg-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 transition">
                  <Check className="h-4 w-4" /> Save Proposal
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs text-slate-500 font-mono">
              <div>* based on 4-week month</div>
              <div className="text-right">Generated by Verified Agents</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
