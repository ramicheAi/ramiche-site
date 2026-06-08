"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { InstrumentPage, Panel } from "@/components/command-center/po/Instrument";

/* ══════════════════════════════════════════════════════════════════════════════
   VITALS — Health, Weather, Scripture & Spiritual Dashboard
   ══════════════════════════════════════════════════════════════════════════════ */

interface Weather {
  tempF: string; condition: string; humidity: string; wind: string; feelsLike: string;
  forecast: { day: string; high: string; low: string; cond: string }[];
}
interface Verse { text: string; ref: string; }

const SCHEDULE = [
  { time: "2:30 AM", event: "Night shift build (Atlas)", accent: "#C9A84C" },
  { time: "6:30 AM", event: "AI Self-Improvement Digest", accent: "#00f0ff" },
  { time: "7:00 AM", event: "Daily Scripture & Prayer (Prophets)", accent: "#d4a574" },
  { time: "7:15 AM", event: "Morning Brief Enhanced", accent: "#a855f7" },
  { time: "1:00 PM", event: "Midday Checkpoint", accent: "#22d3ee" },
  { time: "2:00 PM", event: "Social Listening Scan", accent: "#38bdf8" },
  { time: "6:00 PM", event: "Weekly Strategy Review (Fri)", accent: "#f59e0b" },
  { time: "7:00 AM", event: "Competitor Watch (Mon)", accent: "#ef4444" },
  { time: "10:00 PM", event: "End of Day Recap", accent: "#C9A84C" },
];

const noopSubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export default function VitalsPage() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [verse, setVerse] = useState<Verse | null>(null);
  const [copied, setCopied] = useState(false);
  const mounted = useIsClient();

  // Health vitals
  const [steps, setSteps] = useState(0);
  const [waterG, setWaterG] = useState(0);
  const [sleepH, setSleepH] = useState(7);
  const [workedOut, setWorkedOut] = useState(false);
  const [vitalsLoaded, setVitalsLoaded] = useState(false);

  // Spiritual
  const [readingPlan, setReadingPlan] = useState({ book: "Proverbs", chapter: 1, progress: 3 });
  const [prayerFocus, setPrayerFocus] = useState("Discipline & Focus");
  const [spiritualStreak, setSpiritualStreak] = useState(0);
  const [devotionalCheckedIn, setDevotionalCheckedIn] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      // Load vitals (deferred so setState is not synchronous in effect body)
      try {
        const saved = localStorage.getItem("cc-vitals");
        if (saved) {
          const v = JSON.parse(saved) as Record<string, unknown>;
          if (typeof v.steps === "number") setSteps(v.steps);
          if (typeof v.waterG === "number") setWaterG(v.waterG);
          if (typeof v.sleepH === "number") setSleepH(v.sleepH);
          if (typeof v.workedOut === "boolean") setWorkedOut(v.workedOut);
        }
      } catch { /* */ }
      setVitalsLoaded(true);

      try {
        const rp = localStorage.getItem("cc-reading-plan");
        if (rp) setReadingPlan(JSON.parse(rp) as { book: string; chapter: number; progress: number });
      } catch { /* */ }
      try {
        const ss = localStorage.getItem("cc-spiritual-streak");
        if (ss) {
          const { count, lastDate } = JSON.parse(ss) as { count: number; lastDate: string };
          const today = new Date().toDateString();
          const yesterday = new Date(Date.now() - 86400000).toDateString();
          if (lastDate === today || lastDate === yesterday) setSpiritualStreak(count);
          if (lastDate === today) setDevotionalCheckedIn(true);
        }
      } catch { /* */ }

      const focuses = ["Discipline & Focus", "God's Vision for My Life", "Financial Wisdom", "Spiritual Growth", "Health & Strength", "Gratitude & Praise", "Family & Relationships"];
      setPrayerFocus(focuses[new Date().getDay()]);
    });
  }, []);

  useEffect(() => {
    if (!vitalsLoaded) return;
    try { localStorage.setItem("cc-vitals", JSON.stringify({ steps, waterG, sleepH, workedOut })); } catch { /* */ }
  }, [steps, waterG, sleepH, workedOut, vitalsLoaded]);

  const fetchWeather = useCallback(async () => {
    try {
      const r = await fetch("https://wttr.in/FortLauderdale?format=j1");
      const d = await r.json();
      const c = d.current_condition?.[0];
      setWeather({
        tempF: c?.temp_F ?? "--", condition: c?.weatherDesc?.[0]?.value ?? "",
        humidity: c?.humidity ?? "--", wind: `${c?.windspeedMiles ?? "--"} mph`,
        feelsLike: c?.FeelsLikeF ?? "--",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        forecast: (d.weather?.slice(0, 3) ?? []).map((w: any) => ({
          day: new Date(w.date).toLocaleDateString("en", { weekday: "short" }),
          high: w.maxtempF ?? "--", low: w.mintempF ?? "--",
          cond: w.hourly?.[4]?.weatherDesc?.[0]?.value ?? "",
        })),
      });
    } catch { /* */ }
  }, []);

  const fetchVerse = useCallback(async () => {
    try {
      const r = await fetch("https://bible-api.com/?random=verse");
      const d = await r.json();
      setVerse({ text: d.text?.trim() ?? "", ref: d.reference ?? "" });
    } catch { /* */ }
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      void fetchWeather();
      void fetchVerse();
    });
    return () => cancelAnimationFrame(id);
  }, [fetchWeather, fetchVerse]);

  const copyVerse = () => {
    if (!verse) return;
    navigator.clipboard.writeText(`"${verse.text}" — ${verse.ref}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const checkInDevotional = () => {
    const today = new Date().toDateString();
    const newCount = spiritualStreak + (devotionalCheckedIn ? 0 : 1);
    setSpiritualStreak(newCount);
    setDevotionalCheckedIn(true);
    localStorage.setItem("cc-spiritual-streak", JSON.stringify({ count: newCount, lastDate: today }));
    const nextChapter = readingPlan.chapter + 1;
    const maxChapters: Record<string, number> = { Proverbs: 31, Psalms: 150, Genesis: 50, Exodus: 40, Isaiah: 66, Matthew: 28, John: 21, Romans: 16, James: 5, Revelation: 22 };
    const max = maxChapters[readingPlan.book] || 31;
    const newPlan = nextChapter > max
      ? { ...readingPlan, chapter: 1, progress: Math.min(readingPlan.progress + 3, 100) }
      : { ...readingPlan, chapter: nextChapter, progress: Math.min(Math.round((nextChapter / max) * 100), 100) };
    setReadingPlan(newPlan);
    localStorage.setItem("cc-reading-plan", JSON.stringify(newPlan));
  };

  if (!mounted) return null;

  return (
    <InstrumentPage
      id="vitals"
      title="Vitals"
      section="Operations"
      icon="pulse"
      accent="var(--c-cyan)"
    >
        {/* Health Vitals Grid */}
        <Panel title="Health Vitals" icon="pulse">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {[
            { label: "STEPS", value: steps.toLocaleString(), color: "#a855f7", max: 10000, current: steps, onInc: () => setSteps(s => s + 500), onDec: () => setSteps(s => Math.max(0, s - 500)) },
            { label: "WATER", value: `${waterG}`, unit: "glasses", color: "#0ea5e9", max: 8, current: waterG, onInc: () => setWaterG(w => w + 1), onDec: () => setWaterG(w => Math.max(0, w - 1)) },
            { label: "SLEEP", value: `${sleepH}`, unit: "hrs", color: "#f59e0b", max: 10, current: sleepH, onInc: () => setSleepH(s => Math.min(12, s + 0.5)), onDec: () => setSleepH(s => Math.max(0, s - 0.5)) },
          ].map(v => {
            const fillPct = Math.min(100, Math.round((v.current / v.max) * 100));
            return (
              <div key={v.label} style={{ padding: 24, borderRadius: 'var(--r-lg)', background: 'var(--ink-2)', border: '1px solid var(--line)', borderLeft: `3px solid ${v.color}` }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--f-mono)', letterSpacing: '0.2em', color: v.color, marginBottom: 12, textTransform: 'uppercase' }}>{v.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
                  <span style={{ fontSize: 32, fontWeight: 900, color: v.color, lineHeight: 1 }}>{v.value}</span>
                  {v.unit && <span style={{ fontSize: 11, fontFamily: 'var(--f-mono)', color: 'var(--t-mid)' }}>{v.unit}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ flex: 1, height: 4, background: 'var(--line)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${fillPct}%`, height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${v.color}80, ${v.color})`, transition: 'width 0.5s' }} />
                  </div>
                  <span style={{ fontSize: 10, fontFamily: 'var(--f-mono)', color: `${v.color}80` }}>{fillPct}%</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={v.onDec} style={{ flex: 1, height: 36, borderRadius: 'var(--r-sm)', fontSize: 14, fontFamily: 'var(--f-mono)', cursor: 'pointer', background: `${v.color}14`, color: v.color, border: `1px solid ${v.color}33` }}>−</button>
                  <button onClick={v.onInc} style={{ flex: 1, height: 36, borderRadius: 'var(--r-sm)', fontSize: 14, fontFamily: 'var(--f-mono)', cursor: 'pointer', background: `${v.color}14`, color: v.color, border: `1px solid ${v.color}33` }}>+</button>
                </div>
              </div>
            );
          })}
          {/* Workout toggle */}
          <div onClick={() => setWorkedOut(w => !w)} style={{
            padding: 24, borderRadius: 'var(--r-lg)', cursor: 'pointer', transition: 'all 0.3s',
            background: 'var(--ink-2)', border: workedOut ? '2px solid color-mix(in srgb, var(--c-fuchsia) 40%, transparent)' : '1px solid var(--line)',
            borderLeft: '3px solid var(--c-fuchsia)',
          }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--f-mono)', letterSpacing: '0.2em', color: 'var(--c-fuchsia)', marginBottom: 12, textTransform: 'uppercase' }}>WORKOUT</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: workedOut ? 'var(--c-fuchsia)' : 'var(--t-dim)', lineHeight: 1, marginBottom: 8 }}>{workedOut ? "DONE" : "—"}</div>
            <div style={{ fontSize: 11, fontFamily: 'var(--f-mono)', color: workedOut ? 'var(--c-fuchsia)' : 'var(--t-lo)' }}>{workedOut ? "✓ Completed" : "Tap to mark"}</div>
          </div>
        </div>
        </Panel>

        <div style={{ height: 20 }} />

        {/* Scripture + Weather + Schedule Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 20 }}>
          {/* Scripture */}
          <div style={{ padding: 24, borderRadius: 'var(--r-lg)', background: 'var(--ink-1)', border: '1px solid var(--line)', borderLeft: '3px solid var(--c-amber)' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--f-mono)', letterSpacing: '0.2em', color: 'var(--c-amber)', marginBottom: 16, textTransform: 'uppercase' }}>DAILY WORD</div>
            {verse ? (
              <>
                <p style={{ fontSize: 14, color: 'var(--t-hi)', lineHeight: 1.8, fontStyle: 'italic', marginBottom: 8 }}>&ldquo;{verse.text}&rdquo;</p>
                <div style={{ fontSize: 11, fontFamily: 'var(--f-mono)', color: 'var(--c-amber)', marginBottom: 16 }}>— {verse.ref}</div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--t-mid)', fontFamily: 'var(--f-mono)' }}>Loading...</div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={fetchVerse} style={{ padding: '6px 16px', borderRadius: 'var(--r-sm)', fontSize: 10, fontFamily: 'var(--f-mono)', cursor: 'pointer', background: 'color-mix(in srgb, var(--c-amber) 12%, transparent)', color: 'var(--c-amber)', border: '1px solid color-mix(in srgb, var(--c-amber) 25%, transparent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>NEW VERSE</button>
              <button onClick={copyVerse} style={{ padding: '6px 16px', borderRadius: 'var(--r-sm)', fontSize: 10, fontFamily: 'var(--f-mono)', cursor: 'pointer', background: 'var(--ink-2)', color: 'var(--t-mid)', border: '1px solid var(--line)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{copied ? "COPIED" : "COPY"}</button>
            </div>
          </div>

          {/* Weather */}
          <div style={{ padding: 24, borderRadius: 'var(--r-lg)', background: 'var(--ink-1)', border: '1px solid var(--line)', borderLeft: '3px solid var(--c-sky)' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--f-mono)', letterSpacing: '0.2em', color: 'var(--c-sky)', marginBottom: 16, textTransform: 'uppercase' }}>WEATHER · Fort Lauderdale</div>
            {weather ? (
              <>
                <div style={{ fontSize: 48, fontWeight: 900, color: 'var(--c-sky)', lineHeight: 1 }}>{weather.tempF}°</div>
                <div style={{ fontSize: 13, fontFamily: 'var(--f-mono)', color: 'var(--t-mid)', marginTop: 4 }}>Feels like {weather.feelsLike}°F</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t-hi)', marginTop: 8 }}>{weather.condition}</div>
                <div style={{ fontSize: 12, fontFamily: 'var(--f-mono)', color: 'var(--t-mid)', marginTop: 4, display: 'flex', gap: 16 }}>
                  <span>💧 {weather.humidity}%</span>
                  <span>💨 {weather.wind}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 16 }}>
                  {weather.forecast.map(d => (
                    <div key={d.day} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 'var(--r-sm)', background: 'color-mix(in srgb, var(--c-sky) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--c-sky) 12%, transparent)' }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--f-mono)', color: 'var(--c-sky)', textTransform: 'uppercase' }}>{d.day}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-hi)', marginTop: 2 }}>{d.high}°<span style={{ color: 'var(--t-mid)', fontSize: 12 }}>/{d.low}°</span></div>
                      <div style={{ fontSize: 9, color: 'var(--t-mid)', fontFamily: 'var(--f-mono)', marginTop: 2 }}>{d.cond}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--t-mid)', fontFamily: 'var(--f-mono)' }}>Loading...</div>
            )}
          </div>

          {/* Schedule */}
          <div style={{ padding: 24, borderRadius: 'var(--r-lg)', background: 'var(--ink-1)', border: '1px solid var(--line)', borderLeft: '3px solid var(--c-purple)' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--f-mono)', letterSpacing: '0.2em', color: 'var(--c-purple)', marginBottom: 16, textTransform: 'uppercase' }}>DAILY SCHEDULE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {SCHEDULE.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 11, fontFamily: 'var(--f-mono)', width: 64, textAlign: 'right', color: `${s.accent}b0`, flexShrink: 0 }}>{s.time}</span>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.accent, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--t-mid)', fontFamily: 'var(--f-mono)' }}>{s.event}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Spiritual Dashboard */}
        <Panel title="Spiritual Dashboard" icon="spark">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {/* Streak */}
            <div style={{ padding: 24, borderRadius: 'var(--r-lg)', background: 'var(--ink-2)', border: '1px solid var(--line)', borderLeft: '3px solid var(--c-gold)' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--f-mono)', letterSpacing: '0.2em', color: 'var(--c-gold)', marginBottom: 12, textTransform: 'uppercase' }}>DEVOTIONAL STREAK</div>
              <div style={{ fontSize: 48, fontWeight: 900, color: 'var(--c-gold)', lineHeight: 1 }}>{spiritualStreak}</div>
              <div style={{ fontSize: 11, fontFamily: 'var(--f-mono)', color: 'var(--t-mid)', marginTop: 4 }}>consecutive days</div>
              <button onClick={checkInDevotional} disabled={devotionalCheckedIn} style={{
                marginTop: 16, padding: '10px 20px', borderRadius: 'var(--r-sm)', fontSize: 11, fontWeight: 600,
                cursor: devotionalCheckedIn ? 'default' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em',
                background: devotionalCheckedIn ? 'color-mix(in srgb, var(--c-green) 15%, transparent)' : 'color-mix(in srgb, var(--c-gold) 12%, transparent)',
                color: devotionalCheckedIn ? 'var(--c-green)' : 'var(--c-gold)',
                border: devotionalCheckedIn ? '1px solid color-mix(in srgb, var(--c-green) 25%, transparent)' : '1px solid color-mix(in srgb, var(--c-gold) 30%, transparent)',
              }}>{devotionalCheckedIn ? "✓ Checked In Today" : "Check In"}</button>
            </div>
            {/* Reading Plan */}
            <div style={{ padding: 24, borderRadius: 'var(--r-lg)', background: 'var(--ink-2)', border: '1px solid var(--line)', borderLeft: '3px solid var(--c-amber)' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--f-mono)', letterSpacing: '0.2em', color: 'var(--c-amber)', marginBottom: 12, textTransform: 'uppercase' }}>READING PLAN</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--t-hi)' }}>{readingPlan.book} {readingPlan.chapter}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <div style={{ flex: 1, height: 6, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${readingPlan.progress}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, var(--c-amber), var(--c-gold))', transition: 'width 0.5s' }} />
                </div>
                <span style={{ fontSize: 11, fontFamily: 'var(--f-mono)', color: 'var(--c-amber)' }}>{readingPlan.progress}%</span>
              </div>
            </div>
            {/* Prayer Focus */}
            <div style={{ padding: 24, borderRadius: 'var(--r-lg)', background: 'var(--ink-2)', border: '1px solid var(--line)', borderLeft: '3px solid var(--c-purple)' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--f-mono)', letterSpacing: '0.2em', color: 'var(--c-purple)', marginBottom: 12, textTransform: 'uppercase' }}>TODAY&apos;S PRAYER FOCUS</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--t-hi)' }}>{prayerFocus}</div>
              <div style={{ fontSize: 12, fontFamily: 'var(--f-mono)', color: 'var(--t-mid)', marginTop: 8 }}>Rotate daily · {new Date().toLocaleDateString("en", { weekday: "long" })}</div>
            </div>
          </div>
        </Panel>
    </InstrumentPage>
  );
}
