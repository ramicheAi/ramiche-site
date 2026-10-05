/**
 * P06 M5: where a shadow decision lives. No new schema: a founder command is a `messages` row (sender_type "user",
 * like every founder chat message) in one dedicated tenant channel, with the decision in its metadata. That makes the
 * command a canonical record a Mission can link as `chat_message`.
 *
 * The channel is created on first use (a data row, not schema) and is excluded from the chat channel list, so no one
 * chats in it and no agent ever reads it as conversation history (agent history is loaded per channel).
 * Reads and writes use the service role and are always tenant-filtered.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { CC_USER_ID } from "@/lib/server/cockpit-chat-data";
import type { StoreResult } from "@/lib/missions/types";
import { COMMAND_CHANNEL_SLUG } from "./types";

export type CommandRow = { id: string; channel_id: string; content: string; metadata: Record<string, unknown>; created_at: string };
export type LinkedMission = { id: string; ref: number; state: string; relation: string };

export interface CommandStore {
  /** The tenant's command channel id, created on first use. */
  commandChannel(tenantId: string): Promise<StoreResult<string>>;
  insertCommand(a: { tenantId: string; channelId: string; content: string; metadata: Record<string, unknown> }): Promise<StoreResult<CommandRow>>;
  getCommand(tenantId: string, id: string): Promise<StoreResult<CommandRow | null>>;
  /** Missions of this tenant with a LIVE link to this command message. */
  linkedMissions(tenantId: string, commandId: string): Promise<StoreResult<LinkedMission[]>>;
}

type PgErr = { code?: string; message?: string } | null;
const fail = (e: PgErr): { ok: false; error: { code?: string; message: string } } => ({ ok: false, error: { code: e?.code, message: e?.message ?? "database error" } });
const COLS = "id, channel_id, content, metadata, created_at";

export function supabaseCommandStore(svc: SupabaseClient): CommandStore {
  const findChannel = async (tenantId: string) =>
    svc.from("channels").select("id").eq("tenant_id", tenantId).eq("slug", COMMAND_CHANNEL_SLUG).maybeSingle();
  return {
    async commandChannel(tenantId) {
      const found = await findChannel(tenantId);
      if (found.error) return fail(found.error);
      if (found.data) return { ok: true, data: (found.data as { id: string }).id };
      const made = await svc.from("channels").insert({
        tenant_id: tenantId, name: "Universal Command (shadow)", slug: COMMAND_CHANNEL_SLUG, type: "channel", is_private: true,
        description: "Founder commands and their shadow routing decisions. Nothing here is executed.",
      }).select("id").single();
      if (!made.error) return { ok: true, data: (made.data as { id: string }).id };
      if (made.error.code !== "23505") return fail(made.error);
      // Created concurrently: (tenant_id, slug) is unique, so read the winner.
      const again = await findChannel(tenantId);
      if (again.error || !again.data) return fail(again.error ?? { message: "command channel not found after conflict" });
      return { ok: true, data: (again.data as { id: string }).id };
    },
    async insertCommand(a) {
      const { data, error } = await svc.from("messages").insert({
        tenant_id: a.tenantId, channel_id: a.channelId, content: a.content, sender_type: "user", sender_user_id: CC_USER_ID,
        status: "sent", metadata: a.metadata,
      }).select(COLS).single();
      return error ? fail(error) : { ok: true, data: data as CommandRow };
    },
    async getCommand(tenantId, id) {
      const { data, error } = await svc.from("messages").select(COLS).eq("tenant_id", tenantId).eq("id", id).maybeSingle();
      return error ? fail(error) : { ok: true, data: (data as CommandRow | null) ?? null };
    },
    async linkedMissions(tenantId, commandId) {
      const links = await svc.from("mission_links").select("mission_id, relation")
        .eq("target_type", "chat_message").eq("target_id", commandId).is("removed_at", null).limit(200);
      if (links.error) return fail(links.error);
      const rows = (links.data ?? []) as { mission_id: string; relation: string }[];
      if (rows.length === 0) return { ok: true, data: [] };
      const ms = await svc.from("missions").select("id, ref, state").eq("tenant_id", tenantId).in("id", [...new Set(rows.map((r) => r.mission_id))]);
      if (ms.error) return fail(ms.error);
      const byId = new Map(((ms.data ?? []) as { id: string; ref: number; state: string }[]).map((m) => [m.id, m]));
      return { ok: true, data: rows.flatMap((r) => { const m = byId.get(r.mission_id); return m ? [{ ...m, relation: r.relation }] : []; }).sort((a, b) => b.ref - a.ref) };
    },
  };
}
