import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, "../.env.local"), "utf-8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();
const sb = createClient(url, key);

const { data: ch } = await sb.from("channels").select("id,name").eq("name", "General");
const channelId = ch?.[0]?.id;
console.log("Channel:", channelId);

const { data, error } = await sb.from("messages").insert({
  channel_id: channelId,
  sender_agent_id: "00000000-0000-0000-0000-000000000001",
  content: "Atlas, confirm you are receiving this from Command Center chat.",
  tenant_id: "11111111-1111-1111-1111-111111111111",
  attachments: [],
}).select();

console.log("Inserted:", data?.[0]?.id, error?.message || "OK");
process.exit(0);
