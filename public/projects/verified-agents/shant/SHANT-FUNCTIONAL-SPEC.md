# SHANT ONBOARDING — Functional Spec & Implementation Plan
## Friday, April 4 · 12 PM ET · 2.5-hour Zoom

---

## PART 1: WHAT WE NEED TO BUILD

### Deliverable 1: Marketing Agency Agent Config
**What:** Pre-built OpenClaw config with 5 agents tailored for a marketing agency funnel workflow.
**Why:** Shant opens OpenClaw and it already speaks his language — funnels, copy, campaigns.
**Files needed:**
- `SOUL.md` — personality tuned for marketing agency ops (not dev ops)
- `AGENTS.md` — 5 agents: COPY (copywriter), CANVAS (design), FUNNEL (GHL builder), ANALYST (campaign metrics), SCHEDULER (content calendar)
- `USER.md` — template for Shant to fill in his business details
- `agents/directory.json` — pre-configured with appropriate models
- Cron jobs: daily content brief, weekly performance digest

**Location:** `/Users/admin/.openclaw/workspace/client-configs/marketing-agency/`

**Spec:**
```
COPY agent:
- Model: Sonnet 4.5 (strong writing)
- Skills: copywriting, email-sequence, cold-email, ad-creative
- Crons: daily content idea, weekly email draft
- Telegram connected

CANVAS agent:
- Model: Gemini 3.1 Pro (visual)
- Skills: nano-banana-pro, canvas-design, frontend-design
- Purpose: social graphics, ad creatives, landing page mockups

FUNNEL agent:
- Model: Sonnet 4.5
- Skills: page-cro, form-cro, signup-flow-cro
- Purpose: funnel page copy, CRO analysis, A/B test suggestions
- NOTE: GHL direct integration = stretch goal (browser automation)

ANALYST agent:
- Model: Sonnet 4.5
- Skills: ga4-analytics, analytics-tracking, ab-test-setup
- Purpose: campaign performance, conversion tracking, recommendations

SCHEDULER agent:
- Model: Haiku 4.5 (lightweight, fast)
- Skills: social-content, content-strategy, agent-content-pipeline
- Crons: daily posting schedule, weekly content calendar
```

**Done criteria:** Ramon can `cp -r` this config onto a clean OpenClaw install and all 5 agents respond correctly via Telegram.

---

### Deliverable 2: GHL Browser Automation Test
**What:** Verify if OpenClaw agents can navigate Go High Level's UI via Peekaboo/browser tools.
**Why:** If yes → killer demo. If no → be honest, show what DOES work.
**Test plan:**
1. Open GHL login page via browser tool
2. Attempt login with test credentials
3. Navigate to funnel builder
4. Create a basic page
5. Add copy block

**Realistic expectation:** GHL's UI is React-based with heavy client-side rendering. Browser automation will likely work for reading/navigating but struggle with drag-and-drop funnel building. Be upfront about this.

**Fallback pitch:** "The agent writes all the copy, designs, and strategy. You paste it into GHL in 5 minutes instead of spending 3 hours creating it from scratch."

**Location:** Test results in `/Users/admin/.openclaw/workspace/client-configs/marketing-agency/ghl-test-results.md`

---

### Deliverable 3: Security One-Pager (PDF)
**What:** Professional 1-page PDF addressing every security concern a non-technical client has.
**Why:** Someone already spooked Shant about security. This kills that objection permanently.
**Content:**

```
PARALLAX SECURITY BRIEF
========================

YOUR DATA STAYS ON YOUR MACHINE
- OpenClaw runs locally. No cloud servers store your data.
- Your files, credentials, and business info never leave your computer.

ACCESS CONTROLS
- Gateway PIN: only YOU can access the system remotely
- Custom port: changed from default, invisible to scanners
- Telegram/WhatsApp: encrypted channel, your number only

WHAT THE AI CAN'T DO (without your permission)
- Spend money
- Send emails/messages
- Access your bank or financial accounts
- Install software
- Share files externally

CLAWGUARD PRO (included)
- Real-time security monitoring
- Scans for vulnerabilities
- Alerts on suspicious activity
- Built by us, for our own systems first

THIRD-PARTY AI PROVIDERS
- Claude (Anthropic): SOC 2 compliant, data not used for training
- All API calls encrypted (TLS 1.3)
- No data retention by providers

BOTTOM LINE
We built this for ourselves first. We run our entire business on it.
If it wasn't secure, we'd be the first to know.
```

**Format:** PDF, single page, Parallax branding, clean layout.
**Location:** `/Users/admin/.openclaw/workspace/client-configs/marketing-agency/PARALLAX-SECURITY-BRIEF.pdf`

---

### Deliverable 4: Yauggy EPK (Electronic Press Kit)
**What:** Professional one-pager with Yauggy's bio, streaming links, social handles, key stats, and visual assets.
**Why:** Shant needs this to plan the marketing funnel for Yauggy.
**Content needed from Ramon:**
- [ ] Yauggy's Spotify/Apple Music links
- [ ] Instagram/TikTok/YouTube handles
- [ ] Streaming numbers (monthly listeners, top tracks)
- [ ] 2-3 high-res photos
- [ ] Genre description / artist statement
- [ ] Previous press or features

**Location:** `/Users/admin/.openclaw/workspace/client-configs/marketing-agency/yauggy-epk/`

---

### Deliverable 5: Demo Script
**What:** Minute-by-minute script for the WOW phase of Friday's session.
**Purpose:** Ramon knows exactly what to show, when, and what to say.

```
DEMO SCRIPT — 15 minutes
=========================

[0:00] Open Command Center in browser
  SAY: "This is what runs our entire business. 19 agents, 24/7."
  SHOW: Main dashboard — agent grid, status indicators, active sessions

[2:00] Click into an agent (INK or ECHO)
  SAY: "This is our content agent. Watch what happens when I give it a task."
  ACTION: Send a message via Telegram: "Write 3 LinkedIn posts about AI in marketing agencies"
  SHOW: Agent responding in real time

[5:00] Open YOLO Builds page
  SAY: "Every night, our agents build experimental tools. These are real, deployed apps."
  SHOW: Click 2-3 working YOLO builds, open them in browser

[8:00] Open Memory/Journal
  SAY: "Every action is logged. You always know what happened and when."
  SHOW: Today's journal entries

[10:00] Open Cron Calendar
  SAY: "This is your autopilot. Morning briefs, content drafts, security scans — all scheduled."
  SHOW: Cron schedule with real jobs

[12:00] Open Telegram on phone
  SAY: "You control everything from your phone. Ask it anything, assign tasks, get updates."
  SHOW: Send a quick command, get response

[14:00] Close with impact
  SAY: "This is what you're getting. Your own version, configured for your agency."
```

**Location:** `/Users/admin/.openclaw/workspace/client-configs/marketing-agency/demo-script.md`

---

### Deliverable 6: Install Script Test
**What:** Verify the OpenClaw install works cleanly on a fresh Mac.
**Test:** Run through the full install process, document every step and any friction.
**Key checks:**
- [ ] `install-protocol.sh` runs without errors
- [ ] All dependencies install (Node.js, etc.)
- [ ] Gateway starts successfully
- [ ] Telegram connection works
- [ ] First agent responds

**Location:** Test results in `/Users/admin/.openclaw/workspace/client-configs/marketing-agency/install-test-results.md`

---

## PART 2: WHAT RAMON NEEDS TO DO

### Before Wednesday
- [ ] Confirm Shant bought Mac Mini + Claude Max subscription ($100/mo plan)
- [ ] Send Shant: "Unbox Mac Mini, connect to WiFi, update macOS. That's all for now."
- [ ] Set up Zoom meeting link, send calendar invite
- [ ] Gather Yauggy's EPK materials (links, photos, stats)

### Before Friday
- [ ] Test screen sharing + recording in Zoom
- [ ] Have WhatsApp thread with Shant ready
- [ ] Review demo script once
- [ ] Charge devices, clear schedule for 3 hours

---

## PART 3: EXECUTION TIMELINE

| Day | Task | Owner | Status |
|-----|------|-------|--------|
| Mon Mar 31 | Create marketing agency agent config | Atlas + SHURI | ⬜ |
| Mon Mar 31 | Start GHL browser test | TRIAGE | ⬜ |
| Tue Apr 1 | Complete agent config + test via Telegram | Atlas | ⬜ |
| Tue Apr 1 | GHL test results documented | TRIAGE | ⬜ |
| Wed Apr 2 | Install script full test on clean env | TRIAGE | ⬜ |
| Wed Apr 2 | Security one-pager PDF designed | THEMIS + AETHERION | ⬜ |
| Thu Apr 3 | Yauggy EPK compiled | INK + ECHO | ⬜ |
| Thu Apr 3 | Demo script finalized + dry run | Atlas + Ramon | ⬜ |
| Thu Apr 3 | Music marketing funnel wireframe | INK | ⬜ |
| Fri Apr 4 | Final check: all deliverables verified | Atlas | ⬜ |
| Fri Apr 4 | **12 PM — MEETING** | Ramon + Atlas | ⬜ |

---

## PART 4: WHAT SUCCESS LOOKS LIKE

### Friday End State
- Shant's Mac Mini running OpenClaw with 5 agents
- Telegram connected, first agent task completed live
- Security concerns eliminated
- Yauggy marketing brief handed off
- Next meeting scheduled (1 week out)
- Permission to record content secured
- Both sides clear on trade deliverables + deadlines

### 30-Day End State
- Shant actively using agents for daily workflow
- Parallax funnel built and driving traffic
- Yauggy campaign launched
- 2+ referrals from Shant's network
- Retainer conversation started ($149/mo)

---

## PART 5: RISKS & HONEST GAPS

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Install fails on his Mac | HIGH | Pre-test thoroughly. Have screen share backup. |
| GHL can't be automated | MEDIUM | Be honest. Pitch the copy/strategy output instead. |
| He gets overwhelmed | MEDIUM | Show 3 things, not 30. Parallax Protocol. |
| His Mac Mini hasn't arrived | HIGH | Confirm by Wednesday. Offer remote setup as backup. |
| He wants more than we can deliver | MEDIUM | Set clear scope. Trade = defined deliverables, not unlimited support. |
| Security fears kill the deal | LOW | One-pager + live ClawGuard demo handles this. |

---

*Functional Spec v1.0 — Atlas, Mar 29, 2026*
*Parallax Protocol applied: Start with the human, make complexity invisible.*
