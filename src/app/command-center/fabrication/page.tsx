"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

/* ══════════════════════════════════════════════════════════════════════════════
   NOVA 3D FABRICATION — Bambu Lab production dashboard
   Print queue management, printer status, STL pipeline
   ══════════════════════════════════════════════════════════════════════════════ */

interface Agent {
  id: string;
  name: string;
  status: "active" | "idle" | "done";
  model: string;
  role: string;
  color: string;
}

interface PrintJob {
  id: string;
  name: string;
  status: "queued" | "printing" | "complete" | "failed";
  material: string;
  printer: string;
  progress?: number;
  timeRemaining?: string;
  startedAt?: string;
  completedAt?: string;
}

interface Printer {
  id: string;
  name: string;
  model: string;
  status: "online" | "offline" | "printing" | "error";
  currentJob?: string;
  progress?: number;
  temperature?: { nozzle: number; bed: number };
  connectionStrength?: number;
}

interface STLFile {
  id: string;
  name: string;
  size: string;
  uploadedAt: string;
  status: "pending" | "sliced" | "ready";
}

interface BambuTemperature {
  current: number;
  target: number;
}

interface BambuJob {
  name: string;
  file: string;
  progress: number;
  timeElapsed: string;
  timeRemaining: string;
  layer: { current: number; total: number };
  startedAt: string;
}

interface BambuRecentJob {
  name: string;
  status: "completed" | "failed" | "cancelled";
  duration: string;
  completedAt: string;
  material: string;
}

interface BambuPrinterState {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  status: "online" | "offline" | "printing" | "error" | "idle";
  lastSeen: string | null;
  connection: {
    type: "mqtt";
    host: string;
    port: number;
    configured: boolean;
  };
  temperatures: {
    nozzle: BambuTemperature;
    bed: BambuTemperature;
  };
  filament: {
    type: string;
    color: string;
    remaining: number;
  };
  currentJob: BambuJob | null;
  recentJobs: BambuRecentJob[];
  stats: {
    totalPrints: number;
    successRate: number;
    totalHours: number;
    filamentUsedKg: number;
  };
}

type PrintToolCategory = "Monitoring" | "Estimation" | "Design" | "Analysis" | "Storefront" | "Catalog";

const CATEGORY_BADGE: Record<PrintToolCategory, string> = {
  Monitoring: "#22c55e",
  Estimation: "#22d3ee",
  Design: "#a855f7",
  Analysis: "#f59e0b",
  Storefront: "#ec4899",
  Catalog: "#C9A84C",
};

const CC_GOLD_BORDER = "2px solid rgba(201,168,76,0.28)";

const APPROVED_PRINT_TOOLS: { folder: string; title: string; category: PrintToolCategory }[] = [
  { folder: "2026-03-02-print-failure-analyzer", title: "Print Failure Analyzer", category: "Analysis" },
  { folder: "2026-03-02-printflow-storefront", title: "Printflow Storefront", category: "Storefront" },
  { folder: "2026-03-05-print-queue-dashboard", title: "Print Queue Dashboard", category: "Monitoring" },
  { folder: "2026-03-09-bambu-live-monitor", title: "Bambu Live Monitor", category: "Monitoring" },
  { folder: "2026-03-25-print-catalog", title: "Print Catalog", category: "Catalog" },
  { folder: "2026-03-26-print-cost-comparison", title: "Print Cost Comparison", category: "Estimation" },
  { folder: "2026-03-27-print-job-estimator", title: "Print Job Estimator", category: "Estimation" },
  { folder: "2026-03-27-printflow-job-tracker", title: "Printflow Job Tracker", category: "Monitoring" },
  { folder: "2026-03-28-print-battle-arena", title: "Print Battle Arena", category: "Design" },
  { folder: "2026-03-28-print-design-studio", title: "Print Design Studio", category: "Design" },
  { folder: "2026-03-28-print-finish-library", title: "Print Finish Library", category: "Design" },
  { folder: "2026-03-28-print-time-machine", title: "Print Time Machine", category: "Analysis" },
  { folder: "2026-03-29-print-material-stress-tester", title: "Print Material Stress Tester", category: "Analysis" },
];

export default function FabricationPage() {
  const [novaAgent, setNovaAgent] = useState<Agent | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [printQueue, setPrintQueue] = useState<PrintJob[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [printers, setPrinters] = useState<Printer[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [stlPipeline, setStlPipeline] = useState<STLFile[]>([]);

  const [bambuPrinter, setBambuPrinter] = useState<BambuPrinterState | null>(null);
  const [bambuLoading, setBambuLoading] = useState(true);
  const [setupIp, setSetupIp] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [setupSerial, setSetupSerial] = useState("");
  const [connectingPrinter, setConnectingPrinter] = useState(false);
  const [mqttStatus, setMqttStatus] = useState<{ available: boolean; connected: boolean; connecting: boolean; protocol: string; note: string } | null>(null);

  useEffect(() => {
    fetch("/api/command-center/agents")
      .then(res => res.json())
      .then(data => {
        const nova = data.agents?.find((a: { id: string; name: string; status?: string; model?: string; role?: string }) => a.id === "nova");
        if (nova) {
          setNovaAgent({
            id: nova.id,
            name: nova.name,
            status: nova.status || "idle",
            model: nova.model || "DeepSeek V3.2",
            role: nova.role || "3D Fabrication",
            color: "#14b8a6"
          });
        }
      })
      .catch(() => {});

    const fetchBambu = () => {
      fetch("/api/command-center/bambu")
        .then(res => res.json())
        .then(data => {
          if (data.ok && data.printer) {
            setBambuPrinter(data.printer);
            setMqttStatus(data.mqtt || null);
          }
        })
        .catch(() => {})
        .finally(() => setBambuLoading(false));
    };
    fetchBambu();
    const bambuInterval = setInterval(fetchBambu, 5000);
    return () => clearInterval(bambuInterval);
  }, []);

  const handleConnect = async () => {
    if (!setupIp.trim()) return;
    setConnectingPrinter(true);
    try {
      const res = await fetch("/api/command-center/bambu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect", host: setupIp.trim(), accessCode: setupCode.trim() || undefined, serialNumber: setupSerial.trim() || undefined }),
      });
      const data = await res.json();
      if (data.ok && data.printer) {
        setBambuPrinter(data.printer);
        setSetupIp("");
        setSetupCode("");
      }
    } catch { /* swallow */ }
    setConnectingPrinter(false);
  };

  const handleDisconnect = async () => {
    try {
      const res = await fetch("/api/command-center/bambu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      const data = await res.json();
      if (data.ok && data.printer) setBambuPrinter(data.printer);
    } catch { /* swallow */ }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "printing": case "active": return "#22c55e";
      case "online": case "idle": return "#fbbf24";
      case "complete": case "done": return "#06b6d4";
      case "failed": case "error": return "#ef4444";
      case "offline": return "#737373";
      default: return "#737373";
    }
  };

  const getStatusBg = (status: string) => {
    const color = getStatusColor(status);
    return `${color}15`;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#e5e5e5", fontFamily: "Inter, system-ui, sans-serif", position: "relative" }}>
      <ParticleField variant="gold" count={50} speed={0.6} opacity={0.3} connections={true} />

      {/* Holographic ambient glow */}
      <div style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        background: "radial-gradient(ellipse 800px 600px at 30% 20%, rgba(20,184,166,0.08) 0%, transparent 60%), radial-gradient(ellipse 600px 600px at 70% 80%, rgba(139,92,246,0.06) 0%, transparent 60%)"
      }} />

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 1400, margin: "0 auto", padding: "32px 24px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <Link
            href="/command-center"
            style={{
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#737373",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 8,
              transition: "all 0.15s"
            }}
          >
            <span style={{ fontSize: 14 }}>&larr;</span> COMMAND CENTER
          </Link>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, color: "#e5e5e5", textShadow: "0 0 40px rgba(20,184,166,0.3)" }}>
            NOVA 3D Fabrication
          </h1>
          <p style={{ fontSize: 13, color: "#737373", margin: "6px 0 0" }}>
            Bambu Lab production pipeline {printQueue.length > 0 ? `• ${printQueue.filter(p => p.status === "printing").length} printing • ${printQueue.filter(p => p.status === "queued").length} queued` : "• No active jobs"}
          </p>
        </div>

        {/* NOVA Agent Status Card */}
        {novaAgent && (
          <div style={{
            padding: 24,
            borderRadius: 16,
            background: "rgba(0,0,0,0.95)",
            border: CC_GOLD_BORDER,
            marginBottom: 24,
            boxShadow: "0 0 40px rgba(201,168,76,0.12), 0 8px 32px rgba(0,0,0,0.4)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${novaAgent.color}40, ${novaAgent.color}10)`,
                border: `2px solid ${novaAgent.color}60`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                fontWeight: 900,
                color: novaAgent.color,
                boxShadow: `0 0 24px ${novaAgent.color}40`
              }}>
                N
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: "#e5e5e5" }}>{novaAgent.name}</h2>
                  <span style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    background: getStatusBg(novaAgent.status),
                    color: getStatusColor(novaAgent.status),
                    border: `1px solid ${getStatusColor(novaAgent.status)}40`,
                    textTransform: "uppercase"
                  }}>
                    {novaAgent.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#737373", marginTop: 4 }}>
                  {novaAgent.model} • {novaAgent.role}
                </div>
              </div>
            </div>
            <div style={{
              padding: 16,
              borderRadius: 10,
              background: "rgba(20,184,166,0.05)",
              border: "1px solid rgba(20,184,166,0.15)",
              fontSize: 13,
              color: "#e5e5e5",
              lineHeight: 1.6
            }}>
              <strong style={{ color: "#14b8a6" }}>Current Task:</strong> Monitoring Bambu Lab production pipeline • STL file processing • Print queue optimization
            </div>
          </div>
        )}

        {/* Print Tools — YOLO builds gallery */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{
            fontSize: 14,
            fontWeight: 800,
            marginBottom: 16,
            color: "#C9A84C",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}>
            Print Tools
          </h2>
          <p style={{ fontSize: 12, color: "#737373", margin: "-8px 0 16px", lineHeight: 1.5 }}>
            Approved YOLO print utilities — opens in a new tab.
          </p>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
          }}>
            {APPROVED_PRINT_TOOLS.map((tool) => {
              const badge = CATEGORY_BADGE[tool.category];
              return (
                <a
                  key={tool.folder}
                  href={`/yolo-builds/${tool.folder}/index.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    padding: 20,
                    borderRadius: 14,
                    background: "rgba(0,0,0,0.95)",
                    border: CC_GOLD_BORDER,
                    textDecoration: "none",
                    color: "#e5e5e5",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.35), 0 0 20px rgba(201,168,76,0.06)",
                    transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
                  }}
                >
                  <span style={{
                    display: "inline-block",
                    padding: "3px 8px",
                    borderRadius: 6,
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    background: `${badge}18`,
                    color: badge,
                    border: `1px solid ${badge}55`,
                    marginBottom: 10,
                  }}>
                    {tool.category}
                  </span>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#e5e5e5", lineHeight: 1.35, marginBottom: 6 }}>
                    {tool.title}
                  </div>
                  <div style={{ fontSize: 11, color: "#737373", fontFamily: "ui-monospace, monospace" }}>
                    {tool.folder}
                  </div>
                  <div style={{ fontSize: 11, color: "#C9A84C", marginTop: 10, fontWeight: 600 }}>
                    Open build →
                  </div>
                </a>
              );
            })}
          </div>
        </div>

        {/* ═══════ Bambu Lab Printer Status Card ═══════ */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{
            fontSize: 14,
            fontWeight: 800,
            marginBottom: 16,
            color: "#14b8a6",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}>
            Bambu Lab Printer
          </h2>

          {bambuLoading && (
            <div style={{
              padding: 40,
              borderRadius: 16,
              background: "rgba(0,0,0,0.95)",
              border: CC_GOLD_BORDER,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 13, color: "#737373" }}>Loading printer status…</div>
            </div>
          )}

          {!bambuLoading && bambuPrinter && (
            <div style={{
              padding: 24,
              borderRadius: 16,
              background: "rgba(0,0,0,0.95)",
              border: `2px solid ${bambuPrinter.status === "printing" ? "rgba(34,197,94,0.35)" : bambuPrinter.status === "online" || bambuPrinter.status === "idle" ? "rgba(20,184,166,0.3)" : "rgba(201,168,76,0.22)"}`,
              boxShadow: bambuPrinter.status === "printing" ? "0 0 32px rgba(34,197,94,0.12)" : "0 0 16px rgba(201,168,76,0.08)",
              position: "relative",
              overflow: "hidden",
            }}>
              {bambuPrinter.status === "printing" && (
                <div style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: "linear-gradient(90deg, transparent, #22c55e, transparent)",
                }} />
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: bambuPrinter.status === "offline" ? "#ef4444" : bambuPrinter.status === "error" ? "#ef4444" : "#22c55e",
                    boxShadow: bambuPrinter.status === "offline" || bambuPrinter.status === "error"
                      ? "0 0 8px rgba(239,68,68,0.6)"
                      : "0 0 8px rgba(34,197,94,0.6)",
                    animation: bambuPrinter.status !== "offline" ? "pulse 2s ease-in-out infinite" : "none",
                  }} />
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "#e5e5e5" }}>
                      {bambuPrinter.name}
                    </h3>
                    <div style={{ fontSize: 12, color: "#737373", marginTop: 2 }}>
                      {bambuPrinter.model} {bambuPrinter.serialNumber ? `• SN: ${bambuPrinter.serialNumber}` : ""}
                      {bambuPrinter.lastSeen ? ` • Last seen: ${new Date(bambuPrinter.lastSeen).toLocaleString()}` : ""}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    background: getStatusBg(bambuPrinter.status),
                    color: getStatusColor(bambuPrinter.status),
                    border: `1px solid ${getStatusColor(bambuPrinter.status)}40`,
                    textTransform: "uppercase",
                  }}>
                    {bambuPrinter.status}
                  </span>
                  {bambuPrinter.connection.configured && (
                    <button
                      onClick={handleDisconnect}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 700,
                        background: "rgba(239,68,68,0.1)",
                        color: "#ef4444",
                        border: "1px solid rgba(239,68,68,0.3)",
                        cursor: "pointer",
                        letterSpacing: "0.04em",
                      }}
                    >
                      DISCONNECT
                    </button>
                  )}
                </div>
              </div>

              {/* Temperature + Filament row */}
              {bambuPrinter.connection.configured && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <div style={{
                    padding: 12,
                    borderRadius: 10,
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                  }}>
                    <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 4 }}>
                      NOZZLE
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#ef4444" }}>
                      {bambuPrinter.temperatures.nozzle.current}°
                    </div>
                    {bambuPrinter.temperatures.nozzle.target > 0 && (
                      <div style={{ fontSize: 10, color: "#737373", marginTop: 2 }}>
                        Target: {bambuPrinter.temperatures.nozzle.target}°
                      </div>
                    )}
                  </div>
                  <div style={{
                    padding: 12,
                    borderRadius: 10,
                    background: "rgba(251,146,60,0.08)",
                    border: "1px solid rgba(251,146,60,0.2)",
                  }}>
                    <div style={{ fontSize: 10, color: "#fb923c", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 4 }}>
                      BED
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#fb923c" }}>
                      {bambuPrinter.temperatures.bed.current}°
                    </div>
                    {bambuPrinter.temperatures.bed.target > 0 && (
                      <div style={{ fontSize: 10, color: "#737373", marginTop: 2 }}>
                        Target: {bambuPrinter.temperatures.bed.target}°
                      </div>
                    )}
                  </div>
                  <div style={{
                    padding: 12,
                    borderRadius: 10,
                    background: "rgba(20,184,166,0.08)",
                    border: "1px solid rgba(20,184,166,0.2)",
                  }}>
                    <div style={{ fontSize: 10, color: "#14b8a6", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 4 }}>
                      FILAMENT
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: bambuPrinter.filament.color,
                        border: "2px solid rgba(255,255,255,0.2)",
                      }} />
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#14b8a6" }}>
                        {bambuPrinter.filament.type}
                      </span>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${bambuPrinter.filament.remaining}%`,
                          background: bambuPrinter.filament.remaining > 20 ? "#14b8a6" : "#ef4444",
                          borderRadius: 2,
                        }} />
                      </div>
                      <div style={{ fontSize: 10, color: "#737373", marginTop: 2 }}>{bambuPrinter.filament.remaining}% remaining</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Connection info */}
              {bambuPrinter.connection.configured && (
                <div style={{
                  padding: 10,
                  borderRadius: 8,
                  background: "rgba(20,184,166,0.05)",
                  border: "1px solid rgba(20,184,166,0.12)",
                  fontSize: 11,
                  color: "#737373",
                  display: "flex",
                  gap: 16,
                }}>
                  <span><strong style={{ color: "#14b8a6" }}>Host:</strong> {bambuPrinter.connection.host}</span>
                  <span><strong style={{ color: "#14b8a6" }}>Port:</strong> {bambuPrinter.connection.port}</span>
                  <span><strong style={{ color: "#14b8a6" }}>Protocol:</strong> MQTTS (TLS)</span>
                  {mqttStatus && (
                    <span>
                      <strong style={{ color: mqttStatus.connected ? "#22c55e" : "#f59e0b" }}>
                        {mqttStatus.connected ? "● LIVE" : mqttStatus.connecting ? "◌ CONNECTING" : "○ POLLING"}
                      </strong>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══════ Active Print Job ═══════ */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{
            fontSize: 14,
            fontWeight: 800,
            marginBottom: 16,
            color: "#14b8a6",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}>
            Print Queue
          </h2>

          {bambuPrinter?.currentJob ? (
            <div style={{
              padding: 20,
              borderRadius: 14,
              background: "rgba(0,0,0,0.95)",
              border: "2px solid rgba(34,197,94,0.35)",
              boxShadow: "0 0 24px rgba(34,197,94,0.1)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#e5e5e5", marginBottom: 4 }}>
                    {bambuPrinter.currentJob.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#737373" }}>
                    {bambuPrinter.currentJob.file} • Started {new Date(bambuPrinter.currentJob.startedAt).toLocaleTimeString()}
                  </div>
                </div>
                <span style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  background: "rgba(34,197,94,0.15)",
                  color: "#22c55e",
                  border: "1px solid rgba(34,197,94,0.4)",
                  textTransform: "uppercase",
                }}>
                  PRINTING
                </span>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>
                    {bambuPrinter.currentJob.progress}%
                  </span>
                  <span style={{ fontSize: 11, color: "#737373" }}>
                    Layer {bambuPrinter.currentJob.layer.current}/{bambuPrinter.currentJob.layer.total}
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${bambuPrinter.currentJob.progress}%`,
                    background: "linear-gradient(90deg, #22c55e, #14b8a6)",
                    borderRadius: 4,
                    boxShadow: "0 0 16px rgba(34,197,94,0.5)",
                    transition: "width 1s ease",
                  }} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 20, fontSize: 12, color: "#737373" }}>
                <span><strong style={{ color: "#14b8a6" }}>Elapsed:</strong> {bambuPrinter.currentJob.timeElapsed}</span>
                <span><strong style={{ color: "#f59e0b" }}>Remaining:</strong> {bambuPrinter.currentJob.timeRemaining}</span>
              </div>
            </div>
          ) : (
            <div style={{
              padding: 40,
              borderRadius: 14,
              background: "rgba(0,0,0,0.95)",
              border: CC_GOLD_BORDER,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🖨️</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#a3a3a3", marginBottom: 6 }}>
                No active print jobs
              </div>
              <div style={{ fontSize: 12, color: "#525252" }}>
                {bambuPrinter?.connection.configured
                  ? "Printer connected — start a print from Bambu Studio."
                  : "Connect your Bambu Lab printer to see live print status."}
              </div>
            </div>
          )}
        </div>

        {/* ═══════ Setup Panel (unconfigured) ═══════ */}
        {bambuPrinter && !bambuPrinter.connection.configured && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{
              fontSize: 14,
              fontWeight: 800,
              marginBottom: 16,
              color: "#C9A84C",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}>
              Printer Setup
            </h2>
            <div style={{
              padding: 24,
              borderRadius: 16,
              background: "rgba(0,0,0,0.95)",
              border: CC_GOLD_BORDER,
              boxShadow: "0 0 24px rgba(201,168,76,0.08)",
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#e5e5e5", marginBottom: 16 }}>
                To connect your Bambu Lab printer:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                {[
                  { step: 1, text: "Enable LAN-only mode on your printer" },
                  { step: 2, text: "Find your printer's IP address, access code, and serial number in printer settings" },
                  { step: 3, text: "Enter credentials below — connects via MQTTS (TLS) on port 8883" },
                ].map(({ step, text }) => (
                  <div key={step} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "rgba(201,168,76,0.15)",
                      border: "1px solid rgba(201,168,76,0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#C9A84C",
                      flexShrink: 0,
                    }}>
                      {step}
                    </div>
                    <span style={{ fontSize: 13, color: "#a3a3a3", lineHeight: 1.5 }}>{text}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="Printer IP (e.g. 192.168.1.100)"
                  value={setupIp}
                  onChange={(e) => setSetupIp(e.target.value)}
                  style={{
                    flex: "1 1 200px",
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(201,168,76,0.25)",
                    color: "#e5e5e5",
                    fontSize: 13,
                    outline: "none",
                    fontFamily: "ui-monospace, monospace",
                  }}
                />
                <input
                  type="password"
                  placeholder="Access Code"
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value)}
                  style={{
                    flex: "1 1 160px",
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(201,168,76,0.25)",
                    color: "#e5e5e5",
                    fontSize: 13,
                    outline: "none",
                    fontFamily: "ui-monospace, monospace",
                  }}
                />
                <input
                  type="text"
                  placeholder="Serial Number (optional)"
                  value={setupSerial}
                  onChange={(e) => setSetupSerial(e.target.value)}
                  style={{
                    flex: "1 1 180px",
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(201,168,76,0.25)",
                    color: "#e5e5e5",
                    fontSize: 13,
                    outline: "none",
                    fontFamily: "ui-monospace, monospace",
                  }}
                />
                <button
                  onClick={handleConnect}
                  disabled={connectingPrinter || !setupIp.trim()}
                  style={{
                    padding: "10px 24px",
                    borderRadius: 8,
                    background: connectingPrinter ? "rgba(201,168,76,0.1)" : "linear-gradient(135deg, rgba(201,168,76,0.25), rgba(201,168,76,0.15))",
                    border: "1px solid rgba(201,168,76,0.5)",
                    color: "#C9A84C",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: connectingPrinter || !setupIp.trim() ? "not-allowed" : "pointer",
                    letterSpacing: "0.06em",
                    opacity: connectingPrinter || !setupIp.trim() ? 0.5 : 1,
                  }}
                >
                  {connectingPrinter ? "CONNECTING…" : "CONNECT"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ Recent Print History ═══════ */}
        {bambuPrinter && bambuPrinter.recentJobs.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{
              fontSize: 14,
              fontWeight: 800,
              marginBottom: 16,
              color: "#14b8a6",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}>
              Recent Print History
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {bambuPrinter.recentJobs.map((job, idx) => {
                const jobStatusColor = job.status === "completed" ? "#22c55e" : job.status === "failed" ? "#ef4444" : "#f59e0b";
                return (
                  <div key={`${job.name}-${idx}`} style={{
                    padding: 16,
                    borderRadius: 12,
                    background: "rgba(0,0,0,0.95)",
                    border: CC_GOLD_BORDER,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#e5e5e5", marginBottom: 4 }}>
                        {job.name}
                      </div>
                      <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#737373" }}>
                        <span>{job.material}</span>
                        <span>•</span>
                        <span>{job.duration}</span>
                        <span>•</span>
                        <span>{new Date(job.completedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <span style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      background: `${jobStatusColor}15`,
                      color: jobStatusColor,
                      border: `1px solid ${jobStatusColor}40`,
                      textTransform: "uppercase",
                    }}>
                      {job.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════ Printer Stats ═══════ */}
        {bambuPrinter && bambuPrinter.connection.configured && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{
              fontSize: 14,
              fontWeight: 800,
              marginBottom: 16,
              color: "#14b8a6",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}>
              Printer Stats
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {[
                { label: "TOTAL PRINTS", value: String(bambuPrinter.stats.totalPrints), color: "#C9A84C" },
                { label: "SUCCESS RATE", value: `${bambuPrinter.stats.successRate}%`, color: "#22c55e" },
                { label: "TOTAL HOURS", value: String(bambuPrinter.stats.totalHours), color: "#06b6d4" },
                { label: "FILAMENT USED", value: `${bambuPrinter.stats.filamentUsedKg} kg`, color: "#8b5cf6" },
              ].map((stat) => (
                <div key={stat.label} style={{
                  padding: 16,
                  borderRadius: 12,
                  background: "rgba(0,0,0,0.95)",
                  border: CC_GOLD_BORDER,
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "#737373", marginBottom: 8 }}>
                    {stat.label}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: stat.color }}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════ Design Pipeline — STL Files ═══════ */}
        <div>
          <h2 style={{
            fontSize: 14,
            fontWeight: 800,
            marginBottom: 16,
            color: "#14b8a6",
            letterSpacing: "0.02em",
            textTransform: "uppercase"
          }}>
            Design Pipeline — STL Files
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {stlPipeline.length === 0 && (
              <div style={{
                padding: 40,
                borderRadius: 12,
                background: "rgba(0,0,0,0.95)",
                border: CC_GOLD_BORDER,
                textAlign: "center"
              }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📐</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#737373", marginBottom: 6 }}>No STL files in pipeline</div>
                <div style={{ fontSize: 12, color: "#525252" }}>Upload .stl files to begin slicing</div>
              </div>
            )}
            {stlPipeline.map(file => (
              <div key={file.id} style={{
                padding: 18,
                borderRadius: 12,
                background: "rgba(0,0,0,0.95)",
                border: CC_GOLD_BORDER,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                transition: "all 0.3s"
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#e5e5e5", marginBottom: 4 }}>
                    {file.name}
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#737373" }}>
                    <span>{file.size}</span>
                    <span>•</span>
                    <span>{file.uploadedAt}</span>
                  </div>
                </div>
                <span style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  background: file.status === "ready" ? "rgba(34,197,94,0.15)" : file.status === "sliced" ? "rgba(251,146,60,0.15)" : "rgba(115,115,115,0.15)",
                  color: file.status === "ready" ? "#22c55e" : file.status === "sliced" ? "#fb923c" : "#737373",
                  border: `1px solid ${file.status === "ready" ? "rgba(34,197,94,0.4)" : file.status === "sliced" ? "rgba(251,146,60,0.4)" : "rgba(115,115,115,0.4)"}`,
                  textTransform: "uppercase"
                }}>
                  {file.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
