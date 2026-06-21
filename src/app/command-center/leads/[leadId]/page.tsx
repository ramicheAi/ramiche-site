"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { deliveryFor } from "@/lib/delivery-playbook";
import { SEO_AI_STANDARD, standardCounts } from "@/lib/seo-ai-visibility";
import { AV_WORKFLOWS, PARALLAX_AV_EDGE, fillTemplate } from "@/lib/ai-visibility-playbook";
import { InstrumentPage, Panel } from "@/components/command-center/po/Instrument";

/* ══════════════════════════════════════════════════════════════════════════════
   DEAL ROOM — everything to close + deliver one client, in one place.
   Offer · Call Script · Objection Rebuttals · Outreach · Delivery System.
   All generated from this client's diagnosis, grounded in CLOSER/AAA doctrine.
   ══════════════════════════════════════════════════════════════════════════════ */

interface RecItem { id: string; name: string; billing: "one-time" | "monthly"; price: number; value: string; }
interface Kit {
  threePillarPitch?: string[]; talkingPoints?: string[]; discoveryQuestions?: string[];
  callScript?: { clarify?: string; label?: string; overview?: string; sell?: string; explainAndClose?: string };
  objections?: { objection: string; rebuttal: string }[];
  coldEmail?: { subject?: string; body?: string };
  followUps?: { when?: string; channel?: string; message?: string }[];
}
interface Intel {
  businessType?: string; summary?: string; services?: string[]; brandVibe?: string; audience?: string;
  onlinePresence?: { website?: string | null; websiteState?: string; google?: string | null; social?: string[]; notes?: string };
  strengths?: string[]; gaps?: string[]; competitors?: { name: string; edge: string }[]; owner?: string | null;
  personalizedHooks?: string[]; recentSignals?: string[];
}
interface Lead {
  id: string; name: string | null; company: string | null; product: string | null; contact_email: string | null;
  stage: string; value: number; notes: string | null;
  meta: { website?: string | null; audit?: { healthScore?: number; gaps?: string[] }; recommendation?: { items: RecItem[]; oneTimeTotal: number; monthlyTotal: number; rationale: string[] }; kit?: Kit; intel?: Intel; intelStatus?: string; disqualified?: boolean; disqualifyReason?: string } | null;
}

const ACCENT = "var(--c-green)";
function scoreColor(s: number) { return s >= 70 ? "var(--c-green)" : s >= 40 ? "var(--c-amber)" : "var(--c-red)"; }

export default function DealRoom() {
  const { leadId } = useParams<{ leadId: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [tab, setTab] = useState("offer");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/command-center/pipeline/leads?limit=500`, { cache: "no-store" });
    if (res.ok) { const d = await res.json(); setLead((d.leads || []).find((l: Lead) => l.id === leadId) || null); }
  }, [leadId]);
  useEffect(() => { load(); }, [load]);

  const genKit = useCallback(async (regenerate = false) => {
    setBusy("kit"); setMsg(null);
    const post = (regen: boolean) =>
      fetch("/api/command-center/leads/kit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ leadId, regenerate: regen }) }).then((r) => r.json());
    const apply = (kit: Kit) => setLead((p) => (p ? { ...p, meta: { ...p.meta, kit } } : p));
    try {
      let d = await post(regenerate);
      if (d.kit) { apply(d.kit); return; }
      if (d.error) { setMsg(d.error); return; }
      // generating → poll (each call is fast, so the tunnel never times out)
      for (let i = 0; i < 50; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        d = await post(false);
        if (d.kit) { apply(d.kit); return; }
        if (d.error) { setMsg(`Kit failed: ${d.error}. Click Regenerate to retry.`); return; }
      }
      setMsg("Kit is taking longer than usual — give it a moment and reopen this client.");
    } finally { setBusy(null); }
  }, [leadId]);

  const research = useCallback(async (regenerate = false) => {
    setBusy("intel"); setMsg(null);
    const post = (regen: boolean) =>
      fetch("/api/command-center/leads/intel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ leadId, regenerate: regen }) }).then((r) => r.json());
    const apply = (intel: Intel) => setLead((p) => (p ? { ...p, meta: { ...p.meta, intel } } : p));
    try {
      let d = await post(regenerate);
      if (d.intel) { apply(d.intel); return; }
      if (d.status === "error") { setMsg(`Research failed: ${d.error}. Click Research to retry.`); return; }
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        d = await post(false);
        if (d.intel) { apply(d.intel); return; }
        if (d.status === "error") { setMsg(`Research failed: ${d.error}. Click Research to retry.`); return; }
      }
      setMsg("Research is taking longer than usual — reopen this client in a minute.");
    } finally { setBusy(null); }
  }, [leadId]);

  // One-click: research → diagnose (research-grounded) → sales kit. Everything ready.
  const prepClient = useCallback(async () => {
    setBusy("prep"); setMsg(null);
    const pollGen = async (url: string, field: "intel" | "kit") => {
      const post = (regenerate?: boolean) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ leadId, ...(regenerate ? { regenerate: true } : {}) }) }).then((r) => r.json());
      let d = await post();
      if (d[field]) return;
      // A stale cached error (from an earlier failed run) won't clear on its own — the
      // route returns it verbatim unless we force a fresh run. Retry ONCE with regenerate.
      if (d.status === "error") d = await post(true);
      for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 4000)); d = await post(); if (d[field]) return; if (d.status === "error") throw new Error(d.error || "failed"); }
      throw new Error("timed out");
    };
    try {
      if (!lead?.meta?.intel) { setMsg("🔍 Researching the business on the web… (~1–2 min)"); await pollGen("/api/command-center/leads/intel", "intel"); }
      setMsg("⚗ Diagnosing their digital presence + pricing the offer…");
      const dres = await fetch("/api/command-center/pipeline/diagnose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ leadId }) });
      const dd = await dres.json();
      if (dd.disqualified) { await load(); setMsg(`⛔ Not a fit — ${dd.reason} Marked lost; moving on.`); return; }
      setMsg("✦ Writing the call script, rebuttals & outreach…");
      await pollGen("/api/command-center/leads/kit", "kit");
      await load();
      setMsg("✅ Ready — Profile, Offer, Script, Outreach, Proposal & Invoice are all set below.");
    } catch (e) { setMsg(`Prep hit a snag: ${e instanceof Error ? e.message : "error"}. Try the individual steps above.`); }
    finally { setBusy(null); }
  }, [leadId, lead, load]);

  const createProposal = useCallback(async () => {
    const rec = lead?.meta?.recommendation; if (!rec) return;
    setBusy("proposal"); setMsg(null);
    try {
      const acv = rec.oneTimeTotal + rec.monthlyTotal * 12;
      const res = await fetch("/api/command-center/pipeline/proposals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lead_id: leadId, product: "Web + Growth Bundle", monthly_price: rec.monthlyTotal, annual_value: acv, status: "draft", terms: rec }) });
      setMsg(res.ok ? "✓ Proposal created (draft)." : ((await res.json()).error || "Proposal failed"));
    } finally { setBusy(null); }
  }, [lead, leadId]);

  const sendEmail = useCallback(async () => {
    if (!window.confirm("Send this cold email now from your Parallax Ventures email?")) return;
    setBusy("send"); setMsg(null);
    try {
      const res = await fetch("/api/command-center/leads/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ leadId }) });
      const d = await res.json();
      if (d.sent) { setMsg(`✉ Sent to ${d.to}.`); await load(); }
      else if (d.needsSetup) setMsg("Email sending isn't connected yet — use ‘Open in Email’ below for now. (Add SMTP creds to enable one-click send.)");
      else if (d.noEmail) setMsg("No contact email found for this lead — re-run Research, or it may not have one public.");
      else setMsg(d.error || "Send failed");
    } finally { setBusy(null); }
  }, [leadId, load]);

  const copy = (key: string, text: string) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500); };

  if (!lead) return <InstrumentPage id="lead" title="Lead" section="Business" icon="sales" accent="var(--c-green)"><div style={{ marginTop: 40, textAlign: "center", color: "var(--t-lo)" }}>Loading deal…</div></InstrumentPage>;

  const audit = lead.meta?.audit; const rec = lead.meta?.recommendation; const kit = lead.meta?.kit; const intel = lead.meta?.intel;
  const diagnosed = !!audit; const acv = rec ? rec.oneTimeTotal + rec.monthlyTotal * 12 : lead.value;
  const biz = lead.company || lead.name || "Lead";
  const TABS = [["profile", "Profile"], ["offer", "The Offer"], ["script", "Call Script"], ["objections", "Objections"], ["outreach", "Outreach"], ["delivery", "Delivery"]];

  return (
    <InstrumentPage
      id="lead" title={biz} section="Business" icon="sales" accent="var(--c-green)"
      actions={
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={prepClient} disabled={busy !== null} style={{ ...btn(ACCENT, busy !== null), padding: "10px 18px", fontSize: 13 }}>
            {busy === "prep" ? "Prepping…" : kit ? "↻ Re-prep" : "⚡ Prep this Client"}
          </button>
          {diagnosed && <Link href={`/command-center/leads/${leadId}/proposal`} style={{ ...btn("var(--c-cyan)", false), textDecoration: "none" }}>📄 Proposal</Link>}
          {diagnosed && <Link href={`/command-center/leads/${leadId}/invoice`} style={{ ...btn("var(--c-gold)", false), textDecoration: "none" }}>🧾 Invoice</Link>}
          {kit && <>
            <button onClick={() => research(true)} disabled={busy !== null} style={btn("var(--t-lo)", busy === "intel")} title="Re-run research only">🔍</button>
            <button onClick={() => genKit(true)} disabled={busy !== null} style={btn("var(--t-lo)", busy === "kit")} title="Re-run sales kit only">✦</button>
            <button onClick={createProposal} disabled={busy !== null} style={btn("var(--t-lo)", busy === "proposal")} title="Log proposal to pipeline">+ Pipeline</button>
          </>}
        </div>
      }
    >
      <div style={{ fontSize: 12.5, color: "var(--t-mid)", margin: "0 0 4px" }}>
        {lead.product || "Local business"} · {lead.notes || "—"}
        {typeof audit?.healthScore === "number" && <> · digital health <b style={{ color: scoreColor(audit.healthScore) }}>{audit.healthScore}/100</b></>}
        {acv ? <> · <b style={{ color: "var(--c-gold)" }}>${acv.toLocaleString()} ACV</b></> : null}
      </div>

      {msg && <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: "var(--r-sm)", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#86efac", fontSize: 13 }}>{msg}</div>}
      {lead.meta?.disqualified && <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: "var(--r-sm)", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 13 }}>⛔ <b>Not a fit.</b> {lead.meta.disqualifyReason} Marked Lost so the engine focuses on businesses that actually need us. (Profile below is still here if you want to see why.)</div>}

      {!diagnosed && <Empty text="One click → everything. ⚡ Prep this Client researches the business on the web, audits their digital presence, prices the offer, and writes the full sales kit." />}

      {diagnosed && (
        <Panel style={{ marginTop: 22 }}>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
            {TABS.map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, background: "transparent", border: "none", borderBottom: tab === id ? `2px solid ${ACCENT}` : "2px solid transparent", color: tab === id ? "var(--t-hi)" : "var(--t-lo)", cursor: "pointer" }}>{label}</button>
            ))}
          </div>

          <div style={{ marginTop: 22 }}>
            {tab === "profile" && (intel ? <Profile intel={intel} /> : <Empty text="Click ⚡ Prep this Client above — your agent browses the web to profile this exact business (type, services, reviews, competitors, owner, personalized hooks)." />)}
            {tab === "offer" && rec && <Offer rec={rec} acv={acv} />}
            {tab !== "offer" && tab !== "profile" && !kit && <Empty text="Click ⚡ Prep this Client above — your agent writes the call script, rebuttals, and outreach tailored to this client." />}
            {tab === "script" && kit && <Script kit={kit} copy={copy} copied={copied} />}
            {tab === "objections" && kit && <Objections kit={kit} />}
            {tab === "outreach" && kit && <Outreach kit={kit} copy={copy} copied={copied} email={lead.contact_email} biz={biz} onSend={sendEmail} sending={busy === "send"} />}
            {tab === "delivery" && rec && <Delivery rec={rec} biz={biz} website={lead.meta?.website || intel?.onlinePresence?.website || null} leadId={leadId} competitors={(intel?.competitors || []).map((c) => c.name).join(", ")} facts={[intel?.summary, intel?.services?.length ? `Services: ${intel.services.join(", ")}` : ""].filter(Boolean).join(" · ")} copy={copy} copied={copied} />}
          </div>
        </Panel>
      )}
    </InstrumentPage>
  );
}

/* ── Sections ─────────────────────────────────────────────────────────────── */
function Profile({ intel }: { intel: Intel }) {
  const op = intel.onlinePresence || {};
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--c-cyan)" }}>{intel.businessType || "Business"}</div>
        {intel.owner ? <div style={{ fontSize: 12, color: "var(--t-lo)", marginTop: 2 }}>Owner: {intel.owner}</div> : null}
        <p style={{ fontSize: 13.5, color: "var(--t-hi)", lineHeight: 1.65, marginTop: 8 }}>{intel.summary}</p>
      </div>
      {intel.personalizedHooks?.length ? <div style={{ borderRadius: 10, border: "1px solid rgba(56,189,248,0.3)", background: "rgba(56,189,248,0.05)", padding: "12px 14px" }}>
        <H>Personalized hooks — prove you researched them</H>
        <ul style={{ margin: 0, paddingLeft: 18, color: "#bae6fd", fontSize: 13, lineHeight: 1.8 }}>{intel.personalizedHooks.map((h, i) => <li key={i}>{h}</li>)}</ul>
      </div> : null}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Col label="Services" items={intel.services} />
        <Col label="Strengths" items={intel.strengths} />
        <Col label="Digital gaps we fix" items={intel.gaps} accent="var(--c-amber)" />
        <Col label="Audience" items={intel.audience ? [intel.audience] : []} />
      </div>
      <div>
        <H>Online presence</H>
        <div style={{ fontSize: 13, color: "var(--t-mid)", lineHeight: 1.8 }}>
          Website: {op.website ? <a href={op.website} target="_blank" rel="noreferrer" style={{ color: "var(--c-cyan)" }}>{op.website}</a> : <span style={{ color: "var(--c-amber)" }}>none</span>} {op.websiteState ? `(${op.websiteState})` : ""}<br />
          Google: {op.google || "—"}<br />
          Social: {op.social?.length ? op.social.join(", ") : "—"}<br />
          {op.notes ? <span style={{ color: "var(--t-lo)" }}>{op.notes}</span> : null}
        </div>
      </div>
      {intel.competitors?.length ? <div>
        <H>Competitors</H>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{intel.competitors.map((c, i) => <div key={i} style={{ fontSize: 13 }}><b>{c.name}</b> <span style={{ color: "var(--t-lo)" }}>— {c.edge}</span></div>)}</div>
      </div> : null}
      {intel.recentSignals?.length ? <Col label="Recent signals" items={intel.recentSignals} /> : null}
      {intel.brandVibe ? <div><H>Brand vibe</H><div style={{ fontSize: 13, color: "var(--t-mid)" }}>{intel.brandVibe}</div></div> : null}
    </div>
  );
}
function Col({ label, items, accent }: { label: string; items?: string[]; accent?: string }) {
  if (!items?.length) return null;
  return <div><H>{label}</H><ul style={{ margin: 0, paddingLeft: 18, color: accent || "var(--t-mid)", fontSize: 12.5, lineHeight: 1.75 }}>{items.map((s, i) => <li key={i}>{s}</li>)}</ul></div>;
}
function Offer({ rec, acv }: { rec: { items: RecItem[]; oneTimeTotal: number; monthlyTotal: number; rationale: string[] }; acv: number }) {
  return (
    <div>
      <H>Why they need this</H>
      <ul style={{ margin: "0 0 20px", paddingLeft: 18, color: "var(--t-mid)", fontSize: 13, lineHeight: 1.8 }}>{rec.rationale.map((r, i) => <li key={i}>{r}</li>)}</ul>
      <H>The bundle</H>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rec.items.map((it) => (
          <div key={it.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
            <div><b>{it.name}</b> <span style={{ fontSize: 11, color: "var(--t-lo)" }}>— {it.value}</span></div>
            <div style={{ whiteSpace: "nowrap", color: it.billing === "monthly" ? "var(--c-purplel)" : ACCENT, fontWeight: 700 }}>${it.price.toLocaleString()}{it.billing === "monthly" ? "/mo" : ""}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 24, marginTop: 16, fontSize: 14 }}>
        <span>One-time <b style={{ color: ACCENT }}>${rec.oneTimeTotal.toLocaleString()}</b></span>
        <span>Recurring <b style={{ color: "var(--c-purplel)" }}>${rec.monthlyTotal.toLocaleString()}/mo</b></span>
        <span>Annual value <b style={{ color: "var(--c-gold)" }}>${acv.toLocaleString()}</b></span>
      </div>
    </div>
  );
}
function Script({ kit, copy, copied }: { kit: Kit; copy: (k: string, t: string) => void; copied: string | null }) {
  const s = kit.callScript || {};
  const rows: [string, string | undefined][] = [["1 · Clarify", s.clarify], ["2 · Label the gap", s.label], ["3 · Overview the pain", s.overview], ["4 · Sell the outcome", s.sell], ["5 · Explain + close", s.explainAndClose]];
  const full = rows.map(([k, v]) => `${k}\n${v || ""}`).join("\n\n");
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><H>CLOSER call script</H><CopyBtn k="script" copied={copied} onClick={() => copy("script", full)} /></div>
      {kit.threePillarPitch?.length ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 16px" }}>{kit.threePillarPitch.map((p, i) => <span key={i} style={{ fontSize: 12, padding: "5px 11px", borderRadius: 20, background: "rgba(34,197,94,0.1)", color: "#86efac" }}>{p}</span>)}</div> : null}
      {rows.map(([k, v]) => v && <div key={k} style={{ marginBottom: 14 }}><div style={{ fontSize: 11, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>{k}</div><div style={{ fontSize: 13.5, color: "var(--t-hi)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{v}</div></div>)}
      {kit.discoveryQuestions?.length ? <><H>Discovery questions</H><ul style={{ margin: 0, paddingLeft: 18, color: "var(--t-mid)", fontSize: 13, lineHeight: 1.8 }}>{kit.discoveryQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul></> : null}
    </div>
  );
}
function Objections({ kit }: { kit: Kit }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {(kit.objections || []).map((o, i) => (
        <div key={i} style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "14px 16px" }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#fca5a5" }}>“{o.objection}”</div>
          <div style={{ fontSize: 13.5, color: "var(--t-hi)", lineHeight: 1.65, marginTop: 7, whiteSpace: "pre-wrap" }}>{o.rebuttal}</div>
        </div>
      ))}
    </div>
  );
}
function Outreach({ kit, copy, copied, email, biz, onSend, sending }: { kit: Kit; copy: (k: string, t: string) => void; copied: string | null; email: string | null; biz: string; onSend: () => void; sending: boolean }) {
  const e = kit.coldEmail || {};
  const emailFull = `Subject: ${e.subject || ""}\n\n${e.body || ""}`;
  const mailto = `mailto:${email || ""}?subject=${encodeURIComponent(e.subject || `Quick idea for ${biz}`)}&body=${encodeURIComponent(e.body || "")}`;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <H>Cold email{email ? ` → ${email}` : " · no contact email found"}</H>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onSend} disabled={sending} style={{ fontSize: 11, fontWeight: 800, padding: "6px 14px", borderRadius: 6, background: sending ? "var(--line)" : ACCENT, color: sending ? "var(--t-lo)" : "#001b0c", border: "none", cursor: sending ? "default" : "pointer" }}>{sending ? "Sending…" : "🚀 Send Now"}</button>
          <a href={mailto} style={{ fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 6, background: "rgba(34,197,94,0.12)", color: ACCENT, border: "1px solid #22c55e55", textDecoration: "none" }}>✉ Open in Email</a>
          <CopyBtn k="email" copied={copied} onClick={() => copy("email", emailFull)} />
        </div>
      </div>
      <div style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "14px 16px", marginBottom: 22 }}>
        <div style={{ fontSize: 12, color: "var(--t-lo)" }}>Subject</div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{e.subject}</div>
        <div style={{ fontSize: 13.5, color: "var(--t-hi)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{e.body}</div>
      </div>
      <H>Follow-up sequence</H>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(kit.followUps || []).map((f, i) => (
          <div key={i} style={{ display: "flex", gap: 12, fontSize: 13, borderBottom: "1px solid var(--line)", padding: "9px 0" }}>
            <div style={{ whiteSpace: "nowrap", color: ACCENT, fontWeight: 700, minWidth: 90 }}>{f.when} · {f.channel}</div>
            <div style={{ color: "var(--t-hi)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{f.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
function Delivery({ rec, biz, website, leadId, competitors, facts, copy, copied }: { rec: { items: RecItem[] }; biz: string; website: string | null; leadId: string; competitors: string; facts: string; copy: (k: string, t: string) => void; copied: string | null }) {
  const plays = rec.items.map((i) => deliveryFor(i.id)).filter(Boolean);
  const ids = new Set(rec.items.map((i) => i.id));
  const hasAv = ids.has("ai_visibility");
  const needsBuild = ids.has("web_build") || ids.has("ai_visibility") || ids.has("local_seo") || ids.has("branding");
  // Every {{var}} the four AV workflow templates use — so copied prompts are
  // genuinely pre-filled, not shipped with [placeholders].
  const avVars = {
    brand: biz,
    competitors,
    competitor: competitors.split(",")[0]?.trim() || "",
    page: website || biz,
    pages: website || biz,
    facts,
    questions: "(top-ranked questions from the AI Visibility Audit — run that workflow first)",
    platform: "Next.js (Parallax build)",
  };
  const counts = standardCounts();
  const bundle = rec.items.map((i) => i.name).join(", ");
  // The exact prompt to drop into Claude Code / OpenClaw — runs the build skill for THIS client.
  const handoff = [
    `Run the web-client-delivery skill for a new client.`,
    ``,
    `Client: ${biz}`,
    `Current site: ${website || "none"}`,
    `Lead: ${leadId}`,
    `Sold bundle: ${bundle}`,
    ``,
    `Design with the frontend-design plugin + shadcn/Magic components (professional, not vibe-coded), build it fast (Core Web Vitals), then apply the full Parallax SEO + AI-visibility standard from src/lib/seo-ai-visibility.ts: per-page titles/meta, LocalBusiness + Service + FAQ JSON-LD, app/sitemap.ts, robots.txt allowing AI crawlers, /llms.txt, answer-shaped copy. Verify performance + render with the chrome-devtools MCP, then deploy with the deploy-to-vercel skill.`,
  ].join("\n");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 12.5, color: "var(--t-lo)", margin: 0 }}>When they say yes — this is exactly how we deliver. Repeatable, agent-run.</p>

      {needsBuild && (
        <div style={{ borderRadius: 10, border: "1px solid rgba(0,240,255,0.3)", background: "rgba(0,240,255,0.04)", padding: "16px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--c-cyan)" }}>⚡ Ship it — hand off to Claude Code</div>
            <CopyBtn k="handoff" copied={copied} onClick={() => copy("handoff", handoff)} />
          </div>
          <div style={{ fontSize: 12.5, color: "var(--t-mid)", margin: "6px 0 10px" }}>Copy this into Claude Code (or your OpenClaw agent). It runs the <code style={{ color: "#67e8f9" }}>web-client-delivery</code> skill end-to-end: design → build → SEO/AI pass → verify → deploy.</div>
          <pre style={{ margin: 0, padding: "12px 14px", borderRadius: 8, background: "var(--ink-0)", border: "1px solid var(--line)", color: "var(--t-hi)", fontSize: 11.5, lineHeight: 1.6, whiteSpace: "pre-wrap", fontFamily: "'SF Mono','Fira Code',monospace" }}>{handoff}</pre>
        </div>
      )}

      {plays.map((p) => p && (
        <div key={p.serviceId} style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "16px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{p.system}</div>
            <div style={{ fontSize: 11, color: "var(--t-lo)" }}>{p.timeline} · {p.agents.join(", ")}</div>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--t-mid)", margin: "6px 0 10px" }}>{p.outcome}</div>
          <ol style={{ margin: 0, paddingLeft: 18, color: "var(--t-hi)", fontSize: 12.5, lineHeight: 1.7 }}>{p.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </div>
      ))}

      {needsBuild && (
        <div style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "16px 18px" }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>SEO + AI-Visibility Standard</div>
          <div style={{ fontSize: 12.5, color: "var(--t-mid)", margin: "6px 0 12px" }}>Every site we ship clears this — {counts.total} checks ({counts.ai} of them get you found by AI assistants, not just Google).</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {SEO_AI_STANDARD.map((sec) => (
              <div key={sec.id}>
                <div style={{ fontSize: 12, fontWeight: 700, color: sec.id === "ai_visibility" ? "var(--c-cyan)" : "var(--c-green)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{sec.title}</div>
                <div style={{ fontSize: 11.5, color: "var(--t-lo)", margin: "3px 0 7px" }}>{sec.intro}</div>
                <ul style={{ margin: 0, paddingLeft: 16, color: "var(--t-hi)", fontSize: 12, lineHeight: 1.65, listStyle: "none" }}>
                  {sec.items.map((it) => (
                    <li key={it.id} style={{ marginBottom: 5 }}>
                      <span style={{ color: it.ai ? "var(--c-cyan)" : "var(--c-green)" }}>{it.ai ? "✦" : "✓"}</span> <b>{it.label}</b>
                      <span style={{ color: "var(--t-lo)" }}> — {it.why}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasAv && (
        <div style={{ borderRadius: 10, border: "1px solid rgba(168,85,247,0.35)", background: "rgba(168,85,247,0.05)", padding: "16px 18px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--c-fuchsia)" }}>🤖 AI Visibility Engine (GEO/AEO)</div>
          <div style={{ fontSize: 12.5, color: "var(--t-mid)", margin: "6px 0 12px" }}>The monthly engine that gets {biz} named by ChatGPT, Claude & Perplexity. Each prompt is pre-filled for this client — copy into Claude / your agent, or run the <code style={{ color: "#d8b4fe" }}>ai-visibility-audit</code> skill. Build it weekly; share-of-voice compounds.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {AV_WORKFLOWS.map((w) => (
              <div key={w.id} style={{ borderRadius: 8, border: "1px solid var(--line)", padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{w.title}</div>
                  <CopyBtn k={`av_${w.id}`} copied={copied} onClick={() => copy(`av_${w.id}`, fillTemplate(w.promptTemplate, avVars))} />
                </div>
                <div style={{ fontSize: 12, color: "var(--t-lo)", margin: "4px 0 0" }}>{w.goal}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--c-fuchsia)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "16px 0 8px" }}>The Parallax Edge — past table stakes</div>
          <ul style={{ margin: 0, paddingLeft: 16, color: "var(--t-hi)", fontSize: 12, lineHeight: 1.6, listStyle: "none" }}>
            {PARALLAX_AV_EDGE.map((e) => (
              <li key={e.id} style={{ marginBottom: 7 }}>
                <span style={{ color: "var(--c-fuchsia)" }}>◆</span> <b>{e.name}</b>
                <span style={{ color: "var(--t-lo)" }}> — {e.insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── bits ─────────────────────────────────────────────────────────────────── */
function H({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: 11, color: "var(--t-lo)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 10px" }}>{children}</div>; }
function Empty({ text }: { text: string }) { return <div style={{ marginTop: 30, padding: 30, textAlign: "center", color: "var(--t-lo)", fontSize: 13.5, border: "1px dashed var(--line)", borderRadius: "var(--r-md)" }}>{text}</div>; }
function CopyBtn({ k, copied, onClick }: { k: string; copied: string | null; onClick: () => void }) { return <button onClick={onClick} style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: "var(--r-sm)", background: "var(--ink-2)", color: copied === k ? ACCENT : "var(--t-mid)", border: "1px solid var(--line)", cursor: "pointer" }}>{copied === k ? "✓ Copied" : "Copy"}</button>; }
function btn(color: string, busy: boolean): React.CSSProperties { return { padding: "8px 15px", fontSize: 12.5, fontWeight: 700, borderRadius: "var(--r-sm)", cursor: busy ? "default" : "pointer", whiteSpace: "nowrap", background: `color-mix(in oklab, ${color} 12%, transparent)`, color, border: `1px solid color-mix(in oklab, ${color} 36%, transparent)` }; }
