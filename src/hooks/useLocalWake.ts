"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Privacy-preserving wake word detector.
 *
 * Unlike `useWakeWord` (which streams continuously through Chrome's
 * SpeechRecognition → Google), this hook keeps the mic stream local:
 * - Opens an AnalyserNode and watches RMS energy in real time.
 * - Buffers the last ~3s of audio via MediaRecorder into rolling Blob chunks.
 * - When sustained energy crosses a threshold, snapshots the buffer and POSTs
 *   only that snippet to `/api/command-center/voice/transcribe`.
 * - Matches the transcript against `hotwords` before firing `onWake`.
 *
 * Net effect: audio is sent to Whisper only when you've actually spoken,
 * never as a continuous live stream. Audio level is exposed for a HUD meter.
 */

export type LocalWakeStatus = "idle" | "listening" | "evaluating" | "triggered" | "denied" | "unsupported";

export interface UseLocalWakeOptions {
  enabled: boolean;
  hotwords?: string[];
  cooldownMs?: number;
  energyThreshold?: number;
  sustainMs?: number;
  onWake: (phrase: string) => void;
}

export interface UseLocalWakeResult {
  status: LocalWakeStatus;
  level: number;
  lastHeard: string;
  supported: boolean;
}

const DEFAULT_HOTWORDS = ["atlas", "hey atlas", "ok atlas", "okay atlas"];
const CHUNK_MS = 600;
const BUFFER_CHUNKS = 5;

interface MinimalNav {
  mediaDevices?: { getUserMedia?: (c: MediaStreamConstraints) => Promise<MediaStream> };
}

function getNav(): MinimalNav | null {
  if (typeof navigator === "undefined") return null;
  return navigator as unknown as MinimalNav;
}

function matchHotword(text: string, hotwords: string[]): string | null {
  const t = text.toLowerCase();
  for (const h of hotwords) {
    if (t.includes(h)) return h;
  }
  return null;
}

interface TranscribeResponse {
  text?: string;
}

export function useLocalWake(opts: UseLocalWakeOptions): UseLocalWakeResult {
  const { enabled, onWake } = opts;
  const hotwords = opts.hotwords ?? DEFAULT_HOTWORDS;
  const cooldownMs = opts.cooldownMs ?? 3500;
  const energyThreshold = opts.energyThreshold ?? 0.08;
  const sustainMs = opts.sustainMs ?? 250;

  const onWakeRef = useRef(onWake);
  useEffect(() => {
    onWakeRef.current = onWake;
  }, [onWake]);

  const [status, setStatus] = useState<LocalWakeStatus>("idle");
  const [level, setLevel] = useState(0);
  const [lastHeard, setLastHeard] = useState("");
  const [supported, setSupported] = useState(true);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunkBufferRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const sustainStartRef = useRef<number>(0);
  const lastTriggerAtRef = useRef<number>(0);
  const inFlightRef = useRef<boolean>(false);
  const stoppedRef = useRef<boolean>(false);

  const stopAll = useCallback(() => {
    stoppedRef.current = true;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      recorderRef.current?.stop();
    } catch {
      /* ignore */
    }
    recorderRef.current = null;
    chunkBufferRef.current = [];
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (ctxRef.current) {
      try {
        void ctxRef.current.close();
      } catch {
        /* ignore */
      }
      ctxRef.current = null;
    }
    analyserRef.current = null;
    setLevel(0);
  }, []);

  const evaluateSnapshot = useCallback(async () => {
    if (inFlightRef.current) return;
    if (Date.now() - lastTriggerAtRef.current < cooldownMs) return;

    const buf = [...chunkBufferRef.current];
    if (buf.length === 0) return;

    inFlightRef.current = true;
    setStatus("evaluating");

    const blob = new Blob(buf, { type: buf[0].type || "audio/webm" });
    const form = new FormData();
    form.append("audio", blob, "wake.webm");

    try {
      const res = await fetch("/api/command-center/voice/transcribe", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        setStatus("listening");
        return;
      }
      const data = (await res.json()) as TranscribeResponse;
      const text = (data.text ?? "").trim();
      if (text) setLastHeard(text);
      const hit = matchHotword(text, hotwords);
      if (hit) {
        lastTriggerAtRef.current = Date.now();
        setStatus("triggered");
        try {
          onWakeRef.current(hit);
        } catch {
          /* ignore user callback errors */
        }
      } else {
        setStatus("listening");
      }
    } catch {
      setStatus("listening");
    } finally {
      inFlightRef.current = false;
    }
  }, [cooldownMs, hotwords]);

  useEffect(() => {
    if (status !== "triggered") return;
    const t = setTimeout(() => setStatus("listening"), cooldownMs);
    return () => clearTimeout(t);
  }, [status, cooldownMs]);

  useEffect(() => {
    if (!enabled) {
      stopAll();
      setStatus("idle");
      return;
    }

    const nav = getNav();
    if (!nav?.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setSupported(false);
      setStatus("unsupported");
      return;
    }

    stoppedRef.current = false;
    let cancelled = false;

    (async () => {
      try {
        const stream = await nav.mediaDevices!.getUserMedia!({ audio: true });
        if (cancelled || stoppedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        ctxRef.current = ctx;
        await ctx.resume().catch(() => {});

        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.6;
        src.connect(analyser);
        analyserRef.current = analyser;

        const recorderType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "";
        const recorder = recorderType ? new MediaRecorder(stream, { mimeType: recorderType }) : new MediaRecorder(stream);
        recorderRef.current = recorder;
        chunkBufferRef.current = [];

        recorder.ondataavailable = (e) => {
          if (!e.data || e.data.size === 0) return;
          const buf = chunkBufferRef.current;
          buf.push(e.data);
          if (buf.length > BUFFER_CHUNKS) buf.shift();
        };

        recorder.start(CHUNK_MS);
        setStatus("listening");

        const data = new Uint8Array(analyser.fftSize);
        const tick = () => {
          if (stoppedRef.current) return;
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          setLevel(rms);

          if (rms > energyThreshold) {
            if (sustainStartRef.current === 0) sustainStartRef.current = performance.now();
            const elapsed = performance.now() - sustainStartRef.current;
            if (elapsed >= sustainMs && !inFlightRef.current) {
              sustainStartRef.current = 0;
              void evaluateSnapshot();
            }
          } else {
            sustainStartRef.current = 0;
          }

          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        if (cancelled) return;
        const e = err as { name?: string };
        if (e?.name === "NotAllowedError" || e?.name === "SecurityError") {
          setStatus("denied");
        } else {
          setStatus("idle");
        }
        stopAll();
      }
    })();

    return () => {
      cancelled = true;
      stopAll();
    };
  }, [enabled, energyThreshold, sustainMs, evaluateSnapshot, stopAll]);

  return { status, level, lastHeard, supported };
}
