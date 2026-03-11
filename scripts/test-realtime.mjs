import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Load env
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
const vars = {};
for (const line of env.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) vars[m[1].trim()] = m[2].trim();
}

const sb = createClient(vars.NEXT_PUBLIC_SUPABASE_URL, vars.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Get first channel ID
const { data: ch } = await sb.from("channels").select("id").limit(1).single();
const channelId = ch?.id;
console.log("Channel ID:", channelId);

const sub = sb
  .channel("test-rt")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
    console.log("REALTIME GOT:", JSON.stringify(payload.new).slice(0, 200));
    sb.removeChannel(sub);
    process.exit(0);
  })
  .subscribe((status) => {
    console.log("Subscription status:", status);
    if (status === "SUBSCRIBED") {
      console.log("Realtime SUBSCRIBED — inserting test message...");
      sb.from("messages").insert({
        channel_id: channelId,
        sender_agent_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        content: "Bridge realtime test " + Date.now(),
        tenant_id: "11111111-1111-1111-1111-111111111111",
        attachments: [],
      }).then((r) => console.log("Insert:", r.error ? r.error.message : "OK"));
    }
  });

setTimeout(() => {
  console.log("TIMEOUT — Supabase Realtime may not be enabled on messages table");
  console.log("Enable it in Supabase Dashboard > Database > Replication > messages table");
  process.exit(1);
}, 15000);
