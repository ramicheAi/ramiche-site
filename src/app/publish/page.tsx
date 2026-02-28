"use client";

/* ══════════════════════════════════════════════════════════════
   PARALLAX PUBLISH — Social Media Command Center
   Links to the real Publish app at parallax-publish.vercel.app
   ══════════════════════════════════════════════════════════════ */

const PLATFORMS = [
  { name: "Twitter / X", icon: "𝕏", color: "#000000", status: "live" },
  { name: "LinkedIn", icon: "in", color: "#0A66C2", status: "live" },
  { name: "Bluesky", icon: "🦋", color: "#0085FF", status: "live" },
  { name: "Instagram", icon: "📷", color: "#E4405F", status: "coming" },
  { name: "TikTok", icon: "♪", color: "#000000", status: "coming" },
  { name: "YouTube", icon: "▶", color: "#FF0000", status: "coming" },
];

const FEATURES = [
  {
    title: "Multi-platform publishing",
    desc: "Post to Twitter, LinkedIn, Bluesky — and more coming. One compose, everywhere.",
    color: "#00f0ff",
  },
  {
    title: "AI-powered captions",
    desc: "Auto-generate hashtags, optimize copy per platform, A/B test variations.",
    color: "#a855f7",
  },
  {
    title: "Post history & analytics",
    desc: "See everything you posted, when, and where. Track what works.",
    color: "#22c55e",
  },
  {
    title: "Platform previews",
    desc: "See exactly how your post will look on each platform before publishing.",
    color: "#f59e0b",
  },
];

export default function PublishPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fafbfc",
        fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
        color: "#0f172a",
      }}
    >
      {/* Header */}
      <header style={{ padding: "40px 24px 32px", textAlign: "center", borderBottom: "2px solid #e2e8f0" }}>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 800,
            letterSpacing: "3px",
            color: "#00f0ff",
            textTransform: "uppercase" as const,
            marginBottom: "12px",
          }}
        >
          PARALLAX PUBLISH
        </div>
        <h1
          style={{
            fontSize: "clamp(28px, 5vw, 42px)",
            fontWeight: 900,
            lineHeight: 1.1,
            margin: "0 0 12px",
          }}
        >
          Your social media.
          <br />
          One dashboard.
        </h1>
        <p style={{ fontSize: "16px", fontWeight: 600, color: "#475569", maxWidth: "480px", margin: "0 auto 24px" }}>
          Compose once, publish everywhere. No middleman APIs. You own the pipeline.
        </p>
        <a
          href="https://parallax-publish.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            padding: "16px 40px",
            borderRadius: "12px",
            background: "#0f172a",
            color: "#fff",
            fontSize: "16px",
            fontWeight: 800,
            textDecoration: "none",
            transition: "all 0.2s",
          }}
        >
          Open Publish Dashboard →
        </a>
      </header>

      {/* Platforms */}
      <section style={{ padding: "32px 24px", maxWidth: "800px", margin: "0 auto" }}>
        <h2 style={{ fontSize: "14px", fontWeight: 800, letterSpacing: "2px", color: "#64748b", textTransform: "uppercase" as const, marginBottom: "20px" }}>
          Connected Platforms
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "14px" }}>
          {PLATFORMS.map((p) => (
            <div
              key={p.name}
              style={{
                background: "#fff",
                border: "2px solid #e2e8f0",
                borderRadius: "12px",
                padding: "18px 20px",
                display: "flex",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: `${p.color}12`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  fontWeight: 900,
                  color: p.color,
                  border: `2px solid ${p.color}30`,
                }}
              >
                {p.icon}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: "15px" }}>{p.name}</div>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: p.status === "live" ? "#22c55e" : "#94a3b8",
                  }}
                >
                  {p.status === "live" ? "● Connected" : "○ Coming soon"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: "24px 24px 48px", maxWidth: "800px", margin: "0 auto" }}>
        <h2 style={{ fontSize: "14px", fontWeight: 800, letterSpacing: "2px", color: "#64748b", textTransform: "uppercase" as const, marginBottom: "20px" }}>
          What You Get
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {FEATURES.map((f) => (
            <div
              key={f.title}
              style={{
                background: "#fff",
                border: "2px solid #e2e8f0",
                borderRadius: "14px",
                padding: "22px 24px",
                borderLeft: `4px solid ${f.color}`,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: "16px", marginBottom: "6px" }}>{f.title}</div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "#475569", lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "40px 24px", textAlign: "center", borderTop: "2px solid #e2e8f0" }}>
        <a
          href="https://parallax-publish.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            padding: "16px 40px",
            borderRadius: "12px",
            background: "#0f172a",
            color: "#fff",
            fontSize: "16px",
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          Launch Publish →
        </a>
      </section>
    </div>
  );
}
