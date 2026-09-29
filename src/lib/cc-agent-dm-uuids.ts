import { agentDmUuidMap } from "@/lib/agent-registry";

/**
 * CC Chat — agent short id → UUID used as `sender_agent_id` for agent messages
 * (matches DM channel UUIDs in chat UI).
 */
export const AGENT_DM_UUID: Record<string, string> = agentDmUuidMap();

export const AGENT_UUID_TO_SHORT_ID: Record<string, string> = Object.fromEntries(
  Object.entries(AGENT_DM_UUID).map(([id, uuid]) => [uuid, id])
);
