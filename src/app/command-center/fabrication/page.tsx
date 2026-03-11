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

export default function FabricationPage() {
  const [novaAgent, setNovaAgent] = useState<Agent | null>(null);
  const [printQueue, setPrintQueue] = useState<PrintJob[]>([
    { id: "pj1", name: "enclosure-lid-v3.stl", status: "printing", material: "PLA Matte Black", printer: "A1 Mini", progress: 47, timeRemaining: "1h 23m", startedAt: "2:14 PM" },
    { id: "pj2", name: "hinge-bracket-reinforced.stl", status: "queued", material: "PETG Carbon", printer: "P1S" },
    { id: "pj3", name: "cable-clip-array-10x.stl", status: "complete", material: "PLA Grey", printer: "A1 Mini", completedAt: "1:08 PM" },
    { id: "pj4", name: "mounting-plate-final.stl", status: "queued", material: "ASA Black", printer: "P1S" },
    { id: "pj5", name: "bearing-holder-test.stl", status: "failed", material: "PLA White", printer: "A1 Mini", completedAt: "11:42 AM" },
  ]);
  const [printers, setPrinters] = useState<Printer[]>([
    {
      id: "a1mini",
      name: "A1 Mini",
      model: "Bambu Lab A1 Mini",
      status: "printing",
      currentJob: "enclosure-lid-v3.stl",
      progress: 47,
      temperature: { nozzle: 210, bed: 60 },
      connectionStrength: 92
    },
    {
      id: "p1s",
      name: "P1S",
      model: "Bambu Lab P1S",
      status: "online",
      temperature: { nozzle: 28, bed: 24 },
      connectionStrength: 88
    },
  ]);
  const [stlPipeline, setStlPipeline] = useState<STLFile[]>([
    { id: "stl1", name: "prototype-shell-v4.stl", size: "2.8 MB", uploadedAt: "3h ago", status: "pending" },
    { id: "stl2", name: "latch-mechanism.stl", size: "512 KB", uploadedAt: "5h ago", status: "sliced" },
    { id: "stl3", name: "case-bottom-revised.stl", size: "1.4 MB", uploadedAt: "1d ago", status: "ready" },
  ]);

  useEffect(() => {
    // Fetch NOVA agent
    fetch("/api/command-center/agents")
      .then(res => res.json())
      .then(data => {
        const nova = data.agents?.find((a: any) => a.id === "nova");
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
  }, []);

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
      <ParticleField variant="cyan" count={50} speed={0.6} opacity={0.3} connections={true} />

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
            Bambu Lab production pipeline • {printQueue.filter(p => p.status === "printing").length} printing • {printQueue.filter(p => p.status === "queued").length} queued
          </p>
        </div>

        {/* NOVA Agent Status Card */}
        {novaAgent && (
          <div style={{
            padding: 24,
            borderRadius: 16,
            background: "rgba(0,0,0,0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            marginBottom: 24,
            boxShadow: "0 0 40px rgba(20,184,166,0.15), 0 8px 32px rgba(0,0,0,0.4)"
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

        {/* Print Queue Section */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{
            fontSize: 14,
            fontWeight: 800,
            marginBottom: 16,
            color: "#14b8a6",
            letterSpacing: "0.02em",
            textTransform: "uppercase",
          }}>
            Print Queue
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {printQueue.map(job => (
              <div key={job.id} style={{
                padding: 20,
                borderRadius: 12,
                background: "rgba(0,0,0,0.95)",
                border: `1px solid ${job.status === "printing" ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)"}`,
                boxShadow: job.status === "printing" ? "0 0 24px rgba(34,197,94,0.1)" : "none",
                transition: "all 0.3s"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#e5e5e5", marginBottom: 6 }}>
                      {job.name}
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#737373" }}>
                      <span><strong style={{ color: "#8b5cf6" }}>Material:</strong> {job.material}</span>
                      <span><strong style={{ color: "#06b6d4" }}>Printer:</strong> {job.printer}</span>
                      {job.startedAt && <span><strong style={{ color: "#f59e0b" }}>Started:</strong> {job.startedAt}</span>}
                      {job.completedAt && <span><strong style={{ color: "#737373" }}>Completed:</strong> {job.completedAt}</span>}
                    </div>
                  </div>
                  <span style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    background: getStatusBg(job.status),
                    color: getStatusColor(job.status),
                    border: `1px solid ${getStatusColor(job.status)}40`,
                    textTransform: "uppercase",
                    whiteSpace: "nowrap"
                  }}>
                    {job.status}
                  </span>
                </div>
                {job.status === "printing" && job.progress !== undefined && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#22c55e" }}>{job.progress}%</span>
                      <span style={{ fontSize: 11, color: "#737373" }}>⏱ {job.timeRemaining} remaining</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.05)", overflow: "hidden", position: "relative" }}>
                      <div style={{
                        height: "100%",
                        width: `${job.progress}%`,
                        background: "linear-gradient(90deg, #22c55e, #14b8a6)",
                        borderRadius: 4,
                        boxShadow: "0 0 16px rgba(34,197,94,0.5)",
                        transition: "width 1s ease"
                      }} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bambu Lab Printer Status Cards */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{
            fontSize: 14,
            fontWeight: 800,
            marginBottom: 16,
            color: "#14b8a6",
            letterSpacing: "0.02em",
            textTransform: "uppercase"
          }}>
            Bambu Lab Printers
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            {printers.map(printer => (
              <div key={printer.id} style={{
                padding: 24,
                borderRadius: 16,
                background: "rgba(0,0,0,0.95)",
                border: `1px solid ${printer.status === "printing" ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)"}`,
                boxShadow: printer.status === "printing" ? "0 0 32px rgba(34,197,94,0.12)" : "0 0 16px rgba(139,92,246,0.08)",
                position: "relative",
                overflow: "hidden"
              }}>
                {/* Glow accent */}
                {printer.status === "printing" && (
                  <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: "linear-gradient(90deg, transparent, #22c55e, transparent)"
                  }} />
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "#e5e5e5" }}>
                      {printer.name}
                    </h3>
                    <div style={{ fontSize: 12, color: "#737373", marginTop: 4 }}>
                      {printer.model}
                    </div>
                  </div>
                  <span style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    background: getStatusBg(printer.status),
                    color: getStatusColor(printer.status),
                    border: `1px solid ${getStatusColor(printer.status)}40`,
                    textTransform: "uppercase"
                  }}>
                    {printer.status}
                  </span>
                </div>

                {/* Temperature readings */}
                {printer.temperature && (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginBottom: 16
                  }}>
                    <div style={{
                      padding: 12,
                      borderRadius: 10,
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.2)"
                    }}>
                      <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 4 }}>
                        NOZZLE
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: "#ef4444" }}>
                        {printer.temperature.nozzle}°
                      </div>
                    </div>
                    <div style={{
                      padding: 12,
                      borderRadius: 10,
                      background: "rgba(251,146,60,0.08)",
                      border: "1px solid rgba(251,146,60,0.2)"
                    }}>
                      <div style={{ fontSize: 10, color: "#fb923c", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 4 }}>
                        BED
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: "#fb923c" }}>
                        {printer.temperature.bed}°
                      </div>
                    </div>
                  </div>
                )}

                {/* Current job progress */}
                {printer.currentJob && printer.progress !== undefined && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: "#737373", marginBottom: 8 }}>
                      <strong style={{ color: "#14b8a6" }}>Printing:</strong> {printer.currentJob}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${printer.progress}%`,
                          background: "linear-gradient(90deg, #22c55e, #14b8a6)",
                          borderRadius: 3,
                          boxShadow: "0 0 12px rgba(34,197,94,0.4)"
                        }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#22c55e", minWidth: 42 }}>
                        {printer.progress}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Connection strength */}
                {printer.connectionStrength && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 11, color: "#737373", letterSpacing: "0.04em" }}>
                      SIGNAL
                    </div>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4 }}>
                      {[...Array(5)].map((_, i) => (
                        <div key={i} style={{
                          flex: 1,
                          height: 4,
                          borderRadius: 2,
                          background: i < Math.floor(printer.connectionStrength! / 20)
                            ? "linear-gradient(90deg, #06b6d4, #14b8a6)"
                            : "rgba(255,255,255,0.05)"
                        }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#14b8a6" }}>
                      {printer.connectionStrength}%
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Design Pipeline - STL Files */}
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
            {stlPipeline.map(file => (
              <div key={file.id} style={{
                padding: 18,
                borderRadius: 12,
                background: "rgba(0,0,0,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
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
