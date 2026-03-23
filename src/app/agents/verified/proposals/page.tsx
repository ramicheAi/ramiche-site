"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, CheckCircle2, Download } from "lucide-react";

export default function ProposalsPage() {
  const proposals = [
    { id: 1, client: "Apex Athletics", agents: 3, value: "$4,500/mo", status: "Active" },
    { id: 2, client: "Studio Flow", agents: 1, value: "$1,200/mo", status: "Draft" },
    { id: 3, client: "TechCorp", agents: 5, value: "$12,000/mo", status: "Sent" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              VERIFIED <span className="text-slate-500 font-mono">//</span> Proposals
            </h1>
            <p className="text-slate-500 text-sm">Manage client agreements and agent SOWs.</p>
          </div>
          <div className="ml-auto">
            <Button className="bg-blue-600 hover:bg-blue-700">New Proposal</Button>
          </div>
        </div>

        <div className="grid gap-4">
          {proposals.map((p) => (
            <div key={p.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between hover:border-blue-500/50 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <div className="font-bold text-white">{p.client}</div>
                  <div className="text-xs text-slate-500">{p.agents} Agents · {p.value}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                  p.status === 'Active' ? 'bg-emerald-950/30 text-emerald-400' :
                  p.status === 'Sent' ? 'bg-amber-950/30 text-amber-400' :
                  'bg-slate-800 text-slate-400'
                }`}>{p.status}</span>
                <Button size="icon" variant="ghost"><Download className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
