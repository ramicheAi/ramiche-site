"use client";

/**
 * Daily contextual Bible verse card (Wellness).
 * - GET /api/command-center/wellness/verse → today's verse (chosen once/day, never repeats).
 * - "What's on your heart today?" → POST { mood } → re-chooses a verse that fits his words.
 */
import { useState, useEffect, useCallback } from "react";

interface Verse {
  reference: string;
  verse_text: string;
  reflection?: string | null;
  verse_date?: string;
  source?: string;
}

export default function DailyVerse() {
  const [verse, setVerse] = useState<Verse | null>(null);
  const [loading, setLoading] = useState(true);
  const [mood, setMood] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/command-center/wellness/verse");
      if (r.ok) setVerse(await r.json());
    } catch {
      /* leave empty */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reroll = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/command-center/wellness/verse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood: mood.trim() || undefined }),
      });
      if (r.ok) {
        setVerse(await r.json());
        setMood("");
      }
    } catch {
      /* keep current */
    } finally {
      setBusy(false);
    }
  }, [mood]);

  const dateLabel = (() => {
    try {
      return new Date((verse?.verse_date ?? "") + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "";
    }
  })();

  return (
    <div
      style={{
        position: "relative",
        marginBottom: 20,
        padding: "22px 24px",
        borderRadius: "var(--r-md, 14px)",
        border: "1px solid color-mix(in srgb, var(--c-teal) 28%, transparent)",
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--c-teal) 8%, transparent), color-mix(in srgb, var(--c-amber) 5%, transparent))",
        overflow: "hidden",
      }}
    >
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <span
          className="mono"
          style={{ fontSize: 11, letterSpacing: "0.18em", color: "var(--c-teal)", fontWeight: 600 }}
        >
          ✦ TODAY&apos;S WORD
        </span>
        <span className="mono" style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--t-mid)" }}>
          {dateLabel}
        </span>
      </div>

      {loading ? (
        <p className="mono" style={{ fontSize: 12, color: "var(--t-mid)" }}>Seeking a word for today…</p>
      ) : verse ? (
        <>
          <blockquote
            style={{
              margin: 0,
              fontSize: 21,
              lineHeight: 1.5,
              fontWeight: 400,
              color: "var(--t-hi)",
              fontFamily: "Georgia, 'Times New Roman', serif",
            }}
          >
            &ldquo;{verse.verse_text}&rdquo;
          </blockquote>
          <div
            className="mono"
            style={{ marginTop: 10, fontSize: 12, letterSpacing: "0.12em", color: "var(--c-amber)", fontWeight: 600 }}
          >
            — {verse.reference}
          </div>

          {verse.reflection ? (
            <p
              style={{
                marginTop: 16,
                paddingTop: 14,
                borderTop: "1px solid color-mix(in srgb, var(--t-mid) 18%, transparent)",
                fontSize: 14,
                lineHeight: 1.6,
                color: "var(--t-mid)",
                fontStyle: "italic",
              }}
            >
              {verse.reflection}
            </p>
          ) : null}
        </>
      ) : (
        <p className="mono" style={{ fontSize: 12, color: "var(--t-mid)" }}>
          No verse yet. Tell me what&apos;s on your heart below.
        </p>
      )}

      {/* contextual re-roll */}
      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <input
          value={mood}
          onChange={(e) => setMood(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !busy) reroll();
          }}
          placeholder="What's on your heart today?"
          style={{
            flex: 1,
            padding: "9px 12px",
            fontSize: 13,
            color: "var(--t-hi)",
            background: "color-mix(in srgb, var(--ink, #0c0c14) 60%, transparent)",
            border: "1px solid color-mix(in srgb, var(--c-teal) 22%, transparent)",
            borderRadius: "var(--r-sm, 8px)",
            outline: "none",
          }}
        />
        <button
          onClick={reroll}
          disabled={busy}
          className="mono"
          style={{
            padding: "9px 16px",
            fontSize: 11,
            letterSpacing: "0.1em",
            fontWeight: 600,
            color: busy ? "var(--t-mid)" : "var(--c-teal)",
            background: "color-mix(in srgb, var(--c-teal) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--c-teal) 30%, transparent)",
            borderRadius: "var(--r-sm, 8px)",
            cursor: busy ? "default" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {busy ? "SEEKING…" : "FIND MY VERSE"}
        </button>
      </div>
    </div>
  );
}
