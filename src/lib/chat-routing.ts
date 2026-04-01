/**
 * CC Chat routing — @mentions and multi-agent targets (shared by API + UI).
 */

const AGENT_IDS = [
  "atlas",
  "triage",
  "shuri",
  "proximon",
  "aetherion",
  "simons",
  "mercury",
  "vee",
  "ink",
  "echo",
  "haven",
  "widow",
  "drstrange",
  "kiyosaki",
  "michael",
  "selah",
  "prophets",
  "themaestro",
  "nova",
  "themis",
] as const;

export const KNOWN_AGENT_IDS = new Set<string>(AGENT_IDS);

const MAX_PARALLEL_AGENTS = 12;

function normalizeAgentId(id: string): string {
  return String(id).toLowerCase().trim();
}

/** Extract @agent ids from message text (e.g. @shuri @atlas). */
export function parseMentions(text: string): string[] {
  const out: string[] = [];
  const re = /@([a-z][a-z0-9_-]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const id = normalizeAgentId(m[1] ?? "");
    if (KNOWN_AGENT_IDS.has(id)) out.push(id);
  }
  return [...new Set(out)];
}

export function resolveChatTargets(input: {
  mentionedAgents?: string[] | null;
  agentName?: string | null;
  channelMembers?: string[] | null;
}): string[] {
  const { mentionedAgents, agentName, channelMembers } = input;
  if (mentionedAgents && Array.isArray(mentionedAgents) && mentionedAgents.length > 0) {
    const uniq = [
      ...new Set(mentionedAgents.map(normalizeAgentId).filter((id) => KNOWN_AGENT_IDS.has(id))),
    ];
    if (uniq.length > 0) return uniq.slice(0, MAX_PARALLEL_AGENTS);
  }
  if (agentName) {
    const a = normalizeAgentId(agentName);
    return [KNOWN_AGENT_IDS.has(a) ? a : "atlas"];
  }
  if (channelMembers && Array.isArray(channelMembers) && channelMembers.length > 0) {
    const members = [
      ...new Set(channelMembers.map(normalizeAgentId).filter((id) => KNOWN_AGENT_IDS.has(id))),
    ];
    if (members.length > 0) return members.slice(0, MAX_PARALLEL_AGENTS);
  }
  return ["atlas"];
}
