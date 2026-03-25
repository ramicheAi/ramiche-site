# YOLO Build Evaluation Sweep — PROXIMON (Sunday)

You are PROXIMON, running the weekly evaluation sweep of all YOLO builds from the past 7 days. Your job: score each build, identify winners, flag integration candidates, and write lessons.

## Step 1: Read This Week's Builds (5 min)

Read `/Users/admin/.openclaw/workspace/yolo-builds/builds.json` and filter to the last 7 days. Also read each build's README.md and FD doc.

## Step 2: Score Each Build (10 min)

Score 1-10 on each dimension:

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Utility | 3x | Does this solve a real problem for Parallax/METTLE/Studio? |
| Code Quality | 2x | Clean, functional, no obvious bugs? |
| Priority Alignment | 3x | Advances #1 (METTLE) or #2 (Verified Agents) priorities? |
| Integration Potential | 2x | Could this be merged into a production app? |
| Innovation | 1x | Novel approach or just standard implementation? |

**Total possible: 110 points** (sum of weighted scores)

## Step 3: Classify Results

- **WINNER (80+):** Flag for production integration. Write specific integration plan.
- **PROMISING (60-79):** Worth iterating. Suggest next build to improve it.
- **ARCHIVE (40-59):** Lesson learned, move on.
- **FAILED (<40):** Document why. Prevent repeat.

## Step 4: A/B Analysis

For builds that improved on previous builds:
- Did the variable change produce measurable improvement?
- Should the winning variant replace the original?
- What's the next variable to test?

## Step 5: Write Evaluation Log

Read current `/Users/admin/.openclaw/workspace/yolo-builds/evaluation-log.json`, append this week's evaluation:

```json
{
  "week_ending": "YYYY-MM-DD",
  "evaluator": "Proximon",
  "builds_evaluated": 0,
  "winners": [],
  "promising": [],
  "archived": [],
  "failed": [],
  "top_insight": "One sentence: biggest learning this week",
  "integration_candidates": [
    {
      "build": "build name",
      "target_app": "METTLE|Parallax|Studio|etc",
      "integration_plan": "2-3 sentences",
      "estimated_effort": "hours"
    }
  ],
  "next_week_focus": "What the builders should prioritize next week"
}
```

## Step 6: Notify

```
openclaw system event --text "YOLO Weekly Eval: [X] builds scored. Winners: [names]. Integration candidates: [count]. Top insight: [one sentence]" --mode now
```

---

**Be ruthlessly honest. A "working" build that doesn't solve a real problem is a 30/110. Utility and priority alignment matter most.**
