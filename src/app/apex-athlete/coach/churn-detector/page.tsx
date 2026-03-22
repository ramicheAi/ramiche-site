"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { 
  ArrowLeft, AlertCircle, TrendingUp, Users, DollarSign, Activity, 
  Search, CheckCircle2, XCircle
} from "lucide-react";

// Mock Data Types
interface Athlete {
  id: number;
  name: string;
  group: string;
  riskScore: number;
  monthlyRev: number;
  signals: {
    practice: number; // 0-100
    meets: number;
    parent: number;
  };
}

// Names for mock generation
const FIRST_NAMES = ['Emma','Liam','Sophia','Noah','Olivia','Mason','Ava','Ethan'];
const LAST_NAMES = ['Johnson','Williams','Brown','Davis','Martinez','Garcia','Wilson'];

export default function ChurnDetectorPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [roster] = useState<Athlete[]>(() => generateMockRoster(50));

  // Stats
  const stats = useMemo(() => {
    const critical = roster.filter(a => a.riskScore >= 75).length;
    const warning = roster.filter(a => a.riskScore >= 40 && a.riskScore < 75).length;
    const revRisk = roster.filter(a => a.riskScore >= 60).reduce((a,b) => a + b.monthlyRev, 0);
    return { critical, warning, revRisk };
  }, [roster]);

  function generateMockRoster(count: number): Athlete[] {
    return Array.from({length: count}, (_, i) => {
      const risk = Math.floor(Math.random() * 100);
      return {
        id: i,
        name: `${FIRST_NAMES[Math.floor(Math.random()*FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random()*LAST_NAMES.length)]}`,
        group: ['Senior','Junior','Age Group'][Math.floor(Math.random()*3)],
        riskScore: risk,
        monthlyRev: 150,
        signals: {
          practice: 100 - Math.floor(Math.random() * (risk/2)),
          meets: 100 - Math.floor(Math.random() * (risk/2)),
          parent: 100 - Math.floor(Math.random() * (risk/2)),
        }
      };
    }).sort((a,b) => b.riskScore - a.riskScore);
  }

  const getRiskColor = (score: number) => {
    if (score >= 75) return "text-red-500 border-red-500/50 bg-red-950/10";
    if (score >= 40) return "text-amber-500 border-amber-500/50 bg-amber-950/10";
    return "text-emerald-500 border-emerald-500/50 bg-emerald-950/10";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
            Churn Risk Detector
          </h1>
          <p className="text-slate-500 text-sm">Identify at-risk athletes & generate win-back actions</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-black text-red-500">{stats.critical}</div>
            <div className="text-xs text-slate-500 uppercase tracking-widest mt-1">Critical Risk</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-black text-amber-500">{stats.warning}</div>
            <div className="text-xs text-slate-500 uppercase tracking-widest mt-1">Warning</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-black text-slate-100">${stats.revRisk.toLocaleString()}</div>
            <div className="text-xs text-slate-500 uppercase tracking-widest mt-1">Monthly Rev at Risk</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-black text-purple-500">{roster.length}</div>
            <div className="text-xs text-slate-500 uppercase tracking-widest mt-1">Total Monitored</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" /> At-Risk Athletes
          </h2>
          
          {roster.slice(0, 10).map((athlete) => (
            <Card key={athlete.id} className={cn("bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer", 
              athlete.riskScore >= 75 ? "border-l-4 border-l-red-500" : 
              athlete.riskScore >= 40 ? "border-l-4 border-l-amber-500" : ""
            )}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-lg text-slate-100">{athlete.name}</div>
                  <div className="text-xs text-slate-500">{athlete.group} · Needs Attention</div>
                </div>
                
                <div className="text-right">
                  <div className={cn("text-2xl font-black", 
                    athlete.riskScore >= 75 ? "text-red-500" : 
                    athlete.riskScore >= 40 ? "text-amber-500" : "text-emerald-500"
                  )}>
                    {athlete.riskScore}%
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase">Risk Score</div>
                </div>
              </CardContent>
              
              {/* Expanded Signals (Simple View) */}
              <div className="px-4 pb-4 flex gap-4 text-xs text-slate-400 border-t border-slate-800/50 pt-3">
                <div className="flex items-center gap-1">
                  <Activity className="h-3 w-3" /> Practice: <span className={athlete.signals.practice < 50 ? "text-red-400" : "text-emerald-400"}>{athlete.signals.practice}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> Parent: <span className={athlete.signals.parent < 50 ? "text-red-400" : "text-emerald-400"}>{athlete.signals.parent}%</span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader><CardTitle className="text-sm uppercase tracking-widest text-slate-500">Win-Back Actions</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded bg-slate-950 border border-slate-800">
                <div className="text-xs text-purple-400 font-bold mb-1">RECOMMENDED</div>
                <div className="text-sm font-medium">Schedule Parent Review</div>
                <p className="text-xs text-slate-500 mt-1">For athletes with >75% risk, a direct call reduces churn by 40%.</p>
                <Button size="sm" className="w-full mt-3 bg-purple-600 hover:bg-purple-700">Generate Script</Button>
              </div>

              <div className="p-3 rounded bg-slate-950 border border-slate-800">
                <div className="text-sm font-medium">Send "We Miss You" Text</div>
                <p className="text-xs text-slate-500 mt-1">Automated outreach for athletes absent 3+ practices.</p>
                <Button size="sm" variant="outline" className="w-full mt-3 border-slate-700">Preview</Button>
              </div>
            </CardContent>
          </Card>

          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 text-center">
            <TrendingUp className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            <div className="text-sm text-slate-400">Projected Revenue Saved</div>
            <div className="text-2xl font-bold text-white">$4,200 <span className="text-xs font-normal text-slate-500">/ yr</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
