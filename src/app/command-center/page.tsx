"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./page.module.css";

/* ── agent network ────────────────────────────────────────── */

const agents = [
  {
    name: "Atlas",
    model: "Opus 4.6",
    status: "active" as const,
    task: "Running GA PRODUCTS render pipeline via Weavy",
  },
  {
    name: "Builder",
    model: "Sonnet 4.5",
    status: "idle" as const,
    task: "Last: scaffolded Apex Athlete MVP",
  },
  {
    name: "Scout",
    model: "Haiku 4.5",
    status: "idle" as const,
    task: "Last: scanned Printful catalog for margin data",
  },
];

/* ── XP data ──────────────────────────────────────────────── */

const xp = { current: 1420, nextLevel: 2000, level: "Operator", nextTitle: "Commander" };

/* ── stats ────────────────────────────────────────────────── */

const stats = [
  { label: "Active missions", value: "3", accent: "teal", delta: null },
  { label: "Tasks shipped", value: "12", accent: "orange", delta: "+3 this week" },
  { label: "Blockers", value: "2", accent: "yellow", delta: "down from 4" },
  { label: "Agent uptime", value: "98%", accent: "purple", delta: null },
];

/* ── revenue ──────────────────────────────────────────────── */

const revenue = [
  { label: "This month", amount: "$0" },
  { label: "Pipeline", amount: "$2,400" },
  { label: "Target", amount: "$5,000" },
];

/* ── projects ─────────────────────────────────────────────── */

const projects = [
  {
    name: "Galactik Antics",
    status: "active" as const,
    accent: "Orange",
    focus: "Phone cases → Framed posters → T-shirts",
    tasks: [
      { text: "Pick case-safe art crops", done: true },
      { text: "Generate production renders via Weavy GA PRODUCTS", done: true },
      { text: "Save outputs into finals folder", done: false },
      { text: "Upload to Printful + configure variants", done: false },
      { text: "PDP copy + pricing", done: false },
    ],
    links: [
      { label: "Weavy GA flow", href: "https://app.weavy.ai/flow/c6YNwJ4aj9z2iXcK1pRSeU" },
      { label: "Printful dashboard", href: "https://www.printful.com/dashboard" },
    ],
  },
  {
    name: "Ramiche Studio",
    status: "active" as const,
    accent: "Teal",
    focus: "$400 Creative Direction Sprint — brand identity in 48h",
    tasks: [
      { text: "Landing page live", done: true },
      { text: "Portfolio section with case studies", done: false },
      { text: "Testimonials / social proof", done: false },
      { text: "Stripe payment integration", done: false },
    ],
    links: [{ label: "Studio page", href: "/studio" }],
  },
  {
    name: "Apex Athlete",
    status: "new" as const,
    accent: "Purple",
    focus: "Gamified swim training system — MVP build",
    tasks: [
      { text: "Game engine (XP, levels, streaks, quests)", done: true },
      { text: "Dashboard UI scaffold", done: true },
      { text: "Daily check-in flow", done: false },
      { text: "Leaderboard + quest tracker", done: false },
      { text: "Coach analytics panel", done: false },
    ],
    links: [{ label: "Apex Athlete app", href: "/apex-athlete" }],
  },
  {
    name: "Music Pipeline",
    status: "paused" as const,
    accent: "Yellow",
    focus: "Track production & release pipeline automation",
    tasks: [
      { text: "music.json system of record", done: true },
      { text: "Status dashboard", done: true },
      { text: "Stalled-track detection", done: false },
      { text: "Momentum reports", done: false },
    ],
    links: [],
  },
];

/* ── timeline ─────────────────────────────────────────────── */

const timeline = [
  { dot: "teal", time: "Now", text: "Atlas running GA render pipeline" },
  { dot: "purple", time: "Today", text: "Apex Athlete swim system shipped" },
  { dot: "teal", time: "Today", text: "Command Center v2 deployed" },
  { dot: "orange", time: "Yest.", text: "GA phone case art crops finalized" },
  { dot: "teal", time: "2d", text: "Studio landing page deployed" },
  { dot: "yellow", time: "3d", text: "Music pipeline paused — focus shift to GA" },
];

/* ── quick access ─────────────────────────────────────────── */

const quickPaths = [
  { label: "GA vault", path: "/Users/admin/Desktop/GA_DECK_CANON_V0" },
  { label: "Source art", path: "/Users/admin/Desktop/GA_DECK_CANON_V0/GA ART" },
  { label: "Finals", path: "/Users/admin/Desktop/GA_DECK_CANON_V0/GALACTIK ANTICS PRODUCTS TO SAVE FINALS" },
];

/* ── helpers ──────────────────────────────────────────────── */

const statusClass: Record<string, string> = {
  active: styles.statusActive,
  paused: styles.statusPaused,
  new: styles.statusNew,
};

const accentClass: Record<string, string> = {
  Orange: styles.cardAccentOrange,
  Teal: styles.cardAccentTeal,
  Purple: styles.cardAccentPurple,
  Yellow: styles.cardAccentYellow,
};

const dotClass: Record<string, string> = {
  orange: styles.dotOrange,
  teal: styles.dotTeal,
  purple: styles.dotPurple,
  yellow: styles.dotYellow,
};

const statAccentClass: Record<string, string> = {
  orange: `${styles.stat} ${styles.statOrange}`,
  teal: `${styles.stat} ${styles.statTeal}`,
  purple: `${styles.stat} ${styles.statPurple}`,
  yellow: `${styles.stat} ${styles.statYellow}`,
};

const statValueClass: Record<string, string> = {
  orange: styles.statValueOrange,
  teal: styles.statValueTeal,
  purple: styles.statValuePurple,
  yellow: styles.statValueYellow,
};

/* ── types ────────────────────────────────────────────────── */

interface WeatherData {
  tempF: string;
  condition: string;
  humidity: string;
  forecast: { day: string; high: string; low: string; condition: string }[];
}

interface VerseData {
  text: string;
  reference: string;
}

/* ── page ─────────────────────────────────────────────────── */

export default function CommandCenter() {
  const totalTasks = projects.reduce((s, p) => s + p.tasks.length, 0);
  const doneTasks = projects.reduce((s, p) => s + p.tasks.filter((t) => t.done).length, 0);
  const pct = Math.round((doneTasks / totalTasks) * 100);
  const xpPct = Math.round((xp.current / xp.nextLevel) * 100);

  /* ── weather state ── */
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  const fetchWeather = useCallback(async () => {
    setWeatherLoading(true);
    try {
      const res = await fetch("https://wttr.in/Miami?format=j1");
      const data = await res.json();
      const current = data.current_condition?.[0];
      const days = data.weather?.slice(0, 3) ?? [];
      setWeather({
        tempF: current?.temp_F ?? "--",
        condition: current?.weatherDesc?.[0]?.value ?? "Unknown",
        humidity: current?.humidity ?? "--",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        forecast: days.map((d: any) => ({
          day: d.date?.slice(5) ?? "",
          high: d.maxtempF ?? "--",
          low: d.mintempF ?? "--",
          condition: d.hourly?.[4]?.weatherDesc?.[0]?.value ?? "",
        })),
      });
    } catch {
      setWeather(null);
    }
    setWeatherLoading(false);
  }, []);

  /* ── bible verse state ── */
  const [verse, setVerse] = useState<VerseData | null>(null);
  const [verseLoading, setVerseLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchVerse = useCallback(async () => {
    setVerseLoading(true);
    try {
      const res = await fetch("https://bible-api.com/?random=verse");
      const data = await res.json();
      setVerse({
        text: data.text?.trim() ?? "",
        reference: data.reference ?? "",
      });
    } catch {
      setVerse(null);
    }
    setVerseLoading(false);
  }, []);

  /* ── health stats state ── */
  const [steps, setSteps] = useState(0);
  const [water, setWater] = useState(0);
  const [sleep, setSleep] = useState(7);
  const [workout, setWorkout] = useState(false);

  /* ── fetch on mount ── */
  useEffect(() => {
    fetchWeather();
    fetchVerse();
  }, [fetchWeather, fetchVerse]);

  /* ── copy handler ── */
  const copyVerse = () => {
    if (!verse) return;
    navigator.clipboard.writeText(`${verse.text} — ${verse.reference}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className={styles.main}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <div className={styles.kicker}>Mission Control</div>
          <h1 className={styles.h1}>Command Center</h1>
          <p className={styles.sub}>All agents. All missions. One view.</p>
        </div>
        <nav className={styles.nav}>
          <a className={styles.navLink} href="/">GA Dock</a>
          <a className={styles.navLink} href="/studio">Studio</a>
          <a className={styles.navLink} href="/apex-athlete">Apex Athlete</a>
          <a className={styles.navLinkActive} href="/command-center">Command Center</a>
        </nav>
      </header>

      {/* 1) Widget Row: Weather + Health + Bible Verse */}
      <section className={styles.widgetRow}>
        {/* Weather Widget */}
        <div className={`${styles.card} ${styles.cardAccentTeal}`}>
          <div className={styles.cardHeader}>
            <h2 className={styles.h2}>Weather — Miami</h2>
          </div>
          {weatherLoading ? (
            <div className={styles.loadingPulse} style={{ padding: "20px 0" }}>
              Loading weather data...
            </div>
          ) : weather ? (
            <>
              <div className={styles.weatherCurrent}>
                <div className={styles.weatherTemp}>{weather.tempF}°F</div>
                <div>
                  <div className={styles.weatherCondition}>{weather.condition}</div>
                  <div className={styles.weatherDetail}>Humidity: {weather.humidity}%</div>
                </div>
              </div>
              <div className={styles.forecastRow}>
                {weather.forecast.map((d) => (
                  <div key={d.day} className={styles.forecastDay}>
                    <div className={styles.forecastDayLabel}>{d.day}</div>
                    <div className={styles.forecastHighLow}>{d.high}° / {d.low}°</div>
                    <div className={styles.forecastCondition}>{d.condition}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ opacity: 0.5, padding: "20px 0" }}>Failed to load weather</div>
          )}
          <div className={styles.btnRow}>
            <button className={styles.btnTeal} onClick={fetchWeather}>
              Refresh
            </button>
            <button
              className={styles.btnTeal}
              onClick={() => window.open("https://wttr.in/Miami", "_blank")}
            >
              Open Full Forecast
            </button>
          </div>
        </div>

        {/* Health Stats */}
        <div className={`${styles.card} ${styles.cardAccentPurple}`}>
          <div className={styles.cardHeader}>
            <h2 className={styles.h2}>Health Stats</h2>
          </div>
          <div className={styles.healthGrid}>
            <div className={styles.healthItem}>
              <div className={styles.healthLabel}>Steps</div>
              <div className={styles.healthValue}>{steps.toLocaleString()}</div>
              <div className={styles.healthControls}>
                <button className={styles.healthBtn} onClick={() => setSteps((s) => Math.max(0, s - 500))}>−</button>
                <button className={styles.healthBtn} onClick={() => setSteps((s) => s + 500)}>+</button>
              </div>
            </div>
            <div className={styles.healthItem}>
              <div className={styles.healthLabel}>Water (glasses)</div>
              <div className={styles.healthValue}>{water}</div>
              <div className={styles.healthControls}>
                <button className={styles.healthBtn} onClick={() => setWater((w) => Math.max(0, w - 1))}>−</button>
                <button className={styles.healthBtn} onClick={() => setWater((w) => w + 1)}>+</button>
              </div>
            </div>
            <div className={styles.healthItem}>
              <div className={styles.healthLabel}>Sleep (hours)</div>
              <div className={styles.healthValue}>{sleep}</div>
              <div className={styles.healthControls}>
                <button className={styles.healthBtn} onClick={() => setSleep((s) => Math.max(0, s - 0.5))}>−</button>
                <button className={styles.healthBtn} onClick={() => setSleep((s) => Math.min(12, s + 0.5))}>+</button>
              </div>
            </div>
            <div className={styles.healthItem}>
              <div className={styles.healthLabel}>Workout</div>
              <div className={styles.healthValue}>{workout ? "Done" : "—"}</div>
              <button
                className={workout ? styles.healthToggleDone : styles.healthToggle}
                onClick={() => setWorkout((w) => !w)}
              >
                {workout ? "✓ Completed" : "Mark Done"}
              </button>
            </div>
          </div>
        </div>

        {/* Daily Bible Verse */}
        <div className={`${styles.card} ${styles.cardAccentYellow}`}>
          <div className={styles.cardHeader}>
            <h2 className={styles.h2}>Daily Verse</h2>
          </div>
          {verseLoading ? (
            <div className={styles.loadingPulse} style={{ padding: "20px 0" }}>
              Loading verse...
            </div>
          ) : verse ? (
            <>
              <p className={styles.verseText}>&ldquo;{verse.text}&rdquo;</p>
              <div className={styles.verseRef}>{verse.reference}</div>
            </>
          ) : (
            <div style={{ opacity: 0.5, padding: "20px 0" }}>Failed to load verse</div>
          )}
          <div className={styles.btnRow}>
            <button className={styles.btnGold} onClick={fetchVerse}>
              New Verse
            </button>
            <button className={styles.btnGold} onClick={copyVerse}>
              Copy
              {copied && <span className={styles.copiedToast}>Copied!</span>}
            </button>
          </div>
        </div>
      </section>

      {/* 2) XP Bar */}
      <div className={styles.xpBar}>
        <div className={styles.xpHeader}>
          <span className={styles.xpLabel}>Mission XP</span>
          <span className={styles.xpLevel}>{xp.level} → {xp.nextTitle}</span>
        </div>
        <div className={styles.xpTrack}>
          <div className={styles.xpFill} style={{ width: `${xpPct}%` }} />
        </div>
        <div className={styles.xpValues}>
          <span>{xp.current.toLocaleString()} XP</span>
          <span>{xp.nextLevel.toLocaleString()} XP</span>
        </div>
      </div>

      {/* 3) Stats */}
      <div className={styles.statsRow}>
        {stats.map((s) => (
          <div key={s.label} className={statAccentClass[s.accent] ?? styles.stat}>
            <div className={styles.statLabel}>{s.label}</div>
            <div className={statValueClass[s.accent] ?? styles.statValue}>{s.value}</div>
            {s.delta && (
              <div className={s.delta.startsWith("+") || s.delta.startsWith("down") ? styles.deltaUp : styles.deltaWarn}>
                {s.delta}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Revenue Tracker */}
      <div className={styles.revenuePanel}>
        <div className={styles.revenueHeader}>
          <h2 className={styles.h2}>Revenue Tracker</h2>
          <span className={styles.muted}>GA + Studio pipeline</span>
        </div>
        <div className={styles.revenueGrid}>
          {revenue.map((r) => (
            <div key={r.label} className={styles.revenueStat}>
              <div className={styles.revenueAmount}>{r.amount}</div>
              <div className={styles.revenueLabel}>{r.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 4) Agent Network */}
      <div className={styles.agentPanel}>
        {agents.map((a) => (
          <div
            key={a.name}
            className={a.status === "active" ? styles.agentCardActive : styles.agentCard}
          >
            <div className={styles.agentHeader}>
              <div className={a.status === "active" ? styles.dotActive : styles.dotIdle} />
              <span className={styles.agentName}>{a.name}</span>
            </div>
            <div className={styles.agentModel}>{a.model}</div>
            <div
              className={
                a.status === "active" ? styles.agentStatusActive : styles.agentStatusIdle
              }
            >
              {a.status}
            </div>
            <div className={styles.agentTask}>{a.task}</div>
          </div>
        ))}
      </div>

      {/* 5) Project cards */}
      <section className={styles.grid}>
        {projects.map((p) => (
          <div key={p.name} className={`${styles.card} ${accentClass[p.accent] ?? ""}`}>
            <div className={styles.cardHeader}>
              <h2 className={styles.h2}>{p.name}</h2>
              <span className={statusClass[p.status] ?? styles.statusBadge}>
                <span className={styles.statusDot} />
                {p.status}
              </span>
            </div>
            <p className={styles.muted} style={{ marginBottom: 10 }}>{p.focus}</p>
            <div style={{ display: "grid", gap: 5 }}>
              {p.tasks.map((t) => (
                <div key={t.text} className={t.done ? styles.checkDone : styles.checkItem}>
                  <div className={t.done ? styles.checkBoxDone : styles.checkBox}>
                    {t.done ? "✓" : ""}
                  </div>
                  <span>{t.text}</span>
                </div>
              ))}
            </div>
            {p.links.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {p.links.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    target={l.href.startsWith("http") ? "_blank" : undefined}
                    rel={l.href.startsWith("http") ? "noreferrer" : undefined}
                    className={styles.code}
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      {/* 6) Activity Feed: Timeline + Quick Access */}
      <section className={styles.grid} style={{ marginTop: 14 }}>
        <div className={styles.card}>
          <h2 className={styles.h2} style={{ marginBottom: 8 }}>Mission Log</h2>
          {timeline.map((t, i) => (
            <div key={i} className={styles.timelineItem}>
              <div className={dotClass[t.dot] ?? styles.timelineDot} />
              <span className={styles.timelineTime}>{t.time}</span>
              <span>{t.text}</span>
            </div>
          ))}
        </div>

        <div className={styles.card}>
          <h2 className={styles.h2} style={{ marginBottom: 12 }}>Quick Access</h2>
          <h3 className={styles.h3}>Local paths</h3>
          {quickPaths.map((p) => (
            <div key={p.label} className={styles.pathRow}>
              <span className={styles.muted}>{p.label}</span>
              <code className={styles.code}>{p.path}</code>
            </div>
          ))}

          <h3 className={styles.h3} style={{ marginTop: 14 }}>Mission progress</h3>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${pct}%` }} />
          </div>
          <p className={styles.note}>
            {doneTasks} of {totalTasks} tasks complete ({pct}%)
          </p>
          <p className={styles.note}>
            Priority: GA products → Studio portfolio → Apex Athlete → Music
          </p>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Command Center v2 — mission control for Ramiche Operations</span>
        <span>No auto-publish · PRs only · Signal-first</span>
      </footer>
    </main>
  );
}
