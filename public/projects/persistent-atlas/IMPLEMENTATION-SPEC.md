# PERSISTENT ATLAS — Implementation Spec v1.0

**Author:** Atlas | **Requested by:** Ramon | **Date:** 2026-05-07
**Target:** Claude Code (full implementation context included)

---

## Executive Summary

Transform Atlas from a session-based assistant into a persistent, event-driven coordinator that operates continuously — monitoring, reacting, and acting proactively between operator sessions. Built incrementally on existing OpenClaw infrastructure.

---

## Current State (What Exists)

| Component | Status | Location |
|-----------|--------|----------|
| Cron engine | ✅ 35+ jobs, 30-min heartbeat | OpenClaw gateway |
| Agent fleet | ✅ 19 agents, isolated sessions | agents/ directory |
| Memory system | ✅ Daily logs + MEMORY.md | memory/, workspace/ |
| FORGE cycle | ✅ Daily reflection/learning | 5:00-5:30 AM ET |
| Graphify | ✅ 4 project graphs, weekly rebuild | graphify-out/ |
| Telegram delivery | ✅ All agents can message Ramon | channel=telegram |
| Heartbeat | ✅ But HEARTBEAT.md is empty (no active checks) | workspace/HEARTBEAT.md |

**Key limitation:** Atlas only exists during active sessions. Between sessions = dead. Heartbeat fires but does nothing. No event-driven reactivity. No proactive monitoring.

---

## Architecture Overview

```
Phase 1: Enhanced Awareness (cron-based, no code changes)
Phase 2: Event-Driven Reactivity (webhooks + file watchers)
Phase 3: Autonomous Action (approval system + proactive tasks)
Phase 4: True Persistence (always-on event loop — future)
```

Each phase is independently valuable. Ship Phase 1 immediately.

---

## PHASE 1: Enhanced Awareness
**Effort:** Config only (cron jobs + HEARTBEAT.md)
**Dependencies:** None — uses existing OpenClaw cron engine
**Timeline:** Immediate

### 1.1 Activate HEARTBEAT.md

Replace empty HEARTBEAT.md with active monitoring tasks:

```markdown
# HEARTBEAT.md

## Active Checks (run on every heartbeat poll)

### Git Repository Status
- Check for uncommitted changes in: /Users/admin/mettle, /Users/admin/ramiche-site, /Users/admin/GALACTIK-ANTICS 2
- Alert if any repo has >24h of uncommitted work

### Vercel Deploy Status
- Check latest deploy status for: mettlearena.com, parallax-site-ashen.vercel.app, galactik-antics.vercel.app
- Alert on failed deploys

### Stripe Revenue Pulse
- Check Stripe for new charges/disputes in last heartbeat window
- Alert on disputes or failed charges immediately

### Agent Health
- Check cron job error counts via `cron list`
- Alert if any job has consecutiveErrors > 2

### Memory Freshness
- Check if today's memory/YYYY-MM-DD.md exists
- Alert if no entries after 9 AM ET on weekdays
```

### 1.2 Increase Heartbeat Frequency

Current: 30-minute heartbeat (but does nothing)
Target: 10-minute heartbeat with active monitoring

**Implementation:** Create a new cron job that runs every 10 minutes during active hours (7 AM - 11 PM ET):

```
Name: "Atlas Persistent Monitor"
Schedule: cron "*/10 7-23 * * *" tz America/New_York
Session: isolated
Wake: now
Model: claude-haiku (cost-efficient for checks)
Timeout: 120
Delivery: announce telegram 5916658275 (only if alert found)
```

**Prompt for this cron:**
```
You are Atlas running a persistence check. Read HEARTBEAT.md for your task list.
For each check:
1. Run the check (git status, curl, stripe api, cron list)
2. If everything is normal: log nothing, reply HEARTBEAT_OK
3. If something needs attention: report the specific issue to Ramon

Rules:
- Only alert on actionable items
- Never alert on the same issue twice in the same day (check memory/YYYY-MM-DD.md for prior alerts)
- Prefix urgent items with 🚨
- Keep alerts under 50 words each
- If no issues: reply HEARTBEAT_OK (this suppresses delivery)
```

### 1.3 State Snapshot System

Create a periodic state snapshot that persists between sessions:

**New file:** `workspace/STATE.md`

```markdown
# STATE.md — Current System State
<!-- Auto-updated by Atlas Persistent Monitor -->

## Last Updated: [timestamp]

## Projects
| Project | Branch | Uncommitted | Last Deploy | Deploy Status |
|---------|--------|-------------|-------------|---------------|

## Revenue (Last 24h)
- New charges: $X
- Disputes: X
- MRR estimate: $X

## Agent Fleet
- Active crons: X/35
- Erroring crons: [list]
- Last FORGE cycle: [timestamp]

## Alerts (Unresolved)
- [list of open alerts with timestamps]
```

**Cron for state updates:**
```
Name: "Atlas State Snapshot"
Schedule: cron "0 */2 7-23 * * *" tz America/New_York (every 2 hours during active hours)
Model: sonnet
Timeout: 300
Task: "Read current STATE.md. Update all sections with fresh data. Write back to workspace/STATE.md."
```

### 1.4 Smart Session Resume

Modify BOOTSTRAP.md to read STATE.md on startup:

Add to startup sequence:
```
5. Read workspace/STATE.md for current system state
6. If STATE.md has unresolved alerts, surface them immediately
7. Resume from last HANDOFF + current state (not cold boot)
```

This means every new Atlas session starts with full awareness of what happened between sessions.

---

## PHASE 2: Event-Driven Reactivity
**Effort:** Medium (new scripts + webhook handlers)
**Dependencies:** Phase 1 complete

### 2.1 GitHub Webhook Listener

**Purpose:** React to pushes, PR events, CI failures without polling.

**Implementation:**
Create a lightweight Express server that receives GitHub webhooks and triggers OpenClaw sessions:

**File:** `scripts/webhook-listener.mjs`
```javascript
import express from 'express';
import crypto from 'crypto';
import { exec } from 'child_process';

const app = express();
const PORT = 9876;
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

app.use(express.json());

// Verify GitHub signature
function verifySignature(req) {
  const sig = req.headers['x-hub-signature-256'];
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(digest));
}

// Route events to appropriate actions
const handlers = {
  push: (payload) => {
    const repo = payload.repository.name;
    const branch = payload.ref.replace('refs/heads/', '');
    const commits = payload.commits.length;
    const messages = payload.commits.map(c => c.message).join('; ');
    return `GitHub push to ${repo}/${branch}: ${commits} commits. Messages: ${messages}. Check deploy status and run post-push health check.`;
  },

  pull_request: (payload) => {
    const action = payload.action;
    const pr = payload.pull_request;
    return `GitHub PR #${pr.number} ${action} on ${payload.repository.name}: "${pr.title}". Review if needed.`;
  },

  workflow_run: (payload) => {
    if (payload.workflow_run.conclusion === 'failure') {
      return `🚨 CI FAILED on ${payload.repository.name}: ${payload.workflow_run.name}. Investigate immediately.`;
    }
    return null; // Don't trigger on success
  },

  issues: (payload) => {
    if (payload.action === 'opened') {
      return `New issue on ${payload.repository.name}: #${payload.issue.number} "${payload.issue.title}". Triage needed.`;
    }
    return null;
  }
};

app.post('/webhook/github', (req, res) => {
  if (!verifySignature(req)) {
    return res.status(401).send('Bad signature');
  }

  const event = req.headers['x-github-event'];
  const handler = handlers[event];

  if (handler) {
    const message = handler(req.body);
    if (message) {
      // Trigger an OpenClaw session via CLI
      exec(`openclaw session create --agent triage --message "${message.replace(/"/g, '\\"')}" --channel telegram`, (err, stdout) => {
        if (err) console.error('Failed to trigger session:', err);
      });
    }
  }

  res.status(200).send('OK');
});

app.listen(PORT, () => console.log(`Webhook listener on :${PORT}`));
```

**Deployment:**
- Run as a LaunchAgent (auto-restart)
- Expose via Cloudflare Tunnel or ngrok for GitHub to reach
- Register webhook on GitHub repos: mettle, ramiche-site, GALACTIK-ANTICS

### 2.2 Stripe Webhook Handler

**Purpose:** Real-time revenue monitoring, dispute alerts, subscription changes.

Add to webhook-listener.mjs:

```javascript
app.post('/webhook/stripe', express.raw({type: 'application/json'}), (req, res) => {
  const event = JSON.parse(req.body);

  const alertEvents = {
    'charge.dispute.created': (e) => `🚨 DISPUTE: $${e.data.object.amount/100} on charge ${e.data.object.charge}. Respond within 7 days.`,
    'charge.failed': (e) => `Payment failed: $${e.data.object.amount/100} for ${e.data.object.customer}`,
    'customer.subscription.deleted': (e) => `Subscription canceled: ${e.data.object.id}`,
    'invoice.payment_failed': (e) => `Invoice payment failed: $${e.data.object.amount_due/100}`,
    'checkout.session.completed': (e) => `💰 New sale: $${e.data.object.amount_total/100}`,
  };

  const handler = alertEvents[event.type];
  if (handler) {
    const message = handler(event);
    exec(`openclaw session create --agent main --message "${message.replace(/"/g, '\\"')}" --channel telegram`);
  }

  res.status(200).send('OK');
});
```

### 2.3 File Watcher

**Purpose:** Detect changes in project directories and react.

**File:** `scripts/file-watcher.mjs`
```javascript
import { watch } from 'fs';
import { exec } from 'child_process';
import { debounce } from './utils.mjs';

const WATCHED_DIRS = [
  { path: '/Users/admin/mettle/src', name: 'METTLE' },
  { path: '/Users/admin/ramiche-site/src', name: 'Parallax Site' },
];

// Debounce to avoid triggering on every file save during active editing
const triggerAnalysis = debounce((project, files) => {
  const message = `File changes detected in ${project}: ${files.join(', ')}. Update graphify index and check for issues.`;
  exec(`openclaw session create --agent triage --message "${message.replace(/"/g, '\\"')}"`);
}, 300000); // 5-minute debounce

WATCHED_DIRS.forEach(({ path, name }) => {
  watch(path, { recursive: true }, (eventType, filename) => {
    if (filename && !filename.includes('node_modules') && !filename.includes('.next')) {
      triggerAnalysis(name, [filename]);
    }
  });
});

console.log('File watcher active for:', WATCHED_DIRS.map(d => d.name).join(', '));
```

### 2.4 Message Queue / Priority Router

**Purpose:** When multiple events fire simultaneously, process in priority order.

**File:** `scripts/event-queue.mjs`
```javascript
// Priority levels
const PRIORITY = {
  CRITICAL: 0,   // Disputes, CI failures, security alerts
  HIGH: 1,       // Revenue events, deploy failures
  MEDIUM: 2,     // PR events, issue creation
  LOW: 3,        // File changes, routine updates
};

class EventQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  add(event, priority) {
    this.queue.push({ event, priority, timestamp: Date.now() });
    this.queue.sort((a, b) => a.priority - b.priority || a.timestamp - b.timestamp);
    this.process();
  }

  async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const { event } = this.queue.shift();
      await this.executeEvent(event);
    }

    this.processing = false;
  }

  async executeEvent(event) {
    // Rate limit: max 1 session per 30 seconds
    return new Promise((resolve) => {
      exec(`openclaw session create --agent ${event.agent} --message "${event.message}"`, () => {
        setTimeout(resolve, 30000);
      });
    });
  }
}

export const eventQueue = new EventQueue();
```

---

## PHASE 3: Autonomous Action
**Effort:** High (approval system, action classification, guardrails)
**Dependencies:** Phase 2 complete

### 3.1 Action Classification System

Every autonomous action is classified:

| Tier | Description | Approval Required | Examples |
|------|-------------|-------------------|----------|
| **T0 — Read-only** | Observe, log, report | None | Check git status, read files, query APIs |
| **T1 — Low-risk write** | Create/update internal files | None | Update STATE.md, write memory logs, update graphs |
| **T2 — Medium-risk** | Modify code, create PRs | Telegram confirmation button | Create branches, open PRs, update configs |
| **T3 — High-risk** | Deploy, spend money, external comms | Explicit approval via Telegram | Push to prod, send emails, make purchases |
| **T4 — Critical** | Delete, irreversible actions | Double confirmation + cooldown | Delete repos, cancel subscriptions, remove data |

### 3.2 Telegram Approval Flow

**File:** `scripts/approval-engine.mjs`
```javascript
// When a T2+ action is needed:
// 1. Atlas queues the action
// 2. Sends Telegram message with inline buttons: [Approve] [Deny] [Details]
// 3. Waits for button press (timeout: 30 min for T2, 2 hours for T3)
// 4. On approve: execute action, confirm result
// 5. On deny: log reason, skip action
// 6. On timeout: skip action, log as "deferred"

const pendingApprovals = new Map();

async function requestApproval(action) {
  const id = crypto.randomUUID();
  pendingApprovals.set(id, action);

  // Send via OpenClaw message tool with inline buttons
  await sendTelegramMessage({
    to: '5916658275',
    message: `🔐 **Action Request (${action.tier})**\n\n${action.description}\n\nAgent: ${action.agent}\nRisk: ${action.tier}`,
    buttons: [[
      { text: '✅ Approve', callback_data: `approve:${id}` },
      { text: '❌ Deny', callback_data: `deny:${id}` },
      { text: '📋 Details', callback_data: `details:${id}` },
    ]]
  });

  // Wait for response
  return new Promise((resolve) => {
    const timeout = action.tier === 'T2' ? 1800000 : 7200000;
    const timer = setTimeout(() => {
      pendingApprovals.delete(id);
      resolve({ approved: false, reason: 'timeout' });
    }, timeout);

    action.resolve = (approved, reason) => {
      clearTimeout(timer);
      pendingApprovals.delete(id);
      resolve({ approved, reason });
    };
  });
}
```

### 3.3 Proactive Task Engine

Atlas can initiate these tasks without prompting:

| Task | Trigger | Tier | Action |
|------|---------|------|--------|
| Draft content | Content calendar says "due today" | T1 | Write draft to drafts/ |
| Open PR for fixes | Linter finds issues in nightly scan | T2 | Create branch + PR |
| Update dependencies | Weekly audit finds outdated packages | T2 | Create branch + PR |
| Respond to routine messages | Pattern-matched support queries | T3 | Draft response, await approval |
| Deploy hotfix | CI passes on fix branch | T3 | Trigger deploy, await approval |
| Scale resources | Traffic spike detected | T3 | Adjust Vercel/infra settings |

### 3.4 Autonomous Action Log

Every autonomous action (approved or denied) gets logged:

**File:** `memory/autonomous-actions/YYYY-MM-DD.md`
```markdown
## HH:MM — action-slug
- ACTION: what was attempted
- TIER: T0-T4
- TRIGGER: what caused this
- STATUS: approved | denied | timeout | auto-executed
- RESULT: outcome
- AGENT: which agent
```

### 3.5 Daily Autonomy Report

New cron (end of day):
```
Name: "Atlas Autonomy Report"
Schedule: cron "0 21 * * *" tz America/New_York
Model: sonnet
Task: "Summarize today's autonomous actions from memory/autonomous-actions/YYYY-MM-DD.md.
Report: total actions, by tier, approval rate, notable outcomes.
Deliver to Ramon as a brief status card."
```

---

## PHASE 4: True Persistence (Future Architecture)
**Effort:** Architecture change
**Dependencies:** Phases 1-3 proven stable

### 4.1 Always-On Process

Replace session-based architecture with a persistent event loop:

```
┌─────────────────────────────────────────────────┐
│            Persistent Atlas Process              │
│                                                  │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐ │
│  │ Event    │  │ Context   │  │ Action       │ │
│  │ Listener │→ │ Manager   │→ │ Executor     │ │
│  └──────────┘  └───────────┘  └──────────────┘ │
│       ↑              ↑              │            │
│       │         ┌────┴────┐         │            │
│  Webhooks       │ State   │    ┌────┴────┐      │
│  File events    │ Store   │    │ Approval│      │
│  Cron ticks     │ (disk)  │    │ Queue   │      │
│  Messages       └─────────┘    └─────────┘      │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │ Streaming Memory (not file-based)        │   │
│  │ - Rolling context window                 │   │
│  │ - Importance-weighted retention          │   │
│  │ - Cross-session continuity              │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### 4.2 Continuous Context State

Instead of file-based memory with cold-boot resume:
- **Streaming state** that persists to disk every 60 seconds
- **Importance scoring** — recent events decay, critical events persist
- **Associative recall** — query context by relevance, not just recency
- **Zero startup cost** — process is already running, context is already loaded

### 4.3 Self-Monitoring

Atlas monitors itself:
- Token usage per hour/day
- Action success rate
- Response latency to events
- Memory utilization
- Auto-scaling: reduce check frequency during quiet periods, increase during active periods

---

## Guardrails (All Phases)

### Spending Caps
| Scope | Limit | Enforcement |
|-------|-------|-------------|
| Per autonomous session | $0.50 | Model cost tracking |
| Per hour (all autonomous) | $2.00 | Rate limiter |
| Per day (all autonomous) | $10.00 | Hard kill switch |
| Per month (all autonomous) | $200.00 | Monthly audit |

### Kill Switches
1. **Telegram command:** `/kill` → immediately stops all autonomous sessions
2. **File-based:** Create `workspace/KILL_SWITCH` → all autonomous actions halt
3. **Cron disable:** `cron disable <monitor-id>` → stops heartbeat
4. **Gateway restart:** `openclaw gateway restart` → clears all active sessions

### Drift Prevention
- Every autonomous action is logged with full context
- Weekly "autonomy review" cron compares actions vs. operator intent
- If approval denial rate exceeds 30% in any week → auto-reduce autonomy tier
- Monthly operator review of all T2+ actions

### Safety Boundaries (Never Cross)
- ❌ Never send external communications without T3 approval
- ❌ Never delete production data
- ❌ Never modify billing/subscription settings
- ❌ Never push to main branch without approval
- ❌ Never access systems outside defined project scope
- ❌ Never spend money (purchases, subscriptions, API costs beyond caps)

---

## Implementation Order for Claude Code

### Step 1: Phase 1 Setup (Do First)
1. Update `workspace/HEARTBEAT.md` with active monitoring checks
2. Create `workspace/STATE.md` template
3. Create the "Atlas Persistent Monitor" cron (10-min, haiku, active hours)
4. Create the "Atlas State Snapshot" cron (2-hour, sonnet, active hours)
5. Update `workspace/BOOTSTRAP.md` to include STATE.md in startup sequence
6. Test: force-run both crons, verify output

### Step 2: Phase 2 Infrastructure (After Phase 1 Proven)
1. Create `scripts/webhook-listener.mjs`
2. Create `scripts/file-watcher.mjs`
3. Create `scripts/event-queue.mjs`
4. Create LaunchAgent plist for webhook listener
5. Set up Cloudflare Tunnel for webhook exposure
6. Register GitHub webhooks on repos
7. Register Stripe webhook endpoint
8. Test: push to repo, verify event triggers session

### Step 3: Phase 3 Autonomy (After Phase 2 Proven)
1. Create `scripts/approval-engine.mjs`
2. Create action classification config
3. Create `memory/autonomous-actions/` directory
4. Create "Atlas Autonomy Report" cron
5. Implement Telegram inline button approval flow
6. Define proactive task triggers
7. Test: simulate T2 action, verify approval flow

### Step 4: Phase 4 Architecture (Future)
- Research persistent process architecture
- Design streaming memory system
- Prototype and test

---

## Files This Spec Creates/Modifies

| File | Action | Phase |
|------|--------|-------|
| `workspace/HEARTBEAT.md` | Update (add monitoring tasks) | 1 |
| `workspace/STATE.md` | Create (system state template) | 1 |
| `workspace/BOOTSTRAP.md` | Update (add STATE.md to startup) | 1 |
| `scripts/webhook-listener.mjs` | Create | 2 |
| `scripts/file-watcher.mjs` | Create | 2 |
| `scripts/event-queue.mjs` | Create | 2 |
| `scripts/approval-engine.mjs` | Create | 3 |
| `memory/autonomous-actions/` | Create directory | 3 |

**Cron jobs created:**
| Name | Schedule | Model | Phase |
|------|----------|-------|-------|
| Atlas Persistent Monitor | */10 7-23 * * * ET | claude-haiku | 1 |
| Atlas State Snapshot | 0 */2 7-23 * * * ET | sonnet | 1 |
| Atlas Autonomy Report | 0 21 * * * ET | sonnet | 3 |

---

## Success Metrics

| Metric | Phase 1 Target | Phase 3 Target |
|--------|---------------|----------------|
| Issues caught before Ramon notices | 2/week | 10/week |
| Context recovery time (session start) | <30 seconds | <5 seconds |
| Revenue events detected in real-time | 0 (polling only) | 100% |
| Autonomous tasks completed/day | 0 | 5-10 |
| Operator intervention reduction | 10% | 50% |

---

*Persistent Atlas Spec v1.0 — 2026-05-07. Written by Atlas. Awaiting Claude Code implementation.*
