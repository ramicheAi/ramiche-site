"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";
import { InstrumentPage, Panel } from "@/components/command-center/po/Instrument";

/* ══════════════════════════════════════════════════════════════════════════════
   OBSERVATORY — Live SSE metrics (agents, git, YOLO, cron, vitals)
   ══════════════════════════════════════════════════════════════════════════════ */

interface CommitRow {
  hash?: string;
  date?: string;
  author?: string;
  message?: string;
}

interface AgentRow {
  id: string;
  model?: string;
  provider?: string;
  role?: string;
  capabilities?: string[];
  skills?: string[];
}

interface AgentDirectory {
  agents: AgentRow[];
  version?: string;
  updated?: string;
}

interface SystemVitals {
  uptime: string;
  memory: { total: string; free: string; used: string; percent: string };
  cpu?: { cores: number; model: string; load: string };
  disk?: { total: string; used: string; available: string; percent: string };
}

interface YoloBuild {
  name?: string;
  folder?: string;
  date?: string;
  agent?: string;
  status?: string;
}

function mergeCommitsByHash(prev: CommitRow[], incoming: CommitRow[]): CommitRow[] {
  const seen = new Set(prev.map((c) => c.hash).filter(Boolean));
  const next = [...prev];
  for (const c of incoming) {
    const h = c.hash;
    if (h && !seen.has(h)) {
      seen.add(h);
      next.unshift(c);
    }
  }
  return next;
}

export default function ObservatoryLivePage() {
  const esRef = useRef<EventSource | null>(null);
  const [ready, setReady] = useState(false);
  const [sseStatus, setSseStatus] = useState<"connecting" | "open" | "error">("connecting");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [vitals, setVitals] = useState<SystemVitals | null>(null);
  const [commits, setCommits] = useState<CommitRow[]>([]);
  const [yoloBuilds, setYoloBuilds] = useState<YoloBuild[]>([]);
  const [cronHistory, setCronHistory] = useState<Record<string, unknown>[]>([]);
  const [agentsDir, setAgentsDir] = useState<AgentDirectory | null>(null);

  const touch = useCallback(() => {
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/command-center/sse");
    esRef.current = es;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSseStatus("connecting");

    es.onopen = () => {
      setSseStatus("open");
    };

    es.onerror = () => {
      setSseStatus("error");
    };

    const onSnapshot = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as {
          vitals?: SystemVitals;
          commits?: CommitRow[];
          yoloBuilds?: YoloBuild[];
          cronHistory?: Record<string, unknown>[];
          agents?: AgentDirectory;
        };
        if (data.vitals != null) setVitals(data.vitals);
        if (Array.isArray(data.commits)) setCommits(data.commits);
        if (Array.isArray(data.yoloBuilds)) setYoloBuilds(data.yoloBuilds);
        if (Array.isArray(data.cronHistory)) setCronHistory(data.cronHistory);
        if (data.agents != null) setAgentsDir(data.agents);
        setReady(true);
        touch();
      } catch {
        /* ignore malformed */
      }
    };

    const onVitals = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { vitals?: SystemVitals };
        if (data.vitals != null) setVitals(data.vitals);
        touch();
      } catch {
        /* ignore */
      }
    };

    const onCommits = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { commits?: CommitRow[] };
        if (Array.isArray(data.commits) && data.commits.length > 0) {
          setCommits((prev) => mergeCommitsByHash(prev, data.commits!));
        }
        touch();
      } catch {
        /* ignore */
      }
    };

    const onYolo = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { yoloBuilds?: YoloBuild[] };
        if (Array.isArray(data.yoloBuilds)) setYoloBuilds(data.yoloBuilds);
        touch();
      } catch {
        /* ignore */
      }
    };

    const onCronHistory = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { cronHistory?: Record<string, unknown>[] };
        if (Array.isArray(data.cronHistory)) setCronHistory(data.cronHistory);
        touch();
      } catch {
        /* ignore */
      }
    };

    const onAgents = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { agents?: AgentDirectory };
        if (data.agents != null) setAgentsDir(data.agents);
        touch();
      } catch {
        /* ignore */
      }
    };

    es.addEventListener("snapshot", onSnapshot);
    es.addEventListener("vitals", onVitals);
    es.addEventListener("commits", onCommits);
    es.addEventListener("yolo", onYolo);
    es.addEventListener("cronHistory", onCronHistory);
    es.addEventListener("agents", onAgents);

    return () => {
      es.removeEventListener("snapshot", onSnapshot);
      es.removeEventListener("vitals", onVitals);
      es.removeEventListener("commits", onCommits);
      es.removeEventListener("yolo", onYolo);
      es.removeEventListener("cronHistory", onCronHistory);
      es.removeEventListener("agents", onAgents);
      es.close();
      esRef.current = null;
    };
  }, [touch]);

  const agentCount = agentsDir?.agents?.length ?? 0;
  const commits24h = commits.length;
  const yoloCount = yoloBuilds.length;
  const cronExecCount = cronHistory.length;
  const uptimeStr = vitals?.uptime ?? "—";
  const memPct = vitals?.memory?.percent ?? "—";

  const lastUpdatedLabel =
    lastUpdated != null
      ? lastUpdated.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "medium",
        })
      : "—";

  const latestCommit = commits[0];
  const latestYolo = yoloBuilds[0];
  const latestCron = cronHistory[0] as { name?: string; id?: string; status?: string; time?: string } | undefined;

  return (
    <InstrumentPage
      id="observatory"
      title="Observatory"
      section="Business"
      icon="observatory"
      accent="var(--c-violet)"
      live={sseStatus === "open"}
      actions={
        <Link
          href="/command-center/observatory"
          style={{
            fontSize: 11,
            letterSpacing: "0.1em",
            color: "var(--accent)",
            textDecoration: "none",
            borderBottom: "1px solid var(--line-2)",
          }}
        >
          Strategic Observatory (Multiverse) →
        </Link>
      }
    >
      <ParticleField variant="gold" opacity={0.28} interactive connections />

      <div style={{ position: "relative", zIndex: 2 }}>
        <p style={{ margin: "0 0 6px", fontSize: 13, color: "var(--t-mid)" }}>
          Live stream from <span style={{ color: "var(--accent)", fontFamily: "var(--f-mono)" }}>/api/command-center/sse</span>
        </p>
        <p style={{ margin: "0 0 24px", fontSize: 12, color: "var(--t-lo)" }}>
          Last updated:{" "}
          <span style={{ color: "var(--accent)", fontFamily: "var(--f-mono)" }}>{lastUpdatedLabel}</span>
          {sseStatus === "error" && (
            <span style={{ marginLeft: 12, color: "var(--c-red)" }}>· SSE connection error — retrying…</span>
          )}
        </p>

        {!ready ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "50vh",
              fontSize: 15,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--accent)",
            }}
          >
            Connecting to SSE…
          </div>
        ) : (
          <Panel title="Live Telemetry" icon="pulse">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 16,
              width: "100%",
              padding: 16,
            }}
          >
            {[
              {
                label: "Agents",
                value: String(agentCount),
                sub: [agentsDir?.version && `v${agentsDir.version}`, agentsDir?.updated].filter(Boolean).join(" · ") || "",
              },
              {
                label: "Git commits (24h)",
                value: String(commits24h),
                sub: latestCommit?.message
                  ? `${latestCommit.hash ?? ""} ${latestCommit.message}`.trim().slice(0, 120)
                  : "",
              },
              {
                label: "YOLO builds",
                value: String(yoloCount),
                sub: latestYolo?.name || latestYolo?.folder || "",
              },
              {
                label: "Cron executions",
                value: String(cronExecCount),
                sub: latestCron
                  ? [latestCron.name ?? latestCron.id, latestCron.status, latestCron.time].filter(Boolean).join(" · ")
                  : "",
              },
              {
                label: "System uptime",
                value: uptimeStr.length > 48 ? `${uptimeStr.slice(0, 48)}…` : uptimeStr,
                sub: vitals?.cpu?.load ? `Load ${vitals.cpu.load}` : "",
              },
              {
                label: "Memory usage",
                value: memPct,
                sub: vitals?.memory?.used && vitals?.memory?.total ? `${vitals.memory.used} / ${vitals.memory.total}` : "",
              },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: "20px 18px",
                  background: "var(--ink-1)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t-lo)", marginBottom: 10 }}>
                  {card.label}
                </div>
                <div style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800, color: "var(--accent)", fontFamily: "var(--f-mono)", lineHeight: 1.2 }}>
                  {card.value}
                </div>
                {card.sub ? (
                  <div style={{ marginTop: 10, fontSize: 11, color: "var(--t-lo)", lineHeight: 1.45 }}>{card.sub}</div>
                ) : null}
              </div>
            ))}
          </div>
          </Panel>
        )}
      </div>
    </InstrumentPage>
  );
}
