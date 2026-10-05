# P06 M5: Universal Command shadow observation runbook

**Purpose.** For about one week after M5 ships, the Universal Command records what it *would* route, and executes nothing. This runbook says how to judge whether the routing is good enough to ever be trusted with dispatch. It uses only existing truth: the command records M5 already writes. There is no new schema, no score and no model.

**Status.** M5 was merged to `p06/cockpit-packets123-integration` as `1117c7cf` (PR #42). Pre-deployment acceptance is M5A. M5 is **not deployed**, so no observation has started. Section 6 is the proposed gate; Ramon remains the final authority.

---

## 1. What is recorded (already, by M5)

Each palette "Shadow-route" writes one `messages` row:

- **Where:** the tenant's dedicated channel, slug `universal-command`, with deterministic id `af58dead-cb94-51a4-98e5-d353eca43241` for the cockpit tenant `11111111-…`.
- **Content:** the command text.
- **Metadata:**
  - `kind: "universal_command_shadow"`, `shadow: true`, `executed: false`
  - `routerVersion`, `routedAt`, `missionContext`, `supersedes`
  - `decision`: handler, reviewer, source, reasons, question, approval flags

An **Edit routing** writes a new row whose `supersedes` points at the old one. **Create Mission** and **Attach** write ordinary M2 `mission_links` rows (`target_type = 'chat_message'`, relation `source` or `context`).

## 2. Weekly export (read-only; Ramon runs it, nothing writes)

Run this in the Supabase SQL editor. It is a plain `select`.

```sql
select m.id, m.content, m.created_at, m.metadata,
       coalesce((select json_agg(json_build_object('relation', l.relation, 'mission_id', l.mission_id))
                   from public.mission_links l
                  where l.target_type = 'chat_message' and l.target_id = m.id::text and l.removed_at is null), '[]'::json) as "linkedMissions"
  from public.messages m
 where m.tenant_id = '11111111-1111-1111-1111-111111111111'
   and m.channel_id = 'af58dead-cb94-51a4-98e5-d353eca43241'
   and m.metadata->>'kind' = 'universal_command_shadow'
   and m.created_at >= now() - interval '7 days'
 order by m.created_at;
```

Save the result as JSON (for example `shadow-week1.json`). It contains your own command text, so keep it local.

## 3. Label (founder, about 10 minutes)

For each command, write down which handler *should* have taken it. Use `human` for anything that was yours to decide. Write the labels as `labels.json`:

```json
[{ "id": "<message id>", "expect": "claude_code" }, { "id": "<id>", "expect": "human" }, { "id": "<id>", "expect": null }]
```

`null` means it really was ambiguous and a question was the right answer. Unlabelled commands still count in the observable categories.

## 4. Report (offline, no network)

```
node scripts/command-shadow-report.mjs --records shadow-week1.json --labels labels.json
```

The report needs Node 23.6 or later. It exits 1 if there is any dangerous false negative. `--corpus` runs the same report over the bundled adversarial corpus (`src/lib/command/fixtures/route-corpus.ts`) as a baseline.

## 5. What each category means and what to do with it

Every figure in the report is a count or "n of m". There is no composite score.

| Category | What it is | Action |
|---|---|---|
| **Dangerous false negatives** | You labelled it `human`, but the router chose an agent | **Any non-zero count blocks dispatch.** Add the phrasing to the corpus, fix `authority.ts` and mutation-check it. |
| **Would have acted incorrectly** | The router chose an acting handler (Claude Code, OpenClaw, cockpit agent, existing job), but the wrong one | Fix the rule if there's a pattern; otherwise note it. Blocks dispatch for that handler. |
| **False founder escalations** | The router sent it to you, but an agent was fine | Expected and safe. Fix only if one phrasing recurs. |
| **Other mismatches** | Wrong among non-acting handlers (research vs chat) | Low stakes. Tune later. |
| **Ambiguous** | No rule decided it; a question was returned | Fine, if the question was the right answer. Repeated ambiguity on similar text is a candidate rule. |
| **Founder edits / superseded** | You re-routed by hand | Each one is a disagreement with the router. Read them all. |
| **Handler distribution** | Final decisions by handler | Context for the categories above, not a target. |
| **Founder escalations by reason** | Which safety rule fired | Shows which consequential areas dominate. |
| **Missions created / attached** | Commands that became or joined a Mission | Tells you whether the Mission bridge is used. A low count is information, not a failure. |
| **Replay drift** | Today's rules route a recorded command differently | Expected after a rules change. Check that each drift is an improvement. |

## 6. Shadow-week exit gate (proposed; Ramon decides)

Each category is checked on its own; there is no composite score. **Passing this gate grants no dispatch authority.** Real dispatch needs a separate, explicit founder decision and its own authority design (see `M2B-NEED-ASSESSMENT.md`).

### SAFETY: every count must be zero

| # | Category | How it is checked |
|---|---|---|
| S1 | Dangerous false negatives | Founder labelled it `human`, router chose a handler (report: "DANGEROUS false negatives") |
| S2 | Founder-only acts routed to an agent | Any command in a founder-only category (git/release, external communication, money, Mission lifecycle, destructive data, credentials) routed to an acting handler (labels + escalation-reason list) |
| S3 | Routing-triggered external execution | Jobs created by a shadow route; bridge relay logs mentioning a command id; `execution_events` correlated to a command message (query below) |
| S4 | Routing-triggered model / provider call | `execution_events` tied to routing during the week (deterministic routing calls no model) |
| S5 | Command accepted as Mission evidence | `mission_links` with `relation = 'evidence'` pointing at a command message or the command channel (query below) |
| S6 | Command leaking into chat / history surfaces | Command text in the chat channel list, search, pulse, Decisions, health or gallery, or in agent history (spot-check; the exclusion tests also run in CI) |

### QUALITY

| # | Category | Pass |
|---|---|---|
| Q1 | Explicit routes match the founder label | **all** (founder-authority overrides of a named handler are correct by design) |
| Q2 | Deterministic routes | **no consequential misroute**: no deterministic route that gave an acting handler a command the founder labelled differently |
| Q3 | Ambiguous requests ask rather than guess | every `ambiguous` route has a question and no handler |
| Q4 | Route edits / supersedes auditable | every founder edit has a superseding record and every superseded record still exists |
| Q5 | False founder escalations | **measured separately** (report: "false founder escalations"); they do not block, because they are safe; recurring ones become corpus entries |

### SAMPLE

At least **7 calendar days** and at least **40 founder-labelled real commands**.

### OUTCOME

- **GO:** every SAFETY count is 0, Q1 to Q4 pass, and the sample is met. GO means only that routing quality is proven.
- **EXTEND SHADOW:** the sample is too small, or only minor non-safety mismatches remain (for example a research vs chat mix-up). SAFETY must still be clean.
- **NO-GO:** any SAFETY failure. Fix it, add corpus entries, rerun `--corpus`, and restart the week.

Also, after any rules change, `node scripts/command-shadow-report.mjs --corpus` must exit 0, with 0 dangerous false negatives.

S3, S4, S5 and S6 are read-only checks Ramon (or a read-only session) runs; nothing here writes.

```sql
-- S5: a command accepted as evidence (expect 0 rows; M2 refuses this, so any row is a defect)
select l.* from public.mission_links l
 where l.relation = 'evidence' and l.removed_at is null
   and ((l.target_type = 'chat_message' and l.target_id in (
          select id::text from public.messages where channel_id = 'af58dead-cb94-51a4-98e5-d353eca43241'))
     or (l.target_type = 'chat_channel' and l.target_id = 'af58dead-cb94-51a4-98e5-d353eca43241'));

-- S3 / S4: telemetry correlated to a command message (expect 0 rows)
select e.id, e.provider, e.purpose, e.correlation_type, e.correlation_id from public.execution_events e
 where e.correlation_type = 'chat_message' and lower(e.correlation_id) in (
       select id::text from public.messages where channel_id = 'af58dead-cb94-51a4-98e5-d353eca43241');
```

## 7. Do not

- Do not let the export or report write anything, or call any model.
- Do not invent a score or a percentage target.
- Do not treat "Create Mission" volume as a goal.
- Do not loosen a safety rule to reduce false escalations without a corpus entry proving the dangerous form is still caught.
