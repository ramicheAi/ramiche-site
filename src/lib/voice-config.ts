/** Client + server safe voice settings (filesystem paths expanded only in API routes). */
export const VOICE_CONFIG = {
  // STT
  sttProvider: "whisper-api" as const,
  whisperApiModel: "whisper-1",
  whisperLocalModel: "base",
  maxRecordingSeconds: 30,
  silenceTimeoutMs: 2000,

  // TTS (tilde expanded server-side; env overrides preferred in production)
  ttsProvider: "sherpa-onnx" as const,
  sherpaOnnxBin: "~/.openclaw/tools/sherpa-onnx-tts/bin/sherpa-onnx-tts",
  sherpaOnnxModelDir:
    "~/.openclaw/tools/sherpa-onnx-tts/models/vits-piper-en_US-lessac-high",
  sherpaOnnxRuntimeDir: "~/.openclaw/tools/sherpa-onnx-tts/runtime",
  kokoroVoice: "am_adam",

  // UI
  enableWaveform: true,
  autoPlayResponse: true,
  showTranscript: true,
} as const;
