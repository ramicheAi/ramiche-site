"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { InstrumentPage, Panel, PgBtn } from "@/components/command-center/po/Instrument";

/* ══════════════════════════════════════════════════════════════════════════
   DECISIONS — Cross-channel synthesis ledger
   ──────────────────────────────────────────────────────────────────────────
   Every Atlas synthesis plan that the team has produced lands here. One card
   per plan, grouped by recency, with per-action status and owner commitments
   inline. This is where Ramon checks "what did the team agree to this week
   and what's actually done."

   Data comes from GET /api/command-center/chat/decisions which aggregates
   synthesis messages + their execution_acks + per-action status from
   messages.metadata. No new schema required.
   ══════════════════════════════════════════════════════════════════════════ */

const COLORS = {
  bg: "transparent",
  card: "var(--ink-1)",
  border: "var(--line)",
  text: {
    primary: "var(--t-hi)",
    secondary: "var(--t-mid)",
    muted: "var(--t-lo)",
  },
  accent: { purple: "var(--accent)", purpleSoft: "var(--c-violet)", gold: "var(--c-gold)" },
  status: {
    done: "var(--c-green)",
    blocked: "var(--c-red)",
    in_progress: "var(--c-amber)",
    cancelled: "var(--t-lo)",
    committed: "var(--c-violet)",
    pending: "var(--t-lo)",
  },
  agents: {
    atlas: "#FFD600",
    mercury: "#3B82F6",
    kiyosaki: "#22c55e",
    vee: "#a855f7",
    shuri: "#06b6d4",
    aetherion: "#ec4899",
    simons: "#84cc16",
    drstrange: "#f59e0b",
    proximon: "#8b5cf6",
    widow: "#ef4444",
    selah: "#14b8a6",
    prophets: "#fbbf24",
    themaestro: "#f472b6",
    nova: "#22d3ee",
    triage: "#fb7185",
    themis: "#d946ef",
  } as Record<string, string>,
};

type Action = {
  owner: string;
  task: string;
  deliverable?: string;
  due?: string;
};

type Decision = {
  synthesisId: string;
  channelId: string;
  channelName: string;
  synthesisAuthor: string;
  content: string;
  createdAt: string;
  approvedAt: string | null;
  plan: {
    decision: string;
    actions: Action[];
    risks: string[];
    next_check_in?: string;
  } | null;
  action_statuses: string[];
  acks: Array<{ owner: string; content: string; via?: string; createdAt: string }>;
};

function relativeDate(iso: string): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diff = now - t;
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function DecisionsPage() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "done">("all");
  const [updating, setUpdating] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/command-center/chat/decisions?limit=80");
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; decisions?: Decision[]; error?: string }
        | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error || `Load failed (HTTP ${res.status})`);
        setDecisions([]);
      } else {
        setDecisions(data.decisions || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setDecisions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onSetStatus = async (
    synthesisId: string,
    actionIndex: number,
    status: "pending" | "in_progress" | "done" | "blocked" | "cancelled"
  ) => {
    const key = `${synthesisId}:${actionIndex}`;
    setUpdating(key);
    try {
      const res = await fetch("/api/command-center/chat/action-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ synthesisId, actionIndex, status }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; action_statuses?: string[] }
        | null;
      if (res.ok && data?.ok && Array.isArray(data.action_statuses)) {
        setDecisions((prev) =>
          prev.map((d) =>
            d.synthesisId === synthesisId ? { ...d, action_statuses: data.action_statuses! } : d
          )
        );
      }
    } finally {
      setUpdating(null);
    }
  };

  const stats = useMemo(() => {
    let totalActions = 0;
    let done = 0;
    let blocked = 0;
    let inProgress = 0;
    let pending = 0;
    const active = decisions.filter((d) => d.approvedAt && d.plan);
    for (const d of active) {
      if (!d.plan) continue;
      for (let i = 0; i < d.plan.actions.length; i++) {
        totalActions++;
        const s = d.action_statuses[i] ?? "pending";
        if (s === "done") done++;
        else if (s === "blocked") blocked++;
        else if (s === "in_progress") inProgress++;
        else pending++;
      }
    }
    return {
      plans: active.length,
      totalActions,
      done,
      blocked,
      inProgress,
      pending,
    };
  }, [decisions]);

  const visible = useMemo(() => {
    if (statusFilter === "all") return decisions;
    return decisions.filter((d) => {
      if (!d.plan) return false;
      const total = d.plan.actions.length;
      const done = d.plan.actions.reduce(
        (n, _, i) => (d.action_statuses[i] === "done" ? n + 1 : n),
        0
      );
      if (statusFilter === "done") return done === total && total > 0;
      return done < total; // active
    });
  }, [decisions, statusFilter]);

  return (
    <InstrumentPage
      id="decisions"
      title="Decisions"
      section="Operations"
      icon="strategy"
      accent="var(--c-violet)"
      actions={
        <>
          <PgBtn icon="pulse" onClick={() => void load()}>Refresh</PgBtn>
          <Link
            href="/command-center/chat"
            style={{
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: "var(--r-sm)",
              background: COLORS.accent.purple,
              color: "var(--t-hi)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            ← Back to Chat
          </Link>
        </>
      }
    >
      <p
        style={{
          fontSize: 13,
          color: COLORS.text.secondary,
          margin: "0 0 24px",
        }}
      >
        Every approved synthesis plan across every channel. Track follow-through here.
      </p>

      {/* Stat strip */}
      <Panel title="Plan Telemetry" icon="strategy">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 12,
          }}
        >
          {[
            { label: "Approved plans", value: stats.plans, color: COLORS.accent.purpleSoft },
            { label: "Total actions", value: stats.totalActions, color: COLORS.text.primary },
            { label: "Done", value: stats.done, color: COLORS.status.done },
            { label: "In progress", value: stats.inProgress, color: COLORS.status.in_progress },
            { label: "Blocked", value: stats.blocked, color: COLORS.status.blocked },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                padding: "14px 16px",
                background: COLORS.card,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: 1.4,
                  color: COLORS.text.muted,
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                {s.label.toUpperCase()}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color, lineHeight: 1 }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div style={{ height: 20 }} />

      {/* Filter pills */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["all", "active", "done"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              style={{
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 20,
                cursor: "pointer",
                background: statusFilter === f ? COLORS.accent.purple : "transparent",
                color: statusFilter === f ? "var(--t-hi)" : COLORS.text.secondary,
                border: `1px solid ${statusFilter === f ? COLORS.accent.purple : COLORS.border}`,
                textTransform: "capitalize",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Body */}
        {loading && (
          <div style={{ color: COLORS.text.secondary, fontSize: 13, padding: "40px 0" }}>
            Loading decisions…
          </div>
        )}
        {!loading && error && (
          <div
            role="alert"
            style={{
              padding: "12px 14px",
              border: "1px solid color-mix(in srgb, var(--c-red) 40%, transparent)",
              background: "color-mix(in srgb, var(--c-red) 12%, transparent)",
              borderRadius: 8,
              color: "var(--c-red)",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}
        {!loading && !error && visible.length === 0 && (
          <div
            style={{
              padding: "60px 16px",
              textAlign: "center",
              border: `1px dashed ${COLORS.border}`,
              borderRadius: 12,
              background: COLORS.card,
            }}
          >
            <div style={{ fontSize: 14, color: COLORS.text.secondary, marginBottom: 12 }}>
              No decisions yet for this filter.
            </div>
            <div style={{ fontSize: 12, color: COLORS.text.muted }}>
              Synthesis plans appear here once Atlas runs a multi-agent group chat and you hit
              Approve.
            </div>
          </div>
        )}

        {!loading && !error && visible.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {visible.map((d) => {
              const total = d.plan?.actions.length ?? 0;
              const done = d.plan
                ? d.plan.actions.reduce(
                    (n, _, i) => (d.action_statuses[i] === "done" ? n + 1 : n),
                    0
                  )
                : 0;
              const fullyDone = total > 0 && done === total;
              return (
                <div
                  key={d.synthesisId}
                  style={{
                    background: COLORS.card,
                    border: `1px solid ${
                      fullyDone ? "color-mix(in srgb, var(--c-green) 40%, transparent)" : COLORS.border
                    }`,
                    borderRadius: 10,
                    padding: "16px 18px",
                  }}
                >
                  {/* Card header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: 1.2,
                          color: COLORS.accent.purpleSoft,
                        }}
                      >
                        #{d.channelName}
                      </span>
                      <span style={{ color: COLORS.text.muted, fontSize: 11 }}>·</span>
                      <span style={{ color: COLORS.text.muted, fontSize: 11 }}>
                        {relativeDate(d.createdAt)}
                      </span>
                      {d.approvedAt ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: fullyDone ? COLORS.status.done : COLORS.accent.purpleSoft,
                            letterSpacing: 1.2,
                            marginLeft: 6,
                          }}
                        >
                          {fullyDone ? "✓ COMPLETE" : `${done}/${total} DONE`}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: COLORS.text.muted,
                            letterSpacing: 1.2,
                            marginLeft: 6,
                          }}
                        >
                          UNAPPROVED
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/command-center/chat`}
                      style={{ fontSize: 11, color: COLORS.accent.purpleSoft, textDecoration: "none" }}
                    >
                      open thread ›
                    </Link>
                  </div>

                  {/* Decision sentence */}
                  {d.plan && (
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: COLORS.text.primary,
                        marginBottom: 12,
                        lineHeight: 1.5,
                      }}
                    >
                      {d.plan.decision}
                    </div>
                  )}

                  {/* Actions */}
                  {d.plan && d.plan.actions.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        marginBottom: d.plan.risks.length > 0 || d.plan.next_check_in ? 12 : 0,
                      }}
                    >
                      {d.plan.actions.map((a, i) => {
                        const status = (d.action_statuses[i] ?? "pending") as
                          | "pending"
                          | "in_progress"
                          | "done"
                          | "blocked"
                          | "cancelled";
                        const ack = d.acks.find((x) => x.owner === a.owner.toLowerCase());
                        const updatingThis = updating === `${d.synthesisId}:${i}`;
                        const dotColor =
                          status === "done"
                            ? COLORS.status.done
                            : status === "blocked"
                              ? COLORS.status.blocked
                              : status === "in_progress"
                                ? COLORS.status.in_progress
                                : status === "cancelled"
                                  ? COLORS.status.cancelled
                                  : ack
                                    ? COLORS.status.committed
                                    : COLORS.status.pending;
                        return (
                          <div key={i} style={{ display: "flex", gap: 10 }}>
                            <span
                              style={{
                                flex: "0 0 auto",
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                background: dotColor,
                                marginTop: 5,
                              }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, color: COLORS.text.primary, lineHeight: 1.55 }}>
                                <span
                                  style={{
                                    color:
                                      COLORS.agents[a.owner.toLowerCase()] || COLORS.text.primary,
                                    fontWeight: 700,
                                  }}
                                >
                                  @{a.owner}
                                </span>{" "}
                                — {a.task}
                                {a.due ? (
                                  <span style={{ color: COLORS.text.muted, marginLeft: 6 }}>
                                    · due {a.due}
                                  </span>
                                ) : null}
                              </div>
                              {ack && (
                                <div
                                  style={{
                                    marginTop: 4,
                                    fontSize: 12,
                                    color: COLORS.text.secondary,
                                    lineHeight: 1.55,
                                    fontStyle: "italic",
                                  }}
                                >
                                  “
                                  {ack.content.length > 280
                                    ? ack.content.slice(0, 280) + "…"
                                    : ack.content}
                                  ”
                                </div>
                              )}
                              {d.approvedAt && status !== "done" && status !== "cancelled" && (
                                <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                                  {status !== "in_progress" && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onSetStatus(d.synthesisId, i, "in_progress")
                                      }
                                      disabled={updatingThis}
                                      style={{
                                        padding: "3px 10px",
                                        fontSize: 10,
                                        fontWeight: 600,
                                        borderRadius: 4,
                                        background: "transparent",
                                        color: COLORS.status.in_progress,
                                        border: `1px solid color-mix(in srgb, ${COLORS.status.in_progress} 50%, transparent)`,
                                        cursor: updatingThis ? "wait" : "pointer",
                                      }}
                                    >
                                      Start
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => onSetStatus(d.synthesisId, i, "done")}
                                    disabled={updatingThis}
                                    style={{
                                      padding: "3px 10px",
                                      fontSize: 10,
                                      fontWeight: 600,
                                      borderRadius: 4,
                                      background: "transparent",
                                      color: COLORS.status.done,
                                      border: `1px solid color-mix(in srgb, ${COLORS.status.done} 50%, transparent)`,
                                      cursor: updatingThis ? "wait" : "pointer",
                                    }}
                                  >
                                    ✓ Done
                                  </button>
                                  {status !== "blocked" && (
                                    <button
                                      type="button"
                                      onClick={() => onSetStatus(d.synthesisId, i, "blocked")}
                                      disabled={updatingThis}
                                      style={{
                                        padding: "3px 10px",
                                        fontSize: 10,
                                        fontWeight: 600,
                                        borderRadius: 4,
                                        background: "transparent",
                                        color: COLORS.status.blocked,
                                        border: `1px solid color-mix(in srgb, ${COLORS.status.blocked} 50%, transparent)`,
                                        cursor: updatingThis ? "wait" : "pointer",
                                      }}
                                    >
                                      Blocked
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Risks + next check-in */}
                  {d.plan && (d.plan.risks.length > 0 || d.plan.next_check_in) && (
                    <div
                      style={{
                        borderTop: `1px solid ${COLORS.border}`,
                        paddingTop: 10,
                        marginTop: 4,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {d.plan.risks.length > 0 && (
                        <div style={{ fontSize: 11, color: COLORS.text.muted }}>
                          <span style={{ color: COLORS.status.blocked, fontWeight: 700 }}>
                            RISKS:
                          </span>{" "}
                          {d.plan.risks.join(" · ")}
                        </div>
                      )}
                      {d.plan.next_check_in && (
                        <div style={{ fontSize: 11, color: COLORS.text.muted }}>
                          <span style={{ color: COLORS.accent.purpleSoft, fontWeight: 700 }}>
                            NEXT CHECK-IN:
                          </span>{" "}
                          {d.plan.next_check_in}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </InstrumentPage>
  );
}
