"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Beaker, Zap, Sliders } from "lucide-react";
import { Slider } from "@/components/ui/slider";

export default function PricingLabPage() {
  const [basePrice, setBasePrice] = useState([100]);
  const [complexity, setComplexity] = useState([50]);
  
  const suggestedPrice = Math.round(basePrice[0] * (1 + complexity[0]/100));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              VERIFIED <span className="text-slate-500 font-mono">//</span> Pricing Lab
            </h1>
            <p className="text-slate-500 text-sm">Experimental dynamic pricing engine.</p>
          </div>
        </div>

        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-8">
          <div className="text-center">
            <div className="text-6xl font-black text-white">${suggestedPrice}</div>
            <div className="text-sm uppercase tracking-widest text-slate-500 mt-2">Suggested Hourly Rate</div>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between"><label>Base Market Rate</label><span className="font-mono text-slate-400">${basePrice[0]}</span></div>
              <Slider value={basePrice} onValueChange={setBasePrice} min={50} max={300} step={10} />
            </div>
            <div className="space-y-4">
              <div className="flex justify-between"><label>Task Complexity</label><span className="font-mono text-amber-400">+{complexity[0]}%</span></div>
              <Slider value={complexity} onValueChange={setComplexity} min={0} max={200} step={10} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
