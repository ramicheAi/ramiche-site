// Pricing Modeler for Verified Agents
"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calculator, Activity, Users, DollarSign, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PricingModelerPage() {
  const [hourlyRate, setHourlyRate] = useState([150]);
  const [hoursPerWeek, setHoursPerWeek] = useState([10]);
  const [agents, setAgents] = useState([1]);
  const [markup, setMarkup] = useState([30]); // 30% margin

  const calculate = () => {
    const rate = hourlyRate[0];
    const hrs = hoursPerWeek[0];
    const count = agents[0];
    const margin = markup[0] / 100;

    const baseCost = rate * hrs * count * 4; // Monthly base
    const clientPrice = baseCost * (1 + margin);
    const profit = clientPrice - baseCost;

    return { baseCost, clientPrice, profit };
  };

  const { baseCost, clientPrice, profit } = calculate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
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
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader><CardTitle className="text-sm uppercase tracking-widest text-slate-500">Inputs</CardTitle></CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium">Hourly Rate (Cost)</label>
                    <span className="font-mono text-emerald-400">${hourlyRate[0]}/hr</span>
                  </div>
                  <Slider value={hourlyRate} onValueChange={setHourlyRate} min={50} max={500} step={10} className="py-2" />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium">Hours / Week</label>
                    <span className="font-mono text-blue-400">{hoursPerWeek[0]} hrs</span>
                  </div>
                  <Slider value={hoursPerWeek} onValueChange={setHoursPerWeek} min={1} max={40} step={1} className="py-2" />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium">Agent Count</label>
                    <span className="font-mono text-violet-400">{agents[0]} agents</span>
                  </div>
                  <Slider value={agents} onValueChange={setAgents} min={1} max={20} step={1} className="py-2" />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium">Margin</label>
                    <span className="font-mono text-amber-400">{markup[0]}%</span>
                  </div>
                  <Slider value={markup} onValueChange={setMarkup} min={10} max={100} step={5} className="py-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Outputs */}
          <div className="space-y-6">
            <Card className="bg-slate-900 border-slate-800 relative overflow-hidden">
              <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-violet-500" />
              <CardHeader><CardTitle className="text-sm uppercase tracking-widest text-slate-500">Monthly Projection</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-xs text-slate-500 uppercase mb-1">Client Invoice (Monthly)</div>
                  <div className="text-4xl font-black text-slate-100 tracking-tight">
                    ${clientPrice.toLocaleString()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/50">
                    <div className="text-xs text-emerald-500 uppercase mb-1">Net Profit</div>
                    <div className="text-2xl font-bold text-emerald-400">
                      +${profit.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                    <div className="text-xs text-slate-500 uppercase mb-1">Base Cost</div>
                    <div className="text-2xl font-bold text-slate-400">
                      ${baseCost.toLocaleString()}
                    </div>
                  </div>
                </div>

                <Button className="w-full bg-slate-100 text-slate-950 hover:bg-white font-bold h-12">
                  <Check className="mr-2 h-4 w-4" /> Save Proposal
                </Button>
              </CardContent>
            </Card>

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
