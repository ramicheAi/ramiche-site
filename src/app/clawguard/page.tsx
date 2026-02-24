"use client";

import { useState, useEffect } from "react";

/* ══════════════════════════════════════════════════════════════
   CLAWGUARD PRO — Security Scanner Product Page
   Full-screen, living/breathing design with Stripe checkout
   ══════════════════════════════════════════════════════════════ */

const TIERS = [
  {
    id: "clawguard_pro",
    name: "Pro",
    price: 299,
    subtitle: "Single Machine",
    features: [
      "12-domain security scan",
      "Real-time vulnerability detection",
      "Compliance scoring (0-100)",
      "CLI + JSON reports",
      "Continuous monitoring mode",
      "Email support",
    ],
    cta: "Get Pro",
    accent: "#00f0ff",
  },
  {
    id: "clawguard_team",
    name: "Team",
    price: 799,
    subtitle: "Up to 5 Machines",
    features: [
      "Everything in Pro",
      "Multi-machine scanning",
      "Centralized dashboard",
      "Team audit reports",
      "Priority support",
      "Slack/Discord alerts",
    ],
    cta: "Get Team",
    accent: "#a855f7",
    featured: true,
  },
  {
    id: "clawguard_enterprise",
    name: "Enterprise",
    price: 1499,
    subtitle: "Unlimited Machines",
    features: [
      "Everything in Team",
      "Unlimited machines",
      "Custom scan policies",
      "API access",
      "Dedicated support",
      "SLA guarantee",
      "White-label reports",
    ],
    cta: "Get Enterprise",
    accent: "#f59e0b",
  },
];

const DOMAINS = [
  { name: "Authentication", desc: "SSH, keys, 2FA, login policies", icon: "🔐" },
  { name: "Authorization", desc: "File permissions, sudo, privilege escalation", icon: "🛡️" },
  { name: "Encryption", desc: "TLS, disk encryption, certificates", icon: "🔒" },
  { name: "Vulnerabilities", desc: "CVEs, outdated packages, known exploits", icon: "⚠️" },
  { name: "Audit Trail", desc: "Logging, integrity monitoring, forensics", icon: "📋" },
  { name: "Network", desc: "Firewall rules, open ports, DNS security", icon: "🌐" },
  { name: "Terminal", desc: "Shell security, history, environment leaks", icon: "💻" },
  { name: "Emergency", desc: "Incident response, backup verification", icon: "🚨" },
  { name: "Containers", desc: "Docker security, image scanning, isolation", icon: "📦" },
  { name: "API Security", desc: "Endpoint protection, rate limiting, CORS", icon: "🔗" },
  { name: "Third-Party", desc: "Supply chain, dependency auditing", icon: "🧩" },
  { name: "Disaster Recovery", desc: "Backup integrity, recovery testing", icon: "💾" },
];

async function checkout(productId: string) {
  const res = await fetch("/api/stripe/agents-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId }),
  });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
  else alert(data.error || "Checkout failed. Please try again.");
}

export default function ClawGuardPage() {
  const [success, setSuccess] = useState(false);
  const [canceled, setCanceled] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") setSuccess(true);
    if (params.get("canceled") === "true") setCanceled(true);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e2e8f0", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Success/Cancel banners */}
      {success && (
        <div style={{ background: "linear-gradient(135deg, #065f46, #064e3b)", padding: "16px 24px", textAlign: "center", fontSize: "16px", fontWeight: 600 }}>
          Purchase complete! Check your email for installation instructions.
        </div>
      )}
      {canceled && (
        <div style={{ background: "linear-gradient(135deg, #7f1d1d, #991b1b)", padding: "16px 24px", textAlign: "center", fontSize: "16px" }}>
          Checkout canceled. No charges were made.
        </div>
      )}

      {/* Nav */}
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 32px", maxWidth: "1400px", margin: "0 auto", width: "100%" }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none", color: "#e2e8f0" }}>
          <span style={{ fontSize: "24px", fontWeight: 900, letterSpacing: "-0.02em" }}>PARALLAX</span>
        </a>
        <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
          <a href="/agents" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "14px", fontWeight: 500 }}>Marketplace</a>
          <a href="https://github.com/ramicheAi/clawguard" target="_blank" rel="noopener noreferrer" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "14px", fontWeight: 500 }}>GitHub</a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: "center", padding: "80px 32px 60px", maxWidth: "1000px", margin: "0 auto", position: "relative" }}>
        {/* Shield icon */}
        <div style={{ marginBottom: "24px" }}>
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none" style={{ margin: "0 auto", filter: "drop-shadow(0 0 30px rgba(0,240,255,0.3))" }}>
            <path d="M40 8L12 22v18c0 16.57 11.93 32.08 28 36 16.07-3.92 28-19.43 28-36V22L40 8z" fill="url(#shield-grad)" stroke="#00f0ff" strokeWidth="2"/>
            <path d="M35 40l5 5 10-12" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            <defs><linearGradient id="shield-grad" x1="12" y1="8" x2="68" y2="76"><stop stopColor="#00f0ff" stopOpacity="0.2"/><stop offset="1" stopColor="#a855f7" stopOpacity="0.2"/></linearGradient></defs>
          </svg>
        </div>
        <h1 style={{ fontSize: "clamp(40px, 6vw, 72px)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: "20px" }}>
          <span style={{ background: "linear-gradient(135deg, #00f0ff, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>ClawGuard</span>{" "}
          <span style={{ color: "#94a3b8", fontWeight: 400 }}>Pro</span>
        </h1>
        <p style={{ fontSize: "clamp(18px, 2.5vw, 24px)", color: "#94a3b8", maxWidth: "700px", margin: "0 auto 40px", lineHeight: 1.6 }}>
          Security scanning for AI agent deployments. 12 domains. One command. Know your risk.
        </p>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
          <a href="#pricing" style={{
            display: "inline-block", padding: "16px 40px", background: "linear-gradient(135deg, #00f0ff, #a855f7)", color: "#0a0a0f",
            fontWeight: 800, fontSize: "18px", borderRadius: "12px", textDecoration: "none", letterSpacing: "0.02em",
            boxShadow: "0 0 40px rgba(0,240,255,0.3)",
          }}>
            GET STARTED
          </a>
          <a href="https://github.com/ramicheAi/clawguard" target="_blank" rel="noopener noreferrer" style={{
            display: "inline-block", padding: "16px 40px", border: "2px solid #334155", color: "#e2e8f0",
            fontWeight: 600, fontSize: "18px", borderRadius: "12px", textDecoration: "none",
          }}>
            View Source
          </a>
        </div>
      </section>

      {/* Install snippet */}
      <section style={{ textAlign: "center", padding: "0 32px 60px", maxWidth: "800px", margin: "0 auto" }}>
        <div style={{
          background: "#111118", border: "2px solid #1e293b", borderRadius: "16px", padding: "24px 32px",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: "16px", textAlign: "left",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ color: "#64748b", marginBottom: "8px" }}># Install &amp; scan in one command</div>
          <div><span style={{ color: "#22c55e" }}>$</span> <span style={{ color: "#e2e8f0" }}>pip install clawguard && clawguard scan</span></div>
        </div>
      </section>

      {/* 12 Security Domains */}
      <section style={{ padding: "60px 32px", maxWidth: "1200px", margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, marginBottom: "16px", letterSpacing: "-0.02em" }}>
          12 Security Domains
        </h2>
        <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "18px", marginBottom: "48px", maxWidth: "600px", marginLeft: "auto", marginRight: "auto" }}>
          Every scan checks your entire attack surface — from SSH keys to container isolation.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px" }}>
          {DOMAINS.map((d) => (
            <div key={d.name} style={{
              background: "#111118", border: "2px solid #1e293b", borderRadius: "12px", padding: "20px 24px",
              transition: "border-color 0.3s", cursor: "default",
            }}>
              <div style={{ fontSize: "24px", marginBottom: "8px" }}>{d.icon}</div>
              <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "4px" }}>{d.name}</div>
              <div style={{ color: "#94a3b8", fontSize: "14px" }}>{d.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: "80px 32px", maxWidth: "1200px", margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, marginBottom: "16px", letterSpacing: "-0.02em" }}>
          Choose Your Plan
        </h2>
        <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "18px", marginBottom: "48px" }}>
          One-time purchase. Lifetime updates. No subscriptions.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px", alignItems: "stretch" }}>
          {TIERS.map((tier) => (
            <div key={tier.id} style={{
              background: tier.featured ? "linear-gradient(180deg, #1a1030, #111118)" : "#111118",
              border: `2px solid ${tier.featured ? tier.accent : "#1e293b"}`,
              borderRadius: "20px", padding: "40px 32px", position: "relative", overflow: "hidden",
              display: "flex", flexDirection: "column",
              boxShadow: tier.featured ? `0 0 60px ${tier.accent}20` : "none",
            }}>
              {tier.featured && (
                <div style={{
                  position: "absolute", top: "16px", right: "16px", background: tier.accent, color: "#0a0a0f",
                  padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 800, letterSpacing: "0.05em",
                }}>
                  MOST POPULAR
                </div>
              )}
              <div style={{ fontSize: "14px", color: "#64748b", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>
                {tier.subtitle}
              </div>
              <h3 style={{ fontSize: "32px", fontWeight: 900, marginBottom: "8px" }}>{tier.name}</h3>
              <div style={{ marginBottom: "24px" }}>
                <span style={{ fontSize: "48px", fontWeight: 900, color: tier.accent }}>${tier.price}</span>
                <span style={{ color: "#64748b", fontSize: "16px", marginLeft: "4px" }}>one-time</span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", flex: 1 }}>
                {tier.features.map((f) => (
                  <li key={f} style={{ padding: "8px 0", fontSize: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ color: tier.accent, fontSize: "16px" }}>✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => checkout(tier.id)}
                style={{
                  width: "100%", padding: "16px", background: tier.featured ? `linear-gradient(135deg, ${tier.accent}, ${tier.accent}cc)` : "transparent",
                  border: tier.featured ? "none" : `2px solid ${tier.accent}`,
                  color: tier.featured ? "#0a0a0f" : tier.accent,
                  fontWeight: 800, fontSize: "16px", borderRadius: "12px", cursor: "pointer",
                  letterSpacing: "0.02em",
                }}
              >
                {tier.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #1e293b", padding: "40px 32px", textAlign: "center" }}>
        <div style={{ color: "#64748b", fontSize: "14px" }}>
          © 2026 Parallax Ventures Inc. — <a href="/" style={{ color: "#94a3b8", textDecoration: "none" }}>parallaxhq.com</a>
        </div>
      </footer>

      <style jsx>{`
        @keyframes shieldPulse {
          0%, 100% { filter: drop-shadow(0 0 30px rgba(0,240,255,0.3)); }
          50% { filter: drop-shadow(0 0 50px rgba(0,240,255,0.5)); }
        }
      `}</style>
    </div>
  );
}
