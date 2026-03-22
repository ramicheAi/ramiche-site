// Placeholder component to verify route creation
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { ArrowLeft, Timer, Trophy, Activity, Check } from "lucide-react";

const scorerVariants = cva("flex flex-col gap-4 p-4", {
  variants: {
    mode: {
      default: "bg-slate-900",
      live: "bg-red-950/20 border-red-900/50"
    }
  },
  defaultVariants: {
    mode: "default"
  }
});

export default function MeetScorerPage() {
  const [activeTab, setActiveTab] = useState<"dual" | "tri" | "champ">("dual");
  
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 pb-24">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold tracking-tight">Meet Scorer</h1>
        <div className="ml-auto">
          <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            <Activity className="h-4 w-4" /> Live
          </Button>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        {["dual", "tri", "champ"].map((type) => (
          <button
            key={type}
            onClick={() => setActiveTab(type as any)}
            className={cn(
              "p-4 rounded-xl border transition-all text-left",
              activeTab === type 
                ? "bg-slate-900 border-indigo-500/50 ring-1 ring-indigo-500/50"
                : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
            )}
          >
            <div className="font-medium capitalize mb-1">{type} Meet</div>
            <div className="text-xs text-slate-400">
              {type === "dual" ? "5-3-1 scoring" : type === "tri" ? "7-5-4-3-2-1" : "Top 16 scoring"}
            </div>
          </button>
        ))}
      </div>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-indigo-400" />
            Current Event: 200 Medley Relay
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-slate-500">
            Event scoring interface initializing...
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
