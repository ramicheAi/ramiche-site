"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { InstrumentPage, Panel } from "@/components/command-center/po/Instrument";

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

// One-click starter searches so the page is never a dead-looking blank form.
const EXAMPLES: { cat: string; loc: string; label: string }[] = [
  { cat: "gym", loc: "Fort Lauderdale, FL", label: "Gyms · Fort Lauderdale" },
  { cat: "restaurant", loc: "Austin, TX", label: "Restaurants · Austin" },
  { cat: "salon", loc: "Miami, FL", label: "Salons · Miami" },
  { cat: "dentist", loc: "Scottsdale, AZ", label: "Dentists · Scottsdale" },
  { cat: "cafe", loc: "Lisbon, Portugal", label: "Cafes · Lisbon 🌍" },
];

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

  // Core search — takes explicit args so the one-click examples work without
  // waiting on React state to flush.
  const runSearch = useCallback(async (cat: string, loc: string) => {
    if (!loc.trim() || loading) return;
    setCategory(cat); setLocation(loc);
    setLoading(true); setMsg(null); setImported(null); setResults([]); setSel(new Set());
    try {
      const res = await fetch("/api/command-center/prospector/search", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ category: cat, location: loc.trim(), onlyNoWebsite, limit }),
      });
      const d = await res.json();
      if (!res.ok) { setMsg(d.error || "Search failed"); return; }
      setResults(d.results || []);
      setArea(d.area?.displayName || loc);
      setSel(new Set((d.results || []).map((r: Result) => r.osmId)));
      if ((d.results || []).length === 0) setMsg("No businesses matched. Try a broader category or a narrower location.");
    } catch { setMsg("Network error — the map service may be busy. Try again."); } finally { setLoading(false); }
  }, [onlyNoWebsite, limit, loading]);

  const search = useCallback(() => runSearch(category, location), [runSearch, category, location]);

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

  const input: React.CSSProperties = { background: "var(--ink-2)", border: "1px solid var(--line)", borderRadius: "var(--r-sm)", color: "var(--t-hi)", fontSize: 14, padding: "11px 14px", outline: "none" };
  const noWebCount = results.filter((r) => !r.website).length;

  return (
    <InstrumentPage id="prospector" title="Prospector" section="Business" icon="search" accent="var(--c-green)">
      <p style={{ fontSize: 13, color: "var(--t-mid)", margin: "0 0 6px" }}>Find real businesses anywhere — any city, state, country. Flag the ones with no website and push them into the pipeline. Powered by OpenStreetMap (free, global).</p>

      <Panel title="Search" icon="search">
        {/* Controls */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...input, minWidth: 160 }}>
            {CATEGORIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <input value={location} onChange={(e) => setLocation(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }}
            placeholder="Location — e.g. Fort Lauderdale FL · Austin TX · Lisbon, Portugal" style={{ ...input, flex: 1, minWidth: 280 }} />
          <button onClick={search} disabled={loading || !location.trim()} style={{
            padding: "11px 24px", fontSize: 14, fontWeight: 700, borderRadius: "var(--r-sm)", border: "none",
            cursor: loading || !location.trim() ? "default" : "pointer",
            background: loading || !location.trim() ? "var(--ink-3)" : "linear-gradient(135deg, var(--c-green), #16a34a)", color: "#001b0c", whiteSpace: "nowrap",
          }}>{loading ? "Searching…" : "Search 🌐"}</button>
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 12, alignItems: "center", fontSize: 13, color: "var(--t-mid)" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={onlyNoWebsite} onChange={(e) => setOnlyNoWebsite(e.target.checked)} /> Only businesses with no website
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            Max <input type="number" value={limit} min={10} max={200} onChange={(e) => setLimit(Number(e.target.value))} style={{ ...input, width: 80, padding: "6px 10px" }} />
          </label>
        </div>
      </Panel>

      {msg && <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: "var(--r-sm)", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 13 }}>{msg}</div>}
      {imported !== null && <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: "var(--r-sm)", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#86efac", fontSize: 13 }}>✓ Imported {imported} leads into the pipeline. <Link href="/command-center/sales" style={{ color: "var(--c-green)", fontWeight: 700 }}>View in Sales →</Link></div>}

      {/* Loading */}
      {loading && (
        <div style={{ marginTop: 40, textAlign: "center", color: "var(--t-mid)", fontSize: 14 }}>
          Searching <b style={{ color: "var(--t-hi)" }}>{location}</b> for {(CATEGORIES.find(([id]) => id === category)?.[1]) || category}…
        </div>
      )}

      {/* Empty state — never a dead-looking blank form */}
      {!loading && results.length === 0 && !msg && imported === null && (
        <div style={{ marginTop: 44, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: "var(--t-mid)", marginBottom: 6 }}>Pick a category, type any city, and hit <b style={{ color: "var(--c-green)" }}>Search</b>.</div>
          <div style={{ fontSize: 12.5, color: "var(--t-lo)", marginBottom: 18 }}>Works anywhere on Earth — city, state, country. Or try one:</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            {EXAMPLES.map((ex) => (
              <button key={ex.label} onClick={() => runSearch(ex.cat, ex.loc)} style={{
                padding: "9px 16px", fontSize: 13, fontWeight: 600, borderRadius: 999, cursor: "pointer",
                background: "rgba(34,197,94,0.08)", color: "#86efac", border: "1px solid rgba(34,197,94,0.25)",
              }}>{ex.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <Panel title="Results" icon="sales" badge={<><span style={{ color: "var(--t-hi)", fontWeight: 700 }}>{results.length}</span> in {area.split(",").slice(0, 2).join(",")} · <span style={{ color: "var(--c-amber)" }}>{noWebCount} no website</span></>} style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", margin: "0 0 12px" }}>
            <button onClick={importLeads} disabled={sel.size === 0} style={{
              padding: "9px 20px", fontSize: 13, fontWeight: 700, borderRadius: "var(--r-sm)", border: "1px solid #22c55e55",
              cursor: sel.size === 0 ? "default" : "pointer", background: sel.size === 0 ? "transparent" : "rgba(34,197,94,0.12)", color: sel.size === 0 ? "var(--t-lo)" : "var(--c-green)",
            }}>+ Add {sel.size} to Pipeline</button>
          </div>
          <div style={{ borderRadius: "var(--r-md)", border: "1px solid var(--line)", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "36px 1.6fr 1fr 1.4fr 1fr", gap: 0, padding: "10px 14px", background: "var(--ink-2)", fontSize: 10, color: "var(--t-lo)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              <input type="checkbox" checked={allSelected} onChange={() => setSel(allSelected ? new Set() : new Set(results.map((r) => r.osmId)))} />
              <span>Business</span><span>Category</span><span>Address</span><span>Contact</span>
            </div>
            {results.map((r) => (
              <div key={r.osmId} style={{ display: "grid", gridTemplateColumns: "36px 1.6fr 1fr 1.4fr 1fr", gap: 0, padding: "11px 14px", borderTop: "1px solid var(--line)", fontSize: 13, alignItems: "center", background: sel.has(r.osmId) ? "rgba(34,197,94,0.04)" : "transparent" }}>
                <input type="checkbox" checked={sel.has(r.osmId)} onChange={() => toggle(r.osmId)} />
                <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                <span style={{ color: "var(--t-mid)", fontSize: 12 }}>{r.category}</span>
                <span style={{ color: "var(--t-lo)", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.address || "—"}</span>
                <span style={{ fontSize: 12 }}>
                  {r.phone && <span style={{ color: "var(--t-mid)" }}>{r.phone}</span>}
                  {!r.website ? <span style={{ marginLeft: r.phone ? 8 : 0, color: "var(--c-amber)", fontWeight: 700, fontSize: 10 }}>NO SITE</span> : <a href={r.website} target="_blank" rel="noreferrer" style={{ marginLeft: r.phone ? 8 : 0, color: "var(--c-cyan)", fontSize: 11 }}>site</a>}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </InstrumentPage>
  );
}
