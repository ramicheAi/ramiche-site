"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AGENT_UI, AGENT_ORBIT_IDS, type OrbitAgentId } from "@/app/command-center/dashboard-agents";
import { useGlobalSearch, type GlobalSearchResult } from "@/hooks/useGlobalSearch";
import { Icon } from "@/components/command-center/po/Brand";

const TOKENS = {
  bg: "rgba(10,10,10,0.92)",
  card: "rgba(255,255,255,0.04)",
  border: "rgba(124,58,237,0.35)",
  borderSubtle: "#1e1e1e",
  text: "#e5e5e5",
  textDim: "#888888",
  textMuted: "#555555",
  purple: "#7c3aed",
  purpleSoft: "#a855f7",
  gold: "#C9A84C",
  cyan: "#00f0ff",
};

/* map a legacy unicode/route icon to a Parallax OS geometric Icon name */
function poIconName(entry: { kind: string; icon?: string; id?: string }): string {
  if (entry.kind === "agent") return "agents";
  if (entry.kind === "action") {
    if (entry.id?.includes("dispatch")) return "dispatch";
    if (entry.id?.includes("lock")) return "security";
    if (entry.id?.includes("refresh")) return "spark";
    if (entry.id?.includes("health")) return "health";
    if (entry.id?.includes("voice")) return "mic";
    return "dot";
  }
  if (entry.kind === "global") return "search";
  // route entries: best-effort map by id below in execute render
  return "dot";
}

interface BaseEntry {
  id: string;
  label: string;
  hint?: string;
  keywords?: string;
  accent?: string;
  icon?: string;
}

interface RouteEntry extends BaseEntry {
  kind: "route";
  href: string;
}

interface AgentEntry extends BaseEntry {
  kind: "agent";
  agentId: OrbitAgentId;
}

interface ActionEntry extends BaseEntry {
  kind: "action";
  action: () => void;
}

interface GlobalEntry extends BaseEntry {
  kind: "global";
  data: GlobalSearchResult;
}

type PaletteEntry = RouteEntry | AgentEntry | ActionEntry | GlobalEntry;

const ROUTES: RouteEntry[] = [
  { kind: "route", id: "dashboard", label: "Dashboard", hint: "Mission control", icon: "◇", accent: TOKENS.gold, href: "/command-center", keywords: "home" },
  { kind: "route", id: "jobs", label: "Jobs", hint: "Live run feed", icon: "⚡", accent: TOKENS.purple, href: "/command-center/jobs", keywords: "runs tasks dispatch fleet" },
  { kind: "route", id: "chat", label: "Chat", hint: "All channels + DMs", icon: "◈", accent: TOKENS.purple, href: "/command-center/chat" },
  { kind: "route", id: "agents", label: "Agents", hint: "Roster + models", icon: "✦", accent: "#34d399", href: "/command-center/agents" },
  { kind: "route", id: "tasks", label: "Tasks", hint: "Kanban board", icon: "▣", accent: "#f59e0b", href: "/command-center/tasks" },
  { kind: "route", id: "calendar", label: "Calendar", hint: "Cron + events", icon: "○", accent: "#38bdf8", href: "/command-center/calendar" },
  { kind: "route", id: "projects", label: "Projects", hint: "Tracked work", icon: "◉", accent: "#818cf8", href: "/command-center/projects" },
  { kind: "route", id: "missions", label: "Missions", icon: "✦", accent: TOKENS.gold, href: "/command-center/missions" },
  { kind: "route", id: "memory", label: "Memory", hint: "Agent journal", icon: "◎", accent: TOKENS.purpleSoft, href: "/command-center/memory" },
  { kind: "route", id: "docs", label: "Docs", hint: "Library", icon: "≡", accent: "#3b82f6", href: "/command-center/docs" },
  { kind: "route", id: "office", label: "Office", hint: "3D workspace", icon: "▣", accent: "#06b6d4", href: "/command-center/office" },
  { kind: "route", id: "vitals", label: "Vitals", hint: "Health + verse + weather", icon: "♥", accent: "#10b981", href: "/command-center/vitals" },
  { kind: "route", id: "activity", label: "Activity", icon: "●", accent: "#2563eb", href: "/command-center/activity" },
  { kind: "route", id: "health", label: "System Health", hint: "Service status", icon: "◉", accent: "#22d3ee", href: "/command-center/health" },
  { kind: "route", id: "security", label: "Security", icon: "◆", accent: "#ef4444", href: "/command-center/security" },
  { kind: "route", id: "settings", label: "Settings", hint: "Models + gateway", icon: "⚙", accent: TOKENS.textDim, href: "/command-center/settings" },
  { kind: "route", id: "finance", label: "Finance HQ", icon: "◈", accent: "#fcd34d", href: "/command-center/finance" },
  { kind: "route", id: "arbitrage", label: "Arbitrage Calc", icon: "△", accent: "#fcd34d", href: "/command-center/finance/arbitrage" },
  { kind: "route", id: "revenue", label: "Revenue", hint: "Stripe MRR / payouts", icon: "◇", accent: "#d97706", href: "/command-center/revenue" },
  { kind: "route", id: "sales", label: "Sales", icon: "◉", accent: "#f59e0b", href: "/command-center/sales" },
  { kind: "route", id: "prospector", label: "Prospector", hint: "Find businesses worldwide → pipeline", icon: "🌐", accent: "#22c55e", href: "/command-center/prospector", keywords: "leads business search nationwide overseas places osm" },
  { kind: "route", id: "leads", label: "Leads", hint: "Diagnose → priced bundle → proposal", icon: "◎", accent: "#22c55e", href: "/command-center/leads", keywords: "crm diagnose audit pipeline quote" },
  { kind: "route", id: "proposals", label: "Proposals", icon: "▷", accent: "#f59e0b", href: "/command-center/sales/proposals" },
  { kind: "route", id: "pricing", label: "Pricing", icon: "◎", accent: "#f59e0b", href: "/command-center/sales/pricing" },
  { kind: "route", id: "agent-pricing", label: "Agent Pricing", icon: "◇", accent: "#f59e0b", href: "/command-center/sales/agent-pricing" },
  { kind: "route", id: "legal", label: "Legal", icon: "⚖", accent: "#8b5cf6", href: "/command-center/legal" },
  { kind: "route", id: "reports", label: "Reports", icon: "▤", accent: "#f59e0b", href: "/command-center/reports" },
  { kind: "route", id: "content", label: "Content", icon: "✒", accent: "#c084fc", href: "/command-center/content" },
  { kind: "route", id: "studio", label: "Studio", icon: "♫", accent: "#f59e0b", href: "/command-center/studio" },
  { kind: "route", id: "app-builder", label: "App Builder", icon: "▣", accent: TOKENS.cyan, href: "/command-center/app-builder" },
  { kind: "route", id: "builder", label: "Builder", hint: "Dispatch dev/design to Claude Code", icon: "⚒", accent: TOKENS.cyan, href: "/command-center/builder", keywords: "dev design code claude build" },
  { kind: "route", id: "wellness", label: "Wellness", icon: "◈", accent: "#10b981", href: "/command-center/wellness" },
  { kind: "route", id: "fabrication", label: "Fabrication", hint: "NOVA + Bambu", icon: "⚡", accent: "#14b8a6", href: "/command-center/fabrication" },
  { kind: "route", id: "yolo", label: "YOLO Builds", icon: "⚡", accent: "#f59e0b", href: "/command-center/yolo" },
  { kind: "route", id: "terminal", label: "Terminal", icon: ">_", accent: "#0f172a", href: "/command-center/terminal" },
];

/* route id → Parallax OS geometric icon name */
const ROUTE_ICON: Record<string, string> = {
  dashboard: "dashboard", jobs: "bolt", chat: "comms", agents: "agents", tasks: "tasks",
  calendar: "calendar", projects: "projects", missions: "mettle", memory: "memory",
  docs: "docs", office: "office", comms: "comms", vitals: "health", activity: "pulse",
  health: "health", security: "security", settings: "settings", finance: "finance",
  arbitrage: "arbitrage", revenue: "finance", sales: "sales", prospector: "nexus",
  leads: "strategy", proposals: "proposals", pricing: "finance", "agent-pricing": "finance",
  legal: "legal", strategy: "strategy", reports: "reports", content: "content",
  studio: "studio", "app-builder": "builder", builder: "builder", wellness: "wellness",
  fabrication: "fabrication", yolo: "bolt", "nerve-center": "nerve", terminal: "command",
  observatory: "observatory",
};

function buildAgentEntries(): AgentEntry[] {
  return AGENT_ORBIT_IDS.map((id) => {
    const ui = AGENT_UI[id];
    return {
      kind: "agent" as const,
      id: `agent:${id}`,
      agentId: id,
      label: ui.name,
      hint: ui.roleDisplay,
      icon: ui.icon,
      accent: ui.color,
      keywords: id,
    };
  });
}

function fuzzyScore(haystack: string, needle: string): number {
  if (!needle) return 1;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase().trim();
  if (!n) return 1;
  if (h.startsWith(n)) return 4;
  if (h.includes(n)) return 3;
  let i = 0;
  for (const ch of n) {
    const next = h.indexOf(ch, i);
    if (next === -1) return 0;
    i = next + 1;
  }
  return 1;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onLock?: () => void;
  onRefresh?: () => void;
}

export function CommandPalette({ open, onClose, onLock, onRefresh }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const actions: ActionEntry[] = useMemo(
    () => [
      {
        kind: "action",
        id: "action:voice",
        label: "Open Voice Chat",
        hint: "Talk to Atlas",
        icon: "◉",
        accent: TOKENS.gold,
        keywords: "voice jarvis mic talk",
        action: () => router.push("/command-center/chat"),
      },
      {
        kind: "action",
        id: "action:health",
        label: "Open System Health",
        hint: "Service status board",
        icon: "◉",
        accent: TOKENS.cyan,
        keywords: "status uptime services",
        action: () => router.push("/command-center/health"),
      },
      {
        kind: "action",
        id: "action:refresh",
        label: "Refresh Telemetry",
        hint: "Re-poll all status feeds",
        icon: "↻",
        accent: TOKENS.purpleSoft,
        keywords: "reload poll sync",
        action: () => onRefresh?.(),
      },
      {
        kind: "action",
        id: "action:lock",
        label: "Lock Command Center",
        hint: "Return to PIN gate",
        icon: "◆",
        accent: "#ef4444",
        keywords: "logout signout lock",
        action: () => onLock?.(),
      },
    ],
    [router, onLock, onRefresh]
  );

  const allEntries: PaletteEntry[] = useMemo(
    () => [...actions, ...ROUTES, ...buildAgentEntries()],
    [actions]
  );

  // Dispatch the typed instruction to the fleet as a tracked Job, then jump to
  // the live Jobs feed to watch it run. This is what turns the command bar from
  // a launcher into a control surface.
  const dispatchJob = useCallback(
    (instruction: string) => {
      const title = instruction.trim();
      if (!title) return;
      onClose();
      void fetch("/api/command-center/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, kind: "generic", source: "command-bar" }),
      }).catch(() => {});
      router.push("/command-center/jobs");
    },
    [onClose, router]
  );

  const global = useGlobalSearch(query, open);

  const globalEntries: GlobalEntry[] = useMemo(
    () =>
      global.results.map((r) => ({
        kind: "global" as const,
        id: r.id,
        label: r.title,
        hint: r.subtitle,
        icon: r.kind === "message" ? "◈" : r.kind === "doc" ? "≡" : "◎",
        accent: r.accent,
        data: r,
      })),
    [global.results]
  );

  const results = useMemo<PaletteEntry[]>(() => {
    const q = query.trim();
    if (!q) {
      return [
        ...actions,
        ...ROUTES.slice(0, 8),
      ];
    }
    const scored = allEntries.map((e) => {
      const blob = `${e.label} ${e.hint ?? ""} ${e.keywords ?? ""}`;
      return { e, s: fuzzyScore(blob, q) };
    });
    const localTop = scored
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s || a.e.label.localeCompare(b.e.label))
      .slice(0, 16)
      .map((r) => r.e);
    // Top entry: dispatch the typed instruction to the fleet as a Job.
    const dispatch: ActionEntry = {
      kind: "action",
      id: "action:dispatch",
      label: `Run as Job: "${q.length > 48 ? q.slice(0, 48) + "…" : q}"`,
      hint: "Dispatch to the fleet → watch it run",
      icon: "⚡",
      accent: TOKENS.gold,
      action: () => dispatchJob(q),
    };
    return [dispatch, ...localTop, ...globalEntries];
  }, [allEntries, actions, globalEntries, query, dispatchJob]);

  const execute = useCallback(
    (entry: PaletteEntry) => {
      onClose();
      if (entry.kind === "route") {
        router.push(entry.href);
      } else if (entry.kind === "agent") {
        router.push(`/command-center/chat#dm=${entry.agentId}`);
      } else if (entry.kind === "global") {
        router.push(entry.data.href);
      } else {
        entry.action();
      }
    },
    [onClose, router]
  );

  useEffect(() => {
    setActiveIdx(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (results.length === 0 ? 0 : (i + 1) % results.length));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) =>
          results.length === 0 ? 0 : (i - 1 + results.length) % results.length
        );
        return;
      }
      if (e.key === "Enter") {
        const entry = results[activeIdx];
        if (!entry) return;
        e.preventDefault();
        execute(entry);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, activeIdx, execute, onClose]);

  useEffect(() => {
    if (!open) return;
    const root = listRef.current;
    if (!root) return;
    const el = root.querySelector(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  if (!open) return null;

  const iconNameFor = (entry: PaletteEntry): string => {
    if (entry.kind === "route") return ROUTE_ICON[entry.id] ?? "dot";
    if (entry.kind === "action" && entry.id === "action:dispatch") return "dispatch";
    return poIconName(entry);
  };

  const kindLabelFor = (entry: PaletteEntry): string =>
    entry.kind === "route"
      ? "Page"
      : entry.kind === "agent"
        ? "Agent"
        : entry.kind === "global"
          ? entry.data.meta ?? "Result"
          : "Action";

  return (
    <div
      className="po-scrim"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="po-palette" onClick={(e) => e.stopPropagation()}>
        <div className="po-pal-in">
          <Icon name="command" size={18} style={{ color: "var(--accent)" }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type intent — jump to anything · ask ATLAS · run a command…"
            spellCheck={false}
            autoComplete="off"
          />
          <span className="kbd">ESC</span>
        </div>

        <div ref={listRef} className="po-pal-list po-scroll">
          {global.loading && (
            <div className="eyebrow po-pal-head" style={{ color: "var(--c-purple-l)" }}>
              Searching messages · docs · memory…
            </div>
          )}
          {global.unavailable && (
            <div className="po-pal-head" style={{ color: "var(--t-dim)", fontFamily: "var(--f-mono)", fontSize: 10 }}>
              Message search disabled — set SUPABASE_SERVICE_ROLE_KEY on the server.
            </div>
          )}
          {results.length === 0 ? (
            <div style={{ padding: 22, textAlign: "center", color: "var(--t-lo)" }}>
              {global.loading
                ? "Looking across the system…"
                : query.trim()
                  ? `Press ↵ to run “${query.trim()}” as a job.`
                  : "Try an agent name, a page, or “refresh”."}
            </div>
          ) : (
            results.map((entry, idx) => {
              const active = idx === activeIdx;
              const isRun = entry.kind === "action" && entry.id === "action:dispatch";
              return (
                <button
                  key={entry.id}
                  data-idx={idx}
                  type="button"
                  className={`po-pal-item${active ? " on" : ""}${isRun ? " run" : ""}`}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={() => execute(entry)}
                >
                  <span
                    aria-hidden
                    style={{
                      display: "grid",
                      placeItems: "center",
                      width: 18,
                      color: isRun ? "var(--accent)" : entry.accent ?? "var(--t-mid)",
                    }}
                  >
                    <Icon name={iconNameFor(entry)} size={16} />
                  </span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      textAlign: "left",
                      fontSize: 14,
                      color: isRun ? "var(--accent)" : "var(--t-hi)",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {entry.label}
                    </span>
                    {entry.hint && (
                      <span style={{ display: "block", fontSize: 11, color: "var(--t-lo)", marginTop: 2 }}>
                        {entry.hint}
                      </span>
                    )}
                  </span>
                  {isRun ? (
                    <span className="kbd">↵ dispatch</span>
                  ) : (
                    <span className="po-pal-grp">{kindLabelFor(entry)}</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="po-pal-foot">
          <span>
            <b style={{ color: "var(--t-mid)" }}>↑↓</b> navigate
          </span>
          <span>
            <b style={{ color: "var(--t-mid)" }}>↵</b> select
          </span>
          <span style={{ marginLeft: "auto", color: "var(--c-purple-l)" }}>● ATLAS listening</span>
        </div>
      </div>
    </div>
  );
}
