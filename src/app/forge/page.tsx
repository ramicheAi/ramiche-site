"use client";

import { useState } from "react";
import ParticleField from "@/components/ParticleField";

/* ══════════════════════════════════════════════════════════════
   PARALLAX FORGE — Creative Tools Hub
   Real creative capabilities powered by the agent network.
   ══════════════════════════════════════════════════════════════ */

const TOOLS = [
  {
    id: "image",
    name: "Image Generation",
    description: "Product photography, ads, social media visuals, brand assets",
    agent: "SHURI",
    color: "#a855f7",
    icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
    capabilities: ["Product shots", "Ad creatives", "Social posts", "Brand assets", "Mockups"],
    pricing: "$49/project",
  },
  {
    id: "music",
    name: "Music Production",
    description: "Original tracks, beats, jingles, podcast intros, soundscapes",
    agent: "TheMAESTRO",
    color: "#f59e0b",
    icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3",
    capabilities: ["Original tracks", "Background music", "Jingles", "Podcast audio", "Sound design"],
    pricing: "$79/track",
  },
  {
    id: "video",
    name: "Video Production",
    description: "Reels, TikToks, product demos, explainer videos",
    agent: "INK",
    color: "#ec4899",
    icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
    capabilities: ["Instagram Reels", "TikToks", "Product demos", "Explainers", "Stories"],
    pricing: "$129/video",
  },
  {
    id: "brand",
    name: "Brand Identity",
    description: "Logos, color palettes, typography, brand guidelines, visual systems",
    agent: "Vee",
    color: "#00f0ff",
    icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01",
    capabilities: ["Logo design", "Color systems", "Typography", "Brand guides", "Social templates"],
    pricing: "$299/kit",
  },
  {
    id: "copy",
    name: "Copywriting",
    description: "Website copy, email sequences, ad copy, social captions, SEO content",
    agent: "INK",
    color: "#22c55e",
    icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    capabilities: ["Website copy", "Email sequences", "Ad copy", "Blog posts", "Product descriptions"],
    pricing: "$99/project",
  },
  {
    id: "security",
    name: "Security Audit",
    description: "Vulnerability scanning, code review, compliance checks, penetration testing",
    agent: "Widow",
    color: "#ef4444",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    capabilities: ["Vulnerability scan", "Code review", "OWASP audit", "Compliance check", "Pen testing"],
    pricing: "$299/audit",
  },
];

export default function ForgePage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [brief, setBrief] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const selectedTool = TOOLS.find((t) => t.id === selected);

  const handleSubmit = () => {
    if (!email || !brief || !selected) return;
    setSubmitted(true);
    // TODO: Wire to API / email
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fafbfc",
        fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
        color: "#0f172a",
      }}
    >
      <ParticleField variant="purple" theme="light" opacity={0.12} count={45} interactive connections />
      {/* Header */}
      <header
        style={{
          padding: "40px 24px 32px",
          textAlign: "center",
          borderBottom: "2px solid #e2e8f0",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            fontWeight: 800,
            letterSpacing: "3px",
            color: "#a855f7",
            textTransform: "uppercase" as const,
            marginBottom: "12px",
          }}
        >
          PARALLAX FORGE
        </div>
        <h1
          style={{
            fontSize: "clamp(28px, 5vw, 42px)",
            fontWeight: 900,
            lineHeight: 1.1,
            margin: "0 0 12px",
            color: "#0f172a",
          }}
        >
          Creative tools.
          <br />
          Agent-powered.
        </h1>
        <p
          style={{
            fontSize: "16px",
            fontWeight: 600,
            color: "#475569",
            maxWidth: "480px",
            margin: "0 auto",
          }}
        >
          Pick a tool, describe what you need, and our specialist agents deliver
          production-ready creative assets.
        </p>
      </header>

      {/* Tool Grid */}
      <section style={{ padding: "32px 24px", maxWidth: "1200px", margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "20px",
          }}
        >
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setSelected(selected === tool.id ? null : tool.id)}
              style={{
                background: selected === tool.id ? "#fff" : "#fff",
                border: `2px solid ${selected === tool.id ? tool.color : "#e2e8f0"}`,
                borderRadius: "16px",
                padding: "24px",
                textAlign: "left" as const,
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow:
                  selected === tool.id
                    ? `0 0 0 3px ${tool.color}25, 0 8px 24px rgba(0,0,0,0.08)`
                    : "0 1px 3px rgba(0,0,0,0.04)",
                position: "relative" as const,
                overflow: "hidden" as const,
              }}
            >
              {/* Color accent bar */}
              <div
                style={{
                  position: "absolute" as const,
                  top: 0,
                  left: 0,
                  width: "4px",
                  height: "100%",
                  background: tool.color,
                  borderRadius: "16px 0 0 16px",
                }}
              />

              <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "12px" }}>
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    background: `${tool.color}15`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={tool.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={tool.icon} />
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "16px", color: "#0f172a" }}>
                    {tool.name}
                  </div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: tool.color }}>
                    {tool.agent} Agent • {tool.pricing}
                  </div>
                </div>
              </div>

              <p style={{ fontSize: "14px", fontWeight: 600, color: "#475569", margin: "0 0 14px", lineHeight: 1.5 }}>
                {tool.description}
              </p>

              {/* Capabilities */}
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "6px" }}>
                {tool.capabilities.map((cap) => (
                  <span
                    key={cap}
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: "20px",
                      background: `${tool.color}10`,
                      color: tool.color,
                      border: `1px solid ${tool.color}30`,
                    }}
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Brief Form — appears when a tool is selected */}
      {selected && !submitted && (
        <section
          style={{
            padding: "32px 24px 48px",
            maxWidth: "640px",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              background: "#fff",
              border: `2px solid ${selectedTool?.color || "#e2e8f0"}`,
              borderRadius: "16px",
              padding: "32px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
            }}
          >
            <h3 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 8px" }}>
              Start a {selectedTool?.name} project
            </h3>
            <p style={{ fontSize: "14px", color: "#64748b", fontWeight: 600, margin: "0 0 24px" }}>
              Describe what you need. {selectedTool?.agent} will review and deliver within 24-48 hours.
            </p>

            <div style={{ display: "flex", flexDirection: "column" as const, gap: "16px" }}>
              <input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  padding: "14px 16px",
                  borderRadius: "10px",
                  border: "2px solid #e2e8f0",
                  fontSize: "15px",
                  fontWeight: 600,
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
              <textarea
                placeholder="Describe your project — what do you need, what's it for, any references?"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={5}
                style={{
                  padding: "14px 16px",
                  borderRadius: "10px",
                  border: "2px solid #e2e8f0",
                  fontSize: "15px",
                  fontWeight: 600,
                  outline: "none",
                  resize: "vertical" as const,
                  fontFamily: "inherit",
                }}
              />
              <button
                onClick={handleSubmit}
                disabled={!email || !brief}
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  border: "none",
                  background: selectedTool?.color || "#a855f7",
                  color: "#fff",
                  fontSize: "16px",
                  fontWeight: 800,
                  cursor: email && brief ? "pointer" : "not-allowed",
                  opacity: email && brief ? 1 : 0.5,
                  transition: "all 0.2s",
                }}
              >
                Submit Brief — {selectedTool?.pricing}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Success */}
      {submitted && (
        <section
          style={{
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              border: "2px solid #22c55e",
              borderRadius: "16px",
              padding: "48px 32px",
              maxWidth: "480px",
              margin: "0 auto",
              boxShadow: "0 8px 32px rgba(34,197,94,0.1)",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>&#10003;</div>
            <h3 style={{ fontSize: "22px", fontWeight: 800, margin: "0 0 8px" }}>Brief received</h3>
            <p style={{ fontSize: "15px", color: "#475569", fontWeight: 600 }}>
              {selectedTool?.agent} is on it. You&apos;ll hear from us within 24 hours at{" "}
              <strong>{email}</strong>.
            </p>
            <button
              onClick={() => {
                setSubmitted(false);
                setSelected(null);
                setEmail("");
                setBrief("");
              }}
              style={{
                marginTop: "24px",
                padding: "12px 24px",
                borderRadius: "10px",
                border: "2px solid #e2e8f0",
                background: "transparent",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
                color: "#0f172a",
              }}
            >
              Start another project
            </button>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer
        style={{
          padding: "32px 24px",
          textAlign: "center",
          borderTop: "2px solid #e2e8f0",
          color: "#94a3b8",
          fontSize: "13px",
          fontWeight: 600,
        }}
      >
        Powered by Parallax Agent Network — 19 specialists, one ecosystem
      </footer>
    </div>
  );
}
