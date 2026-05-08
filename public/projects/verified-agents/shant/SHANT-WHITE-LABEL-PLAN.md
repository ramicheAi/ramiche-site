# SHANT WHITE-LABEL DEPLOYMENT — Complete Plan
## Created: Mar 29, 2026 · Atlas

---

## PART 1: AGENT MAPPING — What We Already Have vs. What Shant Needs

### Existing Agents That Map Directly to Shant's Agency

| Shant's Need | Our Agent | Model | Status | Notes |
|-------------|-----------|-------|--------|-------|
| Copywriting (funnel copy, ads, emails) | **INK** | Sonnet 4.5 | ✅ READY | Skills: copywriting, email-sequence, cold-email, ad-creative |
| Design (social graphics, ad creatives) | **AETHERION** | Gemini 3.1 Pro | ✅ READY | Skills: nano-banana-pro, canvas-design, ad-ready, ai-product-photography |
| Campaign analytics | **SIMONS** | Sonnet 4.5 | ✅ READY | Skills: ga4-analytics, data-visualization |
| Sales/funnel strategy | **MERCURY** | Sonnet 4.5 | ✅ READY | Skills: marketing-mode, competitive-analysis |
| Content scheduling/social | **ECHO** | qwen3:14b → Sonnet 4.5 for client | ⚠️ NEEDS MODEL UPGRADE | Skills: agent-content-pipeline, linkedin-automator |
| Brand strategy | **VEE** | Kimi K2.5 → Sonnet 4.5 for client | ⚠️ NEEDS MODEL UPGRADE | Skills: brand-analyzer, brand-cog |
| Security | **WIDOW** (as ClawGuard) | qwen3:14b | ✅ READY | Runs on his machine |
| Operations lead | **ATLAS** (lighter version) | Sonnet 4.5 | ✅ READY | Orchestrates his 5-agent squad |

### Decision: Use EXISTING agents, NOT new ones

**Why:** Creating 5 new agents (COPY, CANVAS, FUNNEL, ANALYST, SCHEDULER) is reinventing the wheel. Our existing agents already have:
- Trained skills and skill configurations
- Proven prompt patterns
- Battle-tested cron schedules
- Known failure modes

**White-label approach:** Clone and customize SOUL.md + directory.json for his context. Same agents, different personality/focus.

---

## PART 2: WHITE-LABEL SYSTEM ARCHITECTURE

### What Already Exists
```
~/.openclaw/workspace/white-label/
├── manifests/           # 20+ agent manifest templates with {{VARIABLES}}
├── soul-templates/      # Parameterized SOUL.md files
├── bundles/             # Pre-built packages (operations, growth, creative, support)
├── deploy-kit/          # init.sh, deploy.sh, validate.sh
└── deployments/         # Generated client workspaces
```

### Shant's Bundle: "MARKETING AGENCY" (Custom)

**5 agents selected from existing roster:**

```
shant-agency/
├── agents/
│   ├── atlas/        → Operations lead (orchestrate, delegate, daily brief)
│   ├── ink/          → Copywriter (funnel copy, emails, ad copy, landing pages)
│   ├── aetherion/    → Creative director (ad creatives, social graphics, brand visuals)
│   ├── mercury/      → Sales strategist (funnel strategy, CRO, pricing, campaign planning)
│   └── echo/         → Content manager (social scheduling, content calendar, engagement)
├── config/
│   └── client.json
├── SHARED_CONTEXT.md   → His business, clients, brand voice
├── SOUL.md             → His Atlas personality (marketing agency focused)
├── USER.md             → Shant's profile, preferences, timezone
└── crons.json          → Daily content brief, weekly performance digest
```

### Template Variables for Shant
```json
{
  "CLIENT_NAME": "Shant",
  "COMPANY_NAME": "Shant Marketing Agency",
  "TIMEZONE": "America/Los_Angeles",
  "PRIMARY_PRODUCT": "Marketing funnels and campaigns",
  "SQUAD_SIZE": 5,
  "CHANNEL": "telegram"
}
```

### Deployment Steps (Friday Meeting)
```bash
# 1. Install OpenClaw on his Mac Mini
npm install -g openclaw
openclaw init

# 2. Deploy the marketing agency bundle
cd ~/.openclaw/workspace/white-label
./deploy-kit/init.sh \
  --client "Shant Marketing" \
  --bundle marketing-agency \
  --domain shant \
  --timezone America/Los_Angeles

# 3. Copy API keys
# Claude Max subscription key → openclaw.json

# 4. Connect Telegram
# Create bot via @BotFather → add token

# 5. Start
openclaw gateway start

# 6. Verify
openclaw status
# Send test message via Telegram
```

**Total setup time: ~45 minutes** (with pre-built bundle ready)

---

## PART 3: WHAT NEEDS TO BE BUILT THIS WEEK

### Monday (Mar 31)

**Task 1: Create Marketing Agency Bundle**
- Clone growth bundle → customize for marketing agency
- 5 agent manifests with Shant-specific template variables
- Marketing-focused SOUL.md templates
- Cron schedule: morning content brief (7 AM PT), weekly campaign digest (Mon 9 AM PT)
- **Owner:** Atlas
- **Output:** `white-label/bundles/marketing-agency.json` + 5 manifests

**Task 2: Write Shant's SHARED_CONTEXT.md**
- His business model (funnel agency)
- His tools (Go High Level, Facebook Ads)
- His clients (general agency context)
- Communication style
- **Owner:** Atlas
- **Output:** `white-label/soul-templates/marketing-agency/SHARED_CONTEXT.md`

### Tuesday (Apr 1)

**Task 3: GHL Browser Automation Test**
- Test Peekaboo/browser tool against Go High Level UI
- Document what works, what doesn't
- Write fallback pitch if automation fails
- **Owner:** TRIAGE
- **Output:** `client-configs/marketing-agency/ghl-test-results.md`

**Task 4: Test Full Deploy on Clean Config**
- Run init.sh + deploy.sh with marketing agency bundle
- Verify all 5 agents respond via Telegram
- Verify crons fire correctly
- **Owner:** TRIAGE
- **Output:** `client-configs/marketing-agency/install-test-results.md`

### Wednesday (Apr 2)

**Task 5: Security One-Pager PDF**
- Professional PDF with Parallax branding
- Addresses: local-only data, access controls, AI provider security, ClawGuard
- **Owner:** THEMIS + AETHERION
- **Output:** `client-configs/marketing-agency/PARALLAX-SECURITY-BRIEF.pdf`

**Task 6: Full Install Dry Run**
- Simulate fresh Mac Mini setup end-to-end
- Document every step, screenshot friction points
- **Owner:** TRIAGE + HAVEN
- **Output:** Install guide with screenshots

### Thursday (Apr 3)

**Task 7: Yauggy EPK**
- Bio, streaming links, social handles, photos, stats
- Professional one-pager PDF
- **Owner:** INK + ECHO
- **Input:** Ramon provides links + photos (or we scrape @yauggy Instagram)
- **Output:** `client-configs/marketing-agency/yauggy-epk/`

**Task 8: Demo Script + Dry Run**
- 15-minute demo script (minute-by-minute)
- Ramon runs through once with Atlas watching
- **Owner:** Atlas + Ramon
- **Output:** `client-configs/marketing-agency/demo-script.md`

**Task 9: Music Marketing Funnel Wireframe**
- Funnel structure for Yauggy's Faith EP promotion
- Landing page → email capture → streaming → merchandise
- This is what Shant will build for us
- **Owner:** INK + MERCURY
- **Output:** `client-configs/marketing-agency/yauggy-funnel-wireframe.md`

### Friday (Apr 4) — MEETING DAY

**Task 10: Final Verification**
- All deliverables confirmed working
- Demo script rehearsed
- Zoom link tested
- All files organized and ready
- **Owner:** Atlas

---

## PART 4: CRON SCHEDULE FOR SHANT PREP (Starting Tomorrow)

### Cron Jobs to Create NOW

```
# Monday 8 AM ET — Start marketing agency bundle creation
0 8 31 3 * → Atlas: Create marketing-agency bundle (manifests + souls + crons)

# Monday 2 PM ET — Start GHL test
0 14 31 3 * → TRIAGE: Run GHL browser automation test

# Tuesday 9 AM ET — Test full deploy
0 9 1 4 * → TRIAGE: Run init.sh + deploy.sh with marketing-agency bundle, verify Telegram

# Wednesday 9 AM ET — Security PDF
0 9 2 4 * → THEMIS + AETHERION: Create security one-pager PDF

# Wednesday 2 PM ET — Install dry run
0 14 2 4 * → HAVEN: Run fresh install simulation

# Thursday 9 AM ET — Yauggy EPK
0 9 3 4 * → INK + ECHO: Compile Yauggy EPK

# Thursday 2 PM ET — Demo dry run reminder
0 14 3 4 * → Atlas: Remind Ramon to do demo dry run

# Thursday 6 PM ET — Music funnel wireframe
0 18 3 4 * → INK: Complete Yauggy funnel wireframe

# Friday 10 AM ET — Final check
0 10 4 4 * → Atlas: Final verification of all deliverables
```

---

## PART 5: YAUGGY RESEARCH (from available data)

**Artist:** Yauggy
**Genre:** Christian R&B
**Instagram:** @yauggy
**Latest Release:** Faith EP (December 2025)
**Label:** Parallax / The Baba Studio
**Management:** RAMICHE (Ramon Walton)

### What We Need from Ramon (by Thursday):
- [ ] Spotify link
- [ ] Apple Music link
- [ ] YouTube channel
- [ ] 2-3 high-res artist photos
- [ ] Monthly listener count
- [ ] Top track names from Faith EP
- [ ] Any press features or playlist placements
- [ ] Artist bio (200 words max)

### What We Can Scrape:
- Instagram @yauggy — follower count, content style, engagement rate
- Spotify for Artists — if Ramon has access
- TikTok — if account exists

---

## PART 6: HOW THIS SCALES — TAKING OVER THE MARKET

### The Repeatable Playbook

Every new client gets:
1. **Discovery call** (30 min) → understand their workflow
2. **Bundle selection** → pick from pre-built or customize
3. **Setup session** (2-3 hours on Zoom) → install + configure + first win
4. **Follow-up** (1 week) → verify adoption, fix friction
5. **Retainer** ($149/mo) → ongoing support + updates

### Pricing Structure

| Tier | Price | Agents | Support | Target |
|------|-------|--------|---------|--------|
| **Starter** | $500 setup + $99/mo | 3 agents | Email | Solo entrepreneurs |
| **Professional** | $500 setup + $149/mo | 5 agents | Telegram + email | Agencies, coaches |
| **Business** | $1,500 setup + $349/mo | 10 agents | Priority Telegram | Growing companies |
| **Enterprise** | $5,000+ setup + $999/mo | 15+ agents + custom | Dedicated support | Corporations (Cirexx-type) |

### Trade Value Calculation (Shant)

**What we give:**
- 5-agent marketing agency bundle (~$500 setup value)
- 2.5-hour onboarding session (~$500 consulting value)
- Ongoing support access (~$149/mo × 3 months = $447)
- **Total: ~$1,447**

**What we get:**
- Facebook funnel strategy + build for Parallax (~$2,000-5,000 value)
- Marketing for Yauggy (~$1,000-3,000 value)
- Recorded content for course/marketing (~$500 value)
- Referral pipeline access to his network (~priceless)
- **Total: ~$3,500-8,500**

**Verdict:** Trade is strongly in our favor. Deliver exceptional value to earn referrals.

---

## PART 7: EXISTING ECOSYSTEM INTEGRATION

### What Shant Gets Access To (Through Our System)

| Capability | How | Value |
|-----------|-----|-------|
| Funnel copy at speed | INK agent writes full funnel copy in minutes | Saves $500-2K per funnel |
| Ad creative generation | AETHERION creates social graphics, ad images | Saves $200-500 per campaign |
| Campaign analytics | SIMONS analyzes GA4, conversion data | Saves analyst hire |
| Content calendar | ECHO manages posting schedule | Saves VA hire |
| Security scanning | WIDOW/ClawGuard runs on his machine | Peace of mind |
| Morning briefs | Atlas compiles daily summary | 15 min saved daily |
| YOLO builds | Overnight experimental tools | Innovation engine |

### What We Need to Improve for Client-Ready Quality

1. **Install script polish** — one-command install, zero friction, error recovery
2. **Onboarding wizard** — guided setup (name, timezone, channels) instead of editing JSON
3. **Client dashboard** — simplified CC for non-technical users (read-only view of agent status + task queue)
4. **Documentation** — 5-minute quickstart guide, video walkthrough
5. **Support channel** — dedicated Telegram group for client issues

---

## PART 8: PARALLAX PROTOCOL APPLICATION

Every deliverable for Friday must pass:

- [ ] **Human test:** Would a non-technical marketer understand this in 5 seconds?
- [ ] **Thumb test:** Can Shant control his agents from his phone?
- [ ] **Squint test:** Does the security PDF look professional from 10 feet?
- [ ] **Error test:** What happens if install fails? Is there a clear recovery path?
- [ ] **Speed test:** Can we go from unbox → first agent response in under 45 minutes?
- [ ] **Consistency test:** Do all documents look like they're from the same company?
- [ ] **Accessibility test:** Can Shant's clients use what we build?
- [ ] **Undo test:** Can Shant reset/restart without calling us?
- [ ] **Breath test:** Is there whitespace and clarity, not information overload?
- [ ] **Fill test:** Does the experience feel complete, not half-finished?

---

*White-Label Deployment Plan v1.0 — Atlas, Mar 29, 2026*
*Parallax Protocol: Start with the human, make complexity invisible.*
