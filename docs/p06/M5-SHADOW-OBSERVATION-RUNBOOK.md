# P06 M5: Universal Command shadow observation runbook

**Purpose.** For about one week after M5 ships, the Universal Command records what it *would* route, and executes nothing. This runbook says how to judge whether the routing is good enough to ever be trusted with dispatch. It uses only existing truth: the command records M5 already writes. There is no new schema, no score and no model.

**Status.** Prepared on 2026-10-05. M5 is not merged or deployed, so no observation has started. Section 6 is a proposed default gate; Ramon remains the final authority.

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

## 6. Proposed default exit gate for the shadow week (a proposal; Ramon decides)

The gate is a set of independent categories. Each one is checked on its own, and there is no composite score. Thresholds are deliberately conservative.

**Minimum sample, or the verdict is EXTEND SHADOW.** At least 7 calendar days, at least 40 real commands, and every command labelled by the founder (see sections 3 and 4).

| # | Category | How it is checked | Pass |
|---|---|---|---|
| G1 | Dangerous false negatives | Labelled `human`, router chose a handler (report) | **0** |
| G2 | Founder-only authority reaching an agent | Any command in a founder-only category (git/release, external communication, money, Mission lifecycle, destructive data, credentials) routed to an acting handler. Labels plus the escalation-reason list | **0** |
| G3 | Route edits auditable | Every founder edit has a superseding record, and each superseded record still exists (report "superseded by founder edit" matches the edit count) | **all** |
| G4 | No external execution from shadow | `execution_events` rows correlated to a command message id; jobs created by the shadow route; bridge relay logs mentioning a command id | **0** each |
| G5 | No command accepted as evidence | `mission_links` with `relation = 'evidence'` pointing at a command message or the command channel (one read-only query) | **0** |
| G6 | Explicit-handler accuracy | Among explicit routes, label = decision | **all**, excluding founder-authority overrides, which are correct by design |
| G7 | Deterministic-rule accuracy | Among deterministic non-founder routes, label = decision | **at most 2 mismatches**, none in an acting handler |
| G8 | False founder escalations | Router chose `human`, label says an agent | **measured and reviewed**; does not block, because it is safe; if more than 5, tune with corpus entries |
| G9 | Ambiguity asks rather than guesses | Every `ambiguous` route has a question and no handler; no labelled-ambiguous command was given a handler | **all** |
| G10 | No leakage into chat or history | Command text in the chat channel list, search, pulse, Decisions, health or gallery responses, or in agent conversation history (spot-check plus the exclusion tests in CI) | **0** |
| G11 | No model or cost from routing | `execution_events` rows with a purpose or correlation tied to routing during the week (deterministic routing calls no model) | **0** |
| G12 | Corpus regression | `node scripts/command-shadow-report.mjs --corpus` after every rules change | **0** dangerous false negatives, exit 0 |

**Verdict rule.**
- **GO:** every blocking category (G1 to G7, G9 to G12) passes and the minimum sample is met. GO means only that routing quality is proven. It grants no dispatch authority; that needs its own design and decision (see the M2B assessment).
- **EXTEND SHADOW:** the sample is short, or G7 has 1 or 2 mismatches, or G8 shows a repeated pattern still being tuned. All of G1, G2, G4, G5, G10 and G11 must still be clean.
- **NO-GO:** any failure in G1, G2, G4, G5, G10 or G11. Fix it, add corpus entries, and restart the week.

G4, G5, G10 and G11 are read-only checks Ramon (or a read-only session) runs; nothing here writes.

```sql
-- G5: a command accepted as evidence (expect 0 rows; M2 refuses this, so any row is a defect)
select l.* from public.mission_links l
 where l.relation = 'evidence' and l.removed_at is null
   and ((l.target_type = 'chat_message' and l.target_id in (
          select id::text from public.messages where channel_id = 'af58dead-cb94-51a4-98e5-d353eca43241'))
     or (l.target_type = 'chat_channel' and l.target_id = 'af58dead-cb94-51a4-98e5-d353eca43241'));

-- G4 / G11: telemetry correlated to a command message (expect 0 rows)
select e.id, e.provider, e.purpose, e.correlation_type, e.correlation_id from public.execution_events e
 where e.correlation_type = 'chat_message' and lower(e.correlation_id) in (
       select id::text from public.messages where channel_id = 'af58dead-cb94-51a4-98e5-d353eca43241');
```

## 7. Do not

- Do not let the export or report write anything, or call any model.
- Do not invent a score or a percentage target.
- Do not treat "Create Mission" volume as a goal.
- Do not loosen a safety rule to reduce false escalations without a corpus entry proving the dangerous form is still caught.
