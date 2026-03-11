#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  try {
    const lines = readFileSync(resolve(__dirname, "../.env.local"), "utf-8").split("\n");
    for (const line of lines) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
    }
  } catch {}
}
loadEnv();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data, error } = await sb.from("messages").select("id, content, sender_agent_id, channel_id, created_at").order("created_at", { ascending: false }).limit(10);
if (error) { console.log("ERROR:", JSON.stringify(error)); process.exit(1); }
data.forEach(m => console.log(m.created_at, "|", m.sender_agent_id?.slice(0, 8), "|", m.content?.slice(0, 100)));
process.exit(0);
