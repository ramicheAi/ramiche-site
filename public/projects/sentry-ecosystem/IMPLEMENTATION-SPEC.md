# Sentry Ecosystem-Wide Implementation Spec

**Goal:** Every RAMICHE project gets Sentry error tracking with automated alert → triage → fix pipeline, modeled on @buildwithcormac's workflow but adapted for our Atlas/OpenClaw stack.

---

## Current State

| Project | Sentry SDK | DSN Active | Source Maps | Alerting | Auto-Fix |
|---------|-----------|------------|-------------|----------|----------|
| METTLE | ✅ @sentry/nextjs 10.53.1 | ✅ | ⚠️ Config exists but SENTRY_AUTH_TOKEN not set | ❌ | ❌ |
| ramiche-site | ❌ | ❌ | ❌ | ❌ | ❌ |
| Galactik Antics | ❌ | ❌ | ❌ | ❌ | ❌ |

**Mettle gaps:** Auth token missing (no source maps in prod), no alert rules, no webhook integration, no auto-fix pipeline.

---

## Target State (Cormac's workflow adapted)

```
Error in production
  → Sentry captures it (SDK)
  → Sentry alert rule fires (webhook)
  → Atlas webhook listener receives it
  → Atlas creates GitHub Issue (auto-triage)
  → Atlas sends Telegram alert to Ramon
  → Atlas spawns Claude Code agent to fix (auto-fix)
  → Fix PR created, CI runs, Ramon approves merge
```

**Our equivalents to Cormac's stack:**
- His Slack → our **Telegram**
- His Linear → our **GitHub Issues**
- His Cursor agent → our **Claude Code via coding-agent skill**
- His manual @Linear command → our **Atlas auto-dispatch**

---

## Implementation Phases

### Phase 1: SDK Installation (ramiche-site + Galactik Antics)

For each project, replicate Mettle's proven config:

**1a. Install SDK**
```bash
cd /Users/admin/ramiche-site && npm install @sentry/nextjs
cd "/Users/admin/GALACTIK-ANTICS 2" && npm install @sentry/nextjs
```

**1b. Create config files (per project)**

Copy from Mettle as template, adjust DSN:
- `sentry.client.config.ts` — browser error tracking + PII scrubbing
- `sentry.server.config.ts` — API route + server component errors
- `sentry.edge.config.ts` — middleware errors
- `src/instrumentation.ts` — runtime-aware Sentry init
- `src/app/error.tsx` — component error boundary with Sentry.captureException
- `src/app/global-error.tsx` — root error boundary

**1c. Wrap next.config.ts**
```typescript
import { withSentryConfig } from "@sentry/nextjs";
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  sourcemaps: { disable: false },
  disableLogger: true,
  automaticVercelMonitors: false,
});
```

**1d. Create Sentry projects**

In Sentry dashboard (org `o4511395509698560`):
- Create project: `ramiche-site` (Next.js platform)
- Create project: `galactik-antics` (Next.js platform)
- Copy DSNs to each project's `.env.local` and Vercel env vars

**1e. Set auth tokens for source maps**

For ALL three projects:
- Generate org-level auth token at sentry.io → Settings → Auth Tokens
- Set in each project's `.env.local` + Vercel env vars:
  - `SENTRY_AUTH_TOKEN=<token>`
  - `SENTRY_ORG=<org-slug>`
  - `SENTRY_PROJECT=<project-slug>`

---

### Phase 2: Alert Rules + Webhook Integration

**2a. Sentry webhook secret**

Generate a shared webhook secret for HMAC verification:
```bash
openssl rand -hex 32 > /Users/admin/.openclaw/workspace/secrets/sentry-webhook-secret
chmod 600 /Users/admin/.openclaw/workspace/secrets/sentry-webhook-secret
```

**2b. Sentry alert rules (per project)**

In each Sentry project, create alert rules:

1. **"New Issue" alert** — triggers on first occurrence of any new error
   - Action: Send webhook to `https://command.parallaxvinc.com/webhooks/sentry`
   - Frequency: Once per issue

2. **"High Volume" alert** — triggers when error count > 50 in 1 hour
   - Action: Send webhook (same URL)
   - Frequency: Once per hour

3. **"Regression" alert** — triggers when a resolved issue recurs
   - Action: Send webhook (same URL)
   - Frequency: Once per issue

**2c. Extend webhook listener**

Add Sentry handler to `/Users/admin/.openclaw/workspace/scripts/webhook-listener/server.mjs`:

```javascript
// New route: /webhooks/sentry
// HMAC verification using sentry-webhook-secret
// Extract: project, issue title, URL, stack trace, first seen, event count
// Spawn Atlas cron with event context
```

**2d. Cloudflare tunnel ingress**

Add to `~/.cloudflared/config.yml`:
```yaml
- hostname: command.parallaxvinc.com
  path: ^/webhooks/sentry
  service: http://localhost:9876
```

(Already covered by existing `/webhooks/*` wildcard rule — verify.)

---

### Phase 3: Auto-Triage (GitHub Issues)

When Atlas receives a Sentry webhook:

**3a. Create GitHub Issue**

```bash
gh issue create \
  --repo ramicheAi/<project> \
  --title "[Sentry] <error-title>" \
  --body "## Sentry Error\n\n**Project:** <project>\n**Issue URL:** <sentry-url>\n**First Seen:** <timestamp>\n**Events:** <count>\n\n### Stack Trace\n\`\`\`\n<stacktrace>\n\`\`\`\n\n### Auto-Fix\nAtlas will attempt automated fix. Label: `sentry-auto`" \
  --label "bug,sentry-auto"
```

**3b. Send Telegram alert**

```
🚨 SENTRY: <project>
Error: <title>
Events: <count>
Issue: <github-issue-url>
Auto-fix: spawning...
```

---

### Phase 4: Auto-Fix Pipeline

When Atlas creates the GitHub issue:

**4a. Spawn coding agent**

```bash
openclaw cron add \
  --at "10s" \
  --delete-after-run \
  --agent atlas \
  --session isolated \
  --model claude-max/claude-sonnet-4-5-20250929 \
  --message "SENTRY AUTO-FIX: Fix the following error in <project>.

Error: <title>
Stack trace: <stacktrace>
File: <filename>:<line>

Instructions:
1. Read the file and understand the error
2. Fix the root cause (not just suppress)
3. Create a branch: fix/sentry-<issue-number>
4. Commit and push
5. Create PR referencing the GitHub issue
6. Report result to Telegram

Repo: /Users/admin/<project-path>
GitHub Issue: <issue-url>"
```

**4b. Fix verification**

The coding agent must:
- Run `npm run build` to verify no new errors
- Run `npm run lint` if available
- Create PR with:
  - Title: `fix: [Sentry] <error-title>`
  - Body: references Sentry issue URL + GitHub issue
  - Label: `sentry-auto`

**4c. Ramon approves merge**

Auto-fix PRs are NOT auto-merged. Ramon reviews and merges.
This is a T2 action — PR creation is allowed, merge requires approval.

---

### Phase 5: Monitoring Integration

**5a. Add Sentry check to monitor.sh**

New critical-tier check:

```bash
# C4: Sentry unresolved issues spike
# If any project has >10 unresolved issues in last hour → alert
```

Requires `sentry-cli` installation:
```bash
npm install -g @sentry/cli
```

**5b. STATE.md integration**

Add Sentry section to state snapshot:
```
## Sentry
- mettle: X unresolved issues (Y in last 24h)
- ramiche-site: X unresolved issues (Y in last 24h)
- galactik-antics: X unresolved issues (Y in last 24h)
```

---

## File Changes Summary

### New Files
| File | Project | Purpose |
|------|---------|---------|
| sentry.client.config.ts | ramiche-site | Browser error tracking |
| sentry.server.config.ts | ramiche-site | Server error tracking |
| sentry.edge.config.ts | ramiche-site | Edge error tracking |
| src/instrumentation.ts | ramiche-site | Runtime Sentry init |
| src/app/error.tsx | ramiche-site | Error boundary (if missing) |
| src/app/global-error.tsx | ramiche-site | Root error boundary (if missing) |
| sentry.client.config.ts | galactik-antics | Browser error tracking |
| sentry.server.config.ts | galactik-antics | Server error tracking |
| sentry.edge.config.ts | galactik-antics | Edge error tracking |
| src/instrumentation.ts | galactik-antics | Runtime Sentry init |
| src/app/error.tsx | galactik-antics | Error boundary (if missing) |
| src/app/global-error.tsx | galactik-antics | Root error boundary (if missing) |
| secrets/sentry-webhook-secret | workspace | Webhook HMAC secret |

### Modified Files
| File | Project | Change |
|------|---------|--------|
| next.config.ts | ramiche-site | Add withSentryConfig wrapper |
| next.config.ts | galactik-antics | Add withSentryConfig wrapper |
| .env.local | ramiche-site | Add SENTRY_* vars |
| .env.local | galactik-antics | Add SENTRY_* vars |
| .env.local | mettle | Add missing SENTRY_AUTH_TOKEN/ORG/PROJECT |
| server.mjs | webhook-listener | Add /webhooks/sentry handler |
| monitor.sh | workspace | Add C4 Sentry check |
| config.yml | cloudflared | Verify sentry path (may already work) |
| HEARTBEAT.md | workspace | Document C4 check |
| MEMORY.md | workspace | Add Sentry infrastructure section |

### Vercel Env Vars (per project)
| Variable | Value |
|----------|-------|
| NEXT_PUBLIC_SENTRY_DSN | (from Sentry project) |
| SENTRY_AUTH_TOKEN | (org-level token) |
| SENTRY_ORG | (org slug) |
| SENTRY_PROJECT | (project slug) |

---

## Execution Order

1. **Phase 1** — SDK install on ramiche-site + Galactik (can be parallelized)
2. **Phase 1e** — Fix Mettle's missing auth token (source maps)
3. **Phase 2** — Webhook listener extension + Sentry alert rules
4. **Phase 3** — GitHub issue auto-creation
5. **Phase 4** — Auto-fix agent pipeline
6. **Phase 5** — Monitoring integration

**Dependencies:**
- Phase 2 depends on Phase 1 (need DSNs and active projects)
- Phase 3 depends on Phase 2 (need webhook handler)
- Phase 4 depends on Phase 3 (need issue creation)
- Phase 5 depends on sentry-cli installation

---

## Differences from Cormac's Setup

| Aspect | Cormac | Us | Advantage |
|--------|--------|-----|-----------|
| Alert channel | Slack | Telegram | Same — operator gets notified |
| Issue tracker | Linear | GitHub Issues | Simpler — already using GitHub |
| AI agent | Cursor (via Linear) | Claude Code (via Atlas) | More flexible — full coding-agent skill |
| Trigger | Manual @Linear in Slack | Auto via webhook | Faster — no manual step |
| Fix approval | Unknown | T2 — PR created, Ramon merges | Safer — human in the loop |
| Multi-project | Single project | 3+ projects unified | Broader coverage |
| Monitoring | Sentry dashboard only | Sentry + monitor.sh + STATE.md | Deeper — integrated with fleet |

---

## Risk Assessment

- **Low risk:** SDK installation (Phase 1) — proven pattern from Mettle
- **Medium risk:** Webhook handler (Phase 2) — new code in critical listener
- **Low risk:** GitHub issue creation (Phase 3) — straightforward gh CLI
- **Medium risk:** Auto-fix agent (Phase 4) — coding agent may produce bad fixes
- **Mitigation:** All auto-fixes go through PR review, never auto-merged
