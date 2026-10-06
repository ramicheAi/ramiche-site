"use client";
import { cockpitFetch } from '@/lib/cockpit-fetch';


import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { httpCommandApi, missionIdFromPath } from "@/lib/command/client";
import type { ShadowRecord } from "@/lib/command/types";
import { handlerText } from "@/components/command-center/missions/ShadowCommandPanel";
import { ExecutionFlow } from "@/components/command-center/execution/ExecutionFlow";
import { PRODUCTION_DISPATCH_ENABLED } from "@/lib/execution/policy";
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
  /** the palette stays open (the action reports its own outcome) */
  keepOpen?: boolean;
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
  { kind: "route", id: "missions", label: "Missions", hint: "Objectives, criteria, evidence", icon: "✦", accent: TOKENS.gold, href: "/command-center/missions" },
  { kind: "route", id: "project-progress", label: "Project Progress", hint: "Projects, progress, checklists", icon: "▤", accent: TOKENS.gold, href: "/command-center/projects/progress" },
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
  calendar: "calendar", projects: "projects", "project-progress": "projects", missions: "mettle", memory: "memory",
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

/** attempt: which shadow attempt this state belongs to; a result for an abandoned attempt is ignored. done: the
 *  recorded decision, shown compactly in the palette (P06 M5C: the founder stays where he is; nothing navigates). */
type ShadowState = { busy: boolean; error: string | null; done: ShadowRecord | null; sent: string; attempt: number };
const IDLE: ShadowState = { busy: false, error: null, done: null, sent: "", attempt: 0 };

/** What the compact result says about founder involvement, read from the recorded decision (the same
 *  founderApprovalRequired the detailed panel shows). Display only; the decision itself is unchanged. */
function founderLine(d: ShadowRecord["decision"]): string {
  if (d.handler === "human") return "Founder decision required";
  if (d.handler === null) return "Needs your choice of handler (Details)";
  return d.founderApprovalRequired ? "Founder approval required" : "No founder approval required";
}
/** Create is offered exactly when the Missions panel offers it: not inside a mission, not when already linked. */
const createOffered = (rec: ShadowRecord) => !rec.missionContext && rec.linkedMissions.length === 0;

const resultBtn = {
  minHeight: 44, padding: "0 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
  background: "rgba(255,255,255,0.04)", color: "var(--t-hi)", border: "1px solid var(--line, #1e1e1e)",
} as const;

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onLock?: () => void;
  onRefresh?: () => void;
  /** P06 M6C: offer execution from a shadow result. Defaults to the production gate, which is off. */
  executionEnabled?: boolean;
}

export function CommandPalette({ open, onClose, onLock, onRefresh, executionEnabled = PRODUCTION_DISPATCH_ENABLED }: CommandPaletteProps) {
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
  // P06 M5 Universal Command: record a SHADOW routing decision for the typed command (nothing is executed) and show
  // it compactly right here (M5C, least effort): Missions opens only when the founder picks Create Mission or Details.
  // Issued from inside a mission, the mission travels along as context.
  const pathname = usePathname();
  const [shadowState, setShadowState] = useState<ShadowState>(IDLE);
  // Every attempt gets a number; closing the palette moves past it, so a late result from an abandoned attempt can
  // neither navigate nor show an error, even after the palette is reopened.
  const [attempt, setAttempt] = useState(0);
  const shadowRoute = useCallback(
    async (instruction: string) => {
      const text = instruction.trim();
      if (!text) return;
      const mine = attempt + 1;
      setAttempt(mine);
      setShadowState({ busy: true, error: null, done: null, sent: text, attempt: mine });
      const r = await httpCommandApi.route({ text, missionId: missionIdFromPath(pathname) });
      setShadowState((cur) => (cur.attempt !== mine ? cur
        : r.ok && r.data?.decision && typeof r.data.id === "string" ? { busy: false, error: null, done: r.data, sent: text, attempt: mine }
          : { busy: false, error: `Shadow routing failed: ${r.ok ? "the recorded decision could not be read" : r.message}`, done: null, sent: text, attempt: mine }));
    },
    [pathname, attempt]
  );
  // Closing abandons a pending route (a hung request can never lock the palette) and clears a shown result: a late
  // result or error from an abandoned attempt never appears when the palette is opened again.
  useEffect(() => {
    if (!open && (shadowState.busy || shadowState.done || shadowState.error)) {
      setShadowState({ ...IDLE, attempt: -1 });   // matches no attempt: anything still in flight is ignored
    }
  }, [open, shadowState]);
  // A new result is shown: clear the input, ready for the next command (typing then hides the result), unless the
  // founder already typed something else while it was pending. Adjusted during render, so both appear together.
  const doneId = shadowState.done?.id ?? null;
  const [clearedFor, setClearedFor] = useState<string | null>(null);
  if (doneId !== clearedFor) {
    setClearedFor(doneId);
    if (doneId && query.trim() === shadowState.sent) setQuery("");
  }
  // The founder's explicit next steps from a shown result. Neither happens unless clicked.
  const openShadow = useCallback(
    (id: string, create: boolean) => {
      onClose();
      router.push(`/command-center/missions?command=${encodeURIComponent(id)}${create ? "&create=1" : ""}`);
    },
    [onClose, router]
  );

  const dispatchJob = useCallback(
    (instruction: string) => {
      const title = instruction.trim();
      if (!title) return;
      onClose();
      void cockpitFetch("/api/command-center/jobs", {
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
    // P06 M5 shadow phase: the DEFAULT for typed text is the Universal Command shadow route (row 0, so a plain Enter
    // records a decision and executes nothing). Running it as a Job stays available as row 1, only by deliberate
    // selection (arrow down or click); editing the text moves the highlight back to the shadow route.
    const dispatch: ActionEntry = {
      kind: "action",
      id: "action:dispatch",
      label: `Run as Job: "${q.length > 48 ? q.slice(0, 48) + "…" : q}"`,
      hint: "Executes now: dispatches to the fleet. Select deliberately.",
      icon: "⚡",
      accent: TOKENS.gold,
      action: () => dispatchJob(q),
    };
    const shadow: ActionEntry = {
      kind: "action",
      id: "action:shadow-route",
      label: `Shadow-route: "${q.length > 48 ? q.slice(0, 48) + "…" : q}"`,
      hint: "Universal Command: show who would handle it. Nothing is executed.",
      icon: "◇",
      accent: TOKENS.purpleSoft,
      keywords: "universal command shadow route",
      keepOpen: true,
      action: () => void shadowRoute(q),
    };
    return [shadow, dispatch, ...localTop, ...globalEntries];
  }, [allEntries, actions, globalEntries, query, dispatchJob, shadowRoute]);

  const execute = useCallback(
    (entry: PaletteEntry) => {
      // While a shadow route is being recorded nothing else runs (no accidental job dispatch).
      if (shadowState.busy) return;
      // A shadow route keeps the palette open until its record exists, so a failure is shown, never swallowed.
      if (entry.kind === "action" && entry.keepOpen) { entry.action(); return; }
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
    [onClose, router, shadowState.busy]
  );

  useEffect(() => {
    setActiveIdx(0);   // with typed text, row 0 is always the shadow route
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
        // A shown result with an empty input: Enter does nothing (no page jump from a reflex keypress).
        if (shadowState.done && !query.trim()) { e.preventDefault(); return; }
        const entry = results[activeIdx];
        if (!entry) return;
        e.preventDefault();
        execute(entry);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, activeIdx, execute, onClose, shadowState.done, query]);

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
            onChange={(e) => { setQuery(e.target.value); if (shadowState.error || shadowState.done) setShadowState({ ...IDLE, attempt: shadowState.attempt }); }}
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
          {(shadowState.busy || shadowState.error) && (
            <div role={shadowState.error ? "alert" : "status"} className="po-pal-head" style={{ color: shadowState.error ? "#ef4444" : "var(--c-purple-l)", fontSize: 12 }}>
              {shadowState.error ?? "Recording the shadow route. Nothing is executed."}
            </div>
          )}
          {shadowState.done && (() => {
            const rec = shadowState.done;
            return (
              <div role="status" data-testid="shadow-result" className="po-pal-head"
                style={{ display: "grid", gap: 6, padding: "12px 14px", borderBottom: "1px solid var(--line, #1e1e1e)", overflowWrap: "anywhere" }}>
                <div className="eyebrow" style={{ color: "var(--accent)", fontSize: 11 }}>SHADOW · NOTHING EXECUTED</div>
                <div style={{ color: "var(--t-hi)", fontSize: 15, fontWeight: 600 }}>{handlerText(rec.decision)}</div>
                <div style={{ color: "var(--t-mid)", fontSize: 12 }}>Rules only · {founderLine(rec.decision)}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                  {createOffered(rec) && <button type="button" className="po-pal-btn" style={resultBtn} onClick={() => openShadow(rec.id, true)}>Create Mission</button>}
                  <button type="button" className="po-pal-btn" style={resultBtn} onClick={() => openShadow(rec.id, false)}>Details</button>
                </div>
                {executionEnabled && <ExecutionFlow key={rec.id} record={rec} onOpenDetails={() => openShadow(rec.id, false)} />}
              </div>
            );
          })()}
          {results.length === 0 ? (
            <div style={{ padding: 22, textAlign: "center", color: "var(--t-lo)" }}>
              {global.loading
                ? "Looking across the system…"
                : query.trim()
                  ? `Press ↵ to shadow-route “${query.trim()}”. Nothing is executed.`
                  : "Try an agent name, a page, or “refresh”."}
            </div>
          ) : (
            results.map((entry, idx) => {
              const active = idx === activeIdx;
              const isRun = entry.kind === "action" && entry.id === "action:dispatch";
              const isShadow = entry.kind === "action" && entry.id === "action:shadow-route";
              return (
                <button
                  key={entry.id}
                  data-idx={idx}
                  type="button"
                  className={`po-pal-item${active ? " on" : ""}${isShadow ? " run" : ""}`}
                  // Hover never selects Run as Job: a stray mouse move followed by Enter must not dispatch a job.
                  onMouseEnter={() => { if (!isRun) setActiveIdx(idx); }}
                  onClick={() => execute(entry)}
                >
                  <span
                    aria-hidden
                    style={{
                      display: "grid",
                      placeItems: "center",
                      width: 18,
                      color: isShadow ? "var(--accent)" : entry.accent ?? "var(--t-mid)",
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
                      color: isShadow ? "var(--accent)" : "var(--t-hi)",
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
                      <span style={{ display: "block", fontSize: 11, color: isRun ? "var(--c-amber, #f59e0b)" : "var(--t-lo)", marginTop: 2 }}>
                        {entry.hint}
                      </span>
                    )}
                  </span>
                  {isShadow ? (
                    <span className="kbd">↵ shadow</span>
                  ) : isRun ? (
                    <span className="kbd" style={{ color: "var(--c-amber, #f59e0b)", borderColor: "var(--c-amber, #f59e0b)" }}>runs now</span>
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
