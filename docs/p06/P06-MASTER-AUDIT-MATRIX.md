# P06 master audit matrix

**Date:** 2026-10-05.
**State at:** integration `e386679e`; M5 PR #42 (head on branch `p06/mission-m5-shadow-router`); `main` `fcdf4c6c` (divergent, not used for cockpit work).

**Rules applied.** No closed packet is reopened without new consequential evidence. "Merged" means on the integration branch. Production state is as previously verified unless stated.

## CLOSED

All are verified and are not reopened.

| Packet | Evidence |
|---|---|
| P03 owner boundary | `2e93ebe` |
| P05 (B2, B2.1, B3 anon lockdown, B4) | `b046d55`, `aefdf5e`; B3 anon lockdown previously verified in production (no new contrary evidence) |
| P06-S1 (owner boundary on yolo-review) | `4f44669` on integration. The route deletion `673a9fb` exists only on branch `p06s1/main-delete-yolo-review` (main lineage). |
| Packet 1 Agent Registry | #27 `b19c6b1` |
| Packet 2 Provider Adapter | #28 `dc7557a` |
| Packet 2B Provider Coverage | #29 `58731ac` |
| Packet 3 Execution / Cost Events | #30 `fe72ac2` |
| Agent Identity + Claude Max system transport | #33 `5d6ca9d` |
| Structured History | #34 `75ad0ba`, #35 `6876e2b` |
| Conversation Identity, New Conversation, DM migration | #36 `c48952d` |
| M1 Mission Identity | #37 `9094f21`; production migration history recorded |
| M2 Founder Mission API | #38 `95bdeab` |
| M4A Founder Mission Entry | #39 `1d0c020` |
| M3 Mission Cost Attribution | #40 `03b7540` |
| M4B Founder Mission UX | #41 `e386679` |

Note: some migration headers still say "NOT APPLIED ANYWHERE" (Packet 3, DM conversations, M1). Those comments were written before the production runs and are not evidence of production state. Correcting the header text is a BACKLOG cleanup item, not a reopen.

## ACTIVE

- **M5 Universal Command shadow router + Mission hooks:** PR #42, not merged, not deployed.
  - Shadow-only.
  - Rules-only router with no classifier.
  - Hardened authority rules (519-entry adversarial corpus, mutation-tested).
  - Command records cannot be Mission evidence.
  - Chat leakage closed.
  - Re-route duplicate protection.

## SHADOW OBSERVATION REQUIRED

- **M5 shadow week.** It starts only after #42 is merged and deployed (both are Ramon's decisions). It runs on the runbook in `docs/p06/M5-SHADOW-OBSERVATION-RUNBOOK.md`, with the proposed default exit gate G1 to G12 and the GO / EXTEND SHADOW / NO-GO verdict rule.

## READY NEXT

These follow M5 in order of value. Each needs Ramon's go before starting.

1. **M5 merge and the shadow week** (above).
2. **Browser / mobile visual pass of M4B + M5.** Never done in a real browser; it needs a safe authenticated preview, with no auth weakening.
3. **External-target link resolution** (URL, GitHub PR/commit/branch, YOLO build, Firestore task). These are still format-only and can never be evidence. The code comments call this "M3 work", but the M3 that shipped was cost attribution only. This is the next step for **evidence quality**.

## DEFERRED

- **M2B Trusted Agent Principal.** No concrete consumer; see `docs/p06/M2B-NEED-ASSESSMENT.md`. Keep deferred.
- **Universal Command dispatch** (real execution). Deferred until the shadow week passes AND a separate authority design exists, which is likely founder-confirmed dispatch and does not require M2B.
- **Classifier routing** for ambiguous commands. It would need a new `execution_events` purpose, which is a migration, and the shadow week will show whether ambiguity is frequent enough to justify it.
- **Claude Max proxy fields** (exact CLI model, cache tokens, trustworthy cost). A future packet, not started (`docs/P06-EXECUTION-EVENTS.md`).

## BACKLOG

Harvested; value / risk / effort / dependency are qualitative.

| Item | Value | Risk | Effort | Dependency | Verdict |
|---|---|---|---|---|---|
| Correct stale "NOT APPLIED ANYWHERE" migration headers to match the recorded production runs | Medium: removes false alarms such as the overnight anon-lockdown blocker | Low | Small | Ramon confirms which are applied | **High value / low risk, next safe cleanup** |
| `docs/P06-PROVIDER-ADAPTER.md` still lists the four claude-max callers that Packet 2B finished | Low-medium: stale doc | Low | Tiny | none | High value / low risk (doc only) |
| Delete or label `docs/CC-IMPLEMENTATION-STATUS.md` (May 2026, pre-P05/P06) | Low-medium: reduces founder confusion | Low | Tiny | none | Low risk; do with the item above |
| Packet 1 leftovers: `dashboard-agents` orbit tables, colour/emoji tables, `chat/page.tsx` DEFAULT_AGENTS / AGENT_TIERS, two copies of `modelForAgent` | Medium: one roster | Medium: UI | Medium | UI packet | Backlog |
| `po-data.ts` AGENTS (15 of 22 ids are not real agents) | Medium | Medium | Small | Product decision (Ramon) | BLOCKED_FOR_RAMON |
| `agent-metrics.json` delete candidate; `getRecentlyActiveAgents` fallback | Low | Low | Small | none | Backlog |
| Packet 2 leftovers: OpenRouter removal, dead oracle / PageAgentWidget code, briefing compose / transcription / image gen onto the adapter | Medium: cost + one adapter | Medium | Medium | Provider decision | Backlog |
| CommandPalette "Run as Job" executes free text (pre-existing) | Medium: founder safety | Low | Small | Shadow week outcome | Revisit after the shadow week (it is already explicit-only) |

## OBSOLETE / SUPERSEDED

- **`/api/yolo-review` route:** unused and owner-guarded on integration. Its deletion is staged on `p06s1/main-delete-yolo-review` (main lineage), so porting it to integration is a backlog item.
- **Project progress page at `/command-center/missions`:** moved to `/command-center/projects/progress` (M4A).
- **"Confirm P05-B3 anon lockdown in production"** (overnight handoff): superseded by the prior production verification. ANON LOCKDOWN is PREVIOUSLY VERIFIED, with no new contrary evidence.
- **Overnight claim "M5 candidate 29aa8a6":** superseded by later heads on #42.

## BLOCKED_FOR_RAMON

Only consequential decisions are listed.

1. **Merge PR #42** (M5) after reading the merge-gate report. Then deploy, which starts the shadow week.
2. **Adopt or adjust the shadow-week exit gate** (runbook section 6).
3. **Product decision on `po-data.ts` AGENTS** (backlog; not urgent).
