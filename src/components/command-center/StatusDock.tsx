"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SystemStatus, ServiceState } from "@/hooks/useSystemStatus";

const TOKENS = {
  bg: "rgba(10,10,10,0.94)",
  card: "rgba(255,255,255,0.03)",
  border: "#1e1e1e",
  borderHot: "rgba(124,58,237,0.35)",
  text: "#e5e5e5",
  textDim: "#888888",
  textMuted: "#555555",
  purple: "#7c3aed",
  purpleSoft: "#a855f7",
  gold: "#C9A84C",
  cyan: "#00f0ff",
  green: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
};

const AGENT_TINTS: Record<string, string> = {
  atlas: TOKENS.gold,
  triage: "#22c55e",
  shuri: "#10b981",
  nova: "#f97316",
  simons: "#22d3ee",
  mercury: "#34d399",
  vee: "#f472b6",
  ink: "#a78bfa",
  echo: "#fb923c",
  haven: "#38bdf8",
  widow: "#ef4444",
  "dr-strange": "#a855f7",
  kiyosaki: "#fbbf24",
  michael: "#3b82f6",
  selah: "#c4b5fd",
  prophets: "#fbbf24",
  themaestro: "#ec4899",
  themis: "#818cf8",
  aetherion: "#8b5cf6",
  proximon: "#06b6d4",
  archivist: "#9ca3af",
};

export type StatusTab = "agents" | "gateway" | "revenue" | "network";

const TABS: { id: StatusTab; label: string; accent: string }[] = [
  { id: "agents", label: "Agents", accent: TOKENS.gold },
  { id: "gateway", label: "Gateway", accent: TOKENS.purpleSoft },
  { id: "revenue", label: "Revenue", accent: TOKENS.amber },
  { id: "network", label: "Network", accent: TOKENS.cyan },
];

interface AgentDetail {
  id: string;
  name: string;
  model: string;
  role: string;
  status: "active" | "idle" | string;
}

interface AgentsResponse {
  agents?: AgentDetail[];
  count?: number;
  activeCount?: number;
  updated?: string;
  source?: string;
  version?: string;
}

interface GatewayResponse {
  ok?: boolean;
  configured?: boolean;
  reachable?: boolean;
  url?: string;
  latencyMs?: number;
  error?: string;
}

interface RevenueResponse {
  subscriptions?: { mrr?: number; arr?: number; active?: number };
  revenue?: { last30Days?: number; gross?: number };
  source?: string;
  charges?: Array<{ id?: string; amount?: number; created?: number; description?: string; status?: string }>;
}

interface StatusDockProps {
  open: boolean;
  tab: StatusTab;
  status: SystemStatus;
  onTabChange: (t: StatusTab) => void;
  onClose: () => void;
}

const STATE_COLOR: Record<ServiceState, string> = {
  ok: TOKENS.green,
  degraded: TOKENS.amber,
  offline: TOKENS.red,
  unknown: TOKENS.textMuted,
};

const STATE_LABEL: Record<ServiceState, string> = {
  ok: "Operational",
  degraded: "Degraded",
  offline: "Offline",
  unknown: "Unknown",
};

function fmtMoneyFull(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function fmtPing(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "—";
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function tintFor(id: string): string {
  return AGENT_TINTS[id.toLowerCase()] ?? TOKENS.purpleSoft;
}

export function StatusDock({ open, tab, status, onTabChange, onClose }: StatusDockProps) {
  const [agents, setAgents] = useState<AgentDetail[] | null>(null);
  const [agentsUpdatedAt, setAgentsUpdatedAt] = useState<string | null>(null);
  const [revenue, setRevenue] = useState<RevenueResponse | null>(null);
  const [gatewayDetail, setGatewayDetail] = useState<GatewayResponse | null>(null);
  const [ping, setPing] = useState<number | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const refreshTab = useCallback(async () => {
    if (!open) return;
    const id = ++reqIdRef.current;

    if (tab === "agents") {
      try {
        const res = await fetch("/api/command-center/agents", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as AgentsResponse;
          if (id !== reqIdRef.current) return;
          setAgents(data.agents ?? []);
          setAgentsUpdatedAt(data.updated ?? new Date().toISOString());
        }
      } catch {
        /* keep prior data */
      }
    } else if (tab === "gateway") {
      try {
        const res = await fetch("/api/command-center/settings", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as GatewayResponse;
          if (id !== reqIdRef.current) return;
          setGatewayDetail(data);
        }
      } catch {
        /* ignore */
      }
    } else if (tab === "revenue") {
      try {
        const res = await fetch("/api/command-center/revenue", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as RevenueResponse;
          if (id !== reqIdRef.current) return;
          setRevenue(data);
        }
      } catch {
        /* ignore */
      }
    } else if (tab === "network") {
      try {
        const start = performance.now();
        const res = await fetch("/api/command-center/agents", { cache: "no-store", method: "HEAD" }).catch(() =>
          fetch("/api/command-center/agents", { cache: "no-store" })
        );
        if (id !== reqIdRef.current) return;
        const elapsed = performance.now() - start;
        if (res.ok || res.status > 0) setPing(elapsed);
      } catch {
        if (id === reqIdRef.current) setPing(null);
      }
    }
  }, [tab, open]);

  useEffect(() => {
    void refreshTab();
    if (!open) return;
    const id = window.setInterval(() => void refreshTab(), 8000);
    return () => window.clearInterval(id);
  }, [refreshTab, open]);

  const agentBuckets = useMemo(() => {
    const list = agents ?? [];
    const active = list.filter((a) => a.status === "active");
    const idle = list.filter((a) => a.status !== "active");
    return { active, idle };
  }, [agents]);

  return (
    <aside
      aria-hidden={!open}
      aria-label="Live telemetry"
      style={{
        position: "fixed",
        top: 56,
        right: 0,
        bottom: 0,
        width: "min(440px, 96vw)",
        zIndex: 60,
        background: TOKENS.bg,
        borderLeft: `1px solid ${TOKENS.border}`,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
        boxShadow: open ? `0 0 60px rgba(124,58,237,0.10), -2px 0 0 ${TOKENS.borderHot}` : "none",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        color: TOKENS.text,
      }}
    >
      <header
        style={{
          flexShrink: 0,
          padding: "12px 14px",
          borderBottom: `1px solid ${TOKENS.border}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: "monospace",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.24em",
            textTransform: "uppercase" as const,
            color: TOKENS.purpleSoft,
          }}
        >
          Telemetry
        </h2>
        <button
          type="button"
          onClick={() => void refreshTab()}
          aria-label="Refresh telemetry"
          style={{
            marginLeft: "auto",
            width: 28,
            height: 28,
            borderRadius: 6,
            border: `1px solid ${TOKENS.border}`,
            background: TOKENS.card,
            color: TOKENS.textDim,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          ↻
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close telemetry"
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: `1px solid ${TOKENS.border}`,
            background: TOKENS.card,
            color: TOKENS.textDim,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          ×
        </button>
      </header>

      <nav
        role="tablist"
        style={{
          flexShrink: 0,
          display: "flex",
          gap: 4,
          padding: "8px 12px",
          borderBottom: `1px solid ${TOKENS.border}`,
          background: "rgba(0,0,0,0.35)",
        }}
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(t.id)}
              style={{
                flex: 1,
                padding: "6px 8px",
                borderRadius: 6,
                border: `1px solid ${active ? `${t.accent}66` : TOKENS.border}`,
                background: active ? `${t.accent}1a` : TOKENS.card,
                color: active ? t.accent : TOKENS.textDim,
                fontFamily: "monospace",
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase" as const,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 14 }}>
        {tab === "agents" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Headline
              accent={TOKENS.gold}
              title={`${status.agents.active}/${status.agents.total} agents online`}
              subtitle={STATE_LABEL[status.agents.state]}
              state={status.agents.state}
            />
            {agents === null ? (
              <Placeholder text="Loading agent directory…" />
            ) : agents.length === 0 ? (
              <Placeholder text="Agent directory empty." />
            ) : (
              <>
                {agentBuckets.active.length > 0 && (
                  <Section title="Active" hint={`${agentBuckets.active.length} live`}>
                    {agentBuckets.active.map((a) => (
                      <AgentRow key={a.id} agent={a} live />
                    ))}
                  </Section>
                )}
                {agentBuckets.idle.length > 0 && (
                  <Section title="Idle" hint={`${agentBuckets.idle.length} standby`}>
                    {agentBuckets.idle.map((a) => (
                      <AgentRow key={a.id} agent={a} />
                    ))}
                  </Section>
                )}
              </>
            )}
            {agentsUpdatedAt && <Footnote text={`Updated ${new Date(agentsUpdatedAt).toLocaleString()}`} />}
          </div>
        )}

        {tab === "gateway" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Headline
              accent={TOKENS.purpleSoft}
              title="OpenClaw gateway"
              subtitle={STATE_LABEL[status.gateway.state]}
              state={status.gateway.state}
            />
            <KeyValueGrid
              rows={[
                ["Configured", gatewayDetail?.configured === false ? "No" : "Yes"],
                ["Reachable", gatewayDetail?.reachable ? "Yes" : "No"],
                ["URL", gatewayDetail?.url ?? "—"],
                ["Latency", fmtPing(gatewayDetail?.latencyMs ?? null)],
                ["Last error", gatewayDetail?.error ?? "—"],
              ]}
            />
            <Footnote text="Polls /api/command-center/settings every 8 seconds while open." />
          </div>
        )}

        {tab === "revenue" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Headline
              accent={TOKENS.amber}
              title={fmtMoneyFull(status.revenue.mrr)}
              subtitle={`MRR · ${STATE_LABEL[status.revenue.state]}`}
              state={status.revenue.state}
            />
            <KeyValueGrid
              rows={[
                ["MRR", fmtMoneyFull(status.revenue.mrr)],
                ["ARR", fmtMoneyFull(status.revenue.arr)],
                ["Last 30 days", fmtMoneyFull(status.revenue.last30)],
                ["Active subs", revenue?.subscriptions?.active != null ? String(revenue.subscriptions.active) : "—"],
              ]}
            />
            {Array.isArray(revenue?.charges) && revenue!.charges!.length > 0 && (
              <Section title="Recent charges" hint={`${revenue!.charges!.length} entries`}>
                {revenue!.charges!.slice(0, 6).map((c, i) => (
                  <div
                    key={c.id ?? i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "8px 10px",
                      background: TOKENS.card,
                      border: `1px solid ${TOKENS.border}`,
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                      {c.description ?? "Stripe charge"}
                    </span>
                    <span style={{ color: TOKENS.amber, fontWeight: 700 }}>
                      {fmtMoneyFull((c.amount ?? 0) / 100)}
                    </span>
                  </div>
                ))}
              </Section>
            )}
            <Footnote text="Stripe data via /api/command-center/revenue." />
          </div>
        )}

        {tab === "network" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Headline
              accent={TOKENS.cyan}
              title={status.network.online ? "Online" : "Offline"}
              subtitle={STATE_LABEL[status.network.state]}
              state={status.network.state}
            />
            <KeyValueGrid
              rows={[
                ["Browser online", status.network.online ? "Yes" : "No"],
                ["API ping", fmtPing(ping)],
                [
                  "User agent",
                  typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 80) : "—",
                ],
              ]}
            />
            <Footnote text="API ping refreshes every 8 seconds while this tab is visible." />
          </div>
        )}
      </div>
    </aside>
  );
}

function Headline({
  accent,
  title,
  subtitle,
  state,
}: {
  accent: string;
  title: string;
  subtitle: string;
  state: ServiceState;
}) {
  return (
    <div
      style={{
        padding: 14,
        background: `${accent}10`,
        border: `1px solid ${accent}33`,
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: STATE_COLOR[state],
            boxShadow: `0 0 8px ${STATE_COLOR[state]}aa`,
          }}
        />
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: "0.16em",
            color: TOKENS.textDim,
            textTransform: "uppercase" as const,
          }}
        >
          {subtitle}
        </span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", color: accent }}>{title}</div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: "0.18em",
            color: TOKENS.textDim,
            textTransform: "uppercase" as const,
          }}
        >
          {title}
        </span>
        {hint && (
          <span style={{ fontFamily: "monospace", fontSize: 10, color: TOKENS.textMuted }}>{hint}</span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{children}</div>
    </section>
  );
}

function AgentRow({ agent, live }: { agent: AgentDetail; live?: boolean }) {
  const tint = tintFor(agent.id);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        background: TOKENS.card,
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 6,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: `${tint}22`,
          border: `1px solid ${tint}66`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontFamily: "monospace",
          fontWeight: 700,
          color: tint,
          flexShrink: 0,
        }}
      >
        {agent.id.slice(0, 2).toUpperCase()}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, color: TOKENS.text, fontWeight: 600 }}>{agent.name}</div>
        <div
          style={{
            fontSize: 11,
            color: TOKENS.textMuted,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap" as const,
          }}
        >
          {agent.role} · {agent.model}
        </div>
      </div>
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: live ? TOKENS.green : TOKENS.textMuted,
          boxShadow: live ? `0 0 8px ${TOKENS.green}` : "none",
          flexShrink: 0,
        }}
      />
    </div>
  );
}

function KeyValueGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        rowGap: 4,
        columnGap: 16,
        padding: "10px 12px",
        background: TOKENS.card,
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 8,
        fontSize: 12,
      }}
    >
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 10,
              letterSpacing: "0.12em",
              color: TOKENS.textDim,
              textTransform: "uppercase" as const,
              alignSelf: "center",
            }}
          >
            {k}
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 11,
              color: TOKENS.text,
              alignSelf: "center",
              wordBreak: "break-word" as const,
            }}
          >
            {v}
          </div>
        </div>
      ))}
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: 18,
        background: TOKENS.card,
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 8,
        color: TOKENS.textDim,
        fontSize: 13,
        textAlign: "center" as const,
      }}
    >
      {text}
    </div>
  );
}

function Footnote({ text }: { text: string }) {
  return (
    <div
      style={{
        fontFamily: "monospace",
        fontSize: 10,
        color: TOKENS.textMuted,
        letterSpacing: "0.06em",
        textAlign: "center" as const,
      }}
    >
      {text}
    </div>
  );
}
