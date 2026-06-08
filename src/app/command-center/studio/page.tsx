"use client";

import { useState, useEffect, useCallback } from "react";
import { InstrumentPage, Panel } from "@/components/command-center/po/Instrument";

interface AgentStatus {
  id: string;
  name: string;
  status: string;
  role: string;
}

const SIGNED_ARTISTS = [
  { name: "Yauggy", role: "Artist", status: "Signed" },
  { name: "Niko Biswas", role: "Artist", status: "Signed" },
  { name: "Gabe Greyson", role: "Artist", status: "Signed" },
  { name: "RAMICHE", role: "Executive Producer", status: "Active" },
];

const STUDIO_TOOLS = [
  { name: "AI Music Generation", desc: "Diffrythm, Tencent Song Gen", status: "Available" },
  { name: "Voice Synthesis", desc: "Kokoro TTS, Chatterbox, DIA", status: "Available" },
  { name: "Audio Analysis", desc: "Songsee spectrograms", status: "Available" },
  { name: "ElevenLabs Music", desc: "Full song generation with vocals", status: "Available" },
  { name: "Apple Music", desc: "ClawTunes playback control", status: "Connected" },
];

export default function StudioPage() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/command-center/agents");
      if (res.ok) {
        const data = await res.json();
        const studioAgents = (data.agents || []).filter(
          (a: AgentStatus) => ["themaestro"].includes(a.id)
        );
        setAgents(studioAgents);
      }
    } catch { /* keep existing */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const maestro = agents.find((a) => a.id === "themaestro");

  return (
    <InstrumentPage
      id="studio"
      title="The Baba Studio"
      section="Creative"
      icon="spark"
      accent="var(--c-amber)"
    >
      <p className="mono" style={{ fontSize: 12, color: "var(--t-mid)", letterSpacing: "0.12em", margin: "0 0 20px" }}>
        TheMAESTRO — Music production, audio engineering &amp; artist management
      </p>

      {/* TheMAESTRO Status */}
      <Panel title="TheMAESTRO" icon="agents" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 6 }}>
          <div style={{ width: 56, height: 56, borderRadius: "var(--r-md)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, background: "color-mix(in srgb, var(--c-rose) 12%, transparent)", color: "var(--c-rose)" }}>
            M
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "var(--t-hi)" }}>TheMAESTRO</span>
              <span className="mono" style={{ fontSize: 9, padding: "2px 8px", borderRadius: "var(--r-sm)", background: "color-mix(in srgb, var(--c-amber) 18%, transparent)", color: "var(--c-amber)", letterSpacing: "0.1em" }}>
                LOCAL
              </span>
            </div>
            <p style={{ color: "var(--t-mid)", fontSize: 12, margin: "4px 0 0" }}>Music Production AI — Qwen 14B (local)</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 12, height: 12, borderRadius: "50%",
                backgroundColor: maestro?.status === "active" ? "var(--c-green)" : maestro?.status === "idle" ? "var(--c-amber)" : "var(--t-lo)",
                boxShadow: maestro?.status === "active" ? "0 0 8px color-mix(in srgb, var(--c-green) 50%, transparent)" : "none",
              }}
            />
            <span style={{ fontSize: 12, color: "var(--t-mid)" }}>{maestro?.status?.toUpperCase() || "OFFLINE"}</span>
          </div>
        </div>
      </Panel>

      {/* Signed Artists */}
      <Panel title="Roster" icon="agents" style={{ marginBottom: 20 }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ marginTop: 6 }}>
          {SIGNED_ARTISTS.map((artist) => (
            <div
              key={artist.name}
              style={{ background: "var(--ink-2)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: 16 }}
            >
              <div style={{ width: 40, height: 40, borderRadius: "var(--r-sm)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, marginBottom: 8, background: "color-mix(in srgb, var(--c-rose) 12%, transparent)", color: "var(--c-rose)" }}>
                {artist.name[0]}
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, display: "block", color: "var(--t-hi)" }}>{artist.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 10, color: "var(--t-lo)", letterSpacing: "0.1em" }}>{artist.role}</span>
                <span style={{ fontSize: 9, color: "color-mix(in srgb, var(--c-rose) 60%, transparent)" }}>• {artist.status}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Production Tools */}
      <Panel title="Production Tools" icon="command" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
          {STUDIO_TOOLS.map((tool) => (
            <div
              key={tool.name}
              style={{ background: "var(--ink-2)", border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}
            >
              <div>
                <span style={{ fontSize: 14, fontWeight: 500, color: "var(--t-hi)" }}>{tool.name}</span>
                <p style={{ color: "var(--t-lo)", fontSize: 10, margin: "2px 0 0" }}>{tool.desc}</p>
              </div>
              <span className="mono" style={{ fontSize: 10, color: "var(--c-green)", letterSpacing: "0.1em" }}>{tool.status.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Status Note */}
      <Panel style={{ marginBottom: 20, borderColor: "color-mix(in srgb, var(--c-amber) 28%, var(--line))" }}>
        <p style={{ color: "var(--t-mid)", fontSize: 12, margin: 0, lineHeight: 1.6 }}>
          <span style={{ color: "var(--c-amber)", fontWeight: 600 }}>NOTE:</span> The Baba Studio is temporarily shut down for relocation + recoding.
          Studio sessions will resume when the physical space is operational.
        </p>
      </Panel>

      {/* Project Management Tools */}
      <Panel title="Project Management Tools" icon="dispatch">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ marginTop: 6 }}>
          <div style={{ borderRadius: "var(--r-md)", border: "1px solid color-mix(in srgb, var(--c-gold) 22%, var(--line))", background: "color-mix(in srgb, var(--c-gold) 4%, var(--ink-2))", padding: 20 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--t-hi)", margin: "0 0 4px" }}>Studio Project Tracker</h4>
            <p style={{ fontSize: 12, color: "var(--t-mid)", margin: "0 0 12px" }}>Client pipeline Kanban — 5 stages, tier pricing ($400-$6K+), revenue analytics</p>
            <a href="/api/command-center/yolo-builds/preview/2026-03-12-studio-project-tracker/index.html" target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", fontSize: 12, padding: "6px 14px", borderRadius: "var(--r-sm)", border: "1px solid color-mix(in srgb, var(--c-gold) 40%, transparent)", color: "var(--c-gold)", fontWeight: 600, letterSpacing: "0.04em", textDecoration: "none" }}>
              Launch Tool →
            </a>
          </div>
        </div>
      </Panel>
    </InstrumentPage>
  );
}
