"use client";

import { useState, useMemo } from "react";
import type { Athlete, RosterGroup } from "../types";

/* ══════════════════════════════════════════════════════════════
   BILLING VIEW — Season Recap Invoice (Sweat Economy P0)
   Transforms GoMotion PDF invoices into gamified Season Recaps
   Design: Apex dark theme · glassmorphism · neon accents
   ══════════════════════════════════════════════════════════════ */

// ── Types ──────────────────────────────────────────────────

interface InvoiceLineItem {
  id: string;
  description: string;
  amount: number;
  type: "tuition" | "meet-fee" | "equipment" | "misc";
}

interface MonthlyInvoice {
  id: string;
  month: string;        // "2026-03"
  athleteId: string;
  athleteName: string;
  group: string;
  lineItems: InvoiceLineItem[];
  total: number;
  pointsApplied: number;
  amountDue: number;
  status: "paid" | "pending" | "overdue";
  paidAt?: number;
  // Season recap data
  recap: {
    practicesAttended: number;
    totalPractices: number;
    xpEarned: number;
    levelReached: number;
    bestTimeDrops: number;
    questsCompleted: number;
    streakHigh: number;
    mvpCount: number;
  };
}

interface BillingViewProps {
  roster: Athlete[];
  groups: readonly RosterGroup[];
  currentGroup: string;
}

// ── Mock Data ─────────────────────────────────────────────

function generateMockInvoices(roster: Athlete[]): MonthlyInvoice[] {
  return roster.map((a) => ({
    id: `inv-${a.id}-2026-03`,
    month: "2026-03",
    athleteId: a.id,
    athleteName: a.name,
    group: a.group,
    lineItems: [
      { id: "1", description: "Monthly Tuition — Platinum", amount: 185, type: "tuition" },
      { id: "2", description: "Spring Classic Meet Fee", amount: 45, type: "meet-fee" },
      { id: "3", description: "Team Cap (replacement)", amount: 25, type: "equipment" },
    ],
    total: 255,
    pointsApplied: Math.floor(a.xp * 0.02),
    amountDue: 255 - Math.floor(a.xp * 0.02),
    status: Math.random() > 0.3 ? "paid" : Math.random() > 0.5 ? "pending" : "overdue",
    paidAt: Math.random() > 0.3 ? Date.now() - Math.random() * 604800000 : undefined,
    recap: {
      practicesAttended: a.totalPractices,
      totalPractices: 22,
      xpEarned: a.xp,
      levelReached: Math.floor(a.xp / 100) + 1,
      bestTimeDrops: Math.floor(Math.random() * 5),
      questsCompleted: Object.values(a.quests || {}).filter(s => s === "done").length,
      streakHigh: a.streak,
      mvpCount: Math.floor(Math.random() * 3),
    },
  }));
}

// ── Status badge component ────────────────────────────────

function StatusBadge({ status }: { status: MonthlyInvoice["status"] }) {
  const styles = {
    paid: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    overdue: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[status]}`}>
      {status}
    </span>
  );
}

// ── Stat pill ─────────────────────────────────────────────

function StatPill({ label, value, color = "#00f0ff" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
      <span className="text-lg font-black tabular-nums" style={{ color }}>{value}</span>
      <span className="text-[10px] text-[#f8fafc]/40 uppercase tracking-wider">{label}</span>
    </div>
  );
}

// ── Season Recap Card (the invoice-as-recap) ──────────────

function SeasonRecapCard({ invoice, onSelect }: { invoice: MonthlyInvoice; onSelect: (id: string) => void }) {
  const { recap } = invoice;
  const attendanceRate = recap.totalPractices > 0 ? Math.round((recap.practicesAttended / recap.totalPractices) * 100) : 0;

  return (
    <button
      onClick={() => onSelect(invoice.id)}
      className="w-full text-left game-panel relative bg-[#06020f]/80 backdrop-blur-xl border-2 border-[#00f0ff]/15 rounded-2xl p-5 transition-all duration-300 hover:border-[#00f0ff]/40 hover:-translate-y-[2px] hover:shadow-[0_0_30px_rgba(0,240,255,0.08)] group"
    >
      {/* Header: Athlete + Status */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00f0ff]/20 to-[#a855f7]/20 border border-[#00f0ff]/20 flex items-center justify-center text-lg font-black text-[#00f0ff]">
            {invoice.athleteName.charAt(0)}
          </div>
          <div>
            <div className="text-[#f8fafc] font-bold text-sm">{invoice.athleteName}</div>
            <div className="text-[#f8fafc]/40 text-xs">March 2026 · {invoice.group}</div>
          </div>
        </div>
        <StatusBadge status={invoice.status} />
      </div>

      {/* Mini Season Recap Stats */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <StatPill label="Attendance" value={`${attendanceRate}%`} color={attendanceRate >= 90 ? "#34d399" : attendanceRate >= 70 ? "#f59e0b" : "#ef4444"} />
        <StatPill label="XP Earned" value={recap.xpEarned} />
        <StatPill label="Level" value={recap.levelReached} color="#a855f7" />
        <StatPill label="Streak" value={`${recap.streakHigh}🔥`} color="#f59e0b" />
      </div>

      {/* Financial Summary */}
      <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[10px] text-[#f8fafc]/40 uppercase">Total</div>
            <div className="text-[#f8fafc] font-bold tabular-nums">${invoice.total}</div>
          </div>
          {invoice.pointsApplied > 0 && (
            <div>
              <div className="text-[10px] text-[#a855f7]/60 uppercase">Points Used</div>
              <div className="text-[#a855f7] font-bold tabular-nums">-${invoice.pointsApplied}</div>
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[10px] text-[#f8fafc]/40 uppercase">Due</div>
          <div className="text-[#00f0ff] font-black text-lg tabular-nums">${invoice.amountDue}</div>
        </div>
      </div>
    </button>
  );
}

// ── Detail Modal (full Season Recap Invoice) ──────────────

function InvoiceDetail({ invoice, onBack }: { invoice: MonthlyInvoice; onBack: () => void }) {
  const { recap } = invoice;
  const attendanceRate = recap.totalPractices > 0 ? Math.round((recap.practicesAttended / recap.totalPractices) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-2 text-[#f8fafc]/50 hover:text-[#00f0ff] transition-colors text-sm">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Billing
      </button>

      {/* Hero: Season Recap Header */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-[#00f0ff]/20 bg-gradient-to-br from-[#06020f] via-[#0e0e18] to-[#06020f] p-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,240,255,0.08),transparent_60%)]" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black text-[#f8fafc]">{invoice.athleteName}</h2>
              <p className="text-[#f8fafc]/50 text-sm">Season Recap — March 2026</p>
            </div>
            <StatusBadge status={invoice.status} />
          </div>

          {/* Hero Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-3xl font-black text-[#00f0ff] tabular-nums">{attendanceRate}%</div>
              <div className="text-[10px] text-[#f8fafc]/40 uppercase mt-1">Attendance</div>
              <div className="w-full h-1.5 rounded-full bg-white/[0.06] mt-2 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#00f0ff] to-[#a855f7] transition-all" style={{ width: `${attendanceRate}%` }} />
              </div>
            </div>
            <div className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-3xl font-black text-[#a855f7] tabular-nums">{recap.xpEarned}</div>
              <div className="text-[10px] text-[#f8fafc]/40 uppercase mt-1">XP Earned</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-3xl font-black text-[#f59e0b] tabular-nums">{recap.streakHigh}🔥</div>
              <div className="text-[10px] text-[#f8fafc]/40 uppercase mt-1">Best Streak</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-3xl font-black text-emerald-400 tabular-nums">{recap.bestTimeDrops}</div>
              <div className="text-[10px] text-[#f8fafc]/40 uppercase mt-1">Time Drops</div>
            </div>
          </div>
        </div>
      </div>

      {/* Achievements Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#06020f]/80 border border-[#00f0ff]/10">
          <div className="w-10 h-10 rounded-lg bg-[#a855f7]/20 flex items-center justify-center text-lg">🏆</div>
          <div>
            <div className="text-[#f8fafc] font-bold text-sm tabular-nums">{recap.questsCompleted}</div>
            <div className="text-[#f8fafc]/40 text-[10px] uppercase">Quests Done</div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#06020f]/80 border border-[#00f0ff]/10">
          <div className="w-10 h-10 rounded-lg bg-[#f59e0b]/20 flex items-center justify-center text-lg">⭐</div>
          <div>
            <div className="text-[#f8fafc] font-bold text-sm tabular-nums">{recap.mvpCount}</div>
            <div className="text-[#f8fafc]/40 text-[10px] uppercase">MVP Awards</div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#06020f]/80 border border-[#00f0ff]/10">
          <div className="w-10 h-10 rounded-lg bg-[#00f0ff]/20 flex items-center justify-center text-lg">📊</div>
          <div>
            <div className="text-[#f8fafc] font-bold text-sm tabular-nums">Lvl {recap.levelReached}</div>
            <div className="text-[#f8fafc]/40 text-[10px] uppercase">Level</div>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="rounded-2xl border-2 border-white/[0.06] bg-[#06020f]/60 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <h3 className="text-sm font-bold text-[#f8fafc]/80 uppercase tracking-wider">Invoice Details</h3>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {invoice.lineItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${item.type === "tuition" ? "bg-[#00f0ff]" : item.type === "meet-fee" ? "bg-[#a855f7]" : item.type === "equipment" ? "bg-[#f59e0b]" : "bg-[#f8fafc]/30"}`} />
                <span className="text-[#f8fafc]/80 text-sm">{item.description}</span>
              </div>
              <span className="text-[#f8fafc] font-bold tabular-nums text-sm">${item.amount}</span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t-2 border-white/[0.08] px-5 py-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[#f8fafc]/50">Subtotal</span>
            <span className="text-[#f8fafc] tabular-nums font-bold">${invoice.total}</span>
          </div>
          {invoice.pointsApplied > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-[#a855f7]/70">Points Applied</span>
              <span className="text-[#a855f7] tabular-nums font-bold">-${invoice.pointsApplied}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-white/[0.06]">
            <span className="text-[#f8fafc]/80 font-bold uppercase text-sm">Amount Due</span>
            <span className="text-[#00f0ff] font-black text-2xl tabular-nums">${invoice.amountDue}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Treasurer Summary Bar ─────────────────────────────────

function TreasurerSummary({ invoices }: { invoices: MonthlyInvoice[] }) {
  const total = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const collected = invoices.filter(i => i.status === "paid").reduce((sum, inv) => sum + inv.total, 0);
  const pending = invoices.filter(i => i.status === "pending").reduce((sum, inv) => sum + inv.amountDue, 0);
  const overdue = invoices.filter(i => i.status === "overdue").reduce((sum, inv) => sum + inv.amountDue, 0);
  const collectionRate = total > 0 ? Math.round((collected / total) * 100) : 0;
  const pointsRedeemed = invoices.reduce((sum, inv) => sum + inv.pointsApplied, 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <div className="p-4 rounded-xl bg-[#06020f]/80 border-2 border-[#00f0ff]/15">
        <div className="text-[10px] text-[#f8fafc]/40 uppercase mb-1">MRR</div>
        <div className="text-xl font-black text-[#00f0ff] tabular-nums">${total.toLocaleString()}</div>
      </div>
      <div className="p-4 rounded-xl bg-[#06020f]/80 border-2 border-emerald-500/15">
        <div className="text-[10px] text-[#f8fafc]/40 uppercase mb-1">Collected</div>
        <div className="text-xl font-black text-emerald-400 tabular-nums">${collected.toLocaleString()}</div>
      </div>
      <div className="p-4 rounded-xl bg-[#06020f]/80 border-2 border-amber-500/15">
        <div className="text-[10px] text-[#f8fafc]/40 uppercase mb-1">Pending</div>
        <div className="text-xl font-black text-amber-400 tabular-nums">${pending.toLocaleString()}</div>
      </div>
      <div className="p-4 rounded-xl bg-[#06020f]/80 border-2 border-red-500/15">
        <div className="text-[10px] text-[#f8fafc]/40 uppercase mb-1">Overdue</div>
        <div className="text-xl font-black text-red-400 tabular-nums">${overdue.toLocaleString()}</div>
      </div>
      <div className="p-4 rounded-xl bg-[#06020f]/80 border-2 border-[#a855f7]/15">
        <div className="text-[10px] text-[#f8fafc]/40 uppercase mb-1">Points Used</div>
        <div className="text-xl font-black text-[#a855f7] tabular-nums">${pointsRedeemed}</div>
      </div>
      <div className="p-4 rounded-xl bg-[#06020f]/80 border-2 border-[#00f0ff]/15">
        <div className="text-[10px] text-[#f8fafc]/40 uppercase mb-1">Collection</div>
        <div className="text-xl font-black tabular-nums" style={{ color: collectionRate >= 95 ? "#34d399" : collectionRate >= 85 ? "#f59e0b" : "#ef4444" }}>{collectionRate}%</div>
        <div className="w-full h-1 rounded-full bg-white/[0.06] mt-1.5 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-[#00f0ff] to-[#a855f7]" style={{ width: `${collectionRate}%` }} />
        </div>
      </div>
    </div>
  );
}

// ── Main BillingView ──────────────────────────────────────

export default function BillingView({ roster, groups, currentGroup }: BillingViewProps) {
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "paid" | "pending" | "overdue">("all");

  const invoices = useMemo(() => generateMockInvoices(roster), [roster]);

  const filteredInvoices = useMemo(() =>
    filterStatus === "all" ? invoices : invoices.filter(inv => inv.status === filterStatus),
    [invoices, filterStatus]
  );

  const detail = selectedInvoice ? invoices.find(inv => inv.id === selectedInvoice) : null;

  if (detail) {
    return <InvoiceDetail invoice={detail} onBack={() => setSelectedInvoice(null)} />;
  }

  const statusFilters: { id: typeof filterStatus; label: string; count: number }[] = [
    { id: "all", label: "All", count: invoices.length },
    { id: "paid", label: "Paid", count: invoices.filter(i => i.status === "paid").length },
    { id: "pending", label: "Pending", count: invoices.filter(i => i.status === "pending").length },
    { id: "overdue", label: "Overdue", count: invoices.filter(i => i.status === "overdue").length },
  ];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-[#f8fafc]">Billing</h2>
          <p className="text-[#f8fafc]/40 text-xs">Season Recap Invoices — March 2026</p>
        </div>
      </div>

      {/* Treasurer Summary */}
      <TreasurerSummary invoices={invoices} />

      {/* Status Filters */}
      <div className="flex gap-2">
        {statusFilters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilterStatus(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterStatus === f.id
                ? "bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/30"
                : "bg-white/[0.03] text-[#f8fafc]/50 border border-white/[0.06] hover:border-white/[0.12]"
            }`}
          >
            {f.label} <span className="ml-1 tabular-nums opacity-60">{f.count}</span>
          </button>
        ))}
      </div>

      {/* Invoice Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" style={{ contentVisibility: "auto", containIntrinsicSize: "auto 400px" }}>
        {filteredInvoices.map(inv => (
          <SeasonRecapCard key={inv.id} invoice={inv} onSelect={setSelectedInvoice} />
        ))}
      </div>

      {filteredInvoices.length === 0 && (
        <div className="text-center py-12 text-[#f8fafc]/30 text-sm">
          No invoices match the current filter.
        </div>
      )}
    </div>
  );
}
