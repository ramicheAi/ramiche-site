# ATLAS QUALITY & DELEGATION AUDIT

**Prepared for:** Ramon Walton (Operator)
**Date:** 2026-05-23
**Scope:** Why Atlas ships rushed, un-delegated work — and the repeatable system to fix it, an audit of all 21 agents vs. best-in-class, and confirmation of the Command Center as the hub.

This document answers three questions:

1. How do we solve the quality + delegation problem with a **repeatable, proven system**?
2. **Audit every agent** — role, purpose, performance vs. the best in their field, the gaps, and how to close them so they work together.
3. Is the **Parallax Command Center + its chat** the hub for all of this?

---

## 0. THE INCIDENT (root-cause, not symptom)

The Telegram exchange (swim pitch shipped without Mettle branding, no delegation to the design/brand agents) is **not an Atlas personality flaw**. It is the predictable output of the current architecture. Three structural causes:

**Cause 1 — Delegation is discretionary, not enforced.**
In the runtime (`openclaw`), delegation is only enforced *downward*: a subagent is blocked from spawning further subagents (`src/agents/pi-tools.policy.ts`, `runtime-governor-tool-gate.ts`). There is **nothing that forces Atlas to delegate upward**. Whether a client-facing creative deliverable goes to AETHERION (visual) + VEE (brand) or gets banged out by Atlas alone is left entirely to Atlas's own judgment in its prompt. Under time pressure, the cheapest path for an orchestrator is to do it itself. So it does.

**Cause 2 — The quality gate is weak, non-blocking, and fires on the wrong path.**
The only runtime quality control is `verifyDeliverableGate()` in `src/agents/subagent-announce.ts:343`. It:
- only checks that **referenced files exist and parse** (size/format) — it cannot judge brand compliance, design quality, or correctness;
- is **non-blocking** — it appends a warning to the announce message; the work can still reach the operator;
- only fires when work was **delegated to a subagent**. In the incident Atlas did the work *itself*, so the gate never ran.

**Cause 3 — The good orchestration exists, but on a path the production agent doesn't use.**
The Command Center chat (`ramiche-site/src/app/api/command-center/chat/route.ts`) already implements a genuinely strong **orchestrator-worker + critic** pipeline: parallel specialist drafts → Atlas synthesis (Phase B) → independent critic (Phase E) → one refinement → strict-delegation enforcement (`CC_STRICT_DELEGATION`). **But** that pipeline runs against the Claude Max proxy in the web app. The real production agent on Telegram/Signal runs through the OpenClaw gateway, where `OPENCLAW_CHAT_PRIMARY` is opt-in and described in-code as "flaky." **The discipline is in the demo, not in the worker.**

> **One-line diagnosis:** The system has the right ideas (orchestrator-worker, critic pass, deliverable verification) but they are unenforced, non-blocking, and wired to the wrong execution path. Atlas behaves rationally given those incentives.

---

## 1. THE REPEATABLE SYSTEM — RAMICHE Quality & Delegation Protocol (QDP v1)

The fix is not "tell Atlas to try harder." It is a **closed-loop production system** modeled on four proven disciplines, each already partially present in the codebase:

| Proven discipline | Where it comes from | Already in our code? |
|---|---|---|
| **Orchestrator–worker** (lead delegates to specialists, synthesizes) | Anthropic's multi-agent research pattern | Yes — `generateSynthesis()` (chat route) |
| **Evaluator–optimizer** (independent critic before ship) | Anthropic agent patterns; adversarial review | Yes — `generateCritique()` / `refineSynthesis()` |
| **Jidoka / Andon** (stop the line on a defect; never pass a defect downstream) | Toyota Production System | Partial — `verifyDeliverableGate()` warns but doesn't stop |
| **Checklists + RACI** (deterministic routing, definition-of-done) | Aviation/surgery (Gawande); RACI matrices | No — routing is discretionary |

QDP is six mechanisms. Each says **what to build** and **where it plugs into existing code**.

### QDP-1 · Intake & Classification
Every operator request is classified before work starts: **deliverable type** × **stakes tier**.

- Types: `client-facing-creative` · `code` · `internal-analysis` · `external-comms` · `ops/automation`.
- Stakes: `S0` internal scratch · `S1` internal decision · `S2` client/revenue-facing · `S3` legal/financial/safety.

Classification is mechanical, not vibes (keyword + context classifier). The swim pitch = `client-facing-creative / S2`.

### QDP-2 · Deterministic Routing Matrix (the core fix for delegation)
Routing is a **lookup table, not Atlas's mood.** For each (type × stakes) the matrix names a **Responsible owner, Contributors, and a Reviewer** (RACI). Atlas is *Accountable* but is **forbidden from being sole Responsible** on anything ≥ S2.

| Deliverable | Responsible (does it) | Must contribute | Reviewer (independent) | Atlas role |
|---|---|---|---|---|
| Client pitch / deck / brand asset | AETHERION (visual) | VEE (brand), INK (copy), domain owner (e.g. MICHAEL for swim) | VEE or human | Orchestrate + final gate |
| Marketing copy / landing page | INK | VEE | AETHERION (visual), MERCURY (offer) | Orchestrate |
| Code / feature / build | SHURI or NOVA | PROXIMON (if architectural) | TRIAGE (review) | Orchestrate |
| Financial / pricing model | KIYOSAKI | SIMONS (data) | DR STRANGE (scenarios) | Orchestrate |
| Legal / compliance | THEMIS | — | human (S3 always) | Orchestrate |
| Outbound sales | MERCURY | INK (copy) | HAVEN (CX sanity) | Orchestrate |

The matrix lives in version control (see QDP-6) so it is reviewable and auditable, and is the single source the runtime consults.

### QDP-3 · Definition of Done (DoD) per type
A deliverable is not "done" because the model said so. Each type carries an explicit, checkable DoD. Example — `client-facing-creative`:
- [ ] Uses the correct brand kit (logo, palette, type) from the versioned brand library
- [ ] Produced/reviewed by the named Responsible + Reviewer (QDP-2), evidenced in the audit log
- [ ] No placeholder text, no lorem, no broken assets (extends current file-exists check)
- [ ] Passes a brand-compliance check (asset references present, on-palette)
- [ ] One independent critic pass with verdict `approve`

### QDP-4 · Mandatory two-pass review (generalize what the chat already does)
The producer never ships its own work for S2/S3. The **critic pass** (`generateCritique`) that exists in the chat route is promoted to a **runtime primitive** that runs in the OpenClaw path too — drafter and critic separated even when the same model backs both. `revise` → one refinement; `approve` → proceed to gate.

### QDP-5 · Blocking verification gate (Jidoka — stop the line)
Upgrade `verifyDeliverableGate()` from *warning* to *gate*:
- **Block, don't warn.** On failure the deliverable does **not** reach the operator/client; the orchestrator must rebuild in-session.
- **Check more than existence.** Run the DoD checklist for the classified type (brand references, no placeholders, reviewer recorded), not just "file parses."
- **Cover the self-produced path.** The gate must run on deliverables Atlas produced *itself*, not only delegated ones (this is the exact hole the incident fell through).

### QDP-6 · Evidence, audit & the weekly scorecard (close the loop)
- Every deliverable appends a record to `~/.openclaw/workspace/memory/subagent-audit.jsonl` (already exists) — extend it with: classified type, owner, reviewer, verdict, rework count.
- The Command Center surfaces a **per-agent scorecard**: rework rate, gate-pass rate, critic-revise rate, time-to-deliver. (Today the only metric is vanity `tasksCompletedToday` — see audit finding A5.) **What gets measured gets delegated.**

### QDP-0 · The meta-fix: version-control the workspace
The most important config in the entire system — `SOUL.md` (personas), the RAMICHE OS Protocol, `directory.json` (models/skills), `verify-deliverable.sh` (the quality bar), and the brand kit — **lives only at `~/.openclaw/workspace/` on Ramon's Mac and is not in any repo.** That means the rules that govern quality cannot be reviewed, diffed, tested, or rolled back, and they drift (see finding A6). **Put the workspace under git.** Without this, QDP-2/3/5 have no durable home.

> **Why this is "proven, not invented":** every mechanism above is a named industrial pattern (TPS jidoka, RACI, surgical checklists) or an Anthropic-published agent pattern (orchestrator-worker, evaluator-optimizer) — and 4 of the 6 already exist in fragments in this codebase. QDP's job is to **make them mandatory, blocking, and on the production path.**

---

## 2. AGENT AUDIT — all 21, vs. best-in-class

**Roster source-of-truth:** `src/app/api/command-center/agents/route.ts` (`STATIC_AGENTS`) + `dashboard-agents.ts`. Grades are operational (how well positioned to do the job *today*), A–F.

### Command layer
| Agent | Role | Model | Best-in-class bar | Grade | Gap → close it |
|---|---|---|---|---|---|
| **ATLAS** | Operations lead / orchestrator | Opus 4.6 | A great EM/CTO chief-of-staff; Anthropic orchestrator-worker | **C+** | Does too much itself; one version behind (move to **Opus 4.7**); no enforced delegation. Fix = QDP-2 + QDP-5. |
| **ARCHIVIST** | Workspace indexer (cron) | Sonnet 4.5 | Sourcegraph / Cursor codebase index | **B** | Fine for scope. Expose "last index" freshness in CC. |

### Tier 1 — high-stakes professional
| Agent | Role | Model | Best-in-class bar | Grade | Gap → close it |
|---|---|---|---|---|---|
| **THEMIS** | Legal & governance | Sonnet/Opus | Harvey AI, CoCounsel | **B–** | Strongest legal model + human-in-loop mandatory (S3). UPL risk is real — keep "legal information" not "advice." |
| **KIYOSAKI** | Finance | Sonnet 4.5 | CFA-grade analyst | **C** | "Rich Dad" branding undercuts a *verified* finance agent's credibility. Pair with SIMONS for data; cite sources. |
| **DR STRANGE** | Forecasting / scenarios | Sonnet 4.5 | Superforecasters (Tetlock), McKinsey | **B** | Strong fit. Make it the standing **Reviewer** for KIYOSAKI/strategy (QDP-2). |
| **SIMONS** | Data / quant | Sonnet 4.5 | FAANG/quant-fund data scientist | **B+** | Well-matched. Wire to real datasets (GA4) so outputs are evidenced, not asserted. |
| **WIDOW** | Security | **qwen3:14b (local)** | Snyk/Semgrep + senior pentester | **C–** | **Under-powered for security.** Local 14B can't reason about real CVEs. Move to Sonnet for S2+ scans. |

### Tier 2 — creative & marketing
| Agent | Role | Model | Best-in-class bar | Grade | Gap → close it |
|---|---|---|---|---|---|
| **AETHERION** | Creative director / visual | Gemini 3.1 Pro (image) | Midjourney v6+, Pentagram/Collins | **C+** | The agent that *should* have made the swim pitch. Make it the mandatory Responsible for all `client-facing-creative` (QDP-2). Give it the versioned brand kit. |
| **VEE** | Brand strategy | Kimi K2.5 | Top brand consultancy | **B–** | Overlaps AETHERION — split cleanly: VEE = strategy/positioning/voice, AETHERION = execution/visuals. VEE is default Reviewer for brand. |
| **INK** | Copywriting | Sonnet 4.5 | Top direct-response copywriter | **B** | Solid. Needs the brand voice guide (versioned) as input, or copy drifts off-brand. |
| **ECHO** | Community / social | qwen3:14b (local) | Head of Community (Discord/Reddit) | **C** | Local model is fine for low-stakes posting; escalate campaign work to Sonnet. |
| **MERCURY** | Sales | Sonnet 4.5 | VP Sales at $100M ARR co. | **B** | Good. Wire to real pipeline data; pair with INK for outbound. |

### Tier 3 — specialized verticals
| Agent | Role | Model | Best-in-class bar | Grade | Gap → close it |
|---|---|---|---|---|---|
| **MICHAEL** | Swim coaching (**METTLE flagship**) | **qwen3:14b (local)** | Olympic coach (ASCA L5), TrainingPeaks | **C–** | **Backwards:** the #1 revenue product runs on the weakest model. Move flagship coaching reasoning to Sonnet; keep local only for cheap chat. |
| **SELAH** | Psychology / wellness | qwen3:14b (local) | Licensed sport psychologist | **C** | Sensitive domain on a weak local model; escalate real check-ins to Sonnet + disclaimers. |
| **PROPHETS** | Spiritual counsel | qwen3:14b (local) | Seminary-level | **B** | Niche; local model acceptable. Scripture-accuracy check. |
| **HAVEN** | Customer success | Sonnet 4.5 | Intercom Fin / Decagon / Sierra | **B** | Strong fit; no live customers yet (so untested). First onboarding is the real test. |

### Tier 4 — technical
| Agent | Role | Model | Best-in-class bar | Grade | Gap → close it |
|---|---|---|---|---|---|
| **SHURI** | Engineering / UI | Sonnet 4.5 | Claude Code, Cursor, Devin | **B+** | Strong, productive (18+ PRs). Make TRIAGE its mandatory reviewer (QDP-2). |
| **PROXIMON** | Architecture / infra | Sonnet 4.5 | AWS Well-Architected, staff eng | **B** | Good. Standing Contributor on architectural code. |
| **NOVA** | "3D fabrication" + "overnight builds" | Sonnet 4.5 | Industrial designer / Fusion 360 | **C+** | **Role confusion:** 3D fab and overnight *software* builds are two different jobs. Split or rename — pick one lane. |
| **TRIAGE** | Debugging / QA | **Haiku 4.5** | SRE, SWE-bench leaders | **B** | Good as the cheap, fast reviewer. For deep RCA on S2 incidents, allow Sonnet escalation. |
| **THEMAESTRO** | Music production (Ramon's brand) | qwen3:14b (local) | Grammy producer; Suno/Udio | **C–** | A *founder-brand* product on a 14B local model. If music matters to the brand, it deserves a real model + Suno/Udio integration. |

### Cross-cutting findings
- **A1 — Model↔stakes inversion.** The two flagship customer/founder products (MICHAEL/METTLE swim, THEMAESTRO music) and security (WIDOW) run on the weakest local model, while internal ops runs on Opus/Sonnet. **Re-tier by stakes, not by habit.**
- **A2 — Atlas is one version behind.** Orchestrator should be on the strongest model available (**Opus 4.7**), since its synthesis/critic quality caps the whole system.
- **A3 — Role overlap.** AETHERION↔VEE (visual/brand) and SHURI↔NOVA↔TRIAGE (code) need clean RACI lanes (QDP-2) or they collide / no one owns.
- **A4 — NOVA identity is two jobs.** "3D fabrication" and "overnight software builds" should not be one agent.
- **A5 — No quality metric exists.** The only number tracked is `tasksCompletedToday` (vanity). Add rework rate, gate-pass rate, critic-revise rate (QDP-6).
- **A6 — Three drifting sources of truth.** `agent-metrics.json` (says DeepSeek V3.2 everywhere), `agents/route.ts` (qwen/claude), and `dashboard-agents.ts` disagree on models. Collapse to **one** source: the version-controlled `directory.json` (QDP-0).

---

## 3. IS THE COMMAND CENTER + CHAT THE HUB? — Yes, with one critical caveat

**Yes.** The Parallax Command Center (`ramiche-site`, `command.parallaxvinc.com/command-center`) is the control plane, and its chat is the human↔agent and agent↔agent interface. It already reads the agent directory, sessions, crons, and runs the orchestrator-worker + critic pipeline. That is the right hub.

**The caveat that makes the incident possible:** today the hub is mostly a **dashboard**, not yet a **control plane** over the *production* agent. The screenshot's Atlas runs through the **OpenClaw gateway** (Telegram), and that path bypasses the Command Center's synthesis/critic/strict-delegation — those are env-gated (`OPENCLAW_CHAT_PRIMARY`, `CC_STRICT_DELEGATION`) and largely run against the Claude Max proxy in the web app, not the live worker.

**To make it the true hub, three things must converge there:**
1. **Authoring** — the QDP routing matrix, DoD checklists, personas (`SOUL.md`), and brand kit are edited and version-controlled *through/alongside* the Command Center (QDP-0/2/3).
2. **Enforcement on the production path** — the same critic + blocking gate (QDP-4/5) run in the OpenClaw runtime, so Telegram-Atlas obeys the same rules as chat-Atlas.
3. **Observation** — per-agent scorecards (QDP-6) render in the Command Center so quality is visible and managed, not anecdotal.

---

## 4. IMPLEMENTATION ROADMAP (file-level)

**Phase 0 — Stop the bleed (this week)**
- `openclaw`: make `verifyDeliverableGate()` **blocking** for S2+ and run it on self-produced deliverables, not just subagent ones (`src/agents/subagent-announce.ts`).
- Version-control the workspace (`~/.openclaw/workspace/` → git): `SOUL.md`, protocol, `directory.json`, `verify-deliverable.sh`, brand kit. (QDP-0)
- Move ATLAS → Opus 4.7; move MICHAEL/WIDOW S2 work → Sonnet. (A1/A2)

**Phase 1 — Encode the system (1–2 weeks)**
- Add the **QDP routing matrix** + **classifier** as a versioned module the runtime consults (this PR ships the classifier primitive — see `openclaw/src/agents/quality-delegation-gate.ts`).
- Promote the chat route's `generateCritique` into a shared runtime primitive (QDP-4) so the OpenClaw path gets the critic pass.
- Write DoD checklists per deliverable type into `verify-deliverable.sh`. (QDP-3)

**Phase 2 — Close the loop (2–4 weeks)**
- Extend `subagent-audit.jsonl` with type/owner/reviewer/verdict/rework. (QDP-6)
- Build the **Agent Scorecard** page in the Command Center (rework rate, gate-pass, critic-revise). Collapse the 3 model sources to `directory.json`. (A5/A6)
- Resolve role overlaps: split NOVA; lane AETHERION/VEE and SHURI/NOVA/TRIAGE via the matrix. (A3/A4)

**North star:** No S2+ deliverable reaches the operator or a client without (a) the right specialist as Responsible, (b) an independent critic verdict of `approve`, and (c) a passing blocking gate — all logged and visible in the Command Center.

---

*This audit is grounded in the current code: `subagent-announce.ts` (verification gate), `runtime-governor-tool-gate.ts` (tool policy), `command-center/chat/route.ts` (synthesis/critic/delegation), `agents/route.ts` + `dashboard-agents.ts` (roster). The single biggest leverage point is QDP-2 (deterministic routing) + QDP-5 (blocking gate) running on the production path — that is what would have caught the swim pitch.*
