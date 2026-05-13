"use client";

/**
 * Reusable text-to-speech playback for the Command Center.
 *
 * Tries server-side TTS (sherpa-onnx / Kokoro via `/api/command-center/voice/speak`)
 * first; falls back to the browser's `speechSynthesis` so a JARVIS-style spoken brief
 * still works on Vercel where the local TTS binaries aren't present.
 *
 * Returns a handle with `stop()` so callers can cancel mid-utterance.
 */

export interface VoicePlaybackHandle {
  done: Promise<void>;
  stop: () => void;
}

interface PlayOptions {
  /** Optional Sherpa/Kokoro voice id passed through to the server. */
  voice?: string;
  /** Optional override rate for SpeechSynthesis fallback. */
  rate?: number;
}

export function playVoiceReply(text: string, opts?: PlayOptions): VoicePlaybackHandle {
  const sanitized = text.trim();

  let cancelled = false;
  let audioSource: AudioBufferSourceNode | null = null;
  let audioCtx: AudioContext | null = null;

  const stop = () => {
    cancelled = true;
    try {
      audioSource?.stop();
    } catch {
      /* already stopped */
    }
    audioSource = null;
    try {
      void audioCtx?.close();
    } catch {
      /* ignore */
    }
    audioCtx = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  const done = (async () => {
    if (!sanitized) return;

    try {
      const res = await fetch("/api/command-center/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sanitized, voice: opts?.voice }),
      });
      if (cancelled) return;

      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        const ctx = new AudioContext();
        audioCtx = ctx;
        await ctx.resume().catch(() => {});
        const audioBuf = await ctx.decodeAudioData(buf.slice(0));
        if (cancelled) return;
        const src = ctx.createBufferSource();
        audioSource = src;
        src.buffer = audioBuf;
        src.connect(ctx.destination);
        await new Promise<void>((resolve) => {
          src.onended = () => resolve();
          src.start();
        });
        return;
      }
    } catch {
      /* server TTS unavailable — fall through to browser synth */
    }

    if (cancelled) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const synth = window.speechSynthesis;
    synth.cancel();

    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(sanitized);
      u.rate = opts?.rate ?? 1.02;
      u.pitch = 1.0;
      u.volume = 1.0;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      try {
        synth.speak(u);
      } catch {
        resolve();
      }
    });
  })().catch(() => {
    /* surface as completed; caller decides */
  });

  return { done, stop };
}
