/**
 * Agent registry, CLIENT-SAFE core: canonical agent identity only.
 *
 * This module is imported by browser code (chat page, gallery) through
 * `chat-routing.ts` and `cc-agent-dm-uuids.ts`, so it must stay small and contain
 * nothing internal: no persona/system-prompt text, OpenClaw session keys,
 * declared provider/model metadata, skills/capabilities or runtime routing data.
 * Those live in `agent-registry.ts` (server-only), keyed by the `id` defined here.
 *
 * Dependency direction: `agent-registry.ts` imports this file, never the reverse.
 * This file has no imports. A test enforces both.
 */

export type AgentChannel = "cc-chat";

export interface AgentCore {
  /** Canonical, chat-safe id. Matches chat routing and DM UUIDs. */
  readonly id: string;
  /** Key used by /api/command-center/agents and the export (differs only for Dr Strange). */
  readonly directoryId: string;
  readonly aliases: readonly string[];
  readonly name: string;
  readonly status: "active" | "inactive";
  /** Where this agent can be addressed. Empty = not addressable in chat. */
  readonly channels: readonly AgentChannel[];
  readonly dmUuid: string | null;
}

export const AGENT_CORE: readonly AgentCore[] = [
  {
    id: "archivist",
    directoryId: "archivist",
    aliases: [],
    name: "Archivist",
    status: "active",
    channels: [],
    dmUuid: null,
  },
  {
    id: "atlas",
    directoryId: "atlas",
    aliases: [],
    name: "Atlas",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000001-0000-0000-0000-000000000000",
  },
  {
    id: "triage",
    directoryId: "triage",
    aliases: [],
    name: "Triage",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000002-0000-0000-0000-000000000000",
  },
  {
    id: "shuri",
    directoryId: "shuri",
    aliases: [],
    name: "Shuri",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000003-0000-0000-0000-000000000000",
  },
  {
    id: "proximon",
    directoryId: "proximon",
    aliases: [],
    name: "Proximon",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000004-0000-0000-0000-000000000000",
  },
  {
    id: "aetherion",
    directoryId: "aetherion",
    aliases: [],
    name: "Aetherion",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000005-0000-0000-0000-000000000000",
  },
  {
    id: "simons",
    directoryId: "simons",
    aliases: [],
    name: "Simons",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000006-0000-0000-0000-000000000000",
  },
  {
    id: "mercury",
    directoryId: "mercury",
    aliases: [],
    name: "Mercury",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000007-0000-0000-0000-000000000000",
  },
  {
    id: "vee",
    directoryId: "vee",
    aliases: [],
    name: "Vee",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000008-0000-0000-0000-000000000000",
  },
  {
    id: "ink",
    directoryId: "ink",
    aliases: [],
    name: "Ink",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000009-0000-0000-0000-000000000000",
  },
  {
    id: "echo",
    directoryId: "echo",
    aliases: [],
    name: "Echo",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000010-0000-0000-0000-000000000000",
  },
  {
    id: "haven",
    directoryId: "haven",
    aliases: [],
    name: "Haven",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000011-0000-0000-0000-000000000000",
  },
  {
    id: "widow",
    directoryId: "widow",
    aliases: [],
    name: "Widow",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000012-0000-0000-0000-000000000000",
  },
  {
    id: "drstrange",
    directoryId: "dr-strange",
    aliases: ["dr-strange"],
    name: "Dr Strange",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000013-0000-0000-0000-000000000000",
  },
  {
    id: "kiyosaki",
    directoryId: "kiyosaki",
    aliases: [],
    name: "Kiyosaki",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000014-0000-0000-0000-000000000000",
  },
  {
    id: "michael",
    directoryId: "michael",
    aliases: [],
    name: "Michael",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000015-0000-0000-0000-000000000000",
  },
  {
    id: "selah",
    directoryId: "selah",
    aliases: [],
    name: "Selah",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000016-0000-0000-0000-000000000000",
  },
  {
    id: "prophets",
    directoryId: "prophets",
    aliases: [],
    name: "Prophets",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000017-0000-0000-0000-000000000000",
  },
  {
    id: "themaestro",
    directoryId: "themaestro",
    aliases: [],
    name: "TheMAESTRO",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000018-0000-0000-0000-000000000000",
  },
  {
    id: "nova",
    directoryId: "nova",
    aliases: [],
    name: "Nova",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000019-0000-0000-0000-000000000000",
  },
  {
    id: "themis",
    directoryId: "themis",
    aliases: [],
    name: "Themis",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000020-0000-0000-0000-000000000000",
  },
];

/** Ids addressable in CC chat, in registry order. */
export function chatAgentIds(): string[] {
  return AGENT_CORE.filter((a) => a.channels.includes("cc-chat")).map((a) => a.id);
}

/** short id -> DM UUID (chat agents only). */
export function agentDmUuidMap(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of AGENT_CORE) if (a.dmUuid) out[a.id] = a.dmUuid;
  return out;
}
