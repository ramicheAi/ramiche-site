"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

/* ══════════════════════════════════════════════════════════════════════════════
   APP BUILDER — Describe → Preview → Ship
   EAS + Expo + Apple Developer workflow
   ══════════════════════════════════════════════════════════════════════════════ */

interface PipelineStage {
  id: string;
  label: string;
  status: "locked" | "active" | "complete";
  icon: string;
}

interface Prerequisite {
  id: string;
  label: string;
  description: string;
  status: "not-configured" | "configured";
  required: boolean;
}

export default function AppBuilderPage() {
  const [appDescription, setAppDescription] = useState("");
  const [pipelineStages] = useState<PipelineStage[]>([
    { id: "scaffold", label: "Scaffold", status: "locked", icon: "🏗️" },
    { id: "preview", label: "Preview", status: "locked", icon: "👁️" },
    { id: "build", label: "Build", status: "locked", icon: "⚙️" },
    { id: "testflight", label: "TestFlight", status: "locked", icon: "🧪" },
    { id: "appstore", label: "App Store", status: "locked", icon: "🚀" },
  ]);

  const [prerequisites, setPrerequisites] = useState<Prerequisite[]>([
    {
      id: "apple-dev",
      label: "Apple Developer Program",
      description: "$99/year membership required",
      status: "not-configured",
      required: true
    },
    {
      id: "app-store-api",
      label: "App Store Connect API Key",
      description: "API key for automated uploads",
      status: "not-configured",
      required: true
    },
    {
      id: "eas-cli",
      label: "EAS CLI",
      description: "Expo Application Services command-line tool",
      status: "not-configured",
      required: true
    },
    {
      id: "expo-project",
      label: "Expo Project",
      description: "Initialized Expo project structure",
      status: "not-configured",
      required: true
    },
  ]);

  const checkPrereqs = useCallback(async () => {
    try {
      const res = await fetch("/api/command-center/app-builder", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.prerequisites) {
          setPrerequisites(prev => prev.map(p => {
            const live = data.prerequisites.find((lp: { id: string; status: string; detail: string }) => lp.id === p.id);
            return live ? { ...p, status: live.status, description: live.detail || p.description } : p;
          }));
        }
      }
    } catch { /* keep defaults */ }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { checkPrereqs(); }, [checkPrereqs]);

  const _allPrerequisitesMet = prerequisites.every(p => p.status === "configured");

  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#e5e5e5", fontFamily: "Inter, system-ui, sans-serif", position: "relative" }}>
      <ParticleField variant="purple" count={40} speed={0.5} opacity={0.25} connections={true} />

      {/* Holographic ambient glow */}
      <div style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        background: "radial-gradient(ellipse 800px 600px at 20% 30%, rgba(139,92,246,0.08) 0%, transparent 60%), radial-gradient(ellipse 600px 600px at 80% 70%, rgba(236,72,153,0.06) 0%, transparent 60%)"
      }} />

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 1000, margin: "0 auto", padding: "32px 24px 80px" }}>
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
          <h1 style={{
            fontSize: 32,
            fontWeight: 900,
            margin: 0,
            color: "#e5e5e5",
            textShadow: "0 0 40px rgba(139,92,246,0.3)",
            marginBottom: 8
          }}>
            App Builder
          </h1>
          <p style={{ fontSize: 13, color: "#737373", margin: 0, lineHeight: 1.6 }}>
            Describe → Preview → Ship • Expo + EAS + Apple Developer
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 14 }}>
            <Link href="/command-center/fabrication" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#14b8a6", textDecoration: "none", opacity: 0.9 }}>
              NOVA Fabrication →
            </Link>
            <Link href="/command-center/yolo" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#f59e0b", textDecoration: "none", opacity: 0.9 }}>
              YOLO builds →
            </Link>
          </div>
        </div>

        {/* Info Banner */}
        <div style={{
          padding: 18,
          borderRadius: 12,
          background: "rgba(251,146,60,0.08)",
          border: "1px solid rgba(251,146,60,0.25)",
          marginBottom: 32,
          display: "flex",
          alignItems: "flex-start",
          gap: 14
        }}>
          <div style={{
            fontSize: 20,
            flexShrink: 0,
            filter: "drop-shadow(0 0 8px rgba(251,146,60,0.4))"
          }}>
            ⚠️
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fb923c", marginBottom: 6 }}>
              Configuration Required
            </div>
            <div style={{ fontSize: 13, color: "#e5e5e5", lineHeight: 1.6 }}>
              Configure prerequisites in <Link href="/command-center/settings" style={{ color: "#fb923c", textDecoration: "underline" }}>Settings</Link> to enable the App Builder pipeline.
            </div>
          </div>
        </div>

        {/* App Description */}
        <div style={{ marginBottom: 32 }}>
          <label style={{
            display: "block",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#8b5cf6",
            marginBottom: 12
          }}>
            App Description
          </label>
          <textarea
            value={appDescription}
            onChange={(e) => setAppDescription(e.target.value)}
            placeholder="Describe your app idea in detail... (e.g., A productivity app for managing daily tasks with real-time sync, dark mode, and widget support)"
            rows={6}
            style={{
              width: "100%",
              padding: 18,
              borderRadius: 12,
              background: "rgba(0,0,0,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#e5e5e5",
              fontSize: 14,
              fontFamily: "inherit",
              lineHeight: 1.6,
              resize: "vertical",
              outline: "none",
              transition: "all 0.3s"
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "rgba(139,92,246,0.5)";
              e.target.style.boxShadow = "0 0 24px rgba(139,92,246,0.15)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "rgba(255,255,255,0.1)";
              e.target.style.boxShadow = "none";
            }}
          />
        </div>

        {/* Generate Scaffold Button */}
        <div style={{ marginBottom: 40 }}>
          <button
            disabled={true}
            style={{
              width: "100%",
              padding: "18px 32px",
              borderRadius: 12,
              background: "rgba(115,115,115,0.15)",
              border: "1px solid rgba(115,115,115,0.3)",
              color: "#737373",
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: "0.04em",
              cursor: "not-allowed",
              fontFamily: "inherit",
              textTransform: "uppercase",
              position: "relative",
              overflow: "hidden"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <span>🔒</span>
              <span>Generate Scaffold</span>
            </div>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.02em",
              textTransform: "none",
              marginTop: 6,
              opacity: 0.8
            }}>
              Apple Developer credentials required
            </div>
          </button>
        </div>

        {/* Pipeline Tracker */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{
            fontSize: 14,
            fontWeight: 800,
            marginBottom: 20,
            color: "#8b5cf6",
            letterSpacing: "0.08em",
            textTransform: "uppercase"
          }}>
            Build Pipeline
          </h2>
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 16
          }}>
            {pipelineStages.map((stage, index) => (
              <div key={stage.id} style={{
                padding: 20,
                borderRadius: 12,
                background: "rgba(0,0,0,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                gap: 16,
                opacity: 0.4,
                position: "relative"
              }}>
                {/* Stage number */}
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "rgba(115,115,115,0.1)",
                  border: "1px solid rgba(115,115,115,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  fontWeight: 900,
                  color: "#737373",
                  flexShrink: 0
                }}>
                  {index + 1}
                </div>

                {/* Stage content */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 20 }}>{stage.icon}</span>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "#737373" }}>
                      {stage.label}
                    </h3>
                  </div>
                  <div style={{ fontSize: 12, color: "#737373" }}>
                    {stage.id === "scaffold" && "Generate React Native project structure"}
                    {stage.id === "preview" && "Live preview in Expo Go"}
                    {stage.id === "build" && "EAS Build for iOS"}
                    {stage.id === "testflight" && "Upload to TestFlight for beta testing"}
                    {stage.id === "appstore" && "Submit to App Store for review"}
                  </div>
                </div>

                {/* Lock badge */}
                <div style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  background: "rgba(115,115,115,0.15)",
                  border: "1px solid rgba(115,115,115,0.3)",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: "#737373",
                  textTransform: "uppercase",
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}>
                  <span>🔒</span>
                  <span>Setup Required</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Prerequisites Checklist */}
        <div>
          <h2 style={{
            fontSize: 14,
            fontWeight: 800,
            marginBottom: 20,
            color: "#8b5cf6",
            letterSpacing: "0.08em",
            textTransform: "uppercase"
          }}>
            Prerequisites
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {prerequisites.map(prereq => (
              <div key={prereq.id} style={{
                padding: 20,
                borderRadius: 12,
                background: "rgba(0,0,0,0.95)",
                border: `1px solid ${prereq.status === "configured" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                display: "flex",
                alignItems: "center",
                gap: 16
              }}>
                {/* Status icon */}
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: prereq.status === "configured"
                    ? "rgba(34,197,94,0.15)"
                    : "rgba(239,68,68,0.15)",
                  border: `2px solid ${prereq.status === "configured" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  flexShrink: 0
                }}>
                  {prereq.status === "configured" ? "✓" : "✕"}
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "#e5e5e5" }}>
                      {prereq.label}
                    </h3>
                    {prereq.required && (
                      <span style={{
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        background: "rgba(239,68,68,0.15)",
                        color: "#ef4444",
                        border: "1px solid rgba(239,68,68,0.3)",
                        textTransform: "uppercase"
                      }}>
                        Required
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "#737373" }}>
                    {prereq.description}
                  </div>
                </div>

                {/* Status badge */}
                <div style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  background: prereq.status === "configured"
                    ? "rgba(34,197,94,0.15)"
                    : "rgba(239,68,68,0.15)",
                  border: `1px solid ${prereq.status === "configured" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: prereq.status === "configured" ? "#22c55e" : "#ef4444",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap"
                }}>
                  {prereq.status === "configured" ? "Configured" : "Not Configured"}
                </div>
              </div>
            ))}
          </div>

          {/* Setup link */}
          <div style={{
            marginTop: 24,
            padding: 20,
            borderRadius: 12,
            background: "rgba(139,92,246,0.08)",
            border: "1px solid rgba(139,92,246,0.25)",
            textAlign: "center"
          }}>
            <div style={{ fontSize: 13, color: "#e5e5e5", marginBottom: 12 }}>
              Configure all prerequisites to unlock the App Builder pipeline
            </div>
            <Link
              href="/command-center/settings"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 20px",
                borderRadius: 8,
                background: "rgba(139,92,246,0.15)",
                border: "1px solid rgba(139,92,246,0.4)",
                color: "#8b5cf6",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
                transition: "all 0.3s"
              }}
            >
              <span>⚙️</span>
              <span>Go to Settings</span>
            </Link>
          </div>
        </div>
      </div>

      <style jsx global>{`
        textarea::placeholder {
          color: #737373;
          opacity: 0.6;
        }
      `}</style>
    </div>
  );
}
