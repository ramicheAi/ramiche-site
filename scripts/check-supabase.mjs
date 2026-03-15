import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, "../.env.local"), "utf-8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();
const sb = createClient(url, key);

const { data: channels } = await sb.from("channels").select("id, name, slug");
console.log("CHANNELS:", JSON.stringify(channels, null, 2));

const { data: msgs } = await sb
  .from("messages")
  .select("id, channel_id, sender_type, sender_user_id, sender_agent_id, content, created_at")
  .order("created_at", { ascending: false })
  .limit(10);
console.log("RECENT MESSAGES:", JSON.stringify(msgs, null, 2));

process.exit(0);
