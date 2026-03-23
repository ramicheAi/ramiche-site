"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, TrendingUp, Users, DollarSign, Zap } from "lucide-react";

export default function ArbitragePage() {
  const [agents, setAgents] = useState([5]);
  const [cost, setCost] = useState([50]);
  const [billRate, setBillRate] = useState([125]);
  const [utilization, setUtilization] = useState([80]);

  const monthlyRev = agents[0] * billRate[0] * 160 * (utilization[0]/100);
  const monthlyCost = agents[0] * cost[0] * 160 * (utilization[0]/100);
  const profit = monthlyRev - monthlyCost;
  const margin = Math.round((profit / monthlyRev) * 100);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              VERIFIED <span className="text-slate-500 font-mono">//</span> Arbitrage Calc
            </h1>
            <p className="text-slate-500 text-sm">Model your agency margins directly.</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex justify-between"><label>Active Agents</label><span className="font-mono text-violet-400">{agents[0]}</span></div>
              <Slider value={agents} onValueChange={setAgents} min={1} max={50} step={1} />
            </div>
            <div className="space-y-4">
              <div className="flex justify-between"><label>Hourly Cost (Compute/API)</label><span className="font-mono text-emerald-400">${cost[0]}</span></div>
              <Slider value={cost} onValueChange={setCost} min={10} max={200} step={5} />
            </div>
            <div className="space-y-4">
              <div className="flex justify-between"><label>Client Bill Rate</label><span className="font-mono text-blue-400">${billRate[0]}</span></div>
              <Slider value={billRate} onValueChange={setBillRate} min={50} max={500} step={10} />
            </div>
            <div className="space-y-4">
              <div className="flex justify-between"><label>Utilization</label><span className="font-mono text-amber-400">{utilization[0]}%</span></div>
              <Slider value={utilization} onValueChange={setUtilization} min={10} max={100} step={5} />
            </div>
          </div>

          <Card className="bg-slate-900 border-slate-800 border-t-4 border-t-violet-500">
            <CardContent className="p-8 space-y-8">
              <div className="text-center">
                <div className="text-sm uppercase tracking-widest text-slate-500 mb-2">Monthly Net Profit</div>
                <div className="text-5xl font-black text-white tracking-tight">${profit.toLocaleString()}</div>
                <div className="text-sm text-emerald-400 font-bold mt-2">{margin}% Margin</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-8 border-t border-slate-800">
                <div>
                  <div className="text-xs text-slate-500 uppercase">Gross Revenue</div>
                  <div className="text-xl font-bold text-slate-300">${monthlyRev.toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500 uppercase">Total Cost</div>
                  <div className="text-xl font-bold text-slate-300">${monthlyCost.toLocaleString()}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
