"use client";

import { Loader2, Mic, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { VoiceState } from "@/hooks/useVoiceLoop";
import { VOICE_CONFIG } from "@/lib/voice-config";

const GOLD = "#C9A84C";
const CYAN = "#00f0ff";

function WaveformBars({
  audioLevel,
  mode,
}: {
  audioLevel: number;
  mode: "listen" | "speak";
}) {
  const bars = 7;
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (mode !== "speak") return;
    let id = 0;
    const loop = () => {
      setPhase((p) => p + 1);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [mode]);

  const color = mode === "listen" ? CYAN : GOLD;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: 3,
        height: 24,
        marginBottom: 4,
      }}
    >
      {Array.from({ length: bars }, (_, i) => {
        const j =
          mode === "speak"
            ? Math.sin(phase / 8 + i * 0.8) * 0.35 + 0.35
            : Math.sin(i * 1.4) * 0.12;
        const level = Math.min(1, audioLevel + j);
        const h = Math.max(4, 6 + level * 18);
        return (
          <div
            key={i}
            style={{
              width: 3,
              height: h,
              borderRadius: 2,
              background: color,
              opacity: 0.75 + level * 0.25,
              transition: "height 90ms ease-out, opacity 90ms ease-out",
              boxShadow: `0 0 ${6 + level * 8}px ${color}55`,
            }}
          />
        );
      })}
    </div>
  );
}

function StateLabel({ state, transcript }: { state: VoiceState; transcript: string }) {
  const lines: Record<VoiceState, string> = {
    idle: "",
    listening: "Listening...",
    transcribing: "Transcribing...",
    thinking: "Atlas is thinking...",
    speaking: "Speaking...",
  };
  const primary = lines[state];
  const showTranscript =
    VOICE_CONFIG.showTranscript &&
    transcript &&
    (state === "thinking" || state === "speaking");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        alignItems: "flex-end",
        maxWidth: 220,
      }}
    >
      {primary ? (
        <span style={{ fontSize: 10, fontWeight: 600, color: "#888888", letterSpacing: "0.04em" }}>
          {primary}
        </span>
      ) : null}
      {showTranscript ? (
        <span
          style={{
            fontSize: 11,
            color: "#e5e5e5",
            textAlign: "right",
            lineHeight: 1.35,
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          {transcript.length > 120 ? `${transcript.slice(0, 117)}…` : transcript}
        </span>
      ) : null}
    </div>
  );
}

export interface VoiceButtonProps {
  state: VoiceState;
  transcript: string;
  audioLevel: number;
  toggleMic: () => void;
}

export function VoiceButton({ state, transcript, audioLevel, toggleMic }: VoiceButtonProps) {
  const isActive = state !== "idle";
  const glow =
    state === "listening"
      ? `0 0 14px ${CYAN}66`
      : state === "speaking"
        ? `0 0 14px ${GOLD}77`
        : state === "thinking"
          ? `0 0 12px ${GOLD}55`
          : `0 0 8px ${GOLD}33`;

  let Icon = Mic;
  if (state === "transcribing") Icon = Loader2;
  else if (state === "speaking") Icon = Volume2;

  const spinning = state === "transcribing";

  return (
    <div
      className="voice-control"
      style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}
    >
      {VOICE_CONFIG.enableWaveform && isActive && (
        <WaveformBars audioLevel={audioLevel} mode={state === "speaking" ? "speak" : "listen"} />
      )}
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
        {isActive && <StateLabel state={state} transcript={transcript} />}
        <button
          type="button"
          aria-label={
            state === "listening"
              ? "Stop recording"
              : state === "idle"
                ? "Voice input"
                : "Cancel voice"
          }
          onClick={() => toggleMic()}
          className="mic-button"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: `2px solid ${GOLD}`,
            background: state === "idle" ? "rgba(255,255,255,0.03)" : "rgba(201,168,76,0.12)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: state === "listening" ? CYAN : GOLD,
            boxShadow: glow,
            transition: "box-shadow 180ms ease, border-color 180ms ease, color 180ms ease",
          }}
        >
          <Icon
            size={17}
            strokeWidth={2}
            className={spinning ? "animate-spin" : undefined}
          />
        </button>
      </div>
    </div>
  );
}
