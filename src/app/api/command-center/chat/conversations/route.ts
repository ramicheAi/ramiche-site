import { guardProtectedMutation } from "@/lib/server/protected-mutation";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { CC_TENANT_ID, noStoreJson } from "@/lib/server/cockpit-chat-data";
import { getAgent } from "@/lib/agent-registry";
import {
  conversationSlug,
  defaultConversationTitle,
  normalizeTitle,
  listAgentConversations,
} from "@/lib/dm-conversations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** How many times to retry when a generated slug loses the UNIQUE (tenant_id, slug) race. */
const SLUG_ATTEMPTS = 3;

/**
 * Create a new DM conversation with an agent.
 *
 *   POST { agentId: "triage", title?: "Clean control" }  ->  { channel: { id, agent_id, title, … } }
 *
 * The conversation is a plain `channels` row with `type='dm'` and `agent_id` pointing at the agent's registry
 * uuid, so every existing read path (messages, history, search, realtime, unread) keys off its fresh
 * `channel_id` with no further change. It starts with zero messages because nothing is inserted but the row.
 *
 * The client sends a SHORT agent id and never a uuid: the agent identity is resolved server-side from the
 * registry, so a caller cannot point a conversation at an arbitrary uuid or impersonate another agent.
 *
 * Listing is deliberately NOT here. `GET /api/command-center/chat/bootstrap` already returns every channel
 * row with the new columns, which is the data the UI groups by `agent_id`. One source, no redundant route.
 */
export async function POST(req: Request) {
  const guard = await guardProtectedMutation(req);
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return noStoreJson({ channel: null, error: { message: "invalid JSON body" } }, 400);
  }

  const rawAgentId = typeof body.agentId === "string" ? body.agentId.trim() : "";
  const agent = rawAgentId ? getAgent(rawAgentId) : undefined;
  if (!agent || !agent.dmUuid || !agent.channels.includes("cc-chat")) {
    return noStoreJson({ channel: null, error: { message: "unknown chat agent" } }, 400);
  }
  const title = normalizeTitle(body.title);

  const svc = getSupabaseAdmin();
  if (!svc) return noStoreJson({ channel: null, error: { message: "Supabase not configured" } }, 503);

  // Count existing conversations only to pick a sensible default label. A stale count can duplicate a
  // label, never an id, so this needs no locking.
  const { data: existing, error: listErr } = await svc
    .from("channels")
    .select("id, agent_id, title, type, created_at")
    .eq("tenant_id", CC_TENANT_ID)
    .eq("type", "dm")
    .eq("agent_id", agent.dmUuid);
  if (listErr) return noStoreJson({ channel: null, error: { message: "conversation lookup failed" } }, 502);
  const mine = listAgentConversations(
    (existing ?? []).map((r) => ({
      id: r.id as string,
      agentId: r.agent_id as string | null,
      title: r.title as string | null,
      type: r.type as string | null,
      createdAt: r.created_at as string | null,
    })),
    agent.dmUuid,
  );
  const label = title ?? defaultConversationTitle(agent.name, mine.length);

  for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt++) {
    const id = crypto.randomUUID();
    const { data, error } = await svc
      .from("channels")
      .insert({
        id,
        tenant_id: CC_TENANT_ID,
        name: `DM: ${agent.name}`,
        slug: conversationSlug(agent.id, id),
        type: "dm",
        description: `Direct message with ${agent.id}`,
        is_private: true,
        agent_id: agent.dmUuid,
        title: label,
      })
      .select("id, tenant_id, name, slug, type, description, is_private, agent_id, title, last_activity_at, created_at")
      .single();
    if (!error && data) return noStoreJson({ channel: data, error: null }, 201);
    // 23505 = unique_violation. Only the slug can collide (the id is a fresh uuid), so retry with a new one.
    if (!error || error.code !== "23505" || attempt === SLUG_ATTEMPTS - 1) {
      return noStoreJson({ channel: null, error: { message: "conversation create failed" } }, 502);
    }
  }
  return noStoreJson({ channel: null, error: { message: "conversation create failed" } }, 502);
}
