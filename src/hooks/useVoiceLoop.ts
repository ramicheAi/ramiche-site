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

function recorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const preferred = "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported(preferred)) return preferred;
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  return undefined;
}

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

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceAnchorRef = useRef<number>(0);
  const playbackRef = useRef<AudioBufferSourceNode | null>(null);
  const cancelledRef = useRef(false);
  const finishListeningRef = useRef<() => void>(() => {});

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

  const stopPlayback = useCallback(() => {
    try {
      playbackRef.current?.stop();
    } catch {
      /* stopped */
    }
    playbackRef.current = null;
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
    cleanupRecorderPipeline();
    setState("idle");
    setTranscript("");
  }, [cleanupRecorderPipeline, stopPlayback]);

  const finishListening = useCallback(() => {
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

  const startLevelMonitor = useCallback(() => {
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
      } else if (now - silenceAnchorRef.current >= silenceTimeoutMs) {
        finishListeningRef.current();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [silenceTimeoutMs]);

  const startListening = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;

    cancelledRef.current = false;
    stopPlayback();
    cleanupRecorderPipeline();

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
            const j = (await res.json()) as { ok?: boolean; text?: string };
            if (!j.ok || typeof j.text !== "string") {
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
      startLevelMonitor();

      maxTimerRef.current = setTimeout(() => {
        finishListeningRef.current();
      }, maxRecordingSeconds * 1000);
    } catch {
      cleanupRecorderPipeline();
      setState("idle");
    }
  }, [
    cleanupAnalyserOnly,
    cleanupRecorderPipeline,
    maxRecordingSeconds,
    startLevelMonitor,
    stopPlayback,
  ]);

  const stopListening = useCallback(() => {
    finishListening();
  }, [finishListening]);

  const toggleMic = useCallback(() => {
    if (state === "idle") void startListening();
    else if (state === "listening") stopListening();
    else cancelVoice();
  }, [cancelVoice, startListening, state, stopListening]);

  const playAgentReply = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!autoPlayResponse || !t) {
        setState("idle");
        return;
      }

      try {
        setState("speaking");
        const res = await fetch("/api/command-center/voice/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: t }),
        });
        if (!res.ok) {
          setState("idle");
          return;
        }

        const buf = await res.arrayBuffer();
        const ctx = audioCtxRef.current ?? new AudioContext();
        audioCtxRef.current = ctx;
        await ctx.resume().catch(() => {});

        const audioBuf = await ctx.decodeAudioData(buf.slice(0));
        const src = ctx.createBufferSource();
        src.buffer = audioBuf;
        src.connect(ctx.destination);
        playbackRef.current = src;
        src.onended = () => {
          playbackRef.current = null;
          setState("idle");
        };
        src.start();
      } catch {
        setState("idle");
      }
    },
    [autoPlayResponse]
  );

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      stopPlayback();
      cleanupRecorderPipeline();
      void audioCtxRef.current?.close().catch(() => {});
    };
  }, [cleanupRecorderPipeline, stopPlayback]);

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
