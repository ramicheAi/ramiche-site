# VOICE LOOP — Full Functional Spec for Claude Code

**Project:** Add voice interaction to the RAMICHE Command Center
**Goal:** Speak to Atlas (and any agent), hear spoken responses — like JARVIS
**Repo:** `/Users/admin/ramiche-site/`
**Framework:** Next.js 16.2.4 (App Router), React 19, Tailwind CSS 4, Supabase realtime

---

## WHAT WE'RE BUILDING

A voice interaction loop on the Command Center chat page:

1. User presses mic button (or says wake word — Phase 2)
2. Browser captures audio via MediaRecorder + getUserMedia
3. Audio blob sent to `/api/command-center/voice/transcribe`
4. Server transcribes via OpenAI Whisper API (cloud, fast) with local Whisper CLI fallback
5. Transcribed text routed through existing chat pipeline (`/api/command-center/chat/stream`)
6. Agent response text sent to `/api/command-center/voice/speak`
7. Server generates speech via sherpa-onnx (local, offline, free) with Kokoro/inference.sh fallback for higher quality
8. Audio file returned to browser, auto-played through Web Audio API
9. Animated waveform/pulse visualization during listening + speaking states

---

## EXISTING INFRASTRUCTURE (use these, don't reinvent)

### Chat Pipeline (ALREADY WORKS — do not modify)
- **Chat API:** `src/app/api/command-center/chat/route.ts` (non-streaming)
- **Stream API:** `src/app/api/command-center/chat/stream/route.ts` (SSE streaming)
- **Gateway bridge:** `src/lib/openclaw-gateway.ts` → `POST http://127.0.0.1:24511/tools/invoke`
- **Agent routing:** `src/lib/chat-routing.ts` (20 agents, mention parsing)
- **Agent UUIDs:** `src/lib/cc-agent-dm-uuids.ts`
- **Supabase messages table:** stores all messages with `sender_agent_id`, `content`, `channel_id`

### Voice/Audio Tools (ALREADY INSTALLED)
- **STT (cloud):** OpenAI Whisper API — key in `~/.openclaw/openclaw.json` under `openai-whisper-api.apiKey`
- **STT (local):** `whisper` CLI (Homebrew) — model at `~/.cache/whisper/base.pt`
- **TTS (local, free):** sherpa-onnx — binary at `~/.openclaw/tools/sherpa-onnx-tts/bin/sherpa-onnx-tts`, Piper en_US lessac model
- **TTS (cloud, higher quality):** Kokoro via inference.sh CLI — voices: `af_sarah`, `am_michael`, `am_adam`, `am_echo`, `bf_emma`

### Design System (match exactly)
- BG: `#0a0a0a`, elevated: `#111111`
- Accent purple: `#7c3aed` / `#a855f7`
- Gold (Atlas): `#C9A84C`
- Cyan neon: `#00f0ff`
- Text: `#e5e5e5` primary, `#888888` secondary
- Font: Inter, monospace for code
- Glow animations: `neon-pulse`, `neon-pulse-gold`
- Agent colors defined per-agent in dashboard-agents.ts

---

## FILE PLAN (exact paths)

### New Files to Create

```
src/app/api/command-center/voice/transcribe/route.ts    — STT endpoint
src/app/api/command-center/voice/speak/route.ts          — TTS endpoint
src/components/command-center/VoiceButton.tsx             — Mic button + waveform UI
src/hooks/useVoiceLoop.ts                                 — Voice state machine hook
src/lib/voice-config.ts                                   — Voice feature flags + config
```

### Files to Modify

```
src/app/command-center/chat/page.tsx                      — Add VoiceButton to chat input area
```

---

## IMPLEMENTATION DETAILS

### 1. `src/lib/voice-config.ts`

```typescript
export const VOICE_CONFIG = {
  // STT
  sttProvider: 'whisper-api' as 'whisper-api' | 'whisper-local',
  whisperApiModel: 'whisper-1',
  whisperLocalModel: 'base',
  maxRecordingSeconds: 30,
  silenceTimeoutMs: 2000,

  // TTS
  ttsProvider: 'sherpa-onnx' as 'sherpa-onnx' | 'kokoro',
  sherpaOnnxBin: '~/.openclaw/tools/sherpa-onnx-tts/bin/sherpa-onnx-tts',
  sherpaOnnxModelDir: '~/.openclaw/tools/sherpa-onnx-tts/models/vits-piper-en_US-lessac-high',
  kokoroVoice: 'am_adam',

  // UI
  enableWaveform: true,
  autoPlayResponse: true,
  showTranscript: true,
} as const;
```

### 2. `src/app/api/command-center/voice/transcribe/route.ts`

**Method:** POST
**Input:** `multipart/form-data` with field `audio` (WebM/OGG blob from MediaRecorder)
**Output:** `{ ok: true, text: string, duration: number }`

**Logic:**
1. Receive audio blob from request
2. Write to temp file (`/tmp/voice-${Date.now()}.webm`)
3. **Primary:** Call OpenAI Whisper API:
   ```
   POST https://api.openai.com/v1/audio/transcriptions
   Headers: Authorization: Bearer ${OPENAI_API_KEY}
   Body: model=whisper-1, file=<audio>, response_format=json
   ```
   - Get API key from env `OPENAI_API_KEY` or read from `~/.openclaw/openclaw.json` → `skills.entries.openai-whisper-api.apiKey`
4. **Fallback (if API fails):** Run local whisper CLI:
   ```bash
   whisper /tmp/voice-*.webm --model base --output_format json --output_dir /tmp
   ```
5. Clean up temp files
6. Return `{ ok: true, text: transcribedText, duration: audioDurationMs }`

**Error handling:**
- Empty/silent audio → `{ ok: true, text: "", duration: 0 }`
- API timeout (10s) → fall back to local
- Both fail → `{ ok: false, error: "Transcription failed" }`

**Rate limiting:** None needed (behind PIN gate)
**Max duration:** `export const maxDuration = 30;`

### 3. `src/app/api/command-center/voice/speak/route.ts`

**Method:** POST
**Input:** `{ text: string, voice?: string }`
**Output:** Audio file (WAV) as `audio/wav` response with streaming

**Logic:**
1. Receive text to speak
2. Sanitize: strip markdown formatting, code blocks, URLs, emojis
3. Truncate to first 500 chars if longer (voice responses should be concise)
4. **Primary:** Run sherpa-onnx TTS (local, instant, free):
   ```bash
   ~/.openclaw/tools/sherpa-onnx-tts/bin/sherpa-onnx-tts -o /tmp/tts-${id}.wav "${sanitizedText}"
   ```
   - Binary uses env vars `SHERPA_ONNX_RUNTIME_DIR` and `SHERPA_ONNX_MODEL_DIR`
   - Set these from voice-config.ts values
5. **Fallback (if sherpa fails):** Use Kokoro via inference.sh:
   ```bash
   infsh infer kokoro-tts --voice am_adam --text "${sanitizedText}" --output /tmp/tts-${id}.wav
   ```
6. Read generated WAV file
7. Return as `Response` with:
   - `Content-Type: audio/wav`
   - `Content-Length: <filesize>`
   - Body: WAV file buffer
8. Clean up temp file after streaming

**Max duration:** `export const maxDuration = 30;`

### 4. `src/hooks/useVoiceLoop.ts`

**State machine with 5 states:**

```typescript
type VoiceState = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking';
```

**Hook interface:**
```typescript
interface UseVoiceLoop {
  state: VoiceState;
  transcript: string;       // last transcribed text
  isActive: boolean;        // any non-idle state
  startListening: () => void;
  stopListening: () => void;
  cancelVoice: () => void;
  audioLevel: number;       // 0-1, for waveform visualization (from AnalyserNode)
}
```

**Flow:**
```
idle → [mic press] → listening → [release / silence timeout] → transcribing
  → [text received] → thinking (chat API call happening) → [response received]
  → speaking (audio playing) → [audio ends] → idle
```

**Implementation details:**

1. **listening state:**
   - `navigator.mediaDevices.getUserMedia({ audio: true })`
   - Create `MediaRecorder` with `mimeType: 'audio/webm;codecs=opus'` (fallback to `audio/webm`)
   - Connect to `AnalyserNode` for real-time audio level (feed to `audioLevel`)
   - `ondataavailable` → collect chunks
   - Auto-stop after `maxRecordingSeconds` (30s)
   - Silence detection: if `audioLevel < 0.01` for `silenceTimeoutMs` (2s) → auto-stop

2. **transcribing state:**
   - Create blob from chunks
   - POST to `/api/command-center/voice/transcribe` as FormData
   - On success: set `transcript`, transition to `thinking`
   - On empty text: back to `idle`

3. **thinking state:**
   - The parent component (chat page) handles sending the transcript through the existing chat pipeline
   - Hook exposes `transcript` — parent sends it as a regular chat message
   - Parent calls a callback when agent response arrives

4. **speaking state:**
   - POST agent response text to `/api/command-center/voice/speak`
   - Receive WAV audio
   - Play via `AudioContext` + `decodeAudioData`
   - On playback end → `idle`

5. **cancel at any point:** stops recording, stops playback, returns to `idle`

### 5. `src/components/command-center/VoiceButton.tsx`

**Visual design (match JARVIS aesthetic):**

```
┌─────────────────────────────┐
│  [MIC BUTTON]               │  ← Circular, gold border (#C9A84C)
│                             │
│  ~~~~ waveform ~~~~         │  ← Animated bars when listening
│                             │
│  "Listening..."             │  ← State text
│  "How's the MRR looking?"   │  ← Transcript preview
└─────────────────────────────┘
```

**States:**
- **idle:** Mic icon, subtle gold glow, text "Voice"
- **listening:** Mic icon pulsing, waveform bars animating from `audioLevel`, cyan glow (`#00f0ff`), text "Listening..."
- **transcribing:** Spinner, text "Transcribing..."
- **thinking:** Atlas gold pulse, text "Atlas is thinking..."
- **speaking:** Speaker icon, waveform animating, gold glow, text "Speaking..."

**Component structure:**
```tsx
<div className="voice-control">
  <button onClick={toggle} className="mic-button">
    <MicIcon | LoaderIcon | Volume2Icon />  {/* from lucide-react */}
  </button>
  {isActive && <WaveformBars audioLevel={audioLevel} />}
  {isActive && <StateLabel state={state} transcript={transcript} />}
</div>
```

**WaveformBars:** 5-7 vertical bars, heights driven by `audioLevel` with slight random variation per bar, CSS transition for smooth animation. Colors: cyan (`#00f0ff`) when listening, gold (`#C9A84C`) when speaking.

**Positioning:** Inline with the chat input bar, left of the send button. Waveform + transcript expand above the input area as an overlay when active.

### 6. Integration into Chat Page

**File:** `src/app/command-center/chat/page.tsx`

**Changes needed (minimal):**

1. Import `VoiceButton` and `useVoiceLoop`
2. Add `useVoiceLoop` hook call in the main chat component
3. When `transcript` updates (voice state transitions from `transcribing` to `thinking`):
   - Insert transcript into chat as user message (same flow as typing + send)
   - The existing `handleSend` function handles the rest
4. When agent response arrives AND voice was the input method:
   - Call `/api/command-center/voice/speak` with response text
   - Play audio (handled by the hook)
5. Add `<VoiceButton />` to the input area JSX, next to the existing send button

**Key constraint:** Do NOT refactor the existing chat page. Add voice as an additive layer. The 4,098-line file should gain ~50 lines max. All voice logic lives in the hook and component.

---

## ENV VARS NEEDED

Add to `/Users/admin/ramiche-site/.env.local`:

```env
# Voice Loop
OPENAI_API_KEY=<already in ~/.env — copy from there>
SHERPA_ONNX_BIN=/Users/admin/.openclaw/tools/sherpa-onnx-tts/bin/sherpa-onnx-tts
SHERPA_ONNX_RUNTIME_DIR=/Users/admin/.openclaw/tools/sherpa-onnx-tts/runtime
SHERPA_ONNX_MODEL_DIR=/Users/admin/.openclaw/tools/sherpa-onnx-tts/models/vits-piper-en_US-lessac-high
```

---

## BUILD ORDER

1. `voice-config.ts` — config constants
2. `/api/voice/transcribe/route.ts` — test with curl + audio file
3. `/api/voice/speak/route.ts` — test with curl + text string
4. `useVoiceLoop.ts` — state machine hook
5. `VoiceButton.tsx` — UI component
6. Chat page integration — wire it up
7. End-to-end test — speak → transcribe → agent reply → TTS → playback

---

## TESTING

After each step, verify:

1. **Transcribe endpoint:**
   ```bash
   # Record a test clip first
   curl -X POST http://localhost:3000/api/command-center/voice/transcribe \
     -F "audio=@/tmp/test-audio.webm" | jq
   # Expected: { "ok": true, "text": "hello atlas", "duration": 1500 }
   ```

2. **Speak endpoint:**
   ```bash
   curl -X POST http://localhost:3000/api/command-center/voice/speak \
     -H "Content-Type: application/json" \
     -d '{"text": "Hello Ramon, MRR is looking strong at fifteen thousand."}' \
     --output /tmp/test-tts.wav && afplay /tmp/test-tts.wav
   ```

3. **Full loop:** Open chat page → press mic → speak → verify transcript appears as message → agent responds → audio plays back

---

## WHAT NOT TO DO

- Do NOT install new npm packages for audio recording — browser APIs (`MediaRecorder`, `getUserMedia`, `AudioContext`) handle everything
- Do NOT modify the existing chat API routes — voice adds NEW routes alongside them
- Do NOT refactor the chat page — additive changes only
- Do NOT add ElevenLabs or any paid TTS — sherpa-onnx is local and free
- Do NOT build a wake word system yet — that's Phase 2
- Do NOT over-engineer silence detection — simple threshold + timeout is sufficient
- Do NOT add WebSocket for voice — HTTP POST is fine for this use case

---

## ARCHITECTURE DIAGRAM

```
Browser                          Server (Next.js API)              Local Tools
┌──────────┐                    ┌───────────────────┐             ┌──────────────┐
│ MIC      │──audio blob──────→│ /voice/transcribe  │───────────→│ Whisper API  │
│ BUTTON   │                    │                   │  (fallback) │ whisper CLI  │
│          │←──{ text }────────│                   │←────────────│              │
│          │                    └───────────────────┘             └──────────────┘
│          │
│          │──text──────────→  existing /chat/stream pipeline
│          │←──agent reply──   (no changes needed)
│          │
│          │──{ text }───────→ ┌───────────────────┐             ┌──────────────┐
│ SPEAKER  │                   │ /voice/speak       │───────────→│ sherpa-onnx  │
│          │←──audio/wav──────│                   │  (fallback) │ Kokoro/infsh │
│          │                    └───────────────────┘             └──────────────┘
└──────────┘
```

---

## SUCCESS CRITERIA

- [ ] Can press mic, speak, and see transcript appear in chat
- [ ] Agent responds to voice input identically to typed input
- [ ] Agent response plays back as audio automatically
- [ ] Waveform animates during listening and speaking
- [ ] Works on Chrome, Safari, Firefox (getUserMedia support)
- [ ] No new npm dependencies added
- [ ] Existing text chat continues to work unchanged
- [ ] Voice button visually matches the command center game aesthetic
