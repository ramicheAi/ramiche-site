"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import ParticleField from "../../components/ParticleField";

/* ── Colors ── */
const C = {
  navy: "#1a237e",
  navyLight: "#283593",
  navyDark: "#0d1452",
  gold: "#ffd700",
  goldDim: "#c9a800",
  white: "#ffffff",
  bg: "#060818",
  cardBg: "#0c1230",
} as const;

/* ── Scroll-triggered reveal ── */
function ScrollSection({ children, style, delay = 0, id }: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  delay?: number;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <section
      id={id}
      ref={ref}
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(30px)",
        transition: `opacity 0.7s ease-out ${delay}s, transform 0.7s ease-out ${delay}s`,
      }}
    >
      {children}
    </section>
  );
}

/* ── Countdown logic ── */
function useCountdown(target: Date) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!now) return { days: 0, hours: 0, minutes: 0, seconds: 0, ready: false };
  const diff = Math.max(0, target.getTime() - now.getTime());
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    ready: true,
  };
}

function CountdownBox({ value, label }: { value: number; label: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      background: `linear-gradient(135deg, ${C.navyDark}, ${C.navy})`,
      border: `1px solid ${C.gold}33`,
      borderRadius: 12, padding: "16px 20px", minWidth: 80,
    }}>
      <span style={{
        fontSize: 36, fontWeight: 800, color: C.gold,
        fontVariantNumeric: "tabular-nums", lineHeight: 1,
      }}>
        {String(value).padStart(2, "0")}
      </span>
      <span style={{ fontSize: 11, color: C.white + "99", textTransform: "uppercase", letterSpacing: 2, marginTop: 6 }}>
        {label}
      </span>
    </div>
  );
}

/* ── Stat card ── */
function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.cardBg}, ${C.navyDark})`,
      border: `1px solid ${C.gold}22`,
      borderRadius: 16, padding: "32px 24px", textAlign: "center" as const,
      flex: "1 1 200px", maxWidth: 260,
    }}>
      <div style={{ fontSize: 42, fontWeight: 800, color: C.gold, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 14, color: C.white + "bb", marginTop: 10 }}>{label}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   POWER CHALLENGE — Open Water Swim Landing Page
   Jesse Vassallo's Pompano Beach Piranhas
   ══════════════════════════════════════════════════════════════ */

export default function PowerChallengePage() {
  const eventDate = new Date("2026-04-11T07:00:00-04:00");
  const countdown = useCountdown(eventDate);

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, color: C.white,
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      overflowX: "hidden" as const,
    }}>
      <ParticleField variant="gold" count={50} speed={0.3} opacity={0.4} connections />

      {/* ── Nav ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 28px",
        background: C.bg + "ee", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${C.navy}44`,
      }}>
        <Link href="/power-challenge" style={{ color: C.gold, fontWeight: 800, fontSize: 16, textDecoration: "none", letterSpacing: 1 }}>
          POWER CHALLENGE
        </Link>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          {[
            { label: "Races", href: "#races" },
            { label: "Schedule", href: "#schedule" },
            { label: "FAQ", href: "#faq" },
          ].map((link) => (
            <a key={link.href} href={link.href} style={{ color: C.white + "cc", fontSize: 14, textDecoration: "none", fontWeight: 500 }}>
              {link.label}
            </a>
          ))}
          <Link href="/power-challenge/register" style={{
            padding: "8px 20px", background: C.gold, color: C.navyDark,
            fontWeight: 700, fontSize: 13, borderRadius: 50, textDecoration: "none",
          }}>
            Register
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header style={{
        position: "relative", zIndex: 1,
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        textAlign: "center" as const, padding: "60px 24px 40px",
      }}>
        <div style={{
          fontSize: 13, letterSpacing: 4, textTransform: "uppercase" as const,
          color: C.gold, marginBottom: 16, fontWeight: 600,
        }}>
          Jesse Vassallo&apos;s Pompano Beach Piranhas Present
        </div>

        <h1 style={{
          fontSize: "clamp(48px, 8vw, 96px)", fontWeight: 900,
          lineHeight: 1.05, margin: "0 0 8px",
          background: `linear-gradient(135deg, ${C.gold}, ${C.white}, ${C.gold})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          POWER<br />CHALLENGE
        </h1>

        <p style={{
          fontSize: "clamp(16px, 2.5vw, 22px)", color: C.white + "cc",
          maxWidth: 540, margin: "0 auto 40px", lineHeight: 1.5,
        }}>
          Open Water Swim &mdash; Pompano Beach, FL
        </p>

        {countdown.ready && (
          <div style={{
            display: "flex", gap: 12, flexWrap: "wrap" as const,
            justifyContent: "center", marginBottom: 48,
          }}>
            <CountdownBox value={countdown.days} label="Days" />
            <CountdownBox value={countdown.hours} label="Hours" />
            <CountdownBox value={countdown.minutes} label="Min" />
            <CountdownBox value={countdown.seconds} label="Sec" />
          </div>
        )}

        <Link href="/power-challenge/register" style={{
          display: "inline-block", padding: "16px 48px",
          background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
          color: C.navyDark, fontWeight: 800, fontSize: 18,
          borderRadius: 50, textDecoration: "none",
          boxShadow: `0 0 30px ${C.gold}44`,
          transition: "transform 0.2s, box-shadow 0.2s",
        }}>
          Register Now
        </Link>

        <div style={{
          position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)",
          color: C.white + "44", fontSize: 24, animation: "bounce 2s infinite",
        }}>
          &#8595;
        </div>
      </header>

      {/* ── Event Details ── */}
      <ScrollSection id="races" style={{ position: "relative", zIndex: 1, padding: "80px 24px", maxWidth: 900, margin: "0 auto" }}>
        <h2 style={{
          fontSize: 36, fontWeight: 800, textAlign: "center" as const,
          marginBottom: 48, color: C.gold,
        }}>
          The Races
        </h2>
        <div style={{
          display: "flex", gap: 24, justifyContent: "center",
          flexWrap: "wrap" as const,
        }}>
          {[
            { distance: "500m", desc: "Sprint — fast and fierce. Perfect for first-timers and competitive swimmers alike.", icon: "⚡" },
            { distance: "1.5K", desc: "Distance — test your endurance in the open Atlantic. The ultimate challenge.", icon: "🌊" },
          ].map((race) => (
            <div key={race.distance} style={{
              flex: "1 1 340px", maxWidth: 420,
              background: `linear-gradient(160deg, ${C.cardBg}, ${C.navyDark})`,
              border: `1px solid ${C.navy}`,
              borderRadius: 20, padding: "40px 32px",
              textAlign: "center" as const,
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>{race.icon}</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: C.gold, marginBottom: 12 }}>{race.distance}</div>
              <p style={{ color: C.white + "bb", lineHeight: 1.6, fontSize: 15 }}>{race.desc}</p>
            </div>
          ))}
        </div>
      </ScrollSection>

      {/* ── Location ── */}
      <ScrollSection style={{ position: "relative", zIndex: 1, padding: "60px 24px 80px", textAlign: "center" as const }} delay={0.1}>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: C.white, marginBottom: 12 }}>
          Pompano Beach, Florida
        </h2>
        <p style={{ color: C.white + "99", maxWidth: 520, margin: "0 auto 24px", lineHeight: 1.6 }}>
          Race day morning on the beautiful Atlantic coast. Warm water, ocean swells, and the energy of South Florida&apos;s swim community.
        </p>
        <div style={{
          display: "inline-block",
          background: C.navy + "66", border: `1px solid ${C.navy}`,
          borderRadius: 12, padding: "14px 28px",
          color: C.gold, fontWeight: 600, fontSize: 15,
        }}>
          April 11, 2026 &bull; Race Start 7:00 AM
        </div>
      </ScrollSection>

      {/* ── 2024 Results ── */}
      <ScrollSection style={{ position: "relative", zIndex: 1, padding: "80px 24px", maxWidth: 900, margin: "0 auto" }} delay={0.1}>
        <h2 style={{
          fontSize: 36, fontWeight: 800, textAlign: "center" as const,
          marginBottom: 16, color: C.gold,
        }}>
          2024 Results
        </h2>
        <p style={{
          textAlign: "center" as const, color: C.white + "99",
          marginBottom: 48, fontSize: 15,
        }}>
          Last year&apos;s event brought together an incredible field of open water athletes.
        </p>
        <div style={{
          display: "flex", gap: 24, justifyContent: "center",
          flexWrap: "wrap" as const,
        }}>
          <StatCard value="105" label="Athletes Competed" />
          <StatCard value="8" label="Teams Represented" />
          <StatCard value="2" label="Race Distances" />
        </div>
      </ScrollSection>

      {/* ── Sponsors ── */}
      <ScrollSection style={{ position: "relative", zIndex: 1, padding: "80px 24px 100px", textAlign: "center" as const }} delay={0.15}>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: C.white, marginBottom: 16 }}>
          Our Sponsors
        </h2>
        <p style={{ color: C.white + "99", marginBottom: 40, fontSize: 15 }}>
          Proudly supported by the South Florida swimming community.
        </p>
        <div style={{
          display: "flex", gap: 24, justifyContent: "center",
          flexWrap: "wrap" as const,
        }}>
          {["Sponsor 1", "Sponsor 2", "Sponsor 3", "Sponsor 4"].map((name) => (
            <div key={name} style={{
              width: 160, height: 80,
              background: C.cardBg,
              border: `1px dashed ${C.navy}`,
              borderRadius: 12,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: C.white + "44", fontSize: 13, fontWeight: 500,
            }}>
              {name}
            </div>
          ))}
        </div>
      </ScrollSection>

      {/* ── Race Day Schedule ── */}
      <ScrollSection id="schedule" style={{ position: "relative", zIndex: 1, padding: "80px 24px", maxWidth: 700, margin: "0 auto" }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, textAlign: "center" as const, marginBottom: 48, color: C.gold }}>
          Race Day Schedule
        </h2>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 0 }}>
          {[
            { time: "5:30 AM", event: "Check-in & Body Marking Opens" },
            { time: "6:15 AM", event: "Mandatory Safety Briefing" },
            { time: "6:45 AM", event: "Warm-Up Swim (Optional)" },
            { time: "7:00 AM", event: "500m Sprint — Wave Start" },
            { time: "7:30 AM", event: "1.5K Distance — Wave Start" },
            { time: "9:00 AM", event: "Awards Ceremony" },
            { time: "9:30 AM", event: "Post-Race Social & Refreshments" },
          ].map((item, i) => (
            <div key={i} style={{
              display: "flex", gap: 20, padding: "18px 0",
              borderBottom: `1px solid ${C.navy}33`,
              alignItems: "baseline",
            }}>
              <span style={{ color: C.gold, fontWeight: 700, fontSize: 15, minWidth: 90, fontVariantNumeric: "tabular-nums" }}>
                {item.time}
              </span>
              <span style={{ color: C.white + "dd", fontSize: 15 }}>{item.event}</span>
            </div>
          ))}
        </div>
      </ScrollSection>

      {/* ── FAQ ── */}
      <ScrollSection id="faq" style={{ position: "relative", zIndex: 1, padding: "80px 24px 100px", maxWidth: 700, margin: "0 auto" }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, textAlign: "center" as const, marginBottom: 48, color: C.gold }}>
          FAQ
        </h2>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 24 }}>
          {[
            { q: "What are the race distances?", a: "500m Sprint and 1.5K Distance. Both are open water ocean swims in the Atlantic." },
            { q: "How much does registration cost?", a: "500m Sprint is $45, 1.5K Distance is $65. Online registration only." },
            { q: "Do I need to be on a swim team?", a: "No. The event is open to all swimmers aged 12 and older. Team affiliation is optional." },
            { q: "What safety measures are in place?", a: "Lifeguards, kayak support, and safety boats will be stationed along the entire course. A mandatory safety briefing is held before the race." },
            { q: "What should I bring?", a: "Swimsuit, goggles, and a positive attitude. Wetsuits are permitted. Body marking supplies are provided at check-in." },
            { q: "Is there parking available?", a: "Yes, free parking is available at Pompano Beach. Arrive early for best spots." },
            { q: "Can I get a refund?", a: "Refunds are available up to 14 days before the event. No refunds within 14 days of race day." },
          ].map((item, i) => (
            <div key={i} style={{
              background: C.cardBg, border: `1px solid ${C.navy}44`,
              borderRadius: 14, padding: "24px 28px",
            }}>
              <div style={{ color: C.gold, fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{item.q}</div>
              <div style={{ color: C.white + "bb", fontSize: 14, lineHeight: 1.6 }}>{item.a}</div>
            </div>
          ))}
        </div>
      </ScrollSection>

      {/* ── Footer ── */}
      <footer style={{
        position: "relative", zIndex: 1,
        borderTop: `1px solid ${C.navy}`,
        padding: "32px 24px", textAlign: "center" as const,
        color: C.white + "66", fontSize: 13,
      }}>
        &copy; {new Date().getFullYear()} Pompano Beach Piranhas &mdash; Jesse Vassallo&apos;s POWER CHALLENGE
      </footer>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(8px); }
        }
      `}</style>
    </div>
  );
}
