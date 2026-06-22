"use client";

/**
 * The consent funnel landing page — Parallax's legal, warm lead net.
 * A business requests a free AI-visibility audit; the request is consent.
 * Business Bible: Proof + Promise + Plan, Big Fast Value, low friction, polarize.
 */
import { useState } from "react";

export default function FreeAuditPage() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ business: "", email: "", website: "", city: "", name: "", phone: "" });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch("/api/free-audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Something went wrong."); return; }
      setSent(true);
    } catch { setErr("Network error — please try again."); } finally { setBusy(false); }
  };

  const C = { bg: "#0a0a0f", card: "#14141c", line: "#262633", hi: "#f4f5fb", mid: "#9aa0b5", gold: "#C9A84C", green: "#22c55e" };

  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.hi, fontFamily: "var(--font-geist-sans, system-ui, sans-serif)", padding: "0 20px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "72px 0 96px" }}>
        <div style={{ fontSize: 12, letterSpacing: "0.2em", color: C.gold, fontWeight: 600, textTransform: "uppercase", marginBottom: 22 }}>
          Parallax Ventures · Free Audit
        </div>

        {!sent ? (
          <>
            <h1 style={{ fontSize: "clamp(30px,5vw,46px)", lineHeight: 1.12, fontWeight: 700, margin: "0 0 18px", letterSpacing: "-0.02em" }}>
              See exactly what a customer sees when they Google your business — and the 3 gaps quietly costing you clients.
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.55, color: C.mid, margin: "0 0 14px" }}>
              We&apos;ll run a free AI-visibility audit on your business and send it back within 24 hours: where you show up (and where you vanish), what your competitors do that you don&apos;t, and the exact fixes — ranked by what brings in the most customers.
            </p>
            <p style={{ fontSize: 15, lineHeight: 1.5, color: C.mid, margin: "0 0 28px" }}>
              No sales call required. We send the audit, you decide. For local owners who are <b style={{ color: C.hi }}>great at what they do but invisible online.</b>
            </p>

            <form onSubmit={submit} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { k: "business", ph: "Business name *", type: "text", req: true },
                { k: "email", ph: "Email (where we send the audit) *", type: "email", req: true },
                { k: "website", ph: "Website or Instagram (optional)", type: "text", req: false },
                { k: "city", ph: "City (optional)", type: "text", req: false },
                { k: "name", ph: "Your name (optional)", type: "text", req: false },
                { k: "phone", ph: "Phone (optional — only if you want a call)", type: "tel", req: false },
              ].map((fld) => (
                <input key={fld.k} type={fld.type} placeholder={fld.ph} required={fld.req}
                  value={(f as Record<string, string>)[fld.k]} onChange={set(fld.k)}
                  style={{ padding: "13px 15px", fontSize: 15, color: C.hi, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, outline: "none" }} />
              ))}
              {err && <div style={{ color: "#f87171", fontSize: 14 }}>{err}</div>}
              <button type="submit" disabled={busy}
                style={{ marginTop: 4, padding: "15px", fontSize: 16, fontWeight: 700, color: "#0a0a0f", background: C.gold, border: "none", borderRadius: 10, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
                {busy ? "Sending…" : "Send me my free audit →"}
              </button>
              <p style={{ fontSize: 12, color: C.mid, margin: "4px 0 0", lineHeight: 1.5 }}>
                By requesting your audit you agree to receive it and related follow-up from Parallax Ventures. We never share your info, and you can opt out anytime.
              </p>
            </form>

            <div style={{ display: "flex", gap: 24, marginTop: 28, flexWrap: "wrap", fontSize: 13, color: C.mid }}>
              <span>✓ Free, no obligation</span><span>✓ Back within 24 hours</span><span>✓ Built for local businesses</span>
            </div>
          </>
        ) : (
          <div style={{ background: C.card, border: `1px solid ${C.green}40`, borderRadius: 16, padding: "40px 28px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            <h2 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 12px" }}>Your audit is on the way.</h2>
            <p style={{ fontSize: 16, color: C.mid, lineHeight: 1.55, margin: 0 }}>
              We&apos;re building <b style={{ color: C.hi }}>{f.business}</b>&apos;s audit now and will send it to <b style={{ color: C.hi }}>{f.email}</b> within 24 hours. Keep an eye on your inbox.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
