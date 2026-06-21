/**
 * Daily contextual Bible verse — Command Center / Wellness.
 *
 * Requirements (Ramon): a verse every day, NEVER the same one twice, and it must
 * pertain to what he is going through that day.
 *
 * How it works:
 *  - GET  → today's verse (returns the stored one if already chosen today).
 *  - POST { mood } → (re)generate today's verse, optionally steered by his own words.
 *  - "Contextual": we build a short brief from his day (recent jobs + optional mood)
 *    and ask Claude (via the same claude-max proxy the chat route uses) to pick a
 *    verse that genuinely fits — not a generic comfort verse.
 *  - "Never repeats": every previously-used reference is sent as an EXCLUDE list, and
 *    public.daily_verses has unique(verse_date).
 *  - Degrades gracefully: if the proxy is unreachable (e.g. deployed on Vercel),
 *    falls back to a non-repeating public-API verse, then to a sensible default.
 */
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const PROXY_URL = process.env.CLAUDE_MAX_PROXY_URL || "http://127.0.0.1:3456/v1/chat/completions";
const PROXY_TOKEN = process.env.CLAUDE_MAX_PROXY_TOKEN || "not-needed";
const MODEL = process.env.CC_VERSE_MODEL || "claude-sonnet-4-6";

type Verse = {
  reference: string;
  verse_text: string;
  reflection?: string | null;
  context_summary?: string | null;
  verse_date?: string;
  source?: string;
};

// Ramon is in Boca Raton, FL — pin "today" to his timezone so it flips at his midnight.
function todayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

type AdminClient = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

async function gatherContext(admin: AdminClient | null, mood?: string): Promise<string> {
  const bits: string[] = [];
  const dayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York",
  });
  bits.push(`Today is ${dayLabel}.`);
  if (mood && mood.trim()) bits.push(`What's on his heart today, in his own words: "${mood.trim()}".`);
  // Light automatic signal of "what's going on": his most recent work items.
  if (admin) {
    try {
      const { data } = await admin
        .from("jobs")
        .select("title,status,created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      const titles = (data ?? []).map((j: { title?: string }) => j.title).filter(Boolean);
      if (titles.length) bits.push(`Recently he has been working on: ${titles.join("; ")}.`);
    } catch {
      /* jobs table optional */
    }
  }
  bits.push(
    "Ramon is a Christian founder (Parallax Ventures) building several businesses at once — a swim-training platform, a merch brand, music, and an AI agency. He carries a lot, values candor over platitudes, and wants Scripture that meets the actual weight of his day.",
  );
  return bits.join(" ");
}

async function pastReferences(admin: AdminClient | null): Promise<string[]> {
  if (!admin) return [];
  try {
    const { data } = await admin
      .from("daily_verses")
      .select("reference")
      .order("verse_date", { ascending: false })
      .limit(150);
    return (data ?? []).map((r: { reference?: string }) => r.reference).filter(Boolean) as string[];
  } catch {
    return [];
  }
}

async function generateWithClaude(context: string, exclude: string[]): Promise<Verse | null> {
  const system =
    "You are a thoughtful, theologically-careful spiritual companion choosing ONE Bible verse for someone for today. " +
    "Rules: (1) Pick a verse that GENUINELY speaks to what they are going through today — specific, not generic comfort. " +
    "(2) Quote it accurately (ESV or NIV). (3) NEVER choose any reference in the EXCLUDE list. " +
    "(4) Avoid the over-used defaults (Jeremiah 29:11, Philippians 4:13, Proverbs 3:5-6) unless truly the right word. " +
    'Reply ONLY as compact JSON: {"reference":"Book C:V","verse_text":"...","reflection":"1-2 warm sentences, spoken to him, on why this fits today"}';
  const user = `Context for today:\n${context}\n\nEXCLUDE (already given to him): ${exclude.slice(0, 100).join(", ") || "(none yet)"}`;
  try {
    const res = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${PROXY_TOKEN}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.85,
        max_tokens: 500,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const slice = content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
    const parsed = JSON.parse(slice);
    if (parsed?.reference && parsed?.verse_text) {
      return { reference: String(parsed.reference), verse_text: String(parsed.verse_text), reflection: parsed.reflection ?? null, source: "claude" };
    }
    return null;
  } catch {
    return null;
  }
}

async function fallbackVerse(exclude: string[]): Promise<Verse | null> {
  // Used when the proxy is unreachable (e.g. running on Vercel). Random public verse,
  // retried a few times so it still avoids repeats.
  for (let i = 0; i < 6; i++) {
    try {
      const res = await fetch("https://bible-api.com/?random=verse");
      const d = await res.json();
      const ref: string | undefined = d?.reference;
      if (ref && !exclude.includes(ref)) {
        return { reference: ref, verse_text: String(d.text ?? "").trim(), reflection: null, source: "fallback" };
      }
    } catch {
      break;
    }
  }
  return null;
}

async function getOrCreateToday(opts: { mood?: string; force?: boolean }): Promise<Verse> {
  const admin = getSupabaseAdmin();
  const date = todayET();

  // Already chosen today (and not a forced refresh / mood steer)? Return it.
  if (admin && !opts.force && !opts.mood) {
    try {
      const { data } = await admin.from("daily_verses").select("*").eq("verse_date", date).maybeSingle();
      if (data) {
        return {
          reference: data.reference,
          verse_text: data.verse_text,
          reflection: data.reflection,
          context_summary: data.context_summary,
          verse_date: data.verse_date,
          source: "stored",
        };
      }
    } catch {
      /* table may not exist yet — fall through and still serve a verse */
    }
  }

  const exclude = await pastReferences(admin);
  const context = await gatherContext(admin, opts.mood);
  const chosen =
    (await generateWithClaude(context, exclude)) ||
    (await fallbackVerse(exclude)) ||
    ({ reference: "Psalm 46:10", verse_text: "Be still, and know that I am God.", reflection: "Even when the systems get loud, the anchor holds — He is still God of all of it.", source: "default" } as Verse);

  if (admin) {
    try {
      await admin
        .from("daily_verses")
        .upsert(
          {
            verse_date: date,
            reference: chosen.reference,
            verse_text: chosen.verse_text,
            reflection: chosen.reflection ?? null,
            context_summary: context.slice(0, 1200),
            source: chosen.source ?? null,
          },
          { onConflict: "verse_date" },
        );
    } catch {
      /* persistence is best-effort; the verse still shows */
    }
  }

  return { ...chosen, verse_date: date, context_summary: context.slice(0, 1200) };
}

export async function GET() {
  const verse = await getOrCreateToday({});
  return NextResponse.json(verse);
}

export async function POST(req: Request) {
  let mood: string | undefined;
  try {
    const body = await req.json();
    if (typeof body?.mood === "string") mood = body.mood;
  } catch {
    /* no body is fine */
  }
  const verse = await getOrCreateToday({ mood, force: true });
  return NextResponse.json(verse);
}
