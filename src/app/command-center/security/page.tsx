"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

/* ══════════════════════════════════════════════════════════════════════════════
   SECURITY — WIDOW Intel Dashboard
   Real CSP status, security headers, known vulnerabilities
   ══════════════════════════════════════════════════════════════════════════════ */

interface SecurityCheck {
  name: string;
  status: "pass" | "fail" | "warn" | "checking";
  detail: string;
  category: string;
}

interface ThreatEntry {
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  detail: string;
  mitigated: boolean;
}

const KNOWN_THREATS: ThreatEntry[] = [
  { severity: "high", title: "Firebase Security Rules", detail: "Firestore rules locked down (Mar 8)", mitigated: true },
  { severity: "high", title: "CSP Headers", detail: "Content Security Policy configured with nonce + strict domains", mitigated: true },
  { severity: "medium", title: "API Rate Limiting", detail: "No rate limiting on public API routes", mitigated: false },
  { severity: "medium", title: "Service Worker Cache", detail: "SW banned — self-destruct pattern deployed (Mar 2)", mitigated: true },
  { severity: "low", title: "CORS Configuration", detail: "Restricted to ramiche-site.vercel.app origin", mitigated: true },
  { severity: "critical", title: "Exposed API Keys", detail: "All keys in env vars, never hardcoded", mitigated: true },
  { severity: "high", title: "Role-Based Portal Isolation", detail: "Coach/athlete/parent portals isolated (Mar 8)", mitigated: true },
  { severity: "medium", title: "Session Duration", detail: "30-day sessions configured", mitigated: true },
];

const SEVERITY_COLORS: Record<string, string> = { critical: "#ef4444", high: "#f97316", medium: "#f59e0b", low: "#22d3ee" };

function getCheckColor(s: string) {
  if (s === "pass") return "#22c55e";
  if (s === "fail") return "#ef4444";
  if (s === "warn") return "#f59e0b";
  return "#6b7280";
}

export default function SecurityPage() {
  const [checks, setChecks] = useState<SecurityCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState("");
  const [widowStatus, setWidowStatus] = useState("idle");
  const [scanning, setScanning] = useState(false);
  const [scanScore, setScanScore] = useState<number | null>(null);

  const runChecks = useCallback(async () => {
    // Client-side checks
    const results: SecurityCheck[] = [];
    results.push({ name: "HTTPS Enforcement", status: window.location.protocol === "https:" ? "pass" : "warn", detail: window.location.protocol === "https:" ? "All traffic encrypted" : "Running on HTTP (dev mode)", category: "Transport" });
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      results.push({ name: "Service Worker", status: regs.length === 0 ? "pass" : "warn", detail: regs.length === 0 ? "No service workers (clean)" : `${regs.length} SW registered — should be 0`, category: "Client" });
    }
    const sensitiveKeys = Object.keys(localStorage).filter((k) => k.toLowerCase().includes("token") || k.toLowerCase().includes("secret") || k.toLowerCase().includes("password"));
    results.push({ name: "Local Storage Secrets", status: sensitiveKeys.length === 0 ? "pass" : "fail", detail: sensitiveKeys.length === 0 ? "No sensitive keys in localStorage" : `Found: ${sensitiveKeys.join(", ")}`, category: "Client" });
    setChecks(results);
    setLastSync(new Date().toLocaleTimeString());
    setLoading(false);
  }, []);

  const runFullScan = useCallback(async () => {
    setScanning(true);
    setWidowStatus("scanning");
    try {
      const res = await fetch("/api/command-center/security", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const serverChecks: SecurityCheck[] = (data.results || []).map((r: SecurityCheck) => r);
        // Merge with client checks
        const clientChecks = checks.filter(c => c.category === "Client" || c.category === "Transport");
        setChecks([...serverChecks, ...clientChecks]);
        setScanScore(data.score || null);
      }
    } catch { /* keep existing */ }
    finally {
      setScanning(false);
      setWidowStatus("idle");
      setLastSync(new Date().toLocaleTimeString());
    }
  }, [checks]);

  useEffect(() => { runChecks(); const interval = setInterval(runChecks, 60_000); return () => clearInterval(interval); }, [runChecks]);

  const passCount = checks.filter((c) => c.status === "pass").length;
  const mitigatedCount = KNOWN_THREATS.filter((t) => t.mitigated).length;
  const openCount = KNOWN_THREATS.filter((t) => !t.mitigated).length;

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#000000", color: "#e5e5e5", overflow: "hidden" }}>
      <ParticleField />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse 800px 600px at 20% 20%, rgba(239,68,68,0.08) 0%, transparent 60%), radial-gradient(ellipse 600px 600px at 80% 75%, rgba(249,115,22,0.06) 0%, transparent 60%)" }} />

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 1400, margin: "0 auto", padding: "32px 24px 80px" }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/command-center" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#737373", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 14 }}>&larr;</span> COMMAND CENTER
          </Link>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, color: "#e5e5e5", textShadow: "0 0 40px rgba(239,68,68,0.3)" }}>Security Intel</h1>
              <p style={{ fontSize: 13, color: "#737373", margin: "6px 0 0" }}>
                {loading ? "SCANNING..." : `${passCount}/${checks.length} checks pass · ${mitigatedCount} mitigated · ${openCount} open`}
                {lastSync && <span style={{ marginLeft: 8, color: "rgba(34,197,94,0.6)" }}>● LIVE · {lastSync}</span>}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: widowStatus === "scanning" ? "#ef4444" : widowStatus === "active" ? "#22c55e" : "#6b7280", boxShadow: widowStatus === "scanning" ? "0 0 8px rgba(239,68,68,0.6)" : "none", animation: widowStatus === "scanning" ? "pulse 1.5s infinite" : "none" }} />
                <span style={{ fontSize: 11, color: "#737373" }}>WIDOW</span>
                <span style={{ fontSize: 11, color: "#a3a3a3" }}>{widowStatus.toUpperCase()}</span>
              </div>
              <button onClick={runFullScan} disabled={scanning} style={{ padding: "8px 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", background: scanning ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.05)", border: scanning ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: scanning ? "#ef4444" : "#a3a3a3", cursor: scanning ? "wait" : "pointer", transition: "all 0.3s" }}>
                {scanning ? "SCANNING..." : "RE-SCAN"}
              </button>
              {scanScore !== null && (
                <span style={{ fontSize: 11, fontWeight: 700, color: scanScore >= 80 ? "#22c55e" : scanScore >= 60 ? "#f59e0b" : "#ef4444" }}>
                  {scanScore}/100
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Live Security Checks */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#ef4444", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Live Checks</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, marginBottom: 32 }}>
          {checks.map((check) => {
            const color = getCheckColor(check.status);
            return (
              <div key={check.name} style={{ padding: 20, borderRadius: 12, background: "rgba(0,0,0,0.95)", border: `1px solid ${color}30`, boxShadow: `0 0 16px ${color}10, 0 4px 20px rgba(0,0,0,0.3)`, transition: "all 0.3s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{check.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", padding: "4px 10px", borderRadius: 6, color, border: `1px solid ${color}40`, textTransform: "uppercase" }}>{check.status}</span>
                </div>
                <p style={{ fontSize: 12, color: "#737373", margin: 0 }}>{check.detail}</p>
                <p style={{ fontSize: 10, color: "#404040", marginTop: 6 }}>{check.category}</p>
              </div>
            );
          })}
        </div>

        {/* Threat Landscape */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#ef4444", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Threat Landscape</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {KNOWN_THREATS.map((threat, i) => {
            const sevColor = SEVERITY_COLORS[threat.severity];
            return (
              <div key={i} style={{ padding: "16px 24px", borderRadius: 12, background: "rgba(0,0,0,0.95)", border: threat.mitigated ? "1px solid rgba(255,255,255,0.06)" : `1px solid ${sevColor}30`, boxShadow: threat.mitigated ? "none" : `0 0 16px ${sevColor}10`, display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.3s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", padding: "4px 10px", borderRadius: 6, color: sevColor, border: `1px solid ${sevColor}40`, width: 64, textAlign: "center", textTransform: "uppercase" }}>{threat.severity}</span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: threat.mitigated ? "#737373" : "#e5e5e5" }}>{threat.title}</p>
                    <p style={{ fontSize: 12, color: "#525252", margin: "4px 0 0" }}>{threat.detail}</p>
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: threat.mitigated ? "rgba(34,197,94,0.5)" : "#f59e0b" }}>{threat.mitigated ? "MITIGATED" : "OPEN"}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
