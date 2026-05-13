"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VOICE_CONFIG } from "@/lib/voice-config";

export type VoiceState = "idle" | "listening" | "transcribing" | "thinking" | "speaking";

export interface UseVoiceLoopOptions {
  maxRecordingSeconds?: number;
  silenceTimeoutMs?: number;
  autoPlayResponse?: boolean;
  onTranscriptReady: (text: string) => void;
}

export interface UseVoiceLoopResult {
  state: VoiceState;
  transcript: string;
  isActive: boolean;
  startListening: () => void;
  stopListening: () => void;
  cancelVoice: () => void;
  toggleMic: () => void;
  playAgentReply: (text: string) => Promise<void>;
  audioLevel: number;
}

/* ── Web Speech API types (Chrome / Edge / Safari) ─────────────────────── */

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onspeechend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<{
    isFinal?: boolean;
    0?: { transcript?: string };
  }>;
  resultIndex?: number;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function recorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const preferred = "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported(preferred)) return preferred;
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  return undefined;
}

/* ── Hook ──────────────────────────────────────────────────────────────── */

/**
 * Two-mode voice loop:
 *
 *   Primary  : Web Speech API (free, zero-server, works on Vercel + local Mac,
 *              gives live interim transcripts). Chosen first whenever the
 *              browser supports it (Chrome / Edge / Safari 14.1+).
 *   Fallback : MediaRecorder + POST /api/command-center/voice/transcribe
 *              (used on Firefox or any browser without SpeechRecognition).
 *
 * TTS prefers the local sherpa-onnx server endpoint (Mac only). On any
 * failure (e.g. parallaxvinc.com on Vercel where the binary is absent) we
 * fall back to window.speechSynthesis so the loop never goes silent.
 */
export function useVoiceLoop(options: UseVoiceLoopOptions): UseVoiceLoopResult {
  const maxRecordingSeconds = options.maxRecordingSeconds ?? VOICE_CONFIG.maxRecordingSeconds;
  const silenceTimeoutMs = options.silenceTimeoutMs ?? VOICE_CONFIG.silenceTimeoutMs;
  const autoPlayResponse = options.autoPlayResponse ?? VOICE_CONFIG.autoPlayResponse;

  const onTranscriptReadyRef = useRef(options.onTranscriptReady);
  useEffect(() => {
    onTranscriptReadyRef.current = options.onTranscriptReady;
  }, [options.onTranscriptReady]);

  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);

  /* ── Refs for both engines ───────────────────────────────────────────── */
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceAnchorRef = useRef<number>(0);
  const playbackRef = useRef<AudioBufferSourceNode | null>(null);
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const cancelledRef = useRef(false);
  const finishListeningRef = useRef<() => void>(() => {});

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const recognitionFinalRef = useRef("");

  /* ── Cleanup helpers ─────────────────────────────────────────────────── */
  const cleanupAnalyserOnly = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (maxTimerRef.current !== null) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    analyserRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setAudioLevel(0);
  }, []);

  const cleanupRecorderPipeline = useCallback(() => {
    cleanupAnalyserOnly();
    recorderRef.current = null;
    chunksRef.current = [];
  }, [cleanupAnalyserOnly]);

  const cleanupRecognition = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec.onspeechend = null;
      try {
        rec.abort();
      } catch {
        /* already stopped */
      }
    }
    recognitionRef.current = null;
    recognitionFinalRef.current = "";
  }, []);

  const stopPlayback = useCallback(() => {
    try {
      playbackRef.current?.stop();
    } catch {
      /* stopped */
    }
    playbackRef.current = null;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
    speechSynthRef.current = null;
  }, []);

  const cancelVoice = useCallback(() => {
    cancelledRef.current = true;
    stopPlayback();
    try {
      const rec = recorderRef.current;
      if (rec && rec.state === "recording") rec.stop();
    } catch {
      /* ignore */
    }
    cleanupRecognition();
    cleanupRecorderPipeline();
    setState("idle");
    setTranscript("");
  }, [cleanupRecognition, cleanupRecorderPipeline, stopPlayback]);

  /* ── Audio level meter (visual feedback for both engines) ────────────── */
  const startLevelMonitor = useCallback(
    (autoFinishOnSilence: boolean) => {
      const analyser = analyserRef.current;
      if (!analyser) return;
      const data = new Uint8Array(analyser.frequencyBinCount);
      silenceAnchorRef.current = performance.now();

      const tick = () => {
        if (!analyserRef.current) return;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i]! - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setAudioLevel(Math.min(1, rms * 5));

        const now = performance.now();
        if (rms >= 0.01) {
          silenceAnchorRef.current = now;
        } else if (autoFinishOnSilence && now - silenceAnchorRef.current >= silenceTimeoutMs) {
          finishListeningRef.current();
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [silenceTimeoutMs]
  );

  /* ── Engine A: MediaRecorder → POST /transcribe (fallback) ───────────── */
  const startServerRecording = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("idle");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      await ctx.resume().catch(() => {});

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      chunksRef.current = [];
      const mimeType = recorderMimeType();
      const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = rec;

      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      rec.onstop = () => {
        cleanupAnalyserOnly();
        recorderRef.current = null;
        if (cancelledRef.current) {
          chunksRef.current = [];
          return;
        }
        const mime = rec.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];

        void (async () => {
          setState("transcribing");
          try {
            const fd = new FormData();
            fd.append("audio", blob, "voice.webm");
            const res = await fetch("/api/command-center/voice/transcribe", {
              method: "POST",
              body: fd,
            });
            const j = (await res.json().catch(() => null)) as
              | { ok?: boolean; text?: string }
              | null;
            if (!j || !j.ok || typeof j.text !== "string") {
              setState("idle");
              return;
            }
            const t = j.text.trim();
            if (!t) {
              setState("idle");
              return;
            }
            setTranscript(t);
            setState("thinking");
            onTranscriptReadyRef.current(t);
          } catch {
            setState("idle");
          }
        })();
      };

      rec.start(250);
      setState("listening");
      startLevelMonitor(true);

      maxTimerRef.current = setTimeout(() => {
        finishListeningRef.current();
      }, maxRecordingSeconds * 1000);
    } catch {
      cleanupRecorderPipeline();
      setState("idle");
    }
  }, [cleanupAnalyserOnly, cleanupRecorderPipeline, maxRecordingSeconds, startLevelMonitor]);

  /* ── Engine B: Web Speech API (primary) ──────────────────────────────── */
  const startBrowserRecognition = useCallback(async () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      // No SpeechRecognition support — fall back to server upload path
      void startServerRecording();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
      if (stream) {
        streamRef.current = stream;
        const ctx = audioCtxRef.current ?? new AudioContext();
        audioCtxRef.current = ctx;
        await ctx.resume().catch(() => {});
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        analyserRef.current = analyser;
        // Browser SR has its own VAD/end-of-speech — don't double-fire from
        // our analyser, just drive the level meter for the UI.
        startLevelMonitor(false);
      }

      const rec = new Ctor();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = "en-US";
      recognitionRef.current = rec;
      recognitionFinalRef.current = "";

      rec.onresult = (ev: SpeechRecognitionEventLike) => {
        const start = ev.resultIndex ?? 0;
        let interim = "";
        for (let i = start; i < ev.results.length; i++) {
          const r = ev.results[i];
          const alt = r?.[0];
          const text = alt?.transcript ?? "";
          if (!text) continue;
          if (r?.isFinal) {
            recognitionFinalRef.current += text;
          } else {
            interim += text;
          }
        }
        const visible = (recognitionFinalRef.current + interim).trim();
        if (visible) setTranscript(visible);
      };

      rec.onerror = (ev: { error?: string }) => {
        // Common cases:
        //   - "no-speech" → user paused too long; just stop, don't break
        //   - "not-allowed" → permission denied, surface as idle
        //   - "audio-capture" → no mic, also idle
        if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
          cancelledRef.current = true;
        }
      };

      const handleEnd = () => {
        cleanupAnalyserOnly();
        cleanupRecognition();
        if (cancelledRef.current) {
          cancelledRef.current = false;
          setState("idle");
          return;
        }
        const finalText = recognitionFinalRef.current.trim();
        recognitionFinalRef.current = "";
        if (!finalText) {
          setState("idle");
          setTranscript("");
          return;
        }
        setTranscript(finalText);
        setState("thinking");
        onTranscriptReadyRef.current(finalText);
      };

      rec.onend = handleEnd;

      try {
        rec.start();
        setState("listening");
      } catch {
        // Some browsers throw if start() is called too quickly after a stop.
        cleanupRecognition();
        setState("idle");
        return;
      }

      // Hard cap: stop after maxRecordingSeconds so a stuck SR doesn't hold the mic open.
      maxTimerRef.current = setTimeout(() => {
        try {
          recognitionRef.current?.stop();
        } catch {
          /* ignore */
        }
      }, maxRecordingSeconds * 1000);
    } catch {
      cleanupRecognition();
      cleanupAnalyserOnly();
      setState("idle");
    }
  }, [
    cleanupAnalyserOnly,
    cleanupRecognition,
    maxRecordingSeconds,
    startLevelMonitor,
    startServerRecording,
  ]);

  /* ── Public start / stop ─────────────────────────────────────────────── */
  const startListening = useCallback(async () => {
    cancelledRef.current = false;
    stopPlayback();
    cleanupRecorderPipeline();
    cleanupRecognition();

    // Prefer the browser engine when available — zero-server, live transcript,
    // works identically on Vercel and on the Mac.
    if (getSpeechRecognitionCtor()) {
      void startBrowserRecognition();
    } else {
      void startServerRecording();
    }
  }, [
    cleanupRecognition,
    cleanupRecorderPipeline,
    startBrowserRecognition,
    startServerRecording,
    stopPlayback,
  ]);

  const finishListening = useCallback(() => {
    // Browser SR path
    const sr = recognitionRef.current;
    if (sr) {
      try {
        sr.stop();
      } catch {
        /* ignore */
      }
      return;
    }
    // MediaRecorder path
    const rec = recorderRef.current;
    if (rec && rec.state === "recording") {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    finishListeningRef.current = finishListening;
  }, [finishListening]);

  const stopListening = useCallback(() => {
    finishListening();
  }, [finishListening]);

  const toggleMic = useCallback(() => {
    if (state === "idle") void startListening();
    else if (state === "listening") stopListening();
    else cancelVoice();
  }, [cancelVoice, startListening, state, stopListening]);

  /* ── TTS: server (sherpa-onnx) → browser speechSynthesis fallback ────── */
  const speakViaBrowser = useCallback(
    (text: string) =>
      new Promise<boolean>((resolve) => {
        if (typeof window === "undefined" || !window.speechSynthesis) {
          resolve(false);
          return;
        }
        try {
          const utter = new SpeechSynthesisUtterance(text);
          // Prefer a natural-sounding English voice when one is loaded.
          const voices = window.speechSynthesis.getVoices();
          const pick =
            voices.find((v) => /en[-_]US/i.test(v.lang) && /Google|Samantha|Alex|Daniel/i.test(v.name)) ??
            voices.find((v) => /en[-_]US/i.test(v.lang)) ??
            voices.find((v) => /^en/i.test(v.lang)) ??
            null;
          if (pick) utter.voice = pick;
          utter.rate = 1.0;
          utter.pitch = 1.0;
          speechSynthRef.current = utter;
          let settled = false;
          const finish = (ok: boolean) => {
            if (settled) return;
            settled = true;
            speechSynthRef.current = null;
            resolve(ok);
          };
          utter.onend = () => finish(true);
          utter.onerror = () => finish(false);
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utter);
        } catch {
          resolve(false);
        }
      }),
    []
  );

  const playAgentReply = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!autoPlayResponse || !t) {
        setState("idle");
        return;
      }

      setState("speaking");

      // Try server-side TTS first (higher quality sherpa-onnx voice on the Mac).
      let played = false;
      try {
        const res = await fetch("/api/command-center/voice/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: t }),
        });
        if (res.ok) {
          const ct = res.headers.get("content-type") || "";
          // The endpoint returns audio/wav on success; JSON on failure.
          if (ct.startsWith("audio/")) {
            const buf = await res.arrayBuffer();
            const ctx = audioCtxRef.current ?? new AudioContext();
            audioCtxRef.current = ctx;
            await ctx.resume().catch(() => {});
            const audioBuf = await ctx.decodeAudioData(buf.slice(0));
            await new Promise<void>((resolve) => {
              const src = ctx.createBufferSource();
              src.buffer = audioBuf;
              src.connect(ctx.destination);
              playbackRef.current = src;
              src.onended = () => {
                playbackRef.current = null;
                resolve();
              };
              src.start();
            });
            played = true;
          }
        }
      } catch {
        /* fall through to browser synth */
      }

      if (!played) {
        // Server TTS unavailable (e.g. Vercel-hosted parallaxvinc.com — no
        // sherpa-onnx binary). Browser SpeechSynthesis keeps the voice loop
        // alive everywhere; quality is robotic but it WORKS.
        await speakViaBrowser(t);
      }

      setState("idle");
    },
    [autoPlayResponse, speakViaBrowser]
  );

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      stopPlayback();
      cleanupRecognition();
      cleanupRecorderPipeline();
      void audioCtxRef.current?.close().catch(() => {});
    };
  }, [cleanupRecognition, cleanupRecorderPipeline, stopPlayback]);

  // Prime the speech synthesis voice list — some browsers populate it async
  // after the first getVoices() call, so we trigger it on mount.
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.getVoices();
    } catch {
      /* ignore */
    }
  }, []);

  const isActive = state !== "idle";

  return {
    state,
    transcript,
    isActive,
    startListening,
    stopListening,
    cancelVoice,
    toggleMic,
    playAgentReply,
    audioLevel,
  };
}
