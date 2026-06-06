"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════════════════════
   PROSPECTOR — find real businesses anywhere (city / state / nation / overseas)
   via OpenStreetMap. Flag the ones with no website, then push them straight into
   the sales pipeline as leads. Free, global, no API key.
   ══════════════════════════════════════════════════════════════════════════════ */

const CATEGORIES = [
  ["restaurant", "Restaurants"], ["cafe", "Cafes"], ["bar", "Bars / Pubs"], ["gym", "Gyms / Fitness"],
  ["salon", "Hair Salons"], ["beauty", "Beauty / Spa"], ["retail", "Retail Shops"], ["realestate", "Real Estate"],
  ["lawyer", "Law Firms"], ["dentist", "Dentists"], ["doctor", "Doctors / Clinics"], ["autorepair", "Auto Repair"],
  ["hotel", "Hotels"], ["contractor", "Contractors / Trades"],
];

interface Result { name: string; category: string; address: string; phone: string | null; website: string | null; lat: number | null; lon: number | null; osmId: string; }

export default function ProspectorPage() {
  const [category, setCategory] = useState("gym");
  const [location, setLocation] = useState("");
  const [onlyNoWebsite, setOnlyNoWebsite] = useState(true);
  const [limit, setLimit] = useState(60);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [area, setArea] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [imported, setImported] = useState<number | null>(null);

  const search = useCallback(async () => {
    if (!location.trim() || loading) return;
    setLoading(true); setMsg(null); setImported(null); setResults([]); setSel(new Set());
    try {
      const res = await fetch("/api/command-center/prospector/search", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ category, location: location.trim(), onlyNoWebsite, limit }),
      });
      const d = await res.json();
      if (!res.ok) { setMsg(d.error || "Search failed"); return; }
      setResults(d.results || []);
      setArea(d.area?.displayName || location);
      setSel(new Set((d.results || []).map((r: Result) => r.osmId)));
      if ((d.results || []).length === 0) setMsg("No businesses matched. Try a broader category or a narrower location.");
    } catch { setMsg("Network error"); } finally { setLoading(false); }
  }, [category, location, onlyNoWebsite, limit, loading]);

  const toggle = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = results.length > 0 && sel.size === results.length;

  const importLeads = useCallback(async () => {
    const chosen = results.filter((r) => sel.has(r.osmId));
    if (chosen.length === 0) return;
    setMsg(null);
    const res = await fetch("/api/command-center/prospector/import", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ leads: chosen, product: "Web Development" }),
    });
    const d = await res.json();
    if (res.ok) setImported(d.imported ?? chosen.length);
    else setMsg(d.error || "Import failed");
  }, [results, sel]);

  const input: React.CSSProperties = { background: "#09090b", border: "1px solid #27272a", borderRadius: 8, color: "#e4e4e7", fontSize: 14, padding: "11px 14px", outline: "none" };
  const noWebCount = results.filter((r) => !r.website).length;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e5e5e5", padding: "32px 28px 80px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Link href="/command-center" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#737373", textDecoration: "none" }}>← COMMAND CENTER</Link>
        <h1 style={{ fontSize: 30, fontWeight: 900, margin: "8px 0 0" }}>Prospector</h1>
        <p style={{ fontSize: 13, color: "#737373", margin: "6px 0 0" }}>Find real businesses anywhere — any city, state, country. Flag the ones with no website and push them into the pipeline. Powered by OpenStreetMap (free, global).</p>

        {/* Controls */}
        <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap", alignItems: "center" }}>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...input, minWidth: 160 }}>
            {CATEGORIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <input value={location} onChange={(e) => setLocation(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }}
            placeholder="Location — e.g. Fort Lauderdale FL · Austin TX · Lisbon, Portugal" style={{ ...input, flex: 1, minWidth: 280 }} />
          <button onClick={search} disabled={loading || !location.trim()} style={{
            padding: "11px 24px", fontSize: 14, fontWeight: 700, borderRadius: 8, border: "none",
            cursor: loading || !location.trim() ? "default" : "pointer",
            background: loading || !location.trim() ? "#27272a" : "linear-gradient(135deg, #22c55e, #16a34a)", color: "#001b0c", whiteSpace: "nowrap",
          }}>{loading ? "Searching…" : "Search 🌐"}</button>
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 12, alignItems: "center", fontSize: 13, color: "#a1a1aa" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={onlyNoWebsite} onChange={(e) => setOnlyNoWebsite(e.target.checked)} /> Only businesses with no website
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            Max <input type="number" value={limit} min={10} max={200} onChange={(e) => setLimit(Number(e.target.value))} style={{ ...input, width: 80, padding: "6px 10px" }} />
          </label>
        </div>

        {msg && <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 13 }}>{msg}</div>}
        {imported !== null && <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#86efac", fontSize: 13 }}>✓ Imported {imported} leads into the pipeline. <Link href="/command-center/sales" style={{ color: "#22c55e", fontWeight: 700 }}>View in Sales →</Link></div>}

        {/* Results */}
        {results.length > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "24px 0 12px" }}>
              <div style={{ fontSize: 13, color: "#a1a1aa" }}>
                <span style={{ color: "#e5e5e5", fontWeight: 700 }}>{results.length}</span> found in {area.split(",").slice(0, 2).join(",")} · <span style={{ color: "#f59e0b" }}>{noWebCount} no website</span>
              </div>
              <button onClick={importLeads} disabled={sel.size === 0} style={{
                padding: "9px 20px", fontSize: 13, fontWeight: 700, borderRadius: 8, border: "1px solid #22c55e55",
                cursor: sel.size === 0 ? "default" : "pointer", background: sel.size === 0 ? "transparent" : "rgba(34,197,94,0.12)", color: sel.size === 0 ? "#52525b" : "#22c55e",
              }}>+ Add {sel.size} to Pipeline</button>
            </div>
            <div style={{ borderRadius: 12, border: "1px solid #1e1e1e", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "36px 1.6fr 1fr 1.4fr 1fr", gap: 0, padding: "10px 14px", background: "rgba(255,255,255,0.03)", fontSize: 10, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                <input type="checkbox" checked={allSelected} onChange={() => setSel(allSelected ? new Set() : new Set(results.map((r) => r.osmId)))} />
                <span>Business</span><span>Category</span><span>Address</span><span>Contact</span>
              </div>
              {results.map((r) => (
                <div key={r.osmId} style={{ display: "grid", gridTemplateColumns: "36px 1.6fr 1fr 1.4fr 1fr", gap: 0, padding: "11px 14px", borderTop: "1px solid #161616", fontSize: 13, alignItems: "center", background: sel.has(r.osmId) ? "rgba(34,197,94,0.04)" : "transparent" }}>
                  <input type="checkbox" checked={sel.has(r.osmId)} onChange={() => toggle(r.osmId)} />
                  <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                  <span style={{ color: "#a1a1aa", fontSize: 12 }}>{r.category}</span>
                  <span style={{ color: "#71717a", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.address || "—"}</span>
                  <span style={{ fontSize: 12 }}>
                    {r.phone && <span style={{ color: "#a1a1aa" }}>{r.phone}</span>}
                    {!r.website ? <span style={{ marginLeft: r.phone ? 8 : 0, color: "#f59e0b", fontWeight: 700, fontSize: 10 }}>NO SITE</span> : <a href={r.website} target="_blank" rel="noreferrer" style={{ marginLeft: r.phone ? 8 : 0, color: "#38bdf8", fontSize: 11 }}>site</a>}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
