import { readFile, unlink, writeFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { NextRequest, NextResponse } from "next/server";
import { VOICE_CONFIG } from "@/lib/voice-config";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const execFileAsync = promisify(execFile);

async function resolveOpenAiApiKey(): Promise<string | null> {
  const env = process.env.OPENAI_API_KEY?.trim();
  if (env && env !== "not-needed") return env;
  try {
    const p = join(homedir(), ".openclaw", "openclaw.json");
    const raw = await readFile(p, "utf8");
    const j = JSON.parse(raw) as {
      env?: { vars?: { OPENAI_API_KEY?: string } };
      skills?: { entries?: { "openai-whisper-api"?: { apiKey?: string } } };
    };
    const k =
      j.skills?.entries?.["openai-whisper-api"]?.apiKey?.trim() ||
      j.env?.vars?.OPENAI_API_KEY?.trim();
    if (k && k !== "not-needed") return k;
  } catch {
    /* optional file */
  }
  return null;
}

async function transcribeOpenAi(audioPath: string, apiKey: string): Promise<string | null> {
  const buf = await readFile(audioPath);
  const form = new FormData();
  form.append("model", VOICE_CONFIG.whisperApiModel);
  form.append("file", new File([buf], "audio.webm", { type: "audio/webm" }));

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { text?: string };
    return typeof data.text === "string" ? data.text.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function transcribeLocalWhisper(audioPath: string): Promise<{ text: string; durationMs: number } | null> {
  try {
    await execFileAsync(
      "whisper",
      [
        audioPath,
        "--model",
        VOICE_CONFIG.whisperLocalModel,
        "--output_format",
        "json",
        "--output_dir",
        "/tmp",
      ],
      { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 }
    );
  } catch {
    return null;
  }
  const baseName = audioPath.replace(/^.*\//, "").replace(/\.[^.]+$/, "");
  const jsonPath = `/tmp/${baseName}.json`;
  try {
    const raw = await readFile(jsonPath, "utf8");
    const j = JSON.parse(raw) as { text?: string; segments?: { end?: number }[] };
    const text = (j.text ?? "").trim();
    let durationMs = 0;
    if (j.segments && j.segments.length > 0) {
      const end = j.segments[j.segments.length - 1]?.end;
      if (typeof end === "number") durationMs = Math.round(end * 1000);
    }
    await unlink(jsonPath).catch(() => {});
    return { text, durationMs };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let tmpAudio: string | null = null;
  try {
    const fd = await req.formData();
    const audio = fd.get("audio");
    if (!(audio instanceof Blob)) {
      return NextResponse.json({ ok: false, error: "Missing audio field" }, { status: 400 });
    }

    const buf = Buffer.from(await audio.arrayBuffer());
    if (buf.length < 512) {
      return NextResponse.json({ ok: true, text: "", duration: 0 });
    }

    tmpAudio = `/tmp/voice-${Date.now()}.webm`;
    await writeFile(tmpAudio, buf);

    const apiKey = await resolveOpenAiApiKey();
    let text = "";
    let duration = 0;

    if (apiKey) {
      const apiText = await transcribeOpenAi(tmpAudio, apiKey);
      if (apiText !== null) {
        text = apiText;
      }
    }

    if (!text) {
      const local = await transcribeLocalWhisper(tmpAudio);
      if (local) {
        text = local.text;
        duration = local.durationMs;
      } else {
        await unlink(tmpAudio).catch(() => {});
        tmpAudio = null;
        return NextResponse.json({ ok: false, error: "Transcription failed" });
      }
    }

    await unlink(tmpAudio).catch(() => {});
    tmpAudio = null;

    return NextResponse.json({ ok: true, text, duration });
  } catch (e) {
    console.error("[voice/transcribe]", e);
    if (tmpAudio) await unlink(tmpAudio).catch(() => {});
    return NextResponse.json({ ok: false, error: "Transcription failed" }, { status: 500 });
  }
}
