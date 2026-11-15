import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { ownerOnly } from "@/lib/server/command-center-guard";

async function GET_handler() {
  if (!supabase) {
    return NextResponse.json({ error: "Supabase client is null — env vars missing" });
  }

  const [channels, agents, messages] = await Promise.all([
    supabase.from("channels").select("id,name,slug").order("last_activity_at", { ascending: false }),
    supabase.from("agent_profiles").select("id,name,handle,status").order("name"),
    supabase.from("messages").select("id,channel_id,sender_agent_id,content").order("created_at", { ascending: true }).limit(10),
  ]);

  return NextResponse.json({
    channels: { count: channels.data?.length ?? 0, error: channels.error, sample: channels.data?.[0] },
    agents: { count: agents.data?.length ?? 0, error: agents.error, sample: agents.data?.[0] },
    messages: { count: messages.data?.length ?? 0, error: messages.error, data: messages.data },
  });
}

// Diagnostic route that dumps Command Center chat rows: owner-only.
export const GET = ownerOnly(GET_handler);
