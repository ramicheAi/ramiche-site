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
console.log("Testing insert...");
const { data, error } = await sb.from("messages").insert({
  channel_id: "33333333-3333-3333-3333-333333333333",
  sender_agent_id: "00000000-0000-0000-0000-000000000001",
  content: "Test from Ramon in #mettle - " + Date.now(),
  tenant_id: "11111111-1111-1111-1111-111111111111",
  attachments: [],
}).select();
if (error) console.log("INSERT ERROR:", JSON.stringify(error, null, 2));
else console.log("INSERT OK:", JSON.stringify(data));
process.exit(0);
