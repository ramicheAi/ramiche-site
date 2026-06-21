import { readFile, unlink } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { NextRequest, NextResponse } from "next/server";
import { VOICE_CONFIG } from "@/lib/voice-config";
import { expandVoicePath } from "@/lib/voice-path";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const execFileAsync = promisify(execFile);

// Pronunciation fixes applied before TTS — names the voices get wrong (e.g. "Ramon"
// → "rah-MOAN"). Tune LIVE via VOICE_PRONUNCIATION env (JSON map word→respelling)
// + restart, no rebuild needed.
const DEFAULT_PRONUNCIATION: Record<string, string> = { Ramon: "Rah-mawn", "Ramón": "Rah-mawn" };
function loadPronunciation(): Array<[RegExp, string]> {
  let map = { ...DEFAULT_PRONUNCIATION };
  try {
    if (process.env.VOICE_PRONUNCIATION) map = { ...map, ...(JSON.parse(process.env.VOICE_PRONUNCIATION) as Record<string, string>) };
  } catch {
    /* ignore malformed override */
  }
  return Object.entries(map).map(
    ([w, r]) => [new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), r] as [RegExp, string],
  );
}
const PRONUNCIATION = loadPronunciation();
function applyPronunciation(s: string): string {
  let out = s;
  for (const [re, rep] of PRONUNCIATION) out = out.replace(re, rep);
  return out;
}

function sanitizeForVoice(raw: string): string {
  let s = raw;
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/#{1,6}\s+/g, "");
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  s = s.replace(/https?:\/\/\S+/g, " ");
  s = s.replace(/\p{Extended_Pictographic}/gu, "");
  return applyPronunciation(s.replace(/\s+/g, " ").trim()).slice(0, 500);
}

// ── Premium voice (ElevenLabs) — same quality as Mercury's phone voice. ──────
// Gated on ELEVENLABS_API_KEY; without it we fall back to the local sherpa/kokoro
// voices below. Default voice "Brian" (deep, authoritative) for Atlas — distinct
// from Mercury's "Eric". Override per-agent with ELEVENLABS_VOICE_ID or body.voiceId.
const EL_KEY = process.env.ELEVENLABS_API_KEY?.trim();
const EL_DEFAULT_VOICE = process.env.ELEVENLABS_VOICE_ID?.trim() || "nPczCjzI2devNBz1zQrb"; // Brian
const EL_MODEL = process.env.ELEVENLABS_MODEL?.trim() || "eleven_turbo_v2_5";

async function elevenLabsTTS(text: string, voiceId: string): Promise<ArrayBuffer | null> {
  if (!EL_KEY) return null;
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": EL_KEY, "content-type": "application/json", accept: "audio/mpeg" },
        body: JSON.stringify({
          text,
          model_id: EL_MODEL,
          voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
        }),
      },
    );
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return ab.byteLength > 0 ? ab : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let outWav: string | null = null;
  try {
    const body = (await req.json()) as { text?: string; voice?: string; voiceId?: string };
    const rawText = typeof body.text === "string" ? body.text : "";
    const sanitized = sanitizeForVoice(rawText);
    if (!sanitized) {
      return NextResponse.json({ ok: false, error: "No speakable text" }, { status: 400 });
    }

    // Premium voice first (ElevenLabs) when configured; else fall through to local.
    if (EL_KEY) {
      const voiceId = typeof body.voiceId === "string" && body.voiceId.trim() ? body.voiceId.trim() : EL_DEFAULT_VOICE;
      const mp3 = await elevenLabsTTS(sanitized, voiceId);
      if (mp3) {
        return new NextResponse(new Blob([mp3], { type: "audio/mpeg" }), { status: 200 });
      }
      // ElevenLabs failed — degrade gracefully to the local voices.
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    outWav = `/tmp/tts-${id}.wav`;

    const sherpaBin =
      process.env.SHERPA_ONNX_BIN?.trim() || expandVoicePath(VOICE_CONFIG.sherpaOnnxBin);
    const runtimeDir =
      process.env.SHERPA_ONNX_RUNTIME_DIR?.trim() ||
      expandVoicePath(VOICE_CONFIG.sherpaOnnxRuntimeDir);
    const modelDir =
      process.env.SHERPA_ONNX_MODEL_DIR?.trim() ||
      expandVoicePath(VOICE_CONFIG.sherpaOnnxModelDir);

    const sherpaEnv = {
      ...process.env,
      SHERPA_ONNX_RUNTIME_DIR: runtimeDir,
      SHERPA_ONNX_MODEL_DIR: modelDir,
    };

    let generated = false;

    try {
      await execFileAsync(sherpaBin, ["-o", outWav, sanitized], {
        env: sherpaEnv,
        timeout: 25_000,
        maxBuffer: 1024 * 1024,
      });
      generated = true;
    } catch {
      generated = false;
    }

    if (!generated) {
      const kokoroVoice =
        typeof body.voice === "string" && body.voice.trim()
          ? body.voice.trim()
          : VOICE_CONFIG.kokoroVoice;
      try {
        await execFileAsync(
          "infsh",
          ["infer", "kokoro-tts", "--voice", kokoroVoice, "--text", sanitized, "--output", outWav],
          {
            env: process.env,
            timeout: 25_000,
            maxBuffer: 1024 * 1024,
          }
        );
        generated = true;
      } catch {
        generated = false;
      }
    }

    if (!generated || !outWav) {
      return NextResponse.json({ ok: false, error: "Speech synthesis failed" }, { status: 500 });
    }

    const wavBuffer = await readFile(outWav);
    await unlink(outWav).catch(() => {});
    outWav = null;

    return new NextResponse(wavBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(wavBuffer.length),
      },
    });
  } catch (e) {
    console.error("[voice/speak]", e);
    if (outWav) await unlink(outWav).catch(() => {});
    return NextResponse.json({ ok: false, error: "Speech synthesis failed" }, { status: 500 });
  }
}
