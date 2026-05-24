# ATLAS QUALITY & DELEGATION AUDIT

**Prepared for:** Ramon Walton (Operator)
**Date:** 2026-05-23 · **Rev 2** (restructured after a first-principles / pre-mortem / red-team pass on Rev 1)
**Scope:** Why Atlas ships rushed, off-brand work — the repeatable system that fixes it without taxing speed, an audit of all 21 agents vs. best-in-class, and confirmation of the Command Center as the hub.

> **What changed in Rev 2.** Rev 1 framed the incident as a *delegation* failure and proposed to force every S2+ creative through a specialist and hard-block solo work. Pressure-testing that (see Appendix) showed it was wrong in three ways: (1) the real defect was **quality + missing context**, not too few hops; (2) forcing work to a weaker specialist can *lower* quality; (3) a text-matching gate is trivially gamed by naming the right words. Rev 2 reorients the system around **quality with the right context**, makes delegation a recommendation, and makes the gate judge the **artifact**, not the reply.

This document answers three questions:

1. How do we solve the quality problem with a **repeatable, proven system** that does not make a fast solo operator slow?
2. **Audit every agent** — role, model fit vs. best-in-class, the gaps, and how to close them.
3. Is the **Parallax Command Center + its chat** the hub for all of this?

---

## 0. THE INCIDENT (corrected root cause)

The Telegram exchange (swim pitch shipped without Mettle branding) is **not an Atlas personality flaw**, and — corrected from Rev 1 — it is **not primarily a delegation failure**. Delegating that same task to AETHERION, which runs on a *weaker* local model than Atlas, could have produced a *worse* deck. The defect was concrete and upstream of delegation:

**Root cause A — the brand kit was never in the agent's working context.** Atlas cannot apply brand assets it does not have. Nothing injects the versioned brand kit (logo, palette, type) into the context of whoever produces client-facing work. So "on-brand" was never on the table, by anyone.

**Root cause B — nothing inspected the artifact before it shipped.** The only runtime control, `verifyDeliverableGate()` (`openclaw/src/agents/subagent-announce.ts`), checked that referenced files *exist and parse* — never whether they are on-brand or placeholder-free — was **non-blocking**, and only fired on **delegated** output. In the incident Atlas produced the work itself, so the gate never ran.

**Root cause C — the good orchestration exists, but on a path the production agent doesn't use.** The Command Center chat (`ramiche-site/src/app/api/command-center/chat/route.ts`) implements a strong **orchestrator-worker + critic** pipeline (parallel drafts → synthesis → independent critic → refine → `CC_STRICT_DELEGATION`). But that runs against the Claude Max proxy in the web app; the production agent on Telegram/Signal runs through the OpenClaw gateway, where `OPENCLAW_CHAT_PRIMARY` is opt-in and in-code "flaky." **The discipline is in the demo, not in the worker.**

> **One-line diagnosis (corrected):** Atlas shipped off-brand because the brand context was absent and nothing inspected the artifact before send — not because it skipped a hop. The fix is *context + an artifact-level quality bar on the production path*, with delegation as one optional means to quality, not a mandate.

---

## 1. THE REPEATABLE SYSTEM — RAMICHE Quality Protocol (QDP v2)

**Goal: quality with the right context — at a process cost proportional to stakes.** A fast solo operator must not be forced through a multi-agent pipeline for a 30-second task. Process is a tax; we levy it only where stakes justify it.

| Proven discipline | Source | In our code? |
|---|---|---|
| **Right inputs before work** (you can't be on-brand without the brand kit) | Design ops / brand systems | No — brand kit not injected |
| **Inspect the artifact, not the claim** (test the part, not the operator's word) | TPS quality-at-source | No — old gate checked file existence + reply text |
| **Jidoka / Andon** (stop the line on a real defect) | Toyota Production System | Partial — gate warned, didn't stop |
| **Evaluator–optimizer** (independent critic before ship) | Anthropic agent patterns | Yes — `generateCritique()` (chat route only) |
| **Orchestrator–worker** (delegate breadth, synthesize) | Anthropic multi-agent research | Yes — `generateSynthesis()` (chat route only) |

Six mechanisms, **ordered by leverage-per-cost** — cheap, ungameable input fixes first; heavier process only at high stakes.

### QDP-1 · Right context, injected (highest leverage, lowest cost)
The cheapest fix for the incident: **inject the versioned brand kit** (logo paths, palette tokens, type, voice) into the working context of any agent producing `client-facing-creative` or `external-comms`. This is an *input* fix — it cannot be gamed, adds ~no latency, and would have prevented the incident on its own. ✅ **Mechanism shipped** (`buildSubagentSystemPrompt` in `subagent-announce.ts` reads the workspace brand kit and injects it for creative/comms tasks, degrading gracefully if absent). Still needs the brand kit itself committed via QDP-0, and the same injection on the main-agent (non-subagent) prompt path.

### QDP-2 · Proportional pre-send bar (stakes-scaled)
A short, explicit definition-of-done **scaled to stakes**, so speed is preserved where it's cheap:
- **S0/S1** (internal): ungated. Move fast.
- **S2** (client/revenue): artifact must pass the inspection gate (QDP-4) + one independent review.
- **S3** (legal/financial/safety): the above **plus a human sign-off**, enforced structurally (QDP-5).

### QDP-3 · Delegation as recommendation, not mandate
Routing is a **recommendation**, because forcing a weaker specialist lowers quality. The RACI matrix (below) names a recommended owner/contributors/reviewer per type; the orchestrator may keep production in-house when it is on a **stronger model** than the specialist — but **independent review at S2+ is non-negotiable**. Delegation's real value is *parallelizable breadth* (research, multi-asset campaigns), not every single deliverable.

| Deliverable | Recommended owner | Contributes | Independent reviewer | Atlas role |
|---|---|---|---|---|
| Client pitch / deck / brand asset | AETHERION (or Atlas if stronger model) | VEE (brand), INK (copy), domain owner | VEE or human | Orchestrate + final gate |
| Marketing copy / landing page | INK | VEE | AETHERION, MERCURY | Orchestrate |
| Code / feature / build | SHURI / NOVA | PROXIMON (if architectural) | TRIAGE | Orchestrate |
| Financial / pricing model | KIYOSAKI | SIMONS (data) | DR STRANGE | Orchestrate |
| Legal / compliance | THEMIS | — | **human (S3 always)** | Orchestrate |
| Outbound sales | MERCURY | INK | HAVEN | Orchestrate |

### QDP-4 · The gate inspects the ARTIFACT, not the reply (closes the gaming hole)
The single most important code change, **shipped in this branch** (`openclaw/src/agents/quality-delegation-gate.ts`, evidence-driven v2):
- At **S2+, reply-text claims never satisfy the definition-of-done.** Only facts inspected from the **actual artifact** (file body / render) count. Writing "I used the Mettle brand kit" no longer passes anything — the deliverable file itself must carry the markers.
- **Fail-safe:** missing evidence ⇒ verdict `review` ("verification owed"), **never a silent `pass`**. A real negative (placeholders in the file, brand kit absent, reviewer == author) ⇒ `block`.
- **Independent review enforced:** a reviewer who is the producer is rejected; S3 requires a *human* reviewer flag.
- The inspector reads the referenced files in `subagent-announce.ts` (`inspectDeliverableArtifacts`) and feeds `ArtifactEvidence` to the pure policy.

### QDP-5 · Structural interlock at the send layer (S3) — not an advisory prompt
A verdict that lives only in prompt text can be ignored by the agent summarizing to the operator. So the gate exposes a single boolean — `isShippable(result)` — and the **deliverable/send path must consult it as a hard interlock**. ✅ **Shipped (opt-in):** the gate now runs on the main agent's own self-produced replies in the delivery path (`src/commands/agent/delivery.ts`), records every non-pass outcome, and — when `OPENCLAW_QDP_ENFORCE` is set — suppresses external delivery on a `block` verdict. It is opt-in by default so a heuristic gate never silently drops an operator reply. **Remaining:** make enforcement mandatory (not opt-in) for S3 specifically, and cover the non-delivery send paths. *(See roadmap Phase 1.)*

### QDP-6 · Evidence, scorecard, and a weekly ritual (or it dies)
- Every S2+ deliverable appends type/owner/reviewer/verdict/rework to `~/.openclaw/workspace/memory/subagent-audit.jsonl` (extends today's log).
- The Command Center renders a per-agent scorecard (rework rate, gate-pass rate, review-revise rate, time-to-deliver) — replacing the vanity `tasksCompletedToday`.
- **A dashboard nobody opens is dead.** Tie it to a recurring ritual (a weekly `/loop` review), or don't build it.

### QDP-0 · The meta-fix: version-control the workspace
`SOUL.md` (personas), the OS Protocol, `directory.json` (models/skills), `verify-deliverable.sh`, and the **brand kit** live only at `~/.openclaw/workspace/` on Ramon's Mac, in no repo. The rules that govern quality can't be reviewed, diffed, tested, or rolled back — and they drift (finding A6). **Put the workspace under git.** Without it, QDP-1/2/4 have no durable home.

> **Why "proven, not invented":** quality-at-source and jidoka (TPS), RACI, and evaluator-optimizer / orchestrator-worker (Anthropic) are all named patterns. QDP-2 already exists in fragments in the chat route. The job is to put the *cheap input fixes first*, make the gate judge artifacts, and run it on the production path — without taxing low-stakes speed.

---

## 2. AGENT AUDIT — all 21, vs. best-in-class

**Roster source-of-truth:** `src/app/api/command-center/agents/route.ts` (`STATIC_AGENTS`) + `dashboard-agents.ts`. Grades are operational, A–F.

### Command layer
| Agent | Role | Model | Best-in-class bar | Grade | Gap → close it |
|---|---|---|---|---|---|
| **ATLAS** | Operations lead / orchestrator | Opus 4.6 | EM/CTO chief-of-staff; orchestrator-worker | **C+** | One version behind (→ **Opus 4.7**); no brand context; no artifact gate on its own output. Fix = QDP-1 + QDP-4. |
| **ARCHIVIST** | Workspace indexer (cron) | Sonnet 4.5 | Sourcegraph / Cursor index | **B** | Fine. Expose "last index" freshness in CC. |

### Tier 1 — high-stakes professional
| Agent | Role | Model | Best-in-class bar | Grade | Gap → close it |
|---|---|---|---|---|---|
| **THEMIS** | Legal & governance | Sonnet/Opus | Harvey AI, CoCounsel | **B–** | Strongest model + **human-in-loop mandatory (S3, QDP-5)**. Keep "legal information," not "advice." |
| **KIYOSAKI** | Finance | Sonnet 4.5 | CFA-grade analyst | **C** | "Rich Dad" branding undercuts a *verified* finance agent. Pair with SIMONS; cite sources. |
| **DR STRANGE** | Forecasting / scenarios | Sonnet 4.5 | Superforecasters (Tetlock) | **B** | Make it the standing reviewer for KIYOSAKI/strategy. |
| **SIMONS** | Data / quant | Sonnet 4.5 | FAANG/quant data scientist | **B+** | Wire to real datasets (GA4) so outputs are evidenced. |
| **WIDOW** | Security | **qwen3:14b (local)** | Snyk/Semgrep + senior pentester | **C–** | **Under-powered.** Local 14B can't reason about real CVEs. Move to Sonnet for S2+ scans. |

### Tier 2 — creative & marketing
| Agent | Role | Model | Best-in-class bar | Grade | Gap → close it |
|---|---|---|---|---|---|
| **AETHERION** | Creative director / visual | Gemini 3.1 Pro (image) | Midjourney v6+, Pentagram | **C+** | Recommended owner for `client-facing-creative` — **but only if its model ≥ the orchestrator's** (QDP-3). Give it the versioned brand kit (QDP-1). |
| **VEE** | Brand strategy | Kimi K2.5 | Top brand consultancy | **B–** | Split cleanly: VEE = strategy/voice, AETHERION = visuals. VEE is default reviewer for brand. |
| **INK** | Copywriting | Sonnet 4.5 | Top direct-response copywriter | **B** | Needs the versioned brand voice guide as input or copy drifts. |
| **ECHO** | Community / social | qwen3:14b (local) | Head of Community | **C** | Local fine for low-stakes posting; escalate campaigns to Sonnet. |
| **MERCURY** | Sales | Sonnet 4.5 | VP Sales, $100M ARR | **B** | Wire to real pipeline; pair with INK for outbound. |

### Tier 3 — specialized verticals
| Agent | Role | Model | Best-in-class bar | Grade | Gap → close it |
|---|---|---|---|---|---|
| **MICHAEL** | Swim coaching (**METTLE flagship**) | **qwen3:14b (local)** | Olympic coach (ASCA L5) | **C–** | **Backwards:** the #1 revenue product on the weakest model. Move coaching reasoning to Sonnet; keep local for cheap chat. |
| **SELAH** | Psychology / wellness | qwen3:14b (local) | Licensed sport psychologist | **C** | Sensitive domain on a weak model; escalate real check-ins to Sonnet + disclaimers. |
| **PROPHETS** | Spiritual counsel | qwen3:14b (local) | Seminary-level | **B** | Niche; local acceptable. Scripture-accuracy check. |
| **HAVEN** | Customer success | Sonnet 4.5 | Intercom Fin / Sierra | **B** | Strong fit; untested (no live customers). First onboarding is the test. |

### Tier 4 — technical
| Agent | Role | Model | Best-in-class bar | Grade | Gap → close it |
|---|---|---|---|---|---|
| **SHURI** | Engineering / UI | Sonnet 4.5 | Claude Code, Cursor, Devin | **B+** | Strong (18+ PRs). Make TRIAGE its mandatory reviewer. |
| **PROXIMON** | Architecture / infra | Sonnet 4.5 | AWS Well-Architected, staff eng | **B** | Standing contributor on architectural code. |
| **NOVA** | "3D fabrication" + "overnight builds" | Sonnet 4.5 | Industrial designer / Fusion 360 | **C+** | **Role confusion:** two different jobs. Split or rename. |
| **TRIAGE** | Debugging / QA | **Haiku 4.5** | SRE, SWE-bench leaders | **B** | Good cheap reviewer; allow Sonnet escalation for deep RCA. |
| **THEMAESTRO** | Music production (Ramon's brand) | qwen3:14b (local) | Grammy producer; Suno/Udio | **C–** | Founder-brand product on a 14B model. Deserves a real model + Suno/Udio. |

### Cross-cutting findings
- **A1 — Model↔stakes inversion.** The flagship products (MICHAEL/METTLE, THEMAESTRO) and security (WIDOW) run on the weakest local model; internal ops runs on Opus/Sonnet. **Re-tier by stakes, not habit.**
- **A2 — Atlas is one version behind.** The orchestrator caps the whole system; move to **Opus 4.7**.
- **A3 — Role overlap.** AETHERION↔VEE and SHURI↔NOVA↔TRIAGE need clean lanes.
- **A4 — NOVA is two jobs.** Split 3D fabrication from overnight software builds.
- **A5 — No quality metric.** Only `tasksCompletedToday` (vanity). Add rework/gate-pass/review-revise (QDP-6).
- **A6 — Three drifting sources of truth.** `agent-metrics.json`, `agents/route.ts`, `dashboard-agents.ts` disagree on models. Collapse to version-controlled `directory.json` (QDP-0).
- **A7 — "Expertise" is mostly persona over 2–3 shared models.** AETHERION/VEE/INK are Sonnet/Kimi/Gemini with different system prompts — real persona-diversity and parallel drafting, but **not** distinct domain expertise yet. Routing through three personas of one base model is partly theater until the **Verified-Agent** work (interview real experts, encode their reasoning) lands. This is *why* QDP-3 keeps delegation advisory: more hops over the same intelligence buys less than people assume.

---

## 3. IS THE COMMAND CENTER + CHAT THE HUB? — Yes, with one caveat

**Yes.** The Parallax Command Center (`command.parallaxvinc.com/command-center`) is the control plane and its chat is the human↔agent / agent↔agent interface. It reads the directory, sessions, crons, and runs the orchestrator-worker + critic pipeline. Right hub.

**The caveat that makes the incident possible:** today the hub is a **dashboard**, not yet a **control plane over the production agent**. The screenshot's Atlas runs through the **OpenClaw gateway** (Telegram), bypassing the Command Center's synthesis/critic/gate (env-gated, web-path only). To make it the true hub, three things must converge there:
1. **Authoring** — brand kit, DoD, personas, routing edited and version-controlled through/alongside the Command Center (QDP-0/1/3).
2. **Enforcement on the production path** — the artifact gate + S3 interlock (QDP-4/5) run in the OpenClaw runtime, so Telegram-Atlas obeys the same rules as chat-Atlas.
3. **Observation** — per-agent scorecards (QDP-6) render in the Command Center, tied to a weekly ritual.

---

## 4. IMPLEMENTATION ROADMAP (reordered: cheap ungameable wins first)

**Phase 0 — Cheap, high-value, hard-to-game (this week)**
- ✅ **Brand-kit injection mechanism shipped** for creative/comms producers (QDP-1); now **commit the brand kit itself** to the workspace so the mechanism has something to inject. *Highest leverage; would have prevented the incident alone.*
- **Version-control the workspace** (`~/.openclaw/workspace/` → git): brand kit, `SOUL.md`, protocol, `directory.json`, `verify-deliverable.sh`. (QDP-0)
- **Re-tier by stakes:** ATLAS → Opus 4.7; MICHAEL/WIDOW S2 work → Sonnet. (A1/A2)

**Phase 1 — Make the bar real on the production path (1–2 weeks)**
- ✅ **Artifact-inspecting gate shipped** (`openclaw/src/agents/quality-delegation-gate.ts` v2 + shared `quality-gate-runtime.ts`): evidence over claims, fail-safe to `review`, independent-review enforced.
- ✅ **Self-produced path covered** — the gate runs on the main agent's own replies in `src/commands/agent/delivery.ts`, records outcomes, and suppresses delivery on `block` when `OPENCLAW_QDP_ENFORCE` is set. *(This was the exact hole the incident fell through.)*
- **Make enforcement mandatory for S3** (not opt-in) and inject the brand kit on the main-agent prompt path too; promote `generateCritique` to a shared runtime primitive so the OpenClaw path gets the independent critic (QDP-2/3).

**Phase 2 — Close the loop (2–4 weeks)**
- Extend `subagent-audit.jsonl` with type/owner/reviewer/verdict/rework; build the Command Center scorecard tied to a weekly ritual (QDP-6). Collapse the 3 model sources to `directory.json` (A5/A6).
- Resolve role overlaps (A3/A4); begin the **Verified-Agent** program so "expertise" stops being persona-only (A7).

**North star:** No S2+ deliverable reaches the operator or a client without (a) the right brand context, (b) an artifact that passed the inspection gate, (c) an independent reviewer's approval (human at S3) — all logged and visible in the Command Center, and **with low-stakes work left fast and ungated.**

---

## Appendix — First principles, pre-mortem, red team (the reasoning behind Rev 2)

### First principles
An LLM orchestrator minimizes cost unless the environment makes quality the path of least resistance — that holds. But three Rev 1 premises did not survive scrutiny:
1. **The incident was quality + context, not delegation.** Brand assets weren't in context and nothing reviewed the artifact. Delegating to a weaker AETHERION could have been *worse*. Delegation is a means to quality, not quality.
2. **The "team" is largely personas over 2–3 shared models** (A7). "Delegate to the team" buys parallel drafts, not distinct expertise, until verified agents exist.
3. **Process taxes the speed Ramon needs.** Every gate adds latency and failure surface; a heavy mandatory pipeline gets switched off. Process must be proportional to stakes.

### Pre-mortem (it's 6 months later; QDP failed — why?)
1. **It made everything slow and got turned off.** *(Mitigation: QDP-2 leaves S0/S1 ungated; cheap input fixes first.)*
2. **The checks got gamed** — brand words in the reply passed the brand check. *(Mitigation: QDP-4 inspects the artifact, not the reply.)*
3. **False blocks → alarm fatigue.** *(Mitigation: missing evidence is `review`, not `block`; only inspected negatives block.)*
4. **Routed to a weaker specialist; quality dropped.** *(Mitigation: QDP-3 delegation is advisory, model-tier-aware.)*
5. **Config drifted from reality.** *(Mitigation: QDP-0 version control.)*
6. **Fixed the wrong path** (announce, not the solo/production path). *(Open item: Phase 1 self-produced coverage + send-layer interlock.)*
7. **Nobody opened the scorecard.** *(Mitigation: QDP-6 tied to a weekly ritual.)*

### Red team (how a motivated agent defeats it)
- **Keyword-stuffing** → closed by artifact inspection (QDP-4).
- **Reframe to dodge the classifier** ("internal draft") → partly closed: `inferStakes` now also scans the reply for external/brand markers and fails safe upward.
- **Bypass the path** (main agent does the work itself and replies directly, skipping the subagent announce) → **now gated**: the delivery path runs the gate on self-produced replies. *Still open:* non-delivery send paths and making suppression default-on for S3.
- **Reviewer collusion** (same model rubber-stamps) → mitigated: reviewer == producer is blocked; S3 needs a human. Different-model review is the next hardening.
- **Verdict laundering** (ignore the prompt directive and report success anyway) → **partially closed**: `isShippable` is now a real interlock on the delivery path under `OPENCLAW_QDP_ENFORCE`; closing it fully means making that enforcement mandatory at S3 rather than opt-in.

**Honest status:** the gaming, false-block, and main-agent path-coverage holes are closed in code on this branch (enforcement opt-in via `OPENCLAW_QDP_ENFORCE`). Remaining: make S3 enforcement mandatory, cover non-delivery send paths, and commit the brand kit so QDP-1 has content to inject.

---

*Grounded in current code: `subagent-announce.ts` (gate integration), `quality-delegation-gate.ts` (evidence-driven policy, v2), `command-center/chat/route.ts` (synthesis/critic), `agents/route.ts` + `dashboard-agents.ts` (roster). Biggest leverage point: QDP-1 (brand context) + QDP-4 (artifact gate) on the production path — that is what would have caught the swim pitch.*
