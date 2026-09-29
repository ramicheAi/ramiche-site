# P06 Packet 1: Canonical Agent Registry

Source of truth: `src/lib/agent-registry-core.ts` (client-safe identity) joined by id with
`src/lib/agent-registry.ts` (server-only details). Base: `origin/main` at `42e3921`.

## Client-safe / server-only boundary

| Module | Contains | Imported by |
|---|---|---|
| `agent-registry-core.ts` | id, directoryId, aliases, name, status, channels, DM UUID | client code (via `chat-routing.ts`, `cc-agent-dm-uuids.ts`) and server |
| `agent-registry.ts` | persona text, OpenClaw session keys, runtime tier, declared provider/model, skills/capabilities, escalation | server only |

The core has no imports; the server module imports the core, never the reverse. The server module
joins by id and throws at load if the two disagree. `agent-registry.test.ts` enforces: core has no
imports or internal strings, client-imported modules import the core only, and no `"use client"`
file can transitively reach the server registry. Measured on production builds: persona prompts,
OpenClaw session keys and registry-only field names are absent from client JS; remaining model/skill
strings in client chunks are identical to `origin/main` (they come from existing UI files).

## What is canonical now

One `AgentDefinition` per agent (20 chat agents plus `archivist`). Derived selectors replace the old
hand-written tables: `chatAgentIds`, `agentDmUuidMap`, `openclawSessionKeyMap`, `claudeTierMap`,
`personaMap`, `directoryAgents`, `getAgent`, `listAgents`, `declaredVsRuntime`.

## Runtime truth (what the code in this repo actually does)

| Path | Model per agent? | Model |
|---|---|---|
| `POST /api/command-center/chat`, claude-max proxy (default) | yes, by tier | `claude-opus-4-6` / `claude-sonnet-4-6` / `claude-haiku-4-5`, overridable via `CC_CLAUDE_MODEL_{OPUS,SONNET,HAIKU}` |
| `POST /api/command-center/chat`, OpenClaw primary (`OPENCLAW_CHAT_PRIMARY=1`) | set by OpenClaw agent config | **UNKNOWN here** (outside this repo) |
| `POST /api/command-center/chat/stream` fallbacks | no | `gemini-2.0-flash`, `deepseek-chat`, `anthropic/claude-sonnet-4` (OpenRouter) |
| `cc-approve-synthesis` | yes, same tier map | same defaults as chat |
| Roster API / UI labels (`declared`) | display only | old `STATIC_AGENTS` values, not what chat calls |

Declared directory model disagrees with the claude-max tier for 9 agents: triage (declared Sonnet 4.5,
runtime Haiku), aetherion, vee, echo, widow, michael, selah, prophets, themaestro (declared Gemini, Kimi
or local Qwen, runtime Sonnet). Even the "agreeing" agents differ by version (declared `claude-sonnet-4-5-*`,
runtime default `claude-sonnet-4-6`). Pinned in `agent-registry.test.ts`.

## Migrated in this packet (values proven identical to base)

| Old source | Now |
|---|---|
| `chat-routing.ts` `AGENT_IDS` | `chatAgentIds()` |
| `cc-agent-dm-uuids.ts` `AGENT_DM_UUID` | `agentDmUuidMap()` |
| `chat/webhook/route.ts` local `AGENT_DM_UUID` copy | imports the shared map |
| `openclaw-gateway.ts` `DEFAULT_AGENT_SESSION_KEYS` | `openclawSessionKeyMap()` |
| `chat/route.ts` and `cc-approve-synthesis.ts` `AGENT_MODEL_TIER` (identical copies) | `claudeTierMap()` |
| `chat/route.ts` `AGENT_PERSONAS` | `personaMap()` |
| `chat/stream/route.ts` `AGENT_PERSONAS` (identical copy, found in review) | `personaMap()` |
| `agents/route.ts` and `export/handler.ts` `STATIC_AGENTS` (identical copies) | `directoryAgents()` |

## Left for later (migration targets)

| Source | Why not now |
|---|---|
| `dashboard-agents.ts` `AGENT_UI` / `AGENT_ORBIT_IDS` | Orbit layout, mock credits and tasks; uses `dr-strange` id. Needs a UI packet. |
| Colour and emoji tables (chat page, StatusDock, PushToast, PulseDock, office, gallery, decisions, memory, agents/manage, calendar, signal-wire, pipeline-tasks) | Every table disagrees with every other; choosing one is a design call, not a consolidation. |
| `chat/page.tsx` `DEFAULT_AGENTS`, `AGENT_TIERS`, `normalizeApiAgentId` | Client bundle, seeds UI state; needs a client-safe registry view. |
| `legacy/page.tsx`, `terminal/page.tsx` (fake static print with stale models and wrong roles) | Legacy or decorative surfaces. |
| `po-data.ts` `AGENTS` | 15 of 22 ids are not real agents. Remove or relabel, product decision. |
| `agent-metrics.json` | Not imported anywhere. Delete candidate (stale models and roles). |
| `agents/route.ts` `getRecentlyActiveAgents` fallback list (10 ids marked active when git has no signal) | Separate product policy (which agents show as active), not identity or config. Ids are a subset of the registry. Left in place. |
| `modelForAgent` tier to model-string logic (2 copies) | Provider Adapter packet owns this. |
| `shared-projects.ts`, `yolo-builds` `agentMap`, `manage/page.tsx` model tables | Display-name keyed or model-catalog data. |

## Remaining ambiguities

- Model actually used when OpenClaw is the primary path: not derivable from this repo.
- `directory.json` on the iMac is the real declared source; `declared` mirrors the repo fallback only.
- `archivist` appears in the roster API but not in chat routing, DM UUIDs or the gateway; its runtime is `unknown`.
- Unknown agent ids fall back to `sonnet` in `modelForAgent` (existing behavior, preserved, not a registry default).
- Dr Strange spellings: `drstrange` (canonical), `dr-strange` (directory/API/orbit), `strange` (OpenClaw session name only).
