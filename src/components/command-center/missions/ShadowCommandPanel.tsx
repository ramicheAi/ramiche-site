"use client";
/**
 * P06 M5: the founder's view of one Universal Command shadow decision, on the Missions page.
 * It shows what WOULD handle the command and offers only founder actions that already exist: create a Mission (M2
 * create, starts in Intent, then a `source` link to the command), attach the command to a Mission (M2 link), re-route
 * by hand (a new shadow record that supersedes this one), or dismiss. Nothing here runs a handler, and nothing says
 * "running": in M5 nothing is ever executed.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/command-center/po/Instrument";
import { httpMissionApi, type MissionApi } from "@/lib/missions/client";
import type { MissionRow } from "@/lib/missions/types";
import { agentName, formatRef, isTerminal } from "@/lib/missions/ui";
import { httpCommandApi, type CommandApi } from "@/lib/command/client";
import { HANDLER_META, HANDLERS, type Handler, type ShadowRecord } from "@/lib/command/types";
import { Btn, CreateMissionForm, ErrorLine, field, muted, row } from "./MissionViews";

const SOURCE_TEXT: Record<ShadowRecord["decision"]["source"], string> = {
  explicit: "Explicit: you named the handler",
  deterministic: "Deterministic: a fixed rule matched",
  ambiguous: "Ambiguous: no rule decided it",
};
/**
 * Handlers the founder can pick by hand. An @agent route needs the agent named in the command, and an existing-job
 * route needs the job id in it, so neither can be chosen by editing.
 */
const EDITABLE: Handler[] = HANDLERS.filter((h) => h !== "cockpit_agent" && h !== "existing_job");
/** Attach picker: follow the list cursor, bounded (a mission beyond the bound is reported, never silently missing). */
const PICKER_PAGES = 10;

export function handlerText(d: ShadowRecord["decision"]): string {
  if (!d.handler) return "Undecided";
  if (d.handler === "cockpit_agent" && d.agentId) return `${agentName(d.agentId)} (cockpit agent)`;
  return HANDLER_META[d.handler].label;
}

export function ShadowCommandPanel({ id, api = httpCommandApi, missions = httpMissionApi, onReroute, onDismiss, onCreated }: {
  id: string; api?: CommandApi; missions?: MissionApi;
  onReroute: (newId: string) => void; onDismiss: () => void; onCreated: (m: MissionRow) => void;
}) {
  const [rec, setRec] = useState<ShadowRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateAnyway, setShowCreateAnyway] = useState(false);
  const [open, setOpen] = useState<MissionRow[] | null>(null);
  const [attachTo, setAttachTo] = useState("");
  const [editHandler, setEditHandler] = useState<Handler>("claude_code");
  const [attached, setAttached] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api.get(id);
    if (r.ok) { setRec(r.data); setLoadError(null); } else { setRec(null); setLoadError(r.message); }
  }, [api, id]);
  useEffect(() => {
    let alive = true;
    api.get(id).then((r) => { if (!alive) return; if (r.ok) { setRec(r.data); setLoadError(null); } else { setRec(null); setLoadError(r.message); } });
    return () => { alive = false; };
  }, [api, id]);
  // The attach picker reads every page (bounded), so an older open mission is never silently unavailable. Terminal
  // missions cannot take new links (M1 MI022), so they are not offered.
  const [pickerNote, setPickerNote] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const all: MissionRow[] = [];
      let before: number | undefined;
      for (let page = 0; page < PICKER_PAGES; page++) {
        const r = await missions.list(before);
        if (!alive) return;
        if (!r.ok) { setPickerNote(`Missions could not be loaded for attaching: ${r.message}`); setOpen([]); return; }
        all.push(...r.data.missions);
        if (r.data.nextBefore === null) { setOpen(all.filter((m) => !isTerminal(m.state))); return; }
        before = r.data.nextBefore;
      }
      setOpen(all.filter((m) => !isTerminal(m.state)));
      setPickerNote(`Only the newest ${all.length} missions are listed for attaching; open an older mission and attach from there.`);
    })();
    return () => { alive = false; };
  }, [missions]);

  if (!rec) {
    return (
      <Panel title="Universal Command" icon="command">
        {loadError ? (
          <div style={row}><ErrorLine text={`This command could not be loaded. ${loadError}`} /><Btn onClick={() => void load()}>Try again</Btn><Btn onClick={onDismiss}>Dismiss</Btn></div>
        ) : <p style={muted}>Loading command…</p>}
      </Panel>
    );
  }
  const d = rec.decision;
  const linked = rec.linkedMissions;
  // No duplicate mission by default: inside a mission, or once a mission links this command, Create is tucked away.
  const createOffered = !rec.missionContext && linked.length === 0;
  // Issued inside a mission: that mission is the default attach target until the founder picks another.
  // Only an open mission that is actually offered can be the default; a terminal context mission cannot take links.
  const contextOpen = rec.missionContext && open?.some((m) => m.id === rec.missionContext) ? rec.missionContext : "";
  const target = attachTo || contextOpen;

  async function attach() {
    if (!target || !rec) return;
    setBusy(true); setError(null);
    const r = await missions.addLink(target, { targetType: "chat_message", targetId: rec.id, relation: "context" });
    if (!r.ok) setError(`Attaching failed: ${r.message}`); else setAttached(target);
    await load();
    setBusy(false);
  }
  async function reroute() {
    if (!rec) return;
    setBusy(true); setError(null);
    const r = await api.route({ text: rec.command, missionId: rec.missionContext, handlerHint: editHandler, supersedes: rec.id });
    setBusy(false);
    if (!r.ok) { setError(`Re-routing failed: ${r.message}`); return; }
    onReroute(r.data.id);
  }

  return (
    <Panel title="Universal Command" icon="command" badge={<span data-testid="shadow-badge" style={{
      fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", padding: "3px 10px", borderRadius: 6, whiteSpace: "nowrap",
      color: "var(--ink-0)", background: "var(--c-amber, #f59e0b)",
    }}>SHADOW</span>}>
      <div data-testid="shadow-command" style={{ display: "grid", gap: 12 }}>
        <p data-testid="shadow-label" role="status" style={{ margin: 0, fontWeight: 700, letterSpacing: "0.04em", color: "var(--c-amber, #f59e0b)" }}>
          SHADOW: NOTHING HAS BEEN EXECUTED
        </p>
        <p style={{ margin: 0, color: "var(--t-hi)", fontSize: 16, lineHeight: 1.45, overflowWrap: "anywhere" }}>&ldquo;{rec.command}&rdquo;</p>

        <dl data-testid="shadow-route" style={{ margin: 0, display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: "6px 12px", fontSize: 14 }}>
          <dt style={muted}>Would route to</dt><dd style={{ margin: 0, color: "var(--t-hi)", fontWeight: 600 }}>{handlerText(d)}</dd>
          <dt style={muted}>Review</dt><dd style={{ margin: 0 }}>{d.reviewer ? HANDLER_META[d.reviewer].label : d.reviewRequired ? "Required (reviewer not named)" : "None"}</dd>
          <dt style={muted}>Merge authority</dt><dd style={{ margin: 0 }}>Founder</dd>
          <dt style={muted}>Founder approval</dt><dd style={{ margin: 0 }}>{d.founderApprovalRequired ? "Required" : "Not required"}</dd>
          <dt style={muted}>Mission</dt><dd style={{ margin: 0 }}>{d.attachRecommended ? "Attach to the mission you issued it from" : d.missionRecommended ? "Recommended" : "Not needed"}</dd>
          <dt style={muted}>How decided</dt><dd style={{ margin: 0 }}>{SOURCE_TEXT[d.source]}</dd>
          <dt style={muted}>Model used</dt><dd style={{ margin: 0 }}>None (rules only)</dd>
          <dt style={muted}>Reasons</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }} className="mono">{d.reasons.join(", ")}</dd>
          <dt style={muted}>Recorded</dt><dd style={{ margin: 0 }}>{new Date(rec.routedAt).toLocaleString()} · {rec.routerVersion}</dd>
        </dl>
        {d.question && <p data-testid="shadow-question" style={{ margin: 0, color: "var(--accent)" }}>{d.question}</p>}
        {rec.supersedes && <p style={{ ...muted, margin: 0 }}>Re-routed by you; replaces an earlier decision for the same command.</p>}

        {linked.length > 0 && (
          <p data-testid="shadow-linked" style={{ margin: 0, fontSize: 14 }}>
            Linked to{" "}
            {linked.map((m, i) => (
              <span key={`${m.id}-${m.relation}`}>{i > 0 && ", "}<Link href={`/command-center/missions/${m.id}`} style={{ color: "var(--accent)" }}>{formatRef(m.ref)}</Link> ({m.relation})</span>
            ))}
          </p>
        )}
        {pickerNote && <p style={{ ...muted, margin: 0 }}>{pickerNote}</p>}
        {attached && <p role="status" style={{ ...muted, margin: 0 }}>Attached. Nothing was started; the mission keeps its state.</p>}
        <ErrorLine text={error} />

        {creating ? (
          <CreateMissionForm api={missions} initialObjective={rec.command}
            sourceLink={{ targetType: "chat_message", targetId: rec.id, noun: "command", title: "New Mission from command" }}
            onCancel={() => setCreating(false)}
            onCreated={(m) => { setCreating(false); void load(); onCreated(m); }} />
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={row}>
              {(createOffered || showCreateAnyway) && <Btn tone="primary" disabled={busy} onClick={() => setCreating(true)}>Create Mission</Btn>}
              {!createOffered && !showCreateAnyway && (
                <Btn disabled={busy} onClick={() => setShowCreateAnyway(true)}>Create a separate mission instead</Btn>
              )}
              <Btn disabled={busy} onClick={onDismiss}>Dismiss</Btn>
            </div>
            <div style={row}>
              <select aria-label="Mission to attach to" value={target} disabled={busy || open === null} onChange={(e) => setAttachTo(e.target.value)} style={{ ...field, flex: "1 1 220px", width: "auto" }}>
                <option value="">{open === null ? "Loading missions…" : "Attach to a mission…"}</option>
                {(open ?? []).map((m) => <option key={m.id} value={m.id}>{formatRef(m.ref)} · {m.objective.slice(0, 60)}</option>)}
              </select>
              <Btn tone={rec.missionContext ? "primary" : "default"} disabled={busy || !target} onClick={() => void attach()}>Attach to Mission</Btn>
            </div>
            <div style={row}>
              <select aria-label="Edit routing" value={editHandler} disabled={busy} onChange={(e) => setEditHandler(e.target.value as Handler)} style={{ ...field, flex: "1 1 220px", width: "auto" }}>
                {EDITABLE.map((h) => <option key={h} value={h}>{HANDLER_META[h].label}</option>)}
              </select>
              <Btn disabled={busy} onClick={() => void reroute()}>Edit routing</Btn>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
