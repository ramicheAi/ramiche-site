// /Users/admin/ramiche-site/src/lib/icp-learning.ts
// The learning loop. The prospector used a fixed rotation — it never learned which
// (vertical × city) segments actually convert. This scores every segment from real
// pipeline outcomes and biases tomorrow's sourcing toward proven winners, while
// still exploring (70/20/10 per the Business Bible). Degrades gracefully: with no
// win data yet it leans on qualify-rate; as wins accrue, win-rate dominates.
import { CATEGORIES } from "./prospector";
import { dailyTargets, ICP_CITIES } from "./lead-fit";

export interface SegLead {
  stage?: string | null;
  value?: number | null;
  category?: string | null;
  tags?: string[] | null;
  meta?: { category?: string | null; city?: string | null } | null;
}

export interface SegmentStat {
  vertical: string; // category label as stored on the lead
  city: string;
  sourced: number; researched: number; qualified: number; disqualified: number; won: number;
  wonValue: number;
  qualifyRate: number; // qualified / researched
  deadRate: number;    // disqualified / researched
  winRate: number;     // won / qualified
  score: number;          // 0..100 raw quality
  confidence: number;     // 0..1 by sample size
  effectiveScore: number; // score shrunk toward neutral(50) when data is thin
}

const QUALIFIED = new Set(["qualified", "proposal", "negotiation", "won"]);
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const r1 = (n: number) => Math.round(n * 1000) / 10;

function segOf(l: SegLead): { vertical: string; city: string } {
  const vertical = (l.meta?.category || l.category || l.tags?.[0] || "unknown").trim();
  const city = (l.meta?.city || "unknown").trim();
  return { vertical, city };
}

/** Per-(vertical × city) performance from real pipeline outcomes. */
export function scoreSegments(leads: SegLead[]): SegmentStat[] {
  const acc = new Map<string, { vertical: string; city: string; sourced: number; researched: number; qualified: number; disqualified: number; won: number; wonValue: number }>();
  for (const l of leads) {
    const { vertical, city } = segOf(l);
    if (vertical === "unknown" && city === "unknown") continue;
    const key = `${vertical}||${city}`;
    const s = acc.get(key) || { vertical, city, sourced: 0, researched: 0, qualified: 0, disqualified: 0, won: 0, wonValue: 0 };
    s.sourced++;
    const stage = (l.stage || "lead").toLowerCase();
    if (stage !== "lead") s.researched++;
    if (stage === "lost") s.disqualified++;
    if (QUALIFIED.has(stage)) s.qualified++;
    if (stage === "won") { s.won++; s.wonValue += typeof l.value === "number" ? l.value : 0; }
    acc.set(key, s);
  }
  const out: SegmentStat[] = [];
  for (const s of acc.values()) {
    const qualifyRate = s.researched ? s.qualified / s.researched : 0;
    const deadRate = s.researched ? s.disqualified / s.researched : 0;
    const winRate = s.qualified ? s.won / s.qualified : 0;
    const score = clamp01(0.55 * winRate + 0.45 * qualifyRate) * 100;
    const confidence = clamp01(s.researched / 8); // ~8 researched to trust the signal
    const effectiveScore = score * confidence + 50 * (1 - confidence);
    out.push({ ...s, qualifyRate: r1(qualifyRate), deadRate: r1(deadRate), winRate: r1(winRate), score: Math.round(score), confidence: Math.round(confidence * 100) / 100, effectiveScore: Math.round(effectiveScore) });
  }
  return out;
}

/** Best segments first (effectiveScore, then sample size). */
export function rankSegments(stats: SegmentStat[]): SegmentStat[] {
  return [...stats].sort((a, b) => b.effectiveScore - a.effectiveScore || b.sourced - a.sourced);
}

/**
 * Tomorrow's sourcing targets, biased toward proven winners but still exploring.
 * 70% exploit (winning segments) · 20% adjacent (winning vertical → fresh cities) ·
 * 10%+ explore (the rotation). Always falls back to the rotation when data is thin,
 * so the prospector never breaks.
 */
export function learnedTargets(leads: SegLead[], perDay = 14, dayIndex = 0): { vertical: string; city: string }[] {
  const ranked = rankSegments(scoreSegments(leads));
  const labelToId = new Map(CATEGORIES.map((c) => [c.label.toLowerCase(), c.id]));
  const toId = (label: string) => labelToId.get(label.toLowerCase());

  const out: { vertical: string; city: string }[] = [];
  const seen = new Set<string>();
  const push = (v?: string, c?: string) => {
    if (!v || !c) return;
    const k = `${v}|${c}`;
    if (seen.has(k)) return;
    seen.add(k); out.push({ vertical: v, city: c });
  };

  const exploitN = Math.max(1, Math.round(perDay * 0.7));
  const adjacentN = Math.max(1, Math.round(perDay * 0.2));

  // EXPLOIT — proven winners above neutral, mapped to a searchable vertical id.
  for (const s of ranked) {
    if (out.length >= exploitN) break;
    if (s.effectiveScore <= 50) break; // ranked desc → once neutral, no more proven winners
    push(toId(s.vertical), s.city);
  }

  // ADJACENT — take the single best winning vertical into fresh ICP cities.
  const top = ranked.find((s) => s.effectiveScore > 50 && toId(s.vertical));
  if (top) {
    const tid = toId(top.vertical)!;
    for (const c of ICP_CITIES) {
      if (out.length >= exploitN + adjacentN) break;
      push(tid, c);
    }
  }

  // EXPLORE + FILL — the deterministic rotation guarantees coverage + fresh bets.
  for (const t of dailyTargets(dayIndex, perDay * 2)) {
    if (out.length >= perDay) break;
    push(t.vertical, t.city);
  }

  return out.slice(0, perDay);
}
