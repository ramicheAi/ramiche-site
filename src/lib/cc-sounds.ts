// /Users/admin/ramiche-site/src/lib/cc-sounds.ts
// Command Center sound system — synthesized in-code via the Web Audio API.
// No asset files: every cue is generated from oscillators + filters, giving a
// clean, unique "Jarvis / cinematic sci-fi" UI voice for notifications & alerts.

type CueName = "dispatch" | "success" | "alert" | "notify" | "boot" | "tap";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

const LS_KEY = "cc-sound-enabled";

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.18; // gentle by default
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** A single shaped tone: frequency sweep + envelope through a filter. */
function tone(opts: {
  start: number; f0: number; f1?: number; dur: number;
  type?: OscillatorType; peak?: number; filter?: number; filterEnd?: number;
}) {
  const c = ctx!;
  const t = c.currentTime + opts.start;
  const osc = c.createOscillator();
  const gain = c.createGain();
  const flt = c.createBiquadFilter();
  flt.type = "lowpass";
  flt.frequency.setValueAtTime(opts.filter ?? 6000, t);
  if (opts.filterEnd) flt.frequency.exponentialRampToValueAtTime(Math.max(80, opts.filterEnd), t + opts.dur);
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.f0, t);
  if (opts.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.f1), t + opts.dur);
  const peak = opts.peak ?? 0.9;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.02, opts.dur * 0.3));
  gain.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
  osc.connect(flt); flt.connect(gain); gain.connect(master!);
  osc.start(t); osc.stop(t + opts.dur + 0.02);
}

const CUES: Record<CueName, () => void> = {
  // Rising two-step blip — "engaging".
  dispatch: () => { tone({ start: 0, f0: 520, f1: 760, dur: 0.09, type: "triangle", peak: 0.7 }); tone({ start: 0.08, f0: 880, f1: 1180, dur: 0.12, type: "triangle", peak: 0.6 }); },
  // Clean ascending major-third chime — "done".
  success: () => { tone({ start: 0, f0: 660, dur: 0.12, type: "sine", peak: 0.7 }); tone({ start: 0.1, f0: 880, dur: 0.16, type: "sine", peak: 0.7 }); tone({ start: 0.22, f0: 1320, dur: 0.22, type: "sine", peak: 0.5 }); },
  // Descending detuned alert — "something needs you".
  alert: () => { tone({ start: 0, f0: 440, f1: 300, dur: 0.18, type: "sawtooth", peak: 0.5, filter: 2200, filterEnd: 700 }); tone({ start: 0.16, f0: 300, f1: 200, dur: 0.22, type: "sawtooth", peak: 0.5, filter: 1800, filterEnd: 500 }); },
  // Soft single notification blip.
  notify: () => { tone({ start: 0, f0: 980, dur: 0.11, type: "sine", peak: 0.55 }); },
  // Cinematic power-up sweep — "boot".
  boot: () => { tone({ start: 0, f0: 180, f1: 1200, dur: 0.6, type: "sawtooth", peak: 0.4, filter: 400, filterEnd: 7000 }); tone({ start: 0.5, f0: 1320, dur: 0.25, type: "sine", peak: 0.4 }); },
  // Tiny UI tick for taps/toggles.
  tap: () => { tone({ start: 0, f0: 1400, dur: 0.04, type: "square", peak: 0.25, filter: 3000 }); },
};

export function initSoundPref() {
  if (typeof window === "undefined") return;
  const v = localStorage.getItem(LS_KEY);
  enabled = v !== "0";
}

export function isSoundEnabled(): boolean { return enabled; }

export function setSoundEnabled(on: boolean) {
  enabled = on;
  if (typeof window !== "undefined") localStorage.setItem(LS_KEY, on ? "1" : "0");
  if (on) play("tap");
}

/** Play a named cue. Safe to call anywhere; no-ops without audio / when muted. */
export function play(cue: CueName) {
  try {
    if (!enabled) return;
    if (!ac()) return;
    CUES[cue]?.();
  } catch {
    /* audio is best-effort */
  }
}
