"use client";

/**
 * The Approval Gate — Ramon's one-click queue. Every irreversible action the
 * autonomous loop drafts (send/publish/spend/price/close) waits here. Approve = it
 * fires (sends the email). Reject = it dies. Nothing happens without a click.
 */
import { useState, useEffect, useCallback } from "react";
import { InstrumentPage } from "@/components/command-center/po/Instrument";

interface GateItem {
  id: string;
  feed: string | null;
  kind: string;
  title: string;
  why: string | null;
  dollar_impact: number;
  payload: { subject?: string; body?: string; channel?: string } | null;
  requested_by: string | null;
  created_at: string;
  pipeline_leads: { company?: string | null; contact_email?: string | null; name?: string | null } | null;
}

const FEED_COLOR: Record<string, string> = {
  agency: "var(--c-amber)", mettle: "var(--c-cyan)", galactik: "var(--c-fuchsia)",
  content: "var(--c-green)", services: "var(--c-teal)",
};

export default function GatePage() {
  const [items, setItems] = useState<GateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/command-center/gate", { cache: "no-store" });
      const d = await r.json();
      setItems(d.items || []);
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const decide = useCallback(async (id: string, action: "approve" | "reject") => {
    setBusy(id);
    try {
      const r = await fetch("/api/command-center/gate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const d = await r.json();
      if (d.status === "executed") setToast(`✅ Sent to ${d.sentTo}`);
      else if (d.status === "approved") setToast(d.warning ? `⚠️ ${d.warning}` : "✅ Approved");
      else if (d.status === "rejected") setToast("Rejected — draft killed.");
      else setToast(d.error || "Done");
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch { setToast("Network error"); } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 5000);
    }
  }, []);

  const totalValue = items.reduce((s, x) => s + (x.dollar_impact || 0), 0);

  return (
    <InstrumentPage id="gate" title="Approval Gate" section="Operations" icon="bolt" accent="var(--c-amber)">
      <p className="mono" style={{ fontSize: 12, color: "var(--t-mid)", letterSpacing: "0.1em", margin: "0 0 18px" }}>
        Everything the loop drafts waits here. APPROVE fires it · REJECT kills it · nothing happens without you.
      </p>

      {toast && (
        <div className="mono" style={{ marginBottom: 14, padding: "10px 14px", fontSize: 13, borderRadius: "var(--r-sm,8px)",
          background: "color-mix(in srgb, var(--c-teal) 14%, transparent)", border: "1px solid color-mix(in srgb, var(--c-teal) 30%, transparent)", color: "var(--t-hi)" }}>
          {toast}
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="mono" style={{ marginBottom: 16, fontSize: 13, color: "var(--t-mid)" }}>
          <b style={{ color: "var(--c-amber)" }}>{items.length}</b> pending ·
          <b style={{ color: "var(--t-hi)" }}> ${totalValue.toLocaleString()}</b> at stake
        </div>
      )}

      {loading ? (
        <p className="mono" style={{ fontSize: 12, color: "var(--t-mid)" }}>Loading the queue…</p>
      ) : items.length === 0 ? (
        <div style={{ padding: 30, textAlign: "center", color: "var(--t-mid)", border: "1px dashed color-mix(in srgb, var(--t-mid) 25%, transparent)", borderRadius: "var(--r-md,12px)" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
          <div className="mono" style={{ fontSize: 13 }}>Queue clear. The loop will refill it on its next run.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((it) => {
            const accent = FEED_COLOR[it.feed || ""] || "var(--c-amber)";
            const lead = it.pipeline_leads;
            const noEmail = it.kind === "send" && !lead?.contact_email;
            const isOpen = open[it.id];
            return (
              <div key={it.id} style={{ padding: "16px 18px", borderRadius: "var(--r-md,12px)",
                border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
                background: "color-mix(in srgb, var(--ink,#0c0c14) 50%, transparent)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: accent, marginBottom: 4, textTransform: "uppercase" }}>
                      {it.feed} · {it.kind} {lead?.company ? `· ${lead.company}` : ""}
                    </div>
                    <div style={{ fontSize: 15, color: "var(--t-hi)", fontWeight: 600 }}>{it.title}</div>
                  </div>
                  <div className="mono" style={{ fontSize: 14, color: "var(--c-amber)", fontWeight: 700, whiteSpace: "nowrap" }}>
                    ${(it.dollar_impact || 0).toLocaleString()}
                  </div>
                </div>

                {it.why && <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--t-mid)" }}>{it.why}</p>}

                {noEmail && (
                  <div className="mono" style={{ marginTop: 10, fontSize: 11, color: "var(--c-red)" }}>
                    ⚠ No contact email on this lead — approving won&apos;t send. Enrich it first.
                  </div>
                )}

                {it.payload?.body && (
                  <div style={{ marginTop: 12 }}>
                    <button onClick={() => setOpen((o) => ({ ...o, [it.id]: !isOpen }))} className="mono"
                      style={{ fontSize: 11, color: accent, background: "none", border: "none", cursor: "pointer", padding: 0, letterSpacing: "0.08em" }}>
                      {isOpen ? "▾ hide draft" : "▸ read the draft"} {lead?.contact_email ? `→ ${lead.contact_email}` : ""}
                    </button>
                    {isOpen && (
                      <div style={{ marginTop: 8, padding: 14, borderRadius: "var(--r-sm,8px)", background: "color-mix(in srgb, var(--ink,#0c0c14) 80%, transparent)", border: "1px solid color-mix(in srgb, var(--t-mid) 14%, transparent)" }}>
                        {it.payload.subject && <div style={{ fontSize: 13, color: "var(--t-hi)", fontWeight: 600, marginBottom: 8 }}>Subject: {it.payload.subject}</div>}
                        <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, lineHeight: 1.6, color: "var(--t-mid)" }}>{it.payload.body}</pre>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <button onClick={() => decide(it.id, "approve")} disabled={busy === it.id} className="mono"
                    style={{ padding: "9px 18px", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", cursor: busy ? "default" : "pointer",
                      color: "#031b10", background: "var(--c-green)", border: "none", borderRadius: "var(--r-sm,8px)", opacity: busy === it.id ? 0.5 : 1 }}>
                    {busy === it.id ? "…" : noEmail ? "APPROVE (no send)" : "APPROVE & SEND"}
                  </button>
                  <button onClick={() => decide(it.id, "reject")} disabled={busy === it.id} className="mono"
                    style={{ padding: "9px 18px", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", cursor: busy ? "default" : "pointer",
                      color: "var(--c-red)", background: "color-mix(in srgb, var(--c-red) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--c-red) 30%, transparent)", borderRadius: "var(--r-sm,8px)" }}>
                    REJECT
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </InstrumentPage>
  );
}
