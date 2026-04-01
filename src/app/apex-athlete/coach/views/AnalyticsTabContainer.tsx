"use client";
import React, { useState } from "react";
import AnalyticsDashboard from "./AnalyticsDashboard";
import type { Athlete, DailySnapshot, AuditEntry } from "../types";
import { getSportForAthlete } from "../types";

interface PeakWindow { day: string; avgXP: number; sessions: number; }
interface EngagementTrend { delta: number; direction: "up" | "down" | "flat"; }
interface PeriodData { currentLabel: string; previousLabel: string; current: DailySnapshot[]; previous: DailySnapshot[]; }

interface Props {
  roster: Athlete[];
  selectedGroup: string;
  calendarData: Record<string, { attendance: number; totalAthletes: number; totalXPAwarded: number; poolCheckins: number; weightCheckins: number }>;
  selectedDay: string | null;
  setSelectedDay: (day: string | null) => void;
  timelineAthleteId: string | null;
  setTimelineAthleteId: (id: string | null) => void;
  periodComparison: PeriodData;
  comparePeriod: "week" | "month";
  setComparePeriod: (p: "week" | "month") => void;
  engagementTrend: EngagementTrend;
  cultureScore: number;
  atRiskAthletes: (Athlete & { risk: number })[];
  snapshots: DailySnapshot[];
  peakWindows: PeakWindow[];
  auditLog: AuditEntry[];
  mostImproved: Athlete | null;
  avgAtt: (snaps: DailySnapshot[]) => number;
  avgXP: (snaps: DailySnapshot[]) => number;
  getAttritionRisk: (a: Athlete) => number;
  getSportForAthlete: (a: Athlete) => string;
  exportCSV: () => void;
  GameHUDHeader: React.ComponentType;
}

type SubTab = "overview" | "swim-performance" | "split-analysis";

const SUB_TABS: { id: SubTab; label: string; icon: string }[] = [
  { id: "overview", label: "Team Overview", icon: "📊" },
  { id: "swim-performance", label: "Swim Performance", icon: "🏊" },
  { id: "split-analysis", label: "Split Analysis", icon: "⏱️" },
];

export default function AnalyticsTabContainer(props: Props) {
  const [subTab, setSubTab] = useState<SubTab>("overview");

  return (
    <div className="w-full">
      {/* Sub-tab bar */}
      <div className="flex gap-1 mb-6 border-b-2 border-white/10 pb-0">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`px-4 py-3 text-sm font-semibold transition-all border-b-3 -mb-[2px] ${
              subTab === tab.id
                ? "text-[#a855f7] border-[#a855f7]"
                : "text-white/50 border-transparent hover:text-white/80"
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {subTab === "overview" && (
        <AnalyticsDashboard {...props} />
      )}

      {subTab === "swim-performance" && (
        <div className="w-full rounded-2xl overflow-hidden border-2 border-white/10" style={{ minHeight: "80vh" }}>
          <iframe
            src="/builds/2026-03-13-mettle-swim-analytics/index.html"
            className="w-full border-0"
            style={{ minHeight: "80vh", background: "#f8f7f4" }}
            title="Swim Performance Analytics"
          />
        </div>
      )}

      {subTab === "split-analysis" && (
        <div className="w-full rounded-2xl overflow-hidden border-2 border-white/10" style={{ minHeight: "80vh" }}>
          <iframe
            src="/builds/2026-03-18-mettle-split-analyzer/index.html"
            className="w-full border-0"
            style={{ minHeight: "80vh", background: "#f8f7f4" }}
            title="Split Analysis"
          />
        </div>
      )}
    </div>
  );
}
