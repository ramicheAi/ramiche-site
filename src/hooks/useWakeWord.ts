"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Browser wake-word listener powered by the Web Speech API.
 *
 * Continuously listens through the mic and fires `onWake` when any of `hotwords`
 * appears in the rolling transcript. Auto-restarts after Chrome's quiet timeouts
 * and applies a short cooldown to avoid self-trigger loops while the next mic
 * session is starting up.
 *
 * Note: this uses the browser's SpeechRecognition, which on Chrome/Edge streams
 * audio to Google. Keep it opt-in.
 */

type SR =
  | (typeof window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    })
  | undefined;

interface SpeechRecognitionCtor {
  new (): SpeechRecognitionInstance;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<{
    isFinal?: boolean;
    0?: { transcript?: string; confidence?: number };
  }>;
  resultIndex?: number;
}

export type WakeStatus = "idle" | "listening" | "triggered" | "unsupported" | "denied";

export interface UseWakeWordOptions {
  enabled: boolean;
  hotwords?: string[];
  cooldownMs?: number;
  onWake: (phrase: string) => void;
}

export interface UseWakeWordResult {
  status: WakeStatus;
  lastHeard: string;
  supported: boolean;
}

const DEFAULT_HOTWORDS = ["atlas", "hey atlas", "ok atlas", "okay atlas"];

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as SR;
  if (!w) return null;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function matchHotword(text: string, hotwords: string[]): string | null {
  const t = text.toLowerCase();
  for (const w of hotwords) {
    if (t.includes(w)) return w;
  }
  return null;
}

export function useWakeWord(opts: UseWakeWordOptions): UseWakeWordResult {
  const { enabled, onWake } = opts;
  const hotwords = opts.hotwords ?? DEFAULT_HOTWORDS;
  const cooldownMs = opts.cooldownMs ?? 3000;
  const onWakeRef = useRef(onWake);
  useEffect(() => {
    onWakeRef.current = onWake;
  }, [onWake]);

  const [status, setStatus] = useState<WakeStatus>("idle");
  const [lastHeard, setLastHeard] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const lastWakeAtRef = useRef(0);
  const stoppedManuallyRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supported = typeof window !== "undefined" && !!getCtor();

  useEffect(() => {
    if (!supported) {
      setStatus("unsupported");
      return;
    }
    if (!enabled) {
      setStatus("idle");
      stoppedManuallyRef.current = true;
      try {
        recognitionRef.current?.stop();
      } catch {
        /* already stopped */
      }
      recognitionRef.current = null;
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      return;
    }

    stoppedManuallyRef.current = false;
    const Ctor = getCtor();
    if (!Ctor) {
      setStatus("unsupported");
      return;
    }

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    recognitionRef.current = rec;

    rec.onresult = (ev: SpeechRecognitionEventLike) => {
      const start = ev.resultIndex ?? 0;
      let text = "";
      for (let i = start; i < ev.results.length; i++) {
        const r = ev.results[i];
        const alt = r?.[0];
        if (alt?.transcript) text += alt.transcript + " ";
      }
      const trimmed = text.trim();
      if (!trimmed) return;
      setLastHeard(trimmed);
      const hit = matchHotword(trimmed, hotwords);
      if (!hit) return;

      const now = Date.now();
      if (now - lastWakeAtRef.current < cooldownMs) return;
      lastWakeAtRef.current = now;
      setStatus("triggered");
      try {
        onWakeRef.current(hit);
      } catch {
        /* user callback failure shouldn't kill the recogniser */
      }
    };

    rec.onerror = (ev: { error?: string }) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setStatus("denied");
        stoppedManuallyRef.current = true;
      }
    };

    rec.onend = () => {
      if (stoppedManuallyRef.current) return;
      restartTimerRef.current = setTimeout(() => {
        try {
          rec.start();
          setStatus("listening");
        } catch {
          /* if start fails, try again on next tick */
        }
      }, 250);
    };

    try {
      rec.start();
      setStatus("listening");
    } catch {
      setStatus("idle");
    }

    return () => {
      stoppedManuallyRef.current = true;
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, [enabled, supported, cooldownMs, hotwords]);

  useEffect(() => {
    if (status !== "triggered") return;
    const t = setTimeout(() => setStatus(enabled && supported ? "listening" : "idle"), cooldownMs);
    return () => clearTimeout(t);
  }, [status, cooldownMs, enabled, supported]);

  return { status, lastHeard, supported };
}

const _useStableHotwordsHint: typeof DEFAULT_HOTWORDS = DEFAULT_HOTWORDS;
export { _useStableHotwordsHint as DEFAULT_WAKE_HOTWORDS };
