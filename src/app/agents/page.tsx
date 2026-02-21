"use client";

import { useState, useCallback } from "react";

/* ══════════════════════════════════════════════════════════════
   PARALLAX — White-Label Agent Marketplace
   STANDALONE landing page — NO links to internal tools.
   ══════════════════════════════════════════════════════════════ */

// ─── DATA ────────────────────────────────────────────────────

const BUNDLES = [
  {
    id: "bundle_operations",
    name: "Operations",
    tagline: "Your AI operations backbone",
    price: 3500,
    monthly: 800,
    savings: 33,
    agents: ["Atlas — Operations Lead", "Triage — Diagnostics", "Widow — Security", "Proximon — Architecture"],
    ideal: ["Tech startups", "Agencies", "SaaS companies"],
    color: "#00f0ff",
    icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  },
  {
    id: "bundle_growth",
    name: "Growth",
    tagline: "From pipeline to paycheck",
    price: 3200,
    monthly: 750,
    savings: 33,
    agents: ["Mercury — Sales", "Vee — Brand", "Echo — Community", "Ink — Content"],
    ideal: ["E-commerce", "SaaS GTM", "Creators"],
    color: "#22c55e",
    icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
    featured: true,
  },
  {
    id: "bundle_creative",
    name: "Creative",
    tagline: "Ship creative at machine speed",
    price: 2800,
    monthly: 650,
    savings: 33,
    agents: ["Shuri — Coding", "Maestro — Music", "Ink — Content", "Nova — 3D Fab"],
    ideal: ["Studios", "Labels", "Product design"],
    color: "#a855f7",
    icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  },
  {
    id: "bundle_coaching",
    name: "Coaching",
    tagline: "Build champion athletes",
    price: 3000,
    monthly: 700,
    savings: 32,
    agents: ["Michael — Sport Coach", "Selah — Wellness", "Haven — Support", "Echo — Community"],
    ideal: ["Swim teams", "Gyms", "Youth sports"],
    color: "#f59e0b",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  },
  {
    id: "bundle_support",
    name: "Support",
    tagline: "Take care of your people",
    price: 2500,
    monthly: 550,
    savings: 31,
    agents: ["Haven — Support", "Echo — Community", "Selah — Wellness", "Prophets — Spiritual"],
    ideal: ["Coaching businesses", "Faith orgs", "High-touch support"],
    color: "#ec4899",
    icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  },
  {
    id: "bundle_enterprise",
    name: "Enterprise",
    tagline: "The complete AI workforce",
    price: 8500,
    monthly: 2000,
    savings: 37,
    agents: [
      "Atlas — Ops", "Mercury — Sales", "Triage — Diagnostics", "Shuri — Coding",
      "Haven — Support", "Vee — Brand", "Ink — Content", "Widow — Security",
      "Kiyosaki — Finance", "Simons — Quant",
    ],
    ideal: ["Funded startups", "SMBs scaling", "Agencies"],
    color: "#f97316",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  },
];

const SERVICES = [
  {
    id: "setup_basic",
    name: "Basic Install",
    price: 250,
    description: "OpenClaw installed, gateway running, one channel, one agent.",
    timeline: "1-2 hours",
    includes: ["Platform install", "1 channel integration", "1 agent deployed", "Health check"],
  },
  {
    id: "setup_standard",
    name: "Standard Setup",
    price: 500,
    description: "Full platform with multiple channels and agent bundle.",
    timeline: "2-4 hours",
    includes: ["Up to 3 channels", "4-agent bundle", "Custom souls", "Security hardening", "30-day monitoring"],
    featured: true,
  },
  {
    id: "setup_enterprise",
    name: "Enterprise Deploy",
    price: 2000,
    description: "Full ecosystem, all channels, custom agents, training.",
    timeline: "1-2 days",
    includes: ["All channels", "10+ agents", "Custom souls per agent", "Training session", "90-day support"],
  },
];

const COMPUTER_USE = [
  { id: "computer_standard", name: "Standard Portal", price: 200, setup: 500, desc: "Common web portals (CRM, admin panels)" },
  { id: "computer_complex", name: "Complex Portal", price: 350, setup: 1000, desc: "Multi-step workflows, auth-heavy portals" },
  { id: "computer_custom", name: "Custom Portal", price: 500, setup: 2500, desc: "Legacy systems, custom mapping" },
];

const STATS = [
  { value: "20", label: "AI Agents" },
  { value: "7", label: "Ready Bundles" },
  { value: "24/7", label: "Agent Uptime" },
  { value: "95%+", label: "Profit Margin" },
];

// ─── CHECKOUT ────────────────────────────────────────────────

async function checkout(productId: string) {
  const res = await fetch("/api/stripe/agents-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId }),
  });
  const data = await res.json();
  if (data.url) {
    window.location.href = data.url;
  } else {
    alert(data.error || "Checkout failed. Please try again.");
  }
}

// ─── COMPONENTS ──────────────────────────────────────────────

function SvgIcon({ path, color, size = 24 }: { path: string; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

function BundleCard({ bundle, onBuy }: { bundle: typeof BUNDLES[0]; onBuy: (id: string) => void }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: bundle.featured ? `1px solid ${bundle.color}` : "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 28,
        position: "relative",
        overflow: "hidden",
        transition: "transform 0.2s, border-color 0.2s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = bundle.color; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = bundle.featured ? bundle.color : "rgba(255,255,255,0.08)"; }}
    >
      {bundle.featured && (
        <div style={{ position: "absolute", top: 12, right: 12, background: bundle.color, color: "#000", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, letterSpacing: 0.5 }}>
          POPULAR
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <SvgIcon path={bundle.icon} color={bundle.color} size={32} />
      </div>
      <h3 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#fff" }}>{bundle.name}</h3>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, margin: "4px 0 16px" }}>{bundle.tagline}</p>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 36, fontWeight: 800, color: "#fff" }}>${bundle.price.toLocaleString()}</span>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>one-time</span>
      </div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>
        or ${bundle.monthly}/mo managed &middot; Save {bundle.savings}% vs individual
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
          AGENTS INCLUDED
        </div>
        {bundle.agents.map((a) => (
          <div key={a} style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", padding: "3px 0", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: bundle.color, fontSize: 10 }}>&#9679;</span> {a}
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
          IDEAL FOR
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {bundle.ideal.map((t) => (
            <span key={t} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
              {t}
            </span>
          ))}
        </div>
      </div>

      <button
        onClick={() => onBuy(bundle.id)}
        style={{
          width: "100%",
          padding: "12px 0",
          background: bundle.featured ? bundle.color : "transparent",
          color: bundle.featured ? "#000" : bundle.color,
          border: bundle.featured ? "none" : `1px solid ${bundle.color}`,
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          transition: "opacity 0.2s",
        }}
      >
        Get {bundle.name} Bundle
      </button>
    </div>
  );
}

function ServiceCard({ service, onBuy }: { service: typeof SERVICES[0]; onBuy: (id: string) => void }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: service.featured ? "1px solid #00f0ff" : "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 24,
        flex: 1,
        minWidth: 260,
      }}
    >
      {service.featured && (
        <div style={{ fontSize: 11, fontWeight: 700, color: "#00f0ff", marginBottom: 8, letterSpacing: 0.5 }}>RECOMMENDED</div>
      )}
      <h4 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>{service.name}</h4>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "4px 0 12px" }}>{service.description}</p>
      <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 4 }}>${service.price}</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>{service.timeline}</div>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px" }}>
        {service.includes.map((i) => (
          <li key={i} style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", padding: "3px 0", display: "flex", gap: 6 }}>
            <span style={{ color: "#22c55e" }}>&#10003;</span> {i}
          </li>
        ))}
      </ul>
      <button
        onClick={() => onBuy(service.id)}
        style={{
          width: "100%",
          padding: "10px 0",
          background: service.featured ? "#00f0ff" : "transparent",
          color: service.featured ? "#000" : "#00f0ff",
          border: service.featured ? "none" : "1px solid rgba(0,240,255,0.3)",
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Book Setup
      </button>
    </div>
  );
}

// ─── PAGE ────────────────────────────────────────────────────

export default function AgentsMarketplace() {
  const [activeTab, setActiveTab] = useState<"bundles" | "services" | "computer" | "custom">("bundles");
  const [loading, setLoading] = useState<string | null>(null);

  // Check for success/cancel from Stripe redirect
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const success = params?.get("success");
  const canceled = params?.get("canceled");

  const handleBuy = useCallback(async (productId: string) => {
    setLoading(productId);
    try {
      await checkout(productId);
    } finally {
      setLoading(null);
    }
  }, []);

  return (
    <div style={{ background: "#06020f", minHeight: "100vh", color: "#fff", fontFamily: "var(--font-geist-sans, system-ui)" }}>
      {/* Header — standalone, no internal links */}
      <nav style={{ width: "100%", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(6,2,15,0.8)", backdropFilter: "blur(12px)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px" }}>
          <span style={{ fontSize: 13, letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>
            PARALLAX
          </span>
          <a
            href="mailto:hello@parallax.so?subject=Agent%20Marketplace%20Inquiry"
            style={{ fontSize: 12, color: "#00f0ff", textDecoration: "none", fontWeight: 600, letterSpacing: "0.05em" }}
          >
            CONTACT US
          </a>
        </div>
      </nav>

      {/* Success/Cancel banners */}
      {success && (
        <div style={{ background: "#22c55e", color: "#000", padding: "14px 20px", textAlign: "center", fontWeight: 600, fontSize: 14 }}>
          Purchase successful. Check your email for delivery instructions.
        </div>
      )}
      {canceled && (
        <div style={{ background: "#f59e0b", color: "#000", padding: "14px 20px", textAlign: "center", fontWeight: 600, fontSize: 14 }}>
          Checkout canceled. No charges were made.
        </div>
      )}

      {/* Hero */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 20px 40px", textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#00f0ff", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>
          PARALLAX
        </div>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 800, lineHeight: 1.1, margin: 0 }}>
          Deploy an AI workforce<br />
          <span style={{ background: "linear-gradient(135deg, #00f0ff, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            in 30 minutes.
          </span>
        </h1>
        <p style={{ fontSize: 18, color: "rgba(255,255,255,0.5)", maxWidth: 600, margin: "20px auto 0", lineHeight: 1.6 }}>
          Pre-built AI agent teams with memory, scheduling, and soul engineering.
          Not chatbots. Autonomous specialists that work while you sleep.
        </p>

        {/* Stats */}
        <div style={{ display: "flex", justifyContent: "center", gap: 40, marginTop: 40, flexWrap: "wrap" }}>
          {STATS.map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#00f0ff" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Tab Navigation */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 32, overflowX: "auto", paddingBottom: 4 }}>
          {(["bundles", "services", "computer", "custom"] as const).map((tab) => {
            const labels = { bundles: "Agent Bundles", services: "Setup Service", computer: "Computer Use", custom: "White-Glove" };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  border: "none",
                  background: activeTab === tab ? "rgba(0,240,255,0.15)" : "rgba(255,255,255,0.04)",
                  color: activeTab === tab ? "#00f0ff" : "rgba(255,255,255,0.5)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.2s",
                }}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* ─── BUNDLES TAB ───────────────────────── */}
        {activeTab === "bundles" && (
          <>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Agent Bundles</h2>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, marginTop: 6 }}>
                Pre-assembled teams of specialized AI agents. Buy once, deploy everywhere.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20, marginBottom: 60 }}>
              {BUNDLES.map((b) => (
                <BundleCard key={b.id} bundle={b} onBuy={handleBuy} />
              ))}
            </div>
          </>
        )}

        {/* ─── SETUP SERVICE TAB ──────────────────── */}
        {activeTab === "services" && (
          <>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>OpenClaw Setup Service</h2>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, marginTop: 6 }}>
                We install, configure, and deploy OpenClaw on your infrastructure. From zero to production in hours.
              </p>
            </div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 60 }}>
              {SERVICES.map((s) => (
                <ServiceCard key={s.id} service={s} onBuy={handleBuy} />
              ))}
            </div>
          </>
        )}

        {/* ─── COMPUTER USE TAB ──────────────────── */}
        {activeTab === "computer" && (
          <>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Computer Use Agents</h2>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, marginTop: 6 }}>
                AI agents that operate legacy web portals via browser automation. Replace 5-10 hours/week of manual portal work.
              </p>
            </div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 60 }}>
              {COMPUTER_USE.map((c) => (
                <div key={c.id} style={{ flex: 1, minWidth: 260, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                  <h4 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>{c.name}</h4>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "6px 0 16px" }}>{c.desc}</p>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>${c.price}</span>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>/month</span>
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>
                    + ${c.setup} one-time setup
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 16, padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                    Saves $1,000-2,000/mo in labor at $50/hr admin cost
                  </div>
                  <button
                    onClick={() => handleBuy(c.id)}
                    style={{
                      width: "100%",
                      padding: "10px 0",
                      background: "transparent",
                      color: "#a855f7",
                      border: "1px solid rgba(168,85,247,0.3)",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Subscribe
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ─── WHITE-GLOVE TAB ────────────────────── */}
        {activeTab === "custom" && (
          <>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>White-Glove Deployments</h2>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, marginTop: 6 }}>
                We build your agent ecosystem from scratch. Custom souls, custom workflows, custom everything.
              </p>
            </div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 40 }}>
              {[
                { id: "deploy_single", name: "Single Agent", price: 750, desc: "One custom agent deployed, configured, and tested.", timeline: "1-2 days" },
                { id: "deploy_bundle", name: "Bundle Deploy", price: 2500, desc: "Full bundle with custom souls and inter-agent workflows.", timeline: "3-5 days", featured: true },
                { id: "deploy_ecosystem", name: "Full Ecosystem", price: 7500, desc: "10+ agents, all channels, training session, 90-day support.", timeline: "1-2 weeks" },
              ].map((d) => (
                <div key={d.id} style={{ flex: 1, minWidth: 260, background: "rgba(255,255,255,0.03)", border: d.featured ? "1px solid #f97316" : "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                  {d.featured && <div style={{ fontSize: 11, fontWeight: 700, color: "#f97316", marginBottom: 8, letterSpacing: 0.5 }}>MOST POPULAR</div>}
                  <h4 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>{d.name}</h4>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "6px 0 16px" }}>{d.desc}</p>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 4 }}>${d.price.toLocaleString()}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>{d.timeline}</div>
                  <button
                    onClick={() => handleBuy(d.id)}
                    style={{
                      width: "100%",
                      padding: "10px 0",
                      background: d.featured ? "#f97316" : "transparent",
                      color: d.featured ? "#000" : "#f97316",
                      border: d.featured ? "none" : "1px solid rgba(249,115,22,0.3)",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Book Deployment
                  </button>
                </div>
              ))}
            </div>

            {/* Contact CTA */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: 32,
              textAlign: "center",
              marginBottom: 60,
            }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Need something custom?</h3>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, margin: "0 0 20px" }}>
                Enterprise pricing, custom agent development, or consulting — reach out and we&apos;ll scope it together.
              </p>
              <a
                href="mailto:hello@parallax.so?subject=White-Label%20Agent%20Inquiry"
                style={{
                  display: "inline-block",
                  padding: "12px 32px",
                  background: "linear-gradient(135deg, #00f0ff, #a855f7)",
                  color: "#000",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Contact Us
              </a>
            </div>
          </>
        )}
      </section>

      {/* How It Works */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 20px 60px" }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: "center", marginBottom: 40 }}>How It Works</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24 }}>
          {[
            { step: "01", title: "Choose", desc: "Pick a bundle or individual agents that fit your business." },
            { step: "02", title: "Purchase", desc: "One-time for templates, monthly for managed hosting." },
            { step: "03", title: "Deploy", desc: "Run our CLI or let us deploy. 30 minutes to production." },
            { step: "04", title: "Scale", desc: "Add agents, channels, and workflows as you grow." },
          ].map((s) => (
            <div key={s.step} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 40, fontWeight: 800, color: "rgba(0,240,255,0.2)", marginBottom: 8 }}>{s.step}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* What Makes This Different */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px 60px" }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: "center", marginBottom: 12 }}>Not Chatbots. Teammates.</h2>
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 15, marginBottom: 40, maxWidth: 600, marginLeft: "auto", marginRight: "auto" }}>
          Every agent has a soul file defining their identity, expertise, and values.
          They remember context, run on schedules, and coordinate with each other.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 20 }}>
          {[
            { title: "Soul Engineering", desc: "Each agent has a crafted identity file — not a prompt, a personality. Experiential beliefs, anti-patterns, productive flaws." },
            { title: "Memory Architecture", desc: "Daily logs + long-term memory. Agents learn from every session and build continuity across conversations." },
            { title: "Cron Scheduling", desc: "Morning briefs, health checks, email monitoring — agents work on schedules, not just when you ping them." },
            { title: "Inter-Agent Workflows", desc: "Mercury closes deals → Ink writes announcements → Echo posts to community. Automated handoff chains." },
            { title: "Computer Use", desc: "Agents operate legacy web portals via browser automation. No API needed. If a human can click it, the agent can too." },
            { title: "Model-Agnostic", desc: "Run on Opus, Sonnet, GPT, DeepSeek, Gemini, or local Ollama. Mix and match per agent to optimize cost." },
          ].map((f) => (
            <div key={f.title} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px 80px", textAlign: "center" }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>
          Ready to deploy your AI team?
        </h2>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 16, marginBottom: 28 }}>
          Start with a bundle. Scale to an ecosystem. Replace 5+ roles for the cost of one.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => { setActiveTab("bundles"); window.scrollTo({ top: 400, behavior: "smooth" }); }}
            style={{ padding: "14px 32px", background: "linear-gradient(135deg, #00f0ff, #a855f7)", color: "#000", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer" }}
          >
            Browse Bundles
          </button>
          <a
            href="mailto:hello@parallax.so?subject=Agent%20Marketplace%20Inquiry"
            style={{ padding: "14px 32px", background: "transparent", color: "#00f0ff", border: "1px solid rgba(0,240,255,0.3)", borderRadius: 12, fontSize: 15, fontWeight: 700, textDecoration: "none", cursor: "pointer" }}
          >
            Talk to Us
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "24px 20px", textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0 }}>
          &copy; 2026 Parallax. Powered by OpenClaw.
        </p>
      </footer>
    </div>
  );
}
