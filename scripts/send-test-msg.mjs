import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, "../.env.local"), "utf-8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();
const sb = createClient(url, key);

// Insert a user message exactly like the UI would
const { data, error } = await sb.from("messages").insert({
  channel_id: "22222222-2222-2222-2222-222222222222",
  sender_user_id: "00000000-0000-0000-0000-000000000001",
  sender_type: "user",
  content: "Bridge test from Atlas - what time is it?",
  tenant_id: "11111111-1111-1111-1111-111111111111",
  attachments: [],
  metadata: {
    targetAgent: undefined,
    channelName: "#general",
    source: "command-center-ui",
  },
}).select();

if (error) {
  console.error("INSERT ERROR:", error);
} else {
  console.log("Message sent:", data[0].id);
}

// Wait 15s for bridge to process, then check for response
console.log("Waiting 15s for bridge response...");
await new Promise(r => setTimeout(r, 15000));

const { data: msgs } = await sb
  .from("messages")
  .select("id, sender_type, sender_agent_id, content, created_at")
  .eq("channel_id", "22222222-2222-2222-2222-222222222222")
  .order("created_at", { ascending: false })
  .limit(5);

console.log("Latest messages:", JSON.stringify(msgs, null, 2));
process.exit(0);
