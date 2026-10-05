# P06 M2B: Trusted Agent Principal, need assessment (design only)

**Date:** 2026-10-05.
**Scope:** whether any current workflow needs an agent or machine caller to WRITE Mission state. Nothing here is implemented.

## Recommendation

**Keep M2B deferred.** There is no concrete consumer. Every Mission write today is founder-triggered, and nothing in the code, the docs or the M5 design needs an agent to write Mission state. Re-open M2B only when a specific workflow below becomes real and a founder-triggered alternative has been tried and found insufficient.

## Evidence (code at integration `1117c7cf`, M5 merged)

- **Founder-only callers.** Every Mission write lives in `src/lib/missions/service.ts`: create, transition, verify, reassign, addLink and removeLink. These are reached only from the founder routes (`src/app/api/command-center/missions/**`, via `missionContext`, which always maps to FOUNDER) and from the founder UI (`MissionViews.tsx`, `ShadowCommandPanel.tsx`).
- **No machine mapping.** `missions/http.ts` says "There is no machine or agent mapping", and `principal.ts` says "There is no agent principal … machine callers get NO Mission authority".
- **No machine route touches Missions.** The machine route policy (`src/lib/server/b2-route-policy.ts`) covers bridge, chat webhook, push, Vapi, Twilio and nurture cron.
- **No mission references** in jobs, approve-synthesis, the chat route or the OpenClaw gateway.
- **The agent token is test-only.** `PARALLAX_MISSIONS_AGENT_TOKEN` appears only in tests, which assert that it is denied. No production code reads it.
- **M5 writes no Missions.** It records shadow decisions only; Mission creation and attachment are founder clicks on the existing M2 API.
- **Execution events are not Mission writes.** `execution_events.mission_id` is always null (`execution-events.ts`), and M3 attributes cost through Mission links, which the founder creates.

## Candidate future workflows (none needs M2B today)

| Workflow | Agent / process | Mission write it would want | Why founder-only might be insufficient | Founder-triggered alternative |
|---|---|---|---|---|
| Agent reports work done | OpenClaw agents (they already post chat replies through the `openclaw-webhook` service caller) | transition executing → reviewing; add an `evidence` link to the job or message it produced | Volume: the founder clicking "Send to review" on every finished task | The agent posts its result as a chat message or job, and the founder links it as evidence and transitions in the Mission page. This is how it works today, and M4B's Needs-you group surfaces it. |
| Job outcome attaches to its Mission | Job runner (`runJob`) | add a `context`/`evidence` link from the Mission to the job | Avoid manual linking | The founder creates the job from inside the Mission, or links it after. A future option: the job record carries a `mission_id` that M2 resolves, with the founder still deciding evidence. |
| Synthesis plan → Mission | approve-synthesis (owner-guarded) | create a Mission, link the plan | Avoid duplicate typing | Already founder-triggered: "Create Mission from this plan" (M4A, unapproved plans only). |
| Universal Command dispatch (after the shadow week) | A dispatcher acting for the founder | link the command, start execution | Dispatch is the point of Universal Command | Keep dispatch founder-confirmed: the founder approves each dispatch, and the dispatcher writes nothing to Missions beyond what M2 founder routes already do. |
| Cost telemetry → Mission | Packet 3 writer | populate `execution_events.mission_id` | Direct attribution | Not needed: M3 already attributes through the founder's links. |

## If M2B is ever needed: minimum boundary (for the future packet)

- **Identity:** one credential per agent, never a shared fleet token. It is issued and revoked by the founder, stored only server-side, and checked with a constant-time compare. Each credential maps to exactly one registry agent id, and the claimed name never comes from a header.
- **Authority (allow-list, per agent):**
  - Only on Missions where that agent is the owner or on the team.
  - Only a forward transition `executing → reviewing`.
  - Only an `evidence` or `deliverable` link to a record the agent itself produced (its own job or message), which M2 verifies.
- **Always founder-only:** create, approve (`plan → approved`), start execution, `reviewing → completed`, verify, cancel, reassign, removing links, any Mission the agent is not on, any `source` or `dependency` link, and anything touching cost, credentials or other agents.
- **Audit:** every agent write is a `mission_events` row with `actor_kind = 'agent'` and the agent id, and appears in the founder's history. Founder verification remains the only path to Verified.
- **Kill switch:** an env flag defaulting to off; with the flag off, machine callers are denied exactly as today.

## What must remain prohibited regardless

- Any agent path to `verified`.
- Any agent approval or cancellation.
- Agent-created Missions.
- Agent writes on Missions it is not assigned to.
- A shared or unattributed machine credential.
- Trusting `x-parallax-agent` or any body field as identity.
- Agent writes through the Universal Command shadow route, which executes nothing.
