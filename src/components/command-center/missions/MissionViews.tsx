"use client";
/**
 * P06 M4A: founder Mission surface. Three views over the M2 API and nothing else:
 *   MissionListView    every mission, newest first, with "New Mission"
 *   CreateMissionForm  objective, owner, team, criteria, deliverables (one per line)
 *   MissionDetailView  state, definition, links/evidence, history, and the founder's lifecycle actions
 * Every action calls one M2 route through `api` (default: cockpitFetch). The server decides; these views only offer
 * what M1 allows next, and "verified" is reachable only through the separate Verify button (/verify).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { Panel } from "@/components/command-center/po/Instrument";
import { httpMissionApi, type MissionApi, type MissionDetail } from "@/lib/missions/client";
import type { LinkRow, MissionRow, MissionState, Relation, TargetType } from "@/lib/missions/types";
import {
  agentName, canCancel, canEditLinks, canReassign, canVerify, createBody, emptyCreateForm, EVIDENCE_TARGETS, formatRef,
  forwardSteps, FOUNDER, LINK_TARGETS, mergeMissionPages, nextHint, RELATION_LABEL, selectableAgents, STATE_LABEL, targetLabel,
  uncoveredCriteria, validateCreate, type CreateForm,
} from "@/lib/missions/ui";

/* ── small shared pieces ─────────────────────────────────────────────────────────────────────────────── */

const STATE_COLOR: Record<MissionState, string> = {
  intent: "var(--t-mid)", plan: "var(--c-violet, #a855f7)", approved: "var(--accent)", executing: "var(--c-amber, #f59e0b)",
  reviewing: "var(--c-amber, #f59e0b)", completed: "var(--c-green, #22c55e)", verified: "var(--c-green, #22c55e)", cancelled: "var(--c-red, #ef4444)",
};
const muted: CSSProperties = { color: "var(--t-mid)", fontSize: 13 };
const field: CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px", minHeight: 44, borderRadius: "var(--r-sm, 8px)",
  border: "1px solid var(--line)", background: "var(--ink-2)", color: "var(--t-hi)", fontSize: 15,
};
const row: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" };

export function StateBadge({ state }: { state: MissionState }) {
  const c = STATE_COLOR[state];
  return (
    <span data-testid="state-badge" style={{
      fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 10px", borderRadius: 6,
      color: c, border: `1px solid ${c}`, whiteSpace: "nowrap",
    }}>{STATE_LABEL[state]}</span>
  );
}

function Btn({ children, onClick, disabled, tone = "default", type = "button", label }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; tone?: "default" | "primary" | "danger"; type?: "button" | "submit"; label?: string;
}) {
  const color = tone === "primary" ? "var(--ink-0)" : tone === "danger" ? "var(--c-red, #ef4444)" : "var(--t-hi)";
  const bg = tone === "primary" ? "var(--accent)" : "var(--ink-2)";
  const border = tone === "danger" ? "1px solid var(--c-red, #ef4444)" : tone === "primary" ? "1px solid var(--accent)" : "1px solid var(--line)";
  return (
    <button type={type} onClick={onClick} disabled={disabled} aria-label={label} style={{
      minHeight: 44, padding: "8px 16px", borderRadius: "var(--r-sm, 8px)", fontSize: 14, fontWeight: 600, cursor: disabled ? "default" : "pointer",
      background: bg, color, border, opacity: disabled ? 0.5 : 1, flex: "0 1 auto",
    }}>{children}</button>
  );
}

function ErrorLine({ text }: { text: string | null }) {
  return text ? <p role="alert" style={{ color: "var(--c-red, #ef4444)", fontSize: 14, margin: "8px 0" }}>{text}</p> : null;
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/* ── list ───────────────────────────────────────────────────────────────────────────────────────────── */

export function MissionListView({ api = httpMissionApi, initialObjective, fromSynthesis, onCreated, onPrefillDone }: {
  api?: MissionApi; initialObjective?: string; fromSynthesis?: string; onCreated?: (m: MissionRow) => void;
  /** Called when a prefilled form is finished with (created or cancelled), so the page can drop the prefill query. */
  onPrefillDone?: () => void;
}) {
  const [missions, setMissions] = useState<MissionRow[] | null>(null);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [creating, setCreating] = useState(Boolean(initialObjective || fromSynthesis));

  // Every first-page request is numbered when it STARTS, and only the newest one may apply: a slow older request
  // (e.g. the mount load still pending when a create reloads) can never overwrite a newer list. An older page
  // ("Load more") is likewise dropped if any first-page request started after it.
  const listRequest = useRef(0);
  const moreInFlight = useRef(false); // synchronous guard: a double click must not request the same page twice
  const apply = useCallback((r: Awaited<ReturnType<MissionApi["list"]>>) => {
    if (r.ok) { setMissions(r.data.missions); setNextBefore(r.data.nextBefore); setError(null); setMoreError(null); } else { setError(r.message); }
  }, []);
  // First page: replaces the list (used on mount and after a create).
  const load = useCallback(async () => {
    const mine = ++listRequest.current;
    const r = await api.list();
    if (mine === listRequest.current) apply(r);
  }, [api, apply]);
  // Older pages: appended without duplicates; a failure keeps everything already loaded.
  async function loadMore() {
    if (nextBefore === null || moreInFlight.current) return;
    moreInFlight.current = true;
    const startedFor = listRequest.current;
    setLoadingMore(true); setMoreError(null);
    const r = await api.list(nextBefore);
    moreInFlight.current = false;
    setLoadingMore(false);
    if (startedFor !== listRequest.current) return; // the list was reloaded meanwhile: this page belongs to an old list
    if (!r.ok) { setMoreError(r.message); return; }
    setMissions((cur) => mergeMissionPages(cur ?? [], r.data.missions));
    setNextBefore(r.data.nextBefore);
  }
  useEffect(() => {
    let alive = true;
    const mine = ++listRequest.current;
    api.list().then((r) => { if (alive && mine === listRequest.current) apply(r); });
    return () => { alive = false; };
  }, [api, apply]);

  return (
    <>
      {creating ? (
        <CreateMissionForm api={api} initialObjective={initialObjective} fromSynthesis={fromSynthesis}
          onCancel={() => { setCreating(false); onPrefillDone?.(); }}
          onCreated={(m) => { setCreating(false); void load(); onCreated?.(m); onPrefillDone?.(); }} />
      ) : (
        <div style={{ ...row, marginBottom: 16 }}>
          <Btn tone="primary" onClick={() => setCreating(true)}>+ New Mission</Btn>
        </div>
      )}
      <ErrorLine text={error} />
      {missions === null && !error && <p style={muted}>Loading missions…</p>}
      {missions !== null && missions.length === 0 && !creating && (
        <Panel title="No missions yet" icon="bolt">
          <p style={{ ...muted, fontSize: 15, lineHeight: 1.6 }}>
            A mission is one outcome you want, with the criteria that prove it is done. Start one with New Mission,
            or turn an approved plan into a mission from Decisions.
          </p>
        </Panel>
      )}
      {missions !== null && missions.length > 0 && (
        <div role="list" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))" }}>
          {missions.map((m) => (
            <Link key={m.id} href={`/command-center/missions/${m.id}`} role="listitem" data-testid="mission-card" style={{
              display: "block", textDecoration: "none", padding: 16, borderRadius: "var(--r-lg, 12px)",
              background: "var(--ink-1)", border: "1px solid var(--line)", borderLeft: `4px solid ${STATE_COLOR[m.state]}`,
            }}>
              <div style={{ ...row, justifyContent: "space-between", marginBottom: 8 }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>{formatRef(m.ref)}</span>
                <StateBadge state={m.state} />
              </div>
              <p style={{ color: "var(--t-hi)", fontSize: 15, fontWeight: 600, lineHeight: 1.4, margin: "0 0 8px", overflowWrap: "anywhere" }}>{m.objective}</p>
              <p style={{ ...muted, margin: 0 }}>
                Owner {agentName(m.owner)}
                {m.agent_ids.length > 0 && <> · Team {m.agent_ids.map(agentName).join(", ")}</>}
                {" · "}Updated {timeAgo(m.updated_at)}
              </p>
            </Link>
          ))}
        </div>
      )}
      {missions !== null && missions.length > 0 && (
        <div style={{ ...row, marginTop: 16 }}>
          {nextBefore !== null && <Btn onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more"}</Btn>}
          <ErrorLine text={moreError} />
        </div>
      )}
    </>
  );
}

/* ── create ─────────────────────────────────────────────────────────────────────────────────────────── */

export function CreateMissionForm({ api = httpMissionApi, onCreated, onCancel, initialObjective, fromSynthesis }: {
  api?: MissionApi; onCreated: (m: MissionRow) => void; onCancel: () => void; initialObjective?: string; fromSynthesis?: string;
}) {
  const [form, setForm] = useState<CreateForm>(() => emptyCreateForm(initialObjective ?? ""));
  const [errors, setErrors] = useState<ReturnType<typeof validateCreate>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [unlinked, setUnlinked] = useState<MissionRow | null>(null);
  const agents = useMemo(() => selectableAgents(), []);
  const set = <K extends keyof CreateForm>(k: K, v: CreateForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = validateCreate(form);
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true); setServerError(null);
    const r = await api.create(createBody(form));
    if (!r.ok) { setBusy(false); setServerError(r.message); return; }
    if (fromSynthesis) {
      // Keep the plan where it lives; the mission only points at it.
      const l = await api.addLink(r.data.id, { targetType: "synthesis", targetId: fromSynthesis, relation: "source" });
      if (!l.ok) {
        // Stay open: the founder must see that the mission exists but the plan link does not.
        setBusy(false); setUnlinked(r.data);
        setServerError(`Mission ${formatRef(r.data.ref)} was created, but linking the plan failed: ${l.message}`);
        return;
      }
    }
    setBusy(false);
    onCreated(r.data);
  }

  return (
    <Panel title={fromSynthesis ? "New Mission from plan" : "New Mission"} icon="bolt">
      <form onSubmit={submit} aria-label="New Mission" style={{ display: "grid", gap: 14 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Objective</span>
          <textarea value={form.objective} onChange={(e) => set("objective", e.target.value)} rows={3}
            placeholder="What outcome do you want?" style={field} aria-invalid={Boolean(errors.objective)} />
          <ErrorLine text={errors.objective ?? null} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Owner</span>
          <select value={form.owner} onChange={(e) => set("owner", e.target.value)} style={field}>
            <option value={FOUNDER}>Ramon (you)</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <fieldset style={{ border: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
          <legend style={{ fontWeight: 600, marginBottom: 6 }}>Team <span style={muted}>(optional)</span></legend>
          <div style={row}>
            {agents.map((a) => {
              const on = form.agentIds.includes(a.id);
              return (
                <button key={a.id} type="button" aria-pressed={on} onClick={() => set("agentIds", on ? form.agentIds.filter((x) => x !== a.id) : [...form.agentIds, a.id])}
                  style={{ minHeight: 40, padding: "6px 12px", borderRadius: 999, fontSize: 13, cursor: "pointer",
                    border: `1px solid ${on ? "var(--accent)" : "var(--line)"}`, background: on ? "var(--accent)" : "var(--ink-2)", color: on ? "var(--ink-0)" : "var(--t-hi)" }}>
                  {a.name}
                </button>
              );
            })}
          </div>
          <ErrorLine text={errors.agents ?? null} />
        </fieldset>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Success criteria <span style={muted}>(one per line; at least one)</span></span>
          <textarea value={form.criteriaText} onChange={(e) => set("criteriaText", e.target.value)} rows={3} style={field}
            placeholder={"The report is published\nMettle onboarding takes under 5 minutes"} />
          <ErrorLine text={errors.criteria ?? null} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Deliverables <span style={muted}>(one per line, optional)</span></span>
          <textarea value={form.deliverablesText} onChange={(e) => set("deliverablesText", e.target.value)} rows={2} style={field} />
          <ErrorLine text={errors.deliverables ?? null} />
        </label>
        <ErrorLine text={serverError} />
        {unlinked ? (
          <div style={row}>
            <Link href={`/command-center/missions/${unlinked.id}`} style={{ color: "var(--accent)", fontWeight: 600 }}>Open {formatRef(unlinked.ref)} to link the plan by hand</Link>
            <Btn onClick={() => onCreated(unlinked)}>Done</Btn>
          </div>
        ) : (
          <div style={row}>
            <Btn type="submit" tone="primary" disabled={busy}>{busy ? "Creating…" : "Create Mission"}</Btn>
            <Btn onClick={onCancel} disabled={busy}>Cancel</Btn>
          </div>
        )}
      </form>
    </Panel>
  );
}

/* ── detail ─────────────────────────────────────────────────────────────────────────────────────────── */

const EVENT_TEXT: Record<string, (e: MissionDetail["events"][number]) => string> = {
  created: () => "Mission created",
  state_changed: (e) => `${STATE_LABEL[e.from_state as MissionState] ?? e.from_state} → ${STATE_LABEL[e.to_state as MissionState] ?? e.to_state}`,
  team_changed: () => "Owner or team changed",
  link_added: (e) => `Linked ${String((e.detail as { target_type?: string }).target_type ?? "a record").replace(/_/g, " ")}`,
  link_removed: () => "Link removed",
};

export function MissionDetailView({ id, api = httpMissionApi }: { id: string; api?: MissionApi }) {
  const [d, setD] = useState<MissionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);

  // A successful reload never clears an action's error: the founder must see why the last action was refused.
  // Errors are cleared only when the next action starts (act).
  const apply = useCallback((r: Awaited<ReturnType<MissionApi["get"]>>) => {
    if (r.ok) setD(r.data); else setError(r.message);
  }, []);
  // Reads are numbered when they START; only the newest may apply, so a slow earlier read (e.g. the "show removed"
  // toggle) can never revert the view to its state before an action that has since reloaded it.
  const readRequest = useRef(0);
  const load = useCallback(async () => {
    const mine = ++readRequest.current;
    const r = await api.get(id, showRemoved);
    if (mine === readRequest.current) apply(r);
  }, [api, id, showRemoved, apply]);
  useEffect(() => {
    let alive = true;
    const mine = ++readRequest.current;
    api.get(id, showRemoved).then((r) => { if (alive && mine === readRequest.current) apply(r); });
    return () => { alive = false; };
  }, [api, id, showRemoved, apply]);

  async function act(fn: () => Promise<{ ok: boolean; message?: string }>): Promise<boolean> {
    setBusy(true); setError(null); setConfirmCancel(false);
    const r = await fn();
    setBusy(false);
    if (!r.ok) setError(r.message ?? "That did not work.");
    await load();
    return r.ok;
  }

  if (!d) return <>{error ? <ErrorLine text={error} /> : <p style={muted}>Loading mission…</p>}</>;
  const m = d.mission;
  const live = d.links.filter((l) => !l.removed_at);
  const evidence = live.filter((l) => l.relation === "evidence");
  const missing = uncoveredCriteria(m.success_criteria, evidence);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Link href="/command-center/missions" style={{ ...muted, textDecoration: "none" }}>← All missions</Link>
      <Panel title={formatRef(m.ref)} icon="bolt" badge={<StateBadge state={m.state} />}>
        <p style={{ color: "var(--t-hi)", fontSize: 18, fontWeight: 600, lineHeight: 1.45, margin: "0 0 10px", overflowWrap: "anywhere" }}>{m.objective}</p>
        <p style={{ ...muted, margin: "0 0 12px" }}>
          Owner {agentName(m.owner)}{m.agent_ids.length > 0 && <> · Team {m.agent_ids.map(agentName).join(", ")}</>}
        </p>
        <p data-testid="next-hint" style={{ fontSize: 15, margin: "0 0 14px", color: "var(--accent)" }}>{nextHint(m, evidence)}</p>
        <ErrorLine text={error} />
        <div style={row} data-testid="lifecycle-actions">
          {forwardSteps(m.state, m.success_criteria.length).map((s) => (
            <Btn key={s.to} tone="primary" disabled={busy} onClick={() => act(() => api.transition(m.id, s.to, m.state))}>{s.label}</Btn>
          ))}
          {canVerify(m.state) && (
            <Btn tone="primary" disabled={busy || missing.length > 0} label="Verify mission"
              onClick={() => act(() => api.verify(m.id))}>Verify</Btn>
          )}
          {canCancel(m.state) && !confirmCancel && <Btn tone="danger" disabled={busy} onClick={() => setConfirmCancel(true)}>Cancel mission</Btn>}
          {confirmCancel && (
            <>
              <span style={muted}>Cancelling is final.</span>
              <Btn tone="danger" disabled={busy} onClick={() => void act(() => api.transition(m.id, "cancelled", m.state))}>Confirm cancel</Btn>
              <Btn onClick={() => setConfirmCancel(false)}>Keep it</Btn>
            </>
          )}
        </div>
      </Panel>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))" }}>
        <Panel title="Success criteria" icon="tasks">
          {m.success_criteria.length === 0 ? <p style={muted}>None yet. Approval needs at least one.</p> : (
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
              {m.success_criteria.map((c) => {
                const ok = evidence.some((l) => l.criterion_id === c.id);
                return <li key={c.id} style={{ color: "var(--t-hi)" }}>{c.text} <span style={{ ...muted, color: ok ? "var(--c-green, #22c55e)" : "var(--t-mid)" }}>{ok ? "· evidence linked" : "· no evidence yet"}</span></li>;
              })}
            </ul>
          )}
        </Panel>
        <Panel title="Deliverables" icon="docs">
          {m.deliverables.length === 0 ? <p style={muted}>None listed.</p> : (
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>{m.deliverables.map((x) => <li key={x.id} style={{ color: "var(--t-hi)" }}>{x.text}</li>)}</ul>
          )}
        </Panel>
      </div>

      <LinksPanel m={m} links={d.links} busy={busy} showRemoved={showRemoved} setShowRemoved={setShowRemoved}
        onAdd={(body) => void act(() => api.addLink(m.id, body))} onRemove={(l) => void act(() => api.removeLink(m.id, l.id))} />

      {canReassign(m.state) && <ReassignPanel m={m} busy={busy} onSave={(b) => act(() => api.reassign(m.id, b))} />}

      <Panel title="History" icon="pulse" badge={d.eventsTruncated ? "latest 200" : undefined}>
        <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }} data-testid="history">
          {d.events.map((e) => (
            <li key={e.id} style={{ color: "var(--t-hi)" }}>
              {(EVENT_TEXT[e.kind] ?? (() => e.kind.replace(/_/g, " ")))(e)}
              <span style={muted}> · {agentName(e.actor)} · {new Date(e.created_at).toLocaleString()}</span>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

function LinksPanel({ m, links, busy, showRemoved, setShowRemoved, onAdd, onRemove }: {
  m: MissionRow; links: LinkRow[]; busy: boolean; showRemoved: boolean; setShowRemoved: (v: boolean) => void;
  onAdd: (body: Record<string, unknown>) => void; onRemove: (l: LinkRow) => void;
}) {
  const editable = canEditLinks(m.state);
  const [type, setType] = useState<TargetType>("url");
  const [relation, setRelation] = useState<Relation>("context");
  const [criterionId, setCriterionId] = useState(m.success_criteria[0]?.id ?? "");
  const [target, setTarget] = useState("");
  const canBeEvidence = EVIDENCE_TARGETS.has(type) && m.success_criteria.length > 0;
  const relations = (Object.keys(RELATION_LABEL) as Relation[]).filter((r) => r !== "approval" && r !== "branch" && (r !== "evidence" || canBeEvidence) && (r !== "dependency" || type === "mission"));
  const effectiveRelation = relations.includes(relation) ? relation : "context";

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!target.trim()) return;
    onAdd({ targetType: type, targetId: target.trim(), relation: effectiveRelation, ...(effectiveRelation === "evidence" ? { criterionId } : {}) });
    setTarget("");
  }

  return (
    <Panel title="Links and evidence" icon="nexus">
      {links.length === 0 && <p style={muted}>Nothing linked yet.</p>}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }} data-testid="links">
        {links.map((l) => (
          <li key={l.id} style={{ ...row, justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)", opacity: l.removed_at ? 0.5 : 1 }}>
            <span style={{ color: "var(--t-hi)", overflowWrap: "anywhere", minWidth: 0, flex: "1 1 220px" }}>
              <strong>{l.relation === "evidence" ? `Evidence for ${l.criterion_id}` : RELATION_LABEL[l.relation]}</strong>
              <span style={muted}> · {targetLabel(l.target_type)}</span>
              <br />
              {l.target_type === "url" ? <a href={l.target_id} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>{l.target_id}</a>
                : l.target_type === "mission" ? <Link href={`/command-center/missions/${l.target_id}`} style={{ color: "var(--accent)" }}>{l.target_id}</Link>
                  : <span className="mono" style={{ fontSize: 13 }}>{l.target_id}{l.target_index !== null ? ` #${l.target_index}` : ""}</span>}
              {l.removed_at && <span style={muted}> · removed</span>}
            </span>
            {editable && !l.removed_at && <Btn tone="danger" disabled={busy} label={`Remove link ${l.id}`} onClick={() => onRemove(l)}>Remove</Btn>}
          </li>
        ))}
      </ul>
      <label style={{ ...row, ...muted, marginTop: 10 }}>
        <input type="checkbox" checked={showRemoved} onChange={(e) => setShowRemoved(e.target.checked)} /> Show removed links
      </label>
      {editable ? (
        <form onSubmit={add} aria-label="Add link" style={{ display: "grid", gap: 10, marginTop: 14 }}>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))" }}>
            <select aria-label="Link type" value={type} onChange={(e) => setType(e.target.value as TargetType)} style={field}>
              {LINK_TARGETS.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
            </select>
            <select aria-label="Relation" value={effectiveRelation} onChange={(e) => setRelation(e.target.value as Relation)} style={field}>
              {relations.map((r) => <option key={r} value={r}>{RELATION_LABEL[r]}</option>)}
            </select>
            {effectiveRelation === "evidence" && (
              <select aria-label="Criterion" value={criterionId} onChange={(e) => setCriterionId(e.target.value)} style={field}>
                {m.success_criteria.map((c) => <option key={c.id} value={c.id}>{c.id}: {c.text.slice(0, 40)}</option>)}
              </select>
            )}
          </div>
          <input aria-label="Link target" value={target} onChange={(e) => setTarget(e.target.value)} style={field}
            placeholder={LINK_TARGETS.find((t) => t.type === type)?.placeholder} />
          {!canBeEvidence && <p style={{ ...muted, margin: 0 }}>{targetLabel(type)} links can be context or source, not evidence: the server cannot look them up yet.</p>}
          <div style={row}><Btn type="submit" disabled={busy || !target.trim()}>Add link</Btn></div>
        </form>
      ) : <p style={{ ...muted, marginTop: 10 }}>Links are frozen on a closed mission.</p>}
    </Panel>
  );
}

function ReassignPanel({ m, busy, onSave }: { m: MissionRow; busy: boolean; onSave: (b: { owner: string; ownerKind: "human" | "agent"; agentIds: string[] }) => Promise<boolean> }) {
  // Current members stay visible (and removable) even if the registry no longer lists them as active.
  const agents = useMemo(() => {
    const active = selectableAgents();
    const extra = m.agent_ids.filter((id) => !active.some((a) => a.id === id)).map((id) => ({ id, name: agentName(id) }));
    return [...active, ...extra];
  }, [m.agent_ids]);
  const [open, setOpen] = useState(false);
  const [owner, setOwner] = useState(m.owner);
  const [team, setTeam] = useState<string[]>(m.agent_ids);
  if (!open) return <div style={row}><Btn onClick={() => { setOwner(m.owner); setTeam(m.agent_ids); setOpen(true); }}>Change owner or team</Btn></div>;
  return (
    <Panel title="Owner and team" icon="agents">
      <div style={{ display: "grid", gap: 12 }}>
        <select aria-label="New owner" value={owner} onChange={(e) => setOwner(e.target.value)} style={field}>
          <option value={FOUNDER}>Ramon (you)</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <div style={row}>
          {agents.map((a) => {
            const on = team.includes(a.id);
            return <button key={a.id} type="button" aria-pressed={on} onClick={() => setTeam(on ? team.filter((x) => x !== a.id) : [...team, a.id])}
              style={{ minHeight: 40, padding: "6px 12px", borderRadius: 999, fontSize: 13, cursor: "pointer", border: `1px solid ${on ? "var(--accent)" : "var(--line)"}`,
                background: on ? "var(--accent)" : "var(--ink-2)", color: on ? "var(--ink-0)" : "var(--t-hi)" }}>{a.name}</button>;
          })}
        </div>
        <div style={row}>
          <Btn tone="primary" disabled={busy} onClick={async () => { if (await onSave({ owner, ownerKind: owner === FOUNDER ? "human" : "agent", agentIds: team })) setOpen(false); }}>Save</Btn>
          <Btn onClick={() => setOpen(false)}>Cancel</Btn>
        </div>
      </div>
    </Panel>
  );
}
