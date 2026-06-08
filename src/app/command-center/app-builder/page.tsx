"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { InstrumentPage, Panel } from "@/components/command-center/po/Instrument";

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
    <InstrumentPage
      id="app-builder"
      title="App Builder"
      section="Creative"
      icon="dispatch"
      accent="var(--c-cyan)"
    >
      <p style={{ fontSize: 13, color: "var(--t-mid)", margin: 0, lineHeight: 1.6 }}>
        Describe → Preview → Ship • Expo + EAS + Apple Developer
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, margin: "14px 0 24px" }}>
        <Link href="/command-center/fabrication" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--c-teal)", textDecoration: "none", opacity: 0.9 }}>
          NOVA Fabrication →
        </Link>
        <Link href="/command-center/yolo" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--c-amber)", textDecoration: "none", opacity: 0.9 }}>
          YOLO builds →
        </Link>
      </div>

      {/* Info Banner */}
      <Panel style={{ marginBottom: 24, borderColor: "color-mix(in srgb, var(--c-amber) 25%, var(--line))" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ fontSize: 20, flexShrink: 0 }}>⚠️</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--c-amber)", marginBottom: 6 }}>
              Configuration Required
            </div>
            <div style={{ fontSize: 13, color: "var(--t-hi)", lineHeight: 1.6 }}>
              Configure prerequisites in <Link href="/command-center/settings" style={{ color: "var(--c-amber)", textDecoration: "underline" }}>Settings</Link> to enable the App Builder pipeline.
            </div>
          </div>
        </div>
      </Panel>

      {/* App Description */}
      <Panel title="App Description" icon="spark" style={{ marginBottom: 24 }}>
        <textarea
          value={appDescription}
          onChange={(e) => setAppDescription(e.target.value)}
          placeholder="Describe your app idea in detail... (e.g., A productivity app for managing daily tasks with real-time sync, dark mode, and widget support)"
          rows={6}
          style={{
            width: "100%",
            padding: 18,
            marginTop: 6,
            borderRadius: "var(--r-md)",
            background: "var(--ink-2)",
            border: "1px solid var(--line-2)",
            color: "var(--t-hi)",
            fontSize: 14,
            fontFamily: "inherit",
            lineHeight: 1.6,
            resize: "vertical",
            outline: "none",
            transition: "all 0.3s",
            boxSizing: "border-box",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "var(--accent)";
            e.target.style.boxShadow = "0 0 24px color-mix(in srgb, var(--accent) 15%, transparent)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "var(--line-2)";
            e.target.style.boxShadow = "none";
          }}
        />
      </Panel>

      {/* Generate Scaffold Button */}
      <div style={{ marginBottom: 32 }}>
        <button
          disabled={true}
          style={{
            width: "100%",
            padding: "18px 32px",
            borderRadius: "var(--r-md)",
            background: "var(--ink-3)",
            border: "1px solid var(--line-2)",
            color: "var(--t-lo)",
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
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.02em", textTransform: "none", marginTop: 6, opacity: 0.8 }}>
            Apple Developer credentials required
          </div>
        </button>
      </div>

      {/* Pipeline Tracker */}
      <Panel title="Build Pipeline" icon="pulse" style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 6 }}>
          {pipelineStages.map((stage, index) => (
            <div key={stage.id} style={{
              padding: 20,
              borderRadius: "var(--r-md)",
              background: "var(--ink-2)",
              border: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              gap: 16,
              opacity: 0.55,
              position: "relative"
            }}>
              {/* Stage number */}
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                background: "var(--ink-3)",
                border: "1px solid var(--line-2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 900, color: "var(--t-lo)", flexShrink: 0
              }}>
                {index + 1}
              </div>

              {/* Stage content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 20 }}>{stage.icon}</span>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "var(--t-mid)" }}>
                    {stage.label}
                  </h3>
                </div>
                <div style={{ fontSize: 12, color: "var(--t-lo)" }}>
                  {stage.id === "scaffold" && "Generate React Native project structure"}
                  {stage.id === "preview" && "Live preview in Expo Go"}
                  {stage.id === "build" && "EAS Build for iOS"}
                  {stage.id === "testflight" && "Upload to TestFlight for beta testing"}
                  {stage.id === "appstore" && "Submit to App Store for review"}
                </div>
              </div>

              {/* Lock badge */}
              <div style={{
                padding: "6px 12px", borderRadius: "var(--r-sm)",
                background: "var(--ink-3)", border: "1px solid var(--line-2)",
                fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                color: "var(--t-lo)", textTransform: "uppercase",
                display: "flex", alignItems: "center", gap: 6
              }}>
                <span>🔒</span>
                <span>Setup Required</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Prerequisites Checklist */}
      <Panel title="Prerequisites" icon="check">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 6 }}>
          {prerequisites.map(prereq => (
            <div key={prereq.id} style={{
              padding: 20,
              borderRadius: "var(--r-md)",
              background: "var(--ink-2)",
              border: `1px solid ${prereq.status === "configured" ? "color-mix(in srgb, var(--c-green) 30%, transparent)" : "color-mix(in srgb, var(--c-red) 30%, transparent)"}`,
              display: "flex",
              alignItems: "center",
              gap: 16
            }}>
              {/* Status icon */}
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: prereq.status === "configured" ? "color-mix(in srgb, var(--c-green) 15%, transparent)" : "color-mix(in srgb, var(--c-red) 15%, transparent)",
                border: `2px solid ${prereq.status === "configured" ? "color-mix(in srgb, var(--c-green) 40%, transparent)" : "color-mix(in srgb, var(--c-red) 40%, transparent)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, flexShrink: 0,
                color: prereq.status === "configured" ? "var(--c-green)" : "var(--c-red)",
              }}>
                {prereq.status === "configured" ? "✓" : "✕"}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--t-hi)" }}>
                    {prereq.label}
                  </h3>
                  {prereq.required && (
                    <span style={{
                      padding: "2px 6px", borderRadius: "var(--r-xs)",
                      fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
                      background: "color-mix(in srgb, var(--c-red) 15%, transparent)",
                      color: "var(--c-red)",
                      border: "1px solid color-mix(in srgb, var(--c-red) 30%, transparent)",
                      textTransform: "uppercase"
                    }}>
                      Required
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--t-mid)" }}>
                  {prereq.description}
                </div>
              </div>

              {/* Status badge */}
              <div style={{
                padding: "6px 12px", borderRadius: "var(--r-sm)",
                background: prereq.status === "configured" ? "color-mix(in srgb, var(--c-green) 15%, transparent)" : "color-mix(in srgb, var(--c-red) 15%, transparent)",
                border: `1px solid ${prereq.status === "configured" ? "color-mix(in srgb, var(--c-green) 40%, transparent)" : "color-mix(in srgb, var(--c-red) 40%, transparent)"}`,
                fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                color: prereq.status === "configured" ? "var(--c-green)" : "var(--c-red)",
                textTransform: "uppercase", whiteSpace: "nowrap"
              }}>
                {prereq.status === "configured" ? "Configured" : "Not Configured"}
              </div>
            </div>
          ))}
        </div>

        {/* Setup link */}
        <div style={{
          marginTop: 24, padding: 20, borderRadius: "var(--r-md)",
          background: "color-mix(in srgb, var(--accent) 8%, var(--ink-2))",
          border: "1px solid color-mix(in srgb, var(--accent) 25%, var(--line))",
          textAlign: "center"
        }}>
          <div style={{ fontSize: 13, color: "var(--t-hi)", marginBottom: 12 }}>
            Configure all prerequisites to unlock the App Builder pipeline
          </div>
          <Link
            href="/command-center/settings"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "10px 20px", borderRadius: "var(--r-sm)",
              background: "color-mix(in srgb, var(--accent) 15%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
              color: "var(--accent)", fontSize: 13, fontWeight: 700,
              textDecoration: "none", transition: "all 0.3s"
            }}
          >
            <span>⚙️</span>
            <span>Go to Settings</span>
          </Link>
        </div>
      </Panel>

      <style jsx global>{`
        textarea::placeholder {
          color: var(--t-lo);
          opacity: 0.6;
        }
      `}</style>
    </InstrumentPage>
  );
}
