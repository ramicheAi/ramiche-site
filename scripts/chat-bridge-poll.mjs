#!/usr/bin/env node
/**
 * Chat Bridge (Polling) — Supabase ↔ OpenClaw
 *
 * Polls Supabase every 2s for new user messages.
 * Routes to OpenClaw agents via sessions_send on the local gateway.
 * Writes agent responses back to Supabase — browser picks them up via Realtime or next fetch.
 *
 * Usage: node scripts/chat-bridge-poll.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
function loadEnv() {
  try {
    const envPath = resolve(__dirname, "../.env.local");
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const val = match[2].trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch { /* ignore */ }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const RAMON_UUID = "00000000-0000-0000-0000-000000000001";
const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const POLL_INTERVAL = 2000; // 2 seconds

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("[bridge] Missing SUPABASE env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Track last seen timestamp
let lastSeen = new Date().toISOString();

// Agent profile cache
let agentCache = new Map();
let channelCache = new Map();

async function loadCaches() {
  const { data: agents } = await supabase.from("agent_profiles").select("id, name, handle");
  if (agents) {
    agentCache.clear();
    for (const a of agents) {
      agentCache.set(a.id, { name: a.name, handle: (a.handle || a.name).toLowerCase() });
    }
  }
  const { data: channels } = await supabase.from("channels").select("id, name");
  if (channels) {
    channelCache.clear();
    for (const c of channels) channelCache.set(c.id, c.name);
  }
  console.log(`[bridge] Cached ${agentCache.size} agents, ${channelCache.size} channels`);
}

// Route message to agent by @mention or default to atlas
function routeMessage(content) {
  const mention = content.match(/^@(\w+)/i);
  if (mention) {
    const target = mention[1].toLowerCase();
    for (const [, info] of agentCache) {
      if (info.handle === target || info.name.toLowerCase() === target) return info.handle;
    }
  }
  return "atlas";
}

function findAgentUUID(handle) {
  for (const [uuid, info] of agentCache) {
    if (info.handle === handle || info.name.toLowerCase() === handle) return uuid;
  }
  return "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
}

// Send to OpenClaw agent via CLI
function callAgent(agentHandle, message, channelName) {
  return new Promise((resolve) => {
    const args = [
      "agent",
      "--agent", agentHandle,
      "-m", `[Command Center Chat - ${channelName}] ${message}`,
      "--json",
      "--timeout", "120",
    ];
    console.log(`[bridge] → ${agentHandle}: ${message.slice(0, 80)}`);

    execFile("openclaw", args, { timeout: 130_000 }, (err, stdout, stderr) => {
      if (err) {
        console.error(`[bridge] Agent ${agentHandle} error: ${err.message}`);
        resolve(`Agent ${agentHandle} is processing your request. Response will appear shortly.`);
        return;
      }
      try {
        const result = JSON.parse(stdout);
        const reply = result.response || result.reply || result.message || stdout.trim();
        console.log(`[bridge] ← ${agentHandle}: ${String(reply).slice(0, 80)}`);
        resolve(String(reply));
      } catch {
        const text = stdout.trim() || `Message delivered to ${agentHandle}.`;
        console.log(`[bridge] ← ${agentHandle} (raw): ${text.slice(0, 80)}`);
        resolve(text);
      }
    });
  });
}

// Write response to Supabase
async function writeResponse(channelId, agentUUID, content) {
  const { error } = await supabase.from("messages").insert({
    channel_id: channelId,
    sender_agent_id: agentUUID,
    content,
    tenant_id: TENANT_ID,
    attachments: [],
  });
  if (error) {
    console.error("[bridge] Write failed:", error.message);
  } else {
    console.log("[bridge] ✓ Response written to Supabase");
  }
}

// Processing flag to avoid overlap
let processing = false;

async function poll() {
  if (processing) return;
  processing = true;

  try {
    // Fetch new user messages since last poll
    const { data, error } = await supabase
      .from("messages")
      .select("id, channel_id, sender_agent_id, content, created_at")
      .eq("sender_agent_id", RAMON_UUID)
      .gt("created_at", lastSeen)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[bridge] Poll error:", error.message);
      processing = false;
      return;
    }

    if (data && data.length > 0) {
      console.log(`[bridge] Found ${data.length} new message(s)`);

      for (const msg of data) {
        const channelName = channelCache.get(msg.channel_id) || "general";
        const targetHandle = routeMessage(msg.content);
        const targetUUID = findAgentUUID(targetHandle);

        const response = await callAgent(targetHandle, msg.content, channelName);
        await writeResponse(msg.channel_id, targetUUID, response);

        // Update lastSeen to this message's timestamp
        if (msg.created_at > lastSeen) lastSeen = msg.created_at;
      }
    }
  } catch (err) {
    console.error("[bridge] Poll exception:", err.message);
  }

  processing = false;
}

async function main() {
  console.log("[bridge] Starting Chat Bridge (polling mode)");
  console.log(`[bridge] Supabase: ${SUPABASE_URL}`);
  console.log(`[bridge] Gateway: ${GATEWAY_URL}`);
  console.log(`[bridge] Poll interval: ${POLL_INTERVAL}ms`);

  await loadCaches();

  // Start polling
  setInterval(poll, POLL_INTERVAL);

  // Refresh caches every 5 min
  setInterval(loadCaches, 5 * 60 * 1000);

  // Graceful shutdown
  process.on("SIGINT", () => { console.log("\n[bridge] Stopped."); process.exit(0); });
  process.on("SIGTERM", () => { console.log("\n[bridge] Stopped."); process.exit(0); });

  console.log("[bridge] ✓ Running. Polling for new messages...");
}

main().catch((err) => { console.error("[bridge] Fatal:", err); process.exit(1); });
