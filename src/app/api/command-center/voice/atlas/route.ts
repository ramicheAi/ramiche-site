import { NextResponse } from "next/server";
import { CLAUDE_MAX_DEFAULT_URL, executeCompletion, type ChatMessage } from "@/lib/provider-adapter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Lightweight "talk to Atlas" endpoint for the Sanctuary orb voice loop. Unlike
// the full /api/command-center/chat relay (group fan-out + synthesis), this is a
// single fast turn tuned for SPOKEN replies. Uses the local Claude Max proxy.
const PROXY = process.env.CLAUDE_MAX_PROXY_URL || CLAUDE_MAX_DEFAULT_URL;

const ATLAS_SYSTEM = `You are ATLAS — the orchestrator and Operations Lead of Parallax Ventures' AI fleet, and Ramon's chief of staff. You coordinate the agent roster (Mercury on sales, Vee on brand, Kiyosaki on finance, Themis on legal, Nova on fabrication, Proximon on R&D, and the rest) and keep every venture moving.
This is a live SPOKEN voice conversation with Ramon on the Parallax OS home screen. Talk like a sharp, warm, concise chief of staff thinking out loud:
- Keep it SHORT — one to three sentences. No markdown, no bullet lists, no URLs, no code. It will be read aloud.
- Be direct and useful. If he asks for something you can't execute yet, say what you'd line up and who you'd put on it.
- Sound human and natural. Use his name, Ramon, now and then — not every line.`;

interface Turn {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { text?: string; history?: Turn[] };
    const text = (body.text || "").trim();
    if (!text) return NextResponse.json({ error: "no text" }, { status: 400 });

    const history = (Array.isArray(body.history) ? body.history : [])
      .slice(-8)
      .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 2000) }));

    const messages = [{ role: "system", content: ATLAS_SYSTEM }, ...history, { role: "user", content: text.slice(0, 2000) }];

    const r = await executeCompletion({
      provider: "claude-max",
      // Read per request (not at module load), as before.
      model: process.env.ATLAS_MODEL || "claude-sonnet-4-5",
      messages: messages as ChatMessage[],
      sendStreamFalse: true,
      temperature: 0.7,
      timeoutMs: 45_000,
      // AbortError (not TimeoutError): the catch below maps it to a 504.
      timeoutStyle: "abort-controller",
      // URL read at module load; this caller never sent an Authorization header.
      proxy: { url: PROXY, token: null },
      context: { agentId: "atlas", purpose: "voice" },
    });
    if (!r.ok) {
      if (r.kind === "http") return NextResponse.json({ error: `atlas upstream ${r.httpStatus}` }, { status: 502 });
      throw r.error; // reaches the catch below, exactly like a failed fetch/json before
    }
    const reply = ((r.rawContent as string | undefined) || "").trim();
    if (!reply) return NextResponse.json({ error: "empty reply" }, { status: 502 });
    return NextResponse.json({ reply });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return NextResponse.json({ error: aborted ? "timeout" : "atlas failed" }, { status: aborted ? 504 : 500 });
  }
}
