import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Lightweight "talk to Atlas" endpoint for the Sanctuary orb voice loop. Unlike
// the full /api/command-center/chat relay (group fan-out + synthesis), this is a
// single fast turn tuned for SPOKEN replies. Uses the local Claude Max proxy.
const PROXY = process.env.CLAUDE_MAX_PROXY_URL || "http://127.0.0.1:3456/v1/chat/completions";

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

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45_000);
    try {
      const res = await fetch(PROXY, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: process.env.ATLAS_MODEL || "claude-sonnet-4-5", stream: false, temperature: 0.7, messages }),
        signal: ctrl.signal,
      });
      if (!res.ok) return NextResponse.json({ error: `atlas upstream ${res.status}` }, { status: 502 });
      const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const reply = (j.choices?.[0]?.message?.content || "").trim();
      if (!reply) return NextResponse.json({ error: "empty reply" }, { status: 502 });
      return NextResponse.json({ reply });
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return NextResponse.json({ error: aborted ? "timeout" : "atlas failed" }, { status: aborted ? 504 : 500 });
  }
}
