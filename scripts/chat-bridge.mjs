#!/usr/bin/env node
/**
 * Chat Bridge — Supabase ↔ OpenClaw WebSocket Bridge
 *
 * Subscribes to Supabase Realtime (WebSocket) for new messages.
 * When a user message arrives, relays it to the appropriate OpenClaw agent
 * and writes the response back to Supabase.
 *
 * Usage: node scripts/chat-bridge.mjs
 *
 * Env vars (reads from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
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

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
});

// Cache agent profiles: UUID → { name, handle }
let agentCache = new Map();

async function loadAgents() {
  const { data } = await supabase.from("agent_profiles").select("id, name, handle");
  if (data) {
    agentCache.clear();
    for (const a of data) {
      agentCache.set(a.id, { name: a.name, handle: (a.handle || a.name).toLowerCase() });
    }
  }
  console.log(`[bridge] Loaded ${agentCache.size} agent profiles`);
}

// Cache channel info
let channelCache = new Map();

async function loadChannels() {
  const { data } = await supabase.from("channels").select("id, name");
  if (data) {
    channelCache.clear();
    for (const c of data) {
      channelCache.set(c.id, c.name);
    }
  }
  console.log(`[bridge] Loaded ${channelCache.size} channels`);
}

// Map Supabase agent handles → OpenClaw agent IDs
const AGENT_ID_MAP = {
  atlas: "chatbot",
  shuri: "shuri",
  triage: "triage",
  proximon: "proximon",
  vee: "vee",
  ink: "ink",
  echo: "echo",
  haven: "haven",
  nova: "nova",
  widow: "widow",
  mercury: "mercury",
  simons: "simons",
  aetherion: "aetherion",
  themaestro: "maestro",
  themis: "themis",
  kiyosaki: "kiyosaki",
  michael: "swimelite",
  selah: "selah",
  drstrange: "strange",
  prophets: "prophets",
};

// Determine which agent to route a channel message to
function routeMessage(channelName, content) {
  // If message starts with @agentname, route to that agent
  const mention = content.match(/^@(\w+)/i);
  if (mention) {
    const target = mention[1].toLowerCase();
    for (const [, info] of agentCache) {
      if (info.handle === target || info.name.toLowerCase() === target) {
        return info.handle;
      }
    }
  }
  // Default: route to atlas (main)
  return "atlas";
}

// Resolve handle to OpenClaw agent ID
function resolveAgentId(handle) {
  return AGENT_ID_MAP[handle] || handle;
}

// Internal/silent responses that should NOT be written to chat
const SILENT_RESPONSES = new Set(["NO_REPLY", "HEARTBEAT_OK", ""]);

// Send message to OpenClaw agent and get response
function callAgent(agentId, message, channelName) {
  return new Promise((resolve, reject) => {
    const args = [
      "agent",
      "--agent", agentId,
      "-m", `[Command Center Chat - ${channelName}] ${message}`,
      "--timeout", "120",
    ];

    console.log(`[bridge] → ${agentId}: ${message.slice(0, 80)}...`);

    execFile("openclaw", args, { timeout: 130_000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        console.error(`[bridge] Agent ${agentId} error:`, err.message);
        resolve(null); // null = don't write anything
        return;
      }

      // Without --json, openclaw agent outputs the raw agent reply text
      let text = stdout.trim();

      // Try to parse if it looks like JSON (fallback safety)
      if (text.startsWith("{")) {
        try {
          const result = JSON.parse(text);
          const payloads = result?.result?.payloads;
          text = (payloads && payloads.length > 0 && payloads[0]?.text) || "";
        } catch {
          // Not valid JSON — use as-is
        }
      }

      // Filter out silent/internal responses
      if (SILENT_RESPONSES.has(text)) {
        console.log(`[bridge] ← ${agentId}: (silent: "${text}")`);
        resolve(null);
        return;
      }

      if (!text) {
        console.log(`[bridge] ← ${agentId}: (empty response)`);
        resolve(null);
        return;
      }

      console.log(`[bridge] ← ${agentId}: ${text.slice(0, 120)}...`);
      resolve(text);
    });
  });
}

// Write agent response back to Supabase
async function writeResponse(channelId, agentUUID, content) {
  const { error } = await supabase.from("messages").insert({
    channel_id: channelId,
    sender_agent_id: agentUUID,
    content,
    tenant_id: TENANT_ID,
    attachments: [],
  });
  if (error) {
    console.error("[bridge] Failed to write response:", error.message);
  } else {
    console.log("[bridge] Response written to Supabase ✓");
  }
}

// Find agent UUID by handle
function findAgentUUID(handle) {
  for (const [uuid, info] of agentCache) {
    if (info.handle === handle || info.name.toLowerCase() === handle) {
      return uuid;
    }
  }
  // Fallback: atlas
  for (const [uuid, info] of agentCache) {
    if (info.handle === "atlas") return uuid;
  }
  return "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
}

// Track processed message IDs to avoid duplicates
const processed = new Set();

async function handleNewMessage(payload) {
  const msg = payload.new;

  // Skip if not a user message (Ramon)
  // UI writes sender_user_id (not sender_agent_id) for user messages
  const isUserMessage = msg.sender_user_id === RAMON_UUID
    || msg.sender_type === "user"
    || msg.sender_agent_id === RAMON_UUID;
  if (!isUserMessage) return;

  // Skip if already processed
  if (processed.has(msg.id)) return;
  processed.add(msg.id);

  // Prevent memory leak — keep only last 1000 IDs
  if (processed.size > 1000) {
    const arr = [...processed];
    for (let i = 0; i < 500; i++) processed.delete(arr[i]);
  }

  const channelName = channelCache.get(msg.channel_id) || "general";
  const content = msg.content || "";
  const meta = msg.metadata || {};

  console.log(`[bridge] New message in ${channelName}: ${content.slice(0, 80)}`);

  // Route to agent — prefer explicit target from metadata, then parse @mention
  const targetHandle = meta.targetAgent || routeMessage(channelName, content);
  const targetUUID = findAgentUUID(targetHandle);

  // Call agent (resolve handle → OpenClaw agent ID)
  const clawId = resolveAgentId(targetHandle);
  const response = await callAgent(clawId, content, channelName);

  // Only write response if agent returned actual content
  if (response) {
    await writeResponse(msg.channel_id, targetUUID, response);
  } else {
    console.log(`[bridge] Skipping write — no displayable response from ${clawId}`);
  }
}

// Main
async function main() {
  console.log("[bridge] Starting Chat Bridge — Supabase ↔ OpenClaw");
  console.log(`[bridge] Supabase: ${SUPABASE_URL}`);

  await loadAgents();
  await loadChannels();

  // Subscribe to new messages via Supabase Realtime (WebSocket)
  const channel = supabase
    .channel("bridge-messages")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      handleNewMessage
    )
    .subscribe((status) => {
      console.log(`[bridge] Realtime subscription: ${status}`);
      if (status === "SUBSCRIBED") {
        console.log("[bridge] ✓ Listening for new messages via WebSocket");
      }
    });

  // Refresh caches periodically
  setInterval(async () => {
    await loadAgents();
    await loadChannels();
  }, 5 * 60 * 1000);

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n[bridge] Shutting down...");
    supabase.removeChannel(channel);
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\n[bridge] Shutting down...");
    supabase.removeChannel(channel);
    process.exit(0);
  });

  console.log("[bridge] Bridge running. Press Ctrl+C to stop.");
}

main().catch((err) => {
  console.error("[bridge] Fatal:", err);
  process.exit(1);
});
