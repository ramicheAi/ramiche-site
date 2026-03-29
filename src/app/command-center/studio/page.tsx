"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

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
    <div className="relative min-h-screen text-white overflow-hidden" style={{ background: "#000000" }}>
      <ParticleField />

      <div className="relative z-10 px-4 sm:px-8 pt-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/command-center" className="text-xs text-white/40 hover:text-white/70 tracking-[0.2em] transition-colors">
              ← COMMAND CENTER
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-500">THE BABA</span>
              <span className="text-white/40 ml-2 text-lg font-light">STUDIO</span>
            </h1>
            <p className="text-white/30 text-xs tracking-[0.15em] mt-1">
              TheMAESTRO — Music production, audio engineering & artist management
            </p>
          </div>
        </div>

        {/* TheMAESTRO Status */}
        <div className="bg-white/[0.03] border-2 border-pink-500/20 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold bg-pink-500/10 text-pink-400">
              M
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold">TheMAESTRO</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 tracking-[0.1em]">
                  LOCAL
                </span>
              </div>
              <p className="text-white/30 text-xs">Music Production AI — Qwen 14B (local)</p>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: maestro?.status === "active" ? "#22c55e" : maestro?.status === "idle" ? "#f59e0b" : "#6b7280",
                  boxShadow: maestro?.status === "active" ? "0 0 8px rgba(34,197,94,0.5)" : "none",
                }}
              />
              <span className="text-xs text-white/30">{maestro?.status?.toUpperCase() || "OFFLINE"}</span>
            </div>
          </div>
        </div>

        {/* Signed Artists */}
        <h2 className="text-xs text-white/40 tracking-[0.2em] font-medium mb-3">ROSTER</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {SIGNED_ARTISTS.map((artist) => (
            <div
              key={artist.name}
              className="bg-white/[0.03] border-2 border-white/10 rounded-xl p-4 hover:border-pink-500/20 transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-400 font-bold text-sm mb-2">
                {artist.name[0]}
              </div>
              <span className="text-sm font-semibold block">{artist.name}</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-white/25 tracking-[0.1em]">{artist.role}</span>
                <span className="text-[9px] text-pink-400/50">• {artist.status}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Production Tools */}
        <h2 className="text-xs text-white/40 tracking-[0.2em] font-medium mb-3">PRODUCTION TOOLS</h2>
        <div className="space-y-2 mb-8">
          {STUDIO_TOOLS.map((tool) => (
            <div
              key={tool.name}
              className="bg-white/[0.03] border-2 border-white/10 rounded-lg p-4 flex items-center justify-between hover:border-white/20 transition-all"
            >
              <div>
                <span className="text-sm font-medium">{tool.name}</span>
                <p className="text-white/25 text-[10px] mt-0.5">{tool.desc}</p>
              </div>
              <span className="text-[10px] text-green-400 tracking-[0.1em]">{tool.status.toUpperCase()}</span>
            </div>
          ))}
        </div>

        {/* Status Note */}
        <div className="bg-amber-500/5 border-2 border-amber-500/20 rounded-xl p-4 mb-8">
          <p className="text-white/30 text-xs">
            <span className="text-amber-400 font-medium">NOTE:</span> The Baba Studio is temporarily shut down for relocation + recoding.
            Studio sessions will resume when the physical space is operational.
          </p>
        </div>

        {/* Project Management Tools */}
        <h2 className="text-xs text-white/40 tracking-[0.2em] font-medium mb-3">PROJECT MANAGEMENT TOOLS</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
          <div className="rounded-xl border-2 p-5 transition-all hover:scale-[1.02]" style={{ borderColor: 'rgba(201,168,76,0.2)', background: 'rgba(201,168,76,0.03)' }}>
            <h4 className="text-sm font-bold text-white/90 mb-1">Studio Project Tracker</h4>
            <p className="text-xs text-white/50 mb-3">Client pipeline Kanban — 5 stages, tier pricing ($400-$6K+), revenue analytics</p>
            <a href="/yolo-builds/2026-03-12-studio-project-tracker/index.html" target="_blank" rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded border-2 font-semibold tracking-wider transition-all"
              style={{ borderColor: 'rgba(201,168,76,0.4)', color: '#C9A84C' }}>
              Launch Tool →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
