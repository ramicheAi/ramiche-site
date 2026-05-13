import { readFile, unlink } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { NextRequest, NextResponse } from "next/server";
import { VOICE_CONFIG } from "@/lib/voice-config";
import { expandVoicePath } from "@/lib/voice-path";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const execFileAsync = promisify(execFile);

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
  return s.replace(/\s+/g, " ").trim().slice(0, 500);
}

export async function POST(req: NextRequest) {
  let outWav: string | null = null;
  try {
    const body = (await req.json()) as { text?: string; voice?: string };
    const rawText = typeof body.text === "string" ? body.text : "";
    const sanitized = sanitizeForVoice(rawText);
    if (!sanitized) {
      return NextResponse.json({ ok: false, error: "No speakable text" }, { status: 400 });
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
