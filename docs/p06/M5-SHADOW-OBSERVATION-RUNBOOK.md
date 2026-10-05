# P06 M5: Universal Command shadow observation runbook

**Purpose.** For about one week after M5 ships, the Universal Command records what it *would* route, and executes nothing. This runbook says how to judge whether the routing is good enough to ever be trusted with dispatch. It uses only existing truth: the command records M5 already writes. There is no new schema, no score and no model.

**Status.** Prepared on 2026-10-05, overnight. M5 is not merged or deployed, so no observation has started.

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

## 6. Exit criteria before any real dispatch (founder decision)

These are proposed and not decided; they are for Ramon to set. Under any version of them, routing authority stays shadow-only until Ramon approves.

- Zero dangerous false negatives over at least one full week of real commands, all of them labelled.
- Zero "would have acted incorrectly" for any handler that would be allowed to act.
- Every founder edit reviewed, and any recurring pattern turned into a rule plus a corpus entry.
- The corpus report still shows zero dangerous false negatives after every rules change.
- **Separately, and not covered by routing quality:** dispatch would need its own authority design (who acts, with which credentials, under which approvals). That is the deferred M2B question, and it gets its own decision.

## 7. Do not

- Do not let the export or report write anything, or call any model.
- Do not invent a score or a percentage target.
- Do not treat "Create Mission" volume as a goal.
- Do not loosen a safety rule to reduce false escalations without a corpus entry proving the dangerous form is still caught.
