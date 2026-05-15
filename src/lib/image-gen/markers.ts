/**
 * Shared image-marker processor.
 *
 * Agents are instructed to embed `[GENERATE_IMAGE: <prompt>]` markers inline
 * anywhere they want a rendered image to appear. This module:
 *   1. Extracts every marker from a piece of agent text
 *   2. Dispatches each prompt to /api/command-center/image-gen in parallel
 *   3. Replaces each marker in the text with a short stub
 *   4. Returns the rewritten text + an array of attachments
 *
 * Used by both Phase A (chat/route.ts, regular agent replies) and Phase C
 * (cc-approve-synthesis.ts, approved-deliverable dispatches). Living here
 * means a single update reaches every path that persists agent text.
 *
 * Cap at MAX_IMAGES_PER_REPLY to bound cost from a runaway agent.
 */

const GENERATE_IMAGE_RE = /\[GENERATE_IMAGE:\s*([^\]]+?)\]/g;
const MAX_IMAGES_PER_REPLY = 8;

export type GeneratedAttachment = { url: string; name: string; type: string };

function cleanEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  return raw.replace(/[\s\x00-\x1f\x7f]+$/u, "").replace(/^\s+/u, "") || undefined;
}

/** Resolve the absolute URL of /api/command-center/image-gen. In Vercel we
 *  use VERCEL_URL; locally the loopback. CC_INTERNAL_BASE_URL overrides both
 *  (useful when running inside Docker / behind a tunnel). */
function imageGenEndpoint(): string {
  const base =
    cleanEnv("CC_INTERNAL_BASE_URL") ||
    cleanEnv("VERCEL_URL") ||
    "http://127.0.0.1:3000";
  const root = base.startsWith("http") ? base : `https://${base}`;
  return `${root.replace(/\/$/, "")}/api/command-center/image-gen`;
}

/**
 * Extract markers from `text`, render each one, and return the rewritten
 * text + attachments. Safe to call even if there are no markers (returns
 * the text unchanged with an empty attachments array).
 */
export async function processImageMarkers(
  text: string,
  ownerHint: string
): Promise<{ text: string; attachments: GeneratedAttachment[] }> {
  const matches: Array<{ full: string; prompt: string }> = [];
  let m: RegExpExecArray | null;
  GENERATE_IMAGE_RE.lastIndex = 0;
  while ((m = GENERATE_IMAGE_RE.exec(text)) !== null) {
    matches.push({ full: m[0], prompt: m[1].trim() });
    if (matches.length >= MAX_IMAGES_PER_REPLY) break;
  }
  if (matches.length === 0) return { text, attachments: [] };

  const endpoint = imageGenEndpoint();
  const results = await Promise.all(
    matches.map(async (match, idx) => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: match.prompt,
            agentId: ownerHint,
            filenameHint: `${ownerHint}-${idx + 1}`,
          }),
          signal: AbortSignal.timeout(120_000),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          url?: string;
          providerUsed?: string;
          error?: string;
        };
        if (!res.ok || !data.ok || !data.url) {
          return {
            ok: false as const,
            marker: match.full,
            error: data.error || `HTTP ${res.status}`,
          };
        }
        return {
          ok: true as const,
          marker: match.full,
          url: data.url,
          name: `${ownerHint}-image-${idx + 1}.png`,
        };
      } catch (err) {
        return {
          ok: false as const,
          marker: match.full,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    })
  );

  let out = text;
  const attachments: GeneratedAttachment[] = [];
  for (const r of results) {
    if (r.ok) {
      out = out.replace(r.marker, `*(rendered: ${r.name})*`);
      attachments.push({ url: r.url, name: r.name, type: "image/png" });
    } else {
      out = out.replace(
        r.marker,
        `*[image-gen failed: ${r.error.slice(0, 140)}]*`
      );
    }
  }
  return { text: out, attachments };
}
