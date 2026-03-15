# Pre-Build Checklist — MANDATORY for All Big Builds

**HARD RULE:** Before writing a single line of code on any feature, page, tool, or product that touches >50 lines — complete this checklist. No exceptions.

---

## Phase 1: Research (ByteByteGo)

- [ ] **Consult ByteByteGo PDF** for architectural patterns relevant to the build
- [ ] Identify: auth method, data flow, caching strategy, error handling pattern
- [ ] Document decisions in project's `DECISIONS.md`
- [ ] Security scan: check OWASP top 10 relevance
- [ ] Performance: identify N+1 queries, bundle size concerns, lazy loading needs

**Output:** Architecture brief (5-10 bullets) saved to project `DECISIONS.md`

## Phase 2: Design (UI/UX Pro Max + Stitch MCP)

- [ ] **Read UI/UX Pro Max SKILL.md** — select style, palette, font pairing
- [ ] Apply Ramon's UI rules: fill screen, thick borders, breathing room, no max-w caps
- [ ] Choose component patterns from the 57 UI styles catalog
- [ ] **Run Stitch MCP preview** — generate visual mockup before coding
- [ ] Get Ramon's approval on the visual direction (screenshot in chat)

**Output:** Visual mockup + design tokens (colors, spacing, typography) documented

## Phase 3: Plan (Reverse Engineer)

- [ ] Define the **end state** first — what does "done" look like?
- [ ] Work backwards: identify every component, route, API call, state
- [ ] Write the full task breakdown in project's `TASKS.md`
- [ ] Each task must be <300 lines of code
- [ ] Define commit message template for each task
- [ ] Assign to builder agent(s) with exact file paths + line ranges

**Output:** Task breakdown in `TASKS.md`, pipeline updated in `PIPELINE.md`

## Phase 4: Build (Small Steps)

- [ ] One task at a time through the pipeline
- [ ] Build → Test → Commit → Deploy → Verify for EACH piece
- [ ] Never batch changes
- [ ] Browser verify before marking VERIFIED

## Phase 5: Verify

- [ ] curl the live URL — check HTTP 200, correct content
- [ ] Test on mobile (or report to Ramon for device check)
- [ ] Check console for errors
- [ ] Confirm no regressions on existing features
- [ ] Update project `PIPELINE.md` with VERIFIED status

---

## When to Skip (Only These Cases)

- Single-line bug fix (typo, wrong variable)
- Adding a comment or docstring
- Config file change (<10 lines)

Everything else goes through the checklist. Period.
