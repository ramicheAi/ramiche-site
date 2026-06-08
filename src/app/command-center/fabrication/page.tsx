"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { InstrumentPage, Panel } from "@/components/command-center/po/Instrument";

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
  Monitoring: "var(--c-green)",
  Estimation: "var(--c-cyan)",
  Design: "var(--c-violet)",
  Analysis: "var(--c-amber)",
  Storefront: "var(--c-pink)",
  Catalog: "var(--c-gold)",
};

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
    <InstrumentPage
      id="fabrication"
      title="NOVA 3D Fabrication"
      section="Specialist"
      icon="dispatch"
      accent="var(--c-teal)"
    >
      <p style={{ fontSize: 13, color: "var(--t-mid)", margin: 0 }}>
        Bambu Lab production pipeline {printQueue.length > 0 ? `• ${printQueue.filter(p => p.status === "printing").length} printing • ${printQueue.filter(p => p.status === "queued").length} queued` : "• No active jobs"}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, margin: "14px 0 24px" }}>
        <Link href="/command-center/yolo" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--c-amber)", textDecoration: "none", opacity: 0.9 }}>
          YOLO builds →
        </Link>
        <Link href="/command-center/app-builder" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--c-violet)", textDecoration: "none", opacity: 0.9 }}>
          App Builder →
        </Link>
        <Link href="/command-center/studio" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--c-teal)", textDecoration: "none", opacity: 0.9 }}>
          Studio →
        </Link>
      </div>

      {/* NOVA Agent Status Card */}
      {novaAgent && (
        <Panel style={{ marginBottom: 24, borderColor: "color-mix(in srgb, var(--c-gold) 28%, var(--line))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: `linear-gradient(135deg, ${novaAgent.color}40, ${novaAgent.color}10)`,
              border: `2px solid ${novaAgent.color}60`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 900, color: novaAgent.color,
              boxShadow: `0 0 24px ${novaAgent.color}40`
            }}>
              N
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: "var(--t-hi)" }}>{novaAgent.name}</h2>
                <span style={{
                  padding: "4px 10px", borderRadius: "var(--r-sm)",
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
                  background: getStatusBg(novaAgent.status),
                  color: getStatusColor(novaAgent.status),
                  border: `1px solid ${getStatusColor(novaAgent.status)}40`,
                  textTransform: "uppercase"
                }}>
                  {novaAgent.status}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--t-mid)", marginTop: 4 }}>
                {novaAgent.model} • {novaAgent.role}
              </div>
            </div>
          </div>
          <div style={{
            padding: 16, borderRadius: "var(--r-md)",
            background: "color-mix(in srgb, var(--c-teal) 6%, var(--ink-2))",
            border: "1px solid color-mix(in srgb, var(--c-teal) 15%, var(--line))",
            fontSize: 13, color: "var(--t-hi)", lineHeight: 1.6
          }}>
            <strong style={{ color: "var(--c-teal)" }}>Current Task:</strong> Monitoring Bambu Lab production pipeline • STL file processing • Print queue optimization
          </div>
        </Panel>
      )}

      {/* Print Tools — YOLO builds gallery */}
      <Panel title="Print Tools" icon="dashboard" style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 12, color: "var(--t-mid)", margin: "6px 0 16px", lineHeight: 1.5 }}>
          Approved YOLO print utilities — opens in a new tab.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {APPROVED_PRINT_TOOLS.map((tool) => {
            const badge = CATEGORY_BADGE[tool.category];
            return (
              <a
                key={tool.folder}
                href={`/builds/${tool.folder}/index.html`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block", padding: 20, borderRadius: "var(--r-md)",
                  background: "var(--ink-2)",
                  border: "1px solid color-mix(in srgb, var(--c-gold) 22%, var(--line))",
                  textDecoration: "none", color: "var(--t-hi)",
                  transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
                }}
              >
                <span style={{
                  display: "inline-block", padding: "3px 8px", borderRadius: "var(--r-sm)",
                  fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
                  background: `color-mix(in srgb, ${badge} 18%, transparent)`,
                  color: badge,
                  border: `1px solid color-mix(in srgb, ${badge} 55%, transparent)`,
                  marginBottom: 10,
                }}>
                  {tool.category}
                </span>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--t-hi)", lineHeight: 1.35, marginBottom: 6 }}>
                  {tool.title}
                </div>
                <div className="mono" style={{ fontSize: 11, color: "var(--t-lo)" }}>
                  {tool.folder}
                </div>
                <div style={{ fontSize: 11, color: "var(--c-gold)", marginTop: 10, fontWeight: 600 }}>
                  Open build →
                </div>
              </a>
            );
          })}
        </div>
      </Panel>

      {/* ═══════ Bambu Lab Printer Status Card ═══════ */}
      <Panel title="Bambu Lab Printer" icon="gateway" style={{ marginBottom: 24 }}>
        {bambuLoading && (
          <div style={{
            padding: 40, borderRadius: "var(--r-md)",
            background: "var(--ink-2)", border: "1px solid var(--line)",
            textAlign: "center", marginTop: 6,
          }}>
            <div style={{ fontSize: 13, color: "var(--t-mid)" }}>Loading printer status…</div>
          </div>
        )}

        {!bambuLoading && bambuPrinter && (
          <div style={{
            padding: 24, borderRadius: "var(--r-md)", marginTop: 6,
            background: "var(--ink-2)",
            border: `2px solid ${bambuPrinter.status === "printing" ? "rgba(34,197,94,0.35)" : bambuPrinter.status === "online" || bambuPrinter.status === "idle" ? "color-mix(in srgb, var(--c-teal) 30%, transparent)" : "color-mix(in srgb, var(--c-gold) 22%, transparent)"}`,
            boxShadow: bambuPrinter.status === "printing" ? "0 0 32px rgba(34,197,94,0.12)" : "none",
            position: "relative", overflow: "hidden",
          }}>
            {bambuPrinter.status === "printing" && (
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 3,
                background: "linear-gradient(90deg, transparent, #22c55e, transparent)",
              }} />
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: bambuPrinter.status === "offline" ? "#ef4444" : bambuPrinter.status === "error" ? "#ef4444" : "#22c55e",
                  boxShadow: bambuPrinter.status === "offline" || bambuPrinter.status === "error"
                    ? "0 0 8px rgba(239,68,68,0.6)"
                    : "0 0 8px rgba(34,197,94,0.6)",
                  animation: bambuPrinter.status !== "offline" ? "pulse 2s ease-in-out infinite" : "none",
                }} />
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "var(--t-hi)" }}>
                    {bambuPrinter.name}
                  </h3>
                  <div style={{ fontSize: 12, color: "var(--t-mid)", marginTop: 2 }}>
                    {bambuPrinter.model} {bambuPrinter.serialNumber ? `• SN: ${bambuPrinter.serialNumber}` : ""}
                    {bambuPrinter.lastSeen ? ` • Last seen: ${new Date(bambuPrinter.lastSeen).toLocaleString()}` : ""}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  padding: "5px 12px", borderRadius: "var(--r-sm)",
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
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
                      padding: "5px 10px", borderRadius: "var(--r-sm)",
                      fontSize: 10, fontWeight: 700,
                      background: "color-mix(in srgb, var(--c-red) 10%, transparent)",
                      color: "var(--c-red)",
                      border: "1px solid color-mix(in srgb, var(--c-red) 30%, transparent)",
                      cursor: "pointer", letterSpacing: "0.04em",
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
                  padding: 12, borderRadius: "var(--r-md)",
                  background: "color-mix(in srgb, var(--c-red) 8%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--c-red) 20%, transparent)",
                }}>
                  <div style={{ fontSize: 10, color: "var(--c-red)", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 4 }}>
                    NOZZLE
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "var(--c-red)" }}>
                    {bambuPrinter.temperatures.nozzle.current}°
                  </div>
                  {bambuPrinter.temperatures.nozzle.target > 0 && (
                    <div style={{ fontSize: 10, color: "var(--t-mid)", marginTop: 2 }}>
                      Target: {bambuPrinter.temperatures.nozzle.target}°
                    </div>
                  )}
                </div>
                <div style={{
                  padding: 12, borderRadius: "var(--r-md)",
                  background: "color-mix(in srgb, var(--c-orange) 8%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--c-orange) 20%, transparent)",
                }}>
                  <div style={{ fontSize: 10, color: "var(--c-orange)", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 4 }}>
                    BED
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "var(--c-orange)" }}>
                    {bambuPrinter.temperatures.bed.current}°
                  </div>
                  {bambuPrinter.temperatures.bed.target > 0 && (
                    <div style={{ fontSize: 10, color: "var(--t-mid)", marginTop: 2 }}>
                      Target: {bambuPrinter.temperatures.bed.target}°
                    </div>
                  )}
                </div>
                <div style={{
                  padding: 12, borderRadius: "var(--r-md)",
                  background: "color-mix(in srgb, var(--c-teal) 8%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--c-teal) 20%, transparent)",
                }}>
                  <div style={{ fontSize: 10, color: "var(--c-teal)", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 4 }}>
                    FILAMENT
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: "50%",
                      background: bambuPrinter.filament.color,
                      border: "2px solid var(--line-2)",
                    }} />
                    <span style={{ fontSize: 14, fontWeight: 800, color: "var(--c-teal)" }}>
                      {bambuPrinter.filament.type}
                    </span>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <div style={{ height: 4, borderRadius: 2, background: "var(--ink-3)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${bambuPrinter.filament.remaining}%`,
                        background: bambuPrinter.filament.remaining > 20 ? "var(--c-teal)" : "var(--c-red)",
                        borderRadius: 2,
                      }} />
                    </div>
                    <div style={{ fontSize: 10, color: "var(--t-mid)", marginTop: 2 }}>{bambuPrinter.filament.remaining}% remaining</div>
                  </div>
                </div>
              </div>
            )}

            {/* Connection info */}
            {bambuPrinter.connection.configured && (
              <div style={{
                padding: 10, borderRadius: "var(--r-sm)",
                background: "color-mix(in srgb, var(--c-teal) 5%, transparent)",
                border: "1px solid color-mix(in srgb, var(--c-teal) 12%, transparent)",
                fontSize: 11, color: "var(--t-mid)", display: "flex", gap: 16,
              }}>
                <span><strong style={{ color: "var(--c-teal)" }}>Host:</strong> {bambuPrinter.connection.host}</span>
                <span><strong style={{ color: "var(--c-teal)" }}>Port:</strong> {bambuPrinter.connection.port}</span>
                <span><strong style={{ color: "var(--c-teal)" }}>Protocol:</strong> MQTTS (TLS)</span>
                {mqttStatus && (
                  <span>
                    <strong style={{ color: mqttStatus.connected ? "var(--c-green)" : "var(--c-amber)" }}>
                      {mqttStatus.connected ? "● LIVE" : mqttStatus.connecting ? "◌ CONNECTING" : "○ POLLING"}
                    </strong>
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* ═══════ Active Print Job ═══════ */}
      <Panel title="Print Queue" icon="pulse" style={{ marginBottom: 24 }}>
        {bambuPrinter?.currentJob ? (
          <div style={{
            padding: 20, borderRadius: "var(--r-md)", marginTop: 6,
            background: "var(--ink-2)",
            border: "2px solid rgba(34,197,94,0.35)",
            boxShadow: "0 0 24px rgba(34,197,94,0.1)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--t-hi)", marginBottom: 4 }}>
                  {bambuPrinter.currentJob.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--t-mid)" }}>
                  {bambuPrinter.currentJob.file} • Started {new Date(bambuPrinter.currentJob.startedAt).toLocaleTimeString()}
                </div>
              </div>
              <span style={{
                padding: "5px 12px", borderRadius: "var(--r-sm)",
                fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                background: "rgba(34,197,94,0.15)", color: "#22c55e",
                border: "1px solid rgba(34,197,94,0.4)", textTransform: "uppercase",
              }}>
                PRINTING
              </span>
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>
                  {bambuPrinter.currentJob.progress}%
                </span>
                <span style={{ fontSize: 11, color: "var(--t-mid)" }}>
                  Layer {bambuPrinter.currentJob.layer.current}/{bambuPrinter.currentJob.layer.total}
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: "var(--ink-3)", overflow: "hidden" }}>
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

            <div style={{ display: "flex", gap: 20, fontSize: 12, color: "var(--t-mid)" }}>
              <span><strong style={{ color: "var(--c-teal)" }}>Elapsed:</strong> {bambuPrinter.currentJob.timeElapsed}</span>
              <span><strong style={{ color: "var(--c-amber)" }}>Remaining:</strong> {bambuPrinter.currentJob.timeRemaining}</span>
            </div>
          </div>
        ) : (
          <div style={{
            padding: 40, borderRadius: "var(--r-md)", marginTop: 6,
            background: "var(--ink-2)", border: "1px solid var(--line)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🖨️</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--t-mid)", marginBottom: 6 }}>
              No active print jobs
            </div>
            <div style={{ fontSize: 12, color: "var(--t-lo)" }}>
              {bambuPrinter?.connection.configured
                ? "Printer connected — start a print from Bambu Studio."
                : "Connect your Bambu Lab printer to see live print status."}
            </div>
          </div>
        )}
      </Panel>

      {/* ═══════ Setup Panel (unconfigured) ═══════ */}
      {bambuPrinter && !bambuPrinter.connection.configured && (
        <Panel title="Printer Setup" icon="command" style={{ marginBottom: 24 }}>
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t-hi)", marginBottom: 16 }}>
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
                    width: 24, height: 24, borderRadius: "50%",
                    background: "color-mix(in srgb, var(--c-gold) 15%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--c-gold) 40%, transparent)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 800, color: "var(--c-gold)", flexShrink: 0,
                  }}>
                    {step}
                  </div>
                  <span style={{ fontSize: 13, color: "var(--t-mid)", lineHeight: 1.5 }}>{text}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="Printer IP (e.g. 192.168.1.100)"
                value={setupIp}
                onChange={(e) => setSetupIp(e.target.value)}
                className="mono"
                style={{
                  flex: "1 1 200px", padding: "10px 14px", borderRadius: "var(--r-sm)",
                  background: "var(--ink-3)",
                  border: "1px solid color-mix(in srgb, var(--c-gold) 25%, var(--line))",
                  color: "var(--t-hi)", fontSize: 13, outline: "none",
                }}
              />
              <input
                type="password"
                placeholder="Access Code"
                value={setupCode}
                onChange={(e) => setSetupCode(e.target.value)}
                className="mono"
                style={{
                  flex: "1 1 160px", padding: "10px 14px", borderRadius: "var(--r-sm)",
                  background: "var(--ink-3)",
                  border: "1px solid color-mix(in srgb, var(--c-gold) 25%, var(--line))",
                  color: "var(--t-hi)", fontSize: 13, outline: "none",
                }}
              />
              <input
                type="text"
                placeholder="Serial Number (optional)"
                value={setupSerial}
                onChange={(e) => setSetupSerial(e.target.value)}
                className="mono"
                style={{
                  flex: "1 1 180px", padding: "10px 14px", borderRadius: "var(--r-sm)",
                  background: "var(--ink-3)",
                  border: "1px solid color-mix(in srgb, var(--c-gold) 25%, var(--line))",
                  color: "var(--t-hi)", fontSize: 13, outline: "none",
                }}
              />
              <button
                onClick={handleConnect}
                disabled={connectingPrinter || !setupIp.trim()}
                style={{
                  padding: "10px 24px", borderRadius: "var(--r-sm)",
                  background: connectingPrinter ? "color-mix(in srgb, var(--c-gold) 10%, transparent)" : "linear-gradient(135deg, color-mix(in srgb, var(--c-gold) 25%, transparent), color-mix(in srgb, var(--c-gold) 15%, transparent))",
                  border: "1px solid color-mix(in srgb, var(--c-gold) 50%, transparent)",
                  color: "var(--c-gold)", fontSize: 13, fontWeight: 700,
                  cursor: connectingPrinter || !setupIp.trim() ? "not-allowed" : "pointer",
                  letterSpacing: "0.06em",
                  opacity: connectingPrinter || !setupIp.trim() ? 0.5 : 1,
                }}
              >
                {connectingPrinter ? "CONNECTING…" : "CONNECT"}
              </button>
            </div>
          </div>
        </Panel>
      )}

      {/* ═══════ Recent Print History ═══════ */}
      {bambuPrinter && bambuPrinter.recentJobs.length > 0 && (
        <Panel title="Recent Print History" icon="clock" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
            {bambuPrinter.recentJobs.map((job, idx) => {
              const jobStatusColor = job.status === "completed" ? "#22c55e" : job.status === "failed" ? "#ef4444" : "#f59e0b";
              return (
                <div key={`${job.name}-${idx}`} style={{
                  padding: 16, borderRadius: "var(--r-md)",
                  background: "var(--ink-2)", border: "1px solid var(--line)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t-hi)", marginBottom: 4 }}>
                      {job.name}
                    </div>
                    <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--t-mid)" }}>
                      <span>{job.material}</span>
                      <span>•</span>
                      <span>{job.duration}</span>
                      <span>•</span>
                      <span>{new Date(job.completedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span style={{
                    padding: "4px 10px", borderRadius: "var(--r-sm)",
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                    background: `${jobStatusColor}15`, color: jobStatusColor,
                    border: `1px solid ${jobStatusColor}40`, textTransform: "uppercase",
                  }}>
                    {job.status}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* ═══════ Printer Stats ═══════ */}
      {bambuPrinter && bambuPrinter.connection.configured && (
        <Panel title="Printer Stats" icon="finance" style={{ marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 6 }}>
            {[
              { label: "TOTAL PRINTS", value: String(bambuPrinter.stats.totalPrints), color: "var(--c-gold)" },
              { label: "SUCCESS RATE", value: `${bambuPrinter.stats.successRate}%`, color: "var(--c-green)" },
              { label: "TOTAL HOURS", value: String(bambuPrinter.stats.totalHours), color: "var(--c-cyan)" },
              { label: "FILAMENT USED", value: `${bambuPrinter.stats.filamentUsedKg} kg`, color: "var(--c-violet)" },
            ].map((stat) => (
              <div key={stat.label} style={{
                padding: 16, borderRadius: "var(--r-md)",
                background: "var(--ink-2)", border: "1px solid var(--line)",
                textAlign: "center",
              }}>
                <div className="mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "var(--t-mid)", marginBottom: 8 }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: stat.color }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ═══════ Design Pipeline — STL Files ═══════ */}
      <Panel title="Design Pipeline — STL Files" icon="attach">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 6 }}>
          {stlPipeline.length === 0 && (
            <div style={{
              padding: 40, borderRadius: "var(--r-md)",
              background: "var(--ink-2)", border: "1px solid var(--line)",
              textAlign: "center"
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📐</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--t-mid)", marginBottom: 6 }}>No STL files in pipeline</div>
              <div style={{ fontSize: 12, color: "var(--t-lo)" }}>Upload .stl files to begin slicing</div>
            </div>
          )}
          {stlPipeline.map(file => (
            <div key={file.id} style={{
              padding: 18, borderRadius: "var(--r-md)",
              background: "var(--ink-2)", border: "1px solid var(--line)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              transition: "all 0.3s"
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t-hi)", marginBottom: 4 }}>
                  {file.name}
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--t-mid)" }}>
                  <span>{file.size}</span>
                  <span>•</span>
                  <span>{file.uploadedAt}</span>
                </div>
              </div>
              <span style={{
                padding: "5px 12px", borderRadius: "var(--r-sm)",
                fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                background: file.status === "ready" ? "color-mix(in srgb, var(--c-green) 15%, transparent)" : file.status === "sliced" ? "color-mix(in srgb, var(--c-orange) 15%, transparent)" : "var(--ink-3)",
                color: file.status === "ready" ? "var(--c-green)" : file.status === "sliced" ? "var(--c-orange)" : "var(--t-mid)",
                border: `1px solid ${file.status === "ready" ? "color-mix(in srgb, var(--c-green) 40%, transparent)" : file.status === "sliced" ? "color-mix(in srgb, var(--c-orange) 40%, transparent)" : "var(--line-2)"}`,
                textTransform: "uppercase"
              }}>
                {file.status}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </InstrumentPage>
  );
}
