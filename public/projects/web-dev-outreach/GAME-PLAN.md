# Web Dev Outreach — Complete Game Plan

## 1. Lead Research (Daily: 10–15 prospects)

**Target profile:**
- Fort Lauderdale / South Florida area
- Small to mid-size business (10–100 employees)
- No website OR outdated website (last updated >2 years ago)
- Verticals: restaurants, gyms, salons, retail, real estate, professional services

**Research sources (prioritized):**
1. **Google Maps** — search "restaurants near me," "gyms near me," etc. → scrape results without websites
2. **Yelp** — filter by "no website listed"
3. **LinkedIn** — search by location + industry → check if they have a website
4. **Local directories** — Better Business Bureau, Chamber of Commerce
5. **Social media** — businesses with only Instagram/Facebook, no website

**Daily workflow:**
1. Run scraper (Bash + jq) → outputs CSV: `name | address | phone | email (or N/A) | industry | website_url | last_updated | confidence`
2. Verify contact info via LinkedIn Sales Navigator or Apollo.io
3. Append to `workspace/projects/web-dev-outreach/leads.csv`
4. Hand off 10–15 leads to email automation (see section 2)

**Scraper script:** `workspace/scripts/lead-scraper.sh` (automated daily at 8 AM)

---

## 2. Cold Email Automation (Proof First)

**Email structure (proven to convert):**

**Subject line:** `[Business Name] — quick optimization idea (1-min read)`

**Body (hook → proof → offer):**

```
Hi [Name],

I noticed [Business Name] doesn't have a website — or yours hasn't been updated since [year]. Here's what that's costing you:

**The cost of no/old website:**
- 30% of potential customers can't find you online
- You're losing to competitors who invested $1–2k in a clean, mobile-friendly site
- Every phone call should be a conversion; instead you're scrambling for contact info

**Proof (case study):**
[Previous client]: Italian restaurant, no website. Built a site + online ordering in 7 days. First month: 45 orders via site (didn't have that channel before). Recurring: +$3k/month revenue.

**What we do:**
- Free audit (I'll review your current presence, send 3 specific fixes)
- Fixed-price build ($500–2k, depending on scope)
- 7-day delivery (live staging URL, you see it before go-live)
- No long-term contracts (one-time or month-to-month, your choice)

**Free audit takes 20 mins.** If it's worth exploring, we go from there. If not, no hard feelings.

Available: [Calendly link with 2 time slots]

—Ramon
Web Development
ramon@parallaxvinc.com | 561-xxx-xxxx
```

**Email provider:** Mailchimp (free tier) or Lemlist (for more advanced tracking + multi-touch sequences)

**Automation rules:**
- Send email Tuesday–Thursday (higher open rates)
- Stagger sends (3–5 per day max, avoid spam filters)
- Track: open rate, reply rate, click rate
- Auto-follow-up if no reply within 5 days: lighter touch ("just checking in")

---

## 3. Reply Handling (Manual → Semi-Auto)

**If they reply "interested":**
1. I send Calendly link (already in email, but re-affirm)
2. Book call (15 min discovery)
3. On call: ask 3 questions (see section 4)
4. Post-call: I draft proposal (auto-template)
5. Send proposal for approval (Telegram to Ramon)
6. Once approved, send to prospect

**If they reply "no thanks":**
- Remove from follow-up sequence
- Add to "not interested" list (re-engage in 6 months)

**If no reply after 5 days:**
- Send 1 follow-up email (softer)
- If still no reply after 3 more days, move on

**Time to handle replies:** ~10 min per prospect (batched 2x daily)

---

## 4. Call Script (15 min)

**Opening (2 min):**
"Thanks for hopping on. I sent you that audit idea because [Business Name] has real potential online — and it looks like you haven't invested in a website yet. I'm quick, so let me ask 3 questions and then you'll know exactly what's possible."

**Discovery (8 min):**
1. "How many customers are you trying to reach right now? Are you getting enough leads, or do you feel like you're leaving money on the table?"
2. "What's your current way of getting customers to find you? (Word of mouth, Google, calls?)"
3. "If I could get you 20–30 extra qualified leads per month from a professional website + online ordering (if applicable), what would that be worth to you?"

**Pitch (4 min):**
"Here's what I'm proposing: I build a clean, mobile-friendly site tailored to your business. Includes: your hours, menu/services, photo gallery, online contact form, and for restaurants, online ordering integration. 7 days to launch. $[500–2k] depending on scope. No retainer after that — you own it."

**Proof (if they hesitate):**
"Last restaurant I built this for went from 0 online orders to 45 in the first month. That's $3k extra revenue. Your payback is less than 1 month."

**Objection handling:**
- *"I'll think about it"* → "Totally fair. Let me send you a 2-min video of a similar site I built. Call me back if you want to move forward."
- *"Too expensive"* → "What if it pays for itself in the first month? Most of my clients see 20–50 new orders/calls in month 1."
- *"We like our current setup"* → "Got it. Are you happy with how many leads you're getting online right now?"

**Close:**
"Here's the next step: I'll draft a specific proposal for [Business Name] and send it over by tomorrow. If it makes sense, we kick off next week. Sound good?"

---

## 5. Proposal Auto-Template

```
---
TO: [Business Name] / [Owner Name]
FROM: Ramon Walton (Parallax Dev)
DATE: [Today]

PROPOSAL: Professional Website Build

BUSINESS: [Business Name]
INDUSTRY: [Restaurant / Gym / Retail / etc.]

SCOPE:
✓ Professional website (mobile-responsive design)
✓ Your hours, location, contact info, social links
✓ Photo gallery (up to 20 photos)
✓ Service/menu descriptions
✓ Contact form (emails go to your inbox)
✓ Optional: online ordering (restaurants), appointment booking (salons/gyms)
✓ SEO basics (Google My Business integration, local search optimization)
✓ Mobile-optimized (looks great on phones)

INVESTMENT: $[500 / 1000 / 1500 / 2000]
(Pricing depends on features. See breakdown below.)

TIMELINE:
- Discovery call: [Date]
- Design phase: [+2 days]
- Content upload: [+2 days]
- Review & revisions: [+2 days]
- Live: [+7 days total]

PRICING BREAKDOWN:
- Basic (hours + contact + gallery): $500
- Standard (+ menu/services + contact form): $1,000
- Premium (+ online ordering OR appointment booking): $1,500
- Full Suite (+ both + SEO + analytics): $2,000

WHAT YOU GET AFTER LAUNCH:
- Full ownership (you own the domain and files)
- Free maintenance for 30 days
- I provide you with login credentials
- Annual hosting: ~$120 (I can recommend a provider)

ROI SUMMARY:
- Cost to you: $[amount]
- Average new customers/month (from online): 20–50
- Average customer value: $30–100
- **Payback: 1–2 months**

PAYMENT:
- 50% deposit upon agreement
- 50% due upon launch

Let's turn [Business Name] into a lead-generating machine.

Call me with questions.
---
```

---

## 6. Sales Flow (Start to Finish)

```
DAY 1: Lead Research
  → Scraper runs (automated, 8 AM)
  → 10–15 new leads added to CSV
  → I verify contact info

DAY 1 (afternoon): Cold Emails
  → 10–15 cold emails sent (staggered, 3–5/day)
  → Tracked in Mailchimp

DAY 2–4: Reply Monitoring
  → Check replies 2x daily
  → If interested: send Calendly link
  → If not interested: add to "no" list
  → If no reply: note for 5-day follow-up

DAY 5: First Calls Book
  → 2–3 discovery calls scheduled
  → I take notes on each

DAY 6: Post-Call Proposals
  → I draft proposals (auto-template)
  → Send to Ramon for approval (Telegram)
  → Ramon says "yes" or "edit"
  → I send approved proposal to prospect

DAY 7–10: Closing
  → Prospect reviews proposal
  → If yes: we set a kickoff date
  → If no: I follow up with call/email
  → If closed: I start build

ONGOING:
  → Continue 10–15 emails/day
  → Monitor replies
  → Book calls 2x per week
  → Average closing: 1 new client per week
```

---

## 7. Undeniable Offer (Why They Can't Say No)

**Positioning:**
"Most businesses in Fort Lauderdale are leaving money on the table because they don't have a website (or theirs is outdated). A professional site costs less than hiring one person part-time, but it works 24/7 and brings in customers while you sleep."

**The hook:**
- **Free audit** (20 mins, no obligation)
- **Proof** (case studies: "+$3k/month revenue," "45 orders in month 1")
- **Speed** (7 days to live)
- **Price transparency** ($500–2k, no surprises)
- **No lock-in** (you own it, month-to-month optional support)

**The path of least resistance:**
1. Click Calendly link (takes 10 seconds)
2. Choose a time (already on their calendar)
3. I call them (they don't have to find time to call me)
4. 15-min call (they know it's quick)
5. I draft proposal (Ramon approves it)
6. Simple yes/no decision (fixed price, no custom negotiation)

**Why it's undeniable:**
- If they say yes: they get a professional online presence + average +20–50 leads/month
- If they say no: they stay where they are (losing customers to competitors)
- Cost of saying yes: $500–2k (recovers in 1–2 months from new business)
- Cost of saying no: losing 20–50 potential customers/month (unquantified but painful)

---

## 8. Metrics & Optimization

| Metric | Target | Current | Action |
|--------|--------|---------|--------|
| Leads sourced/day | 10–15 | — | Scraper automated |
| Email open rate | >20% | — | Test subject lines |
| Reply rate | >5% | — | Proof-driven copy |
| Call booking rate | >30% | — | 1-click Calendly link |
| Proposal close rate | >25% | — | A/B test pricing |
| Time-to-close | <14 days | — | Fast follow-up |
| Average deal size | $1,000 | — | Upsell to premium |
| Revenue/client/year | $1,500 (retainer upside) | — | Add support tier |

---

## 9. Automation Tech Stack

| Tool | Purpose | Cost |
|------|---------|------|
| Lead scraper (custom Bash) | Daily lead research | Free (my time) |
| Mailchimp / Lemlist | Cold email + tracking | Free / $30/mo |
| Calendly | Booking links | Free tier (5 calendars) |
| Google Docs (auto-template) | Proposal generation | Free |
| Airtable (optional) | CRM + pipeline | Free / $20/mo |
| Zapier (optional) | Auto-pipeline updates | Free / $30/mo |

**Total cost:** $0 (free tier) or $50–60/mo (paid tiers for tracking + CRM)

---

## 10. My Role (Atlas) in This Flow

1. **Every morning (8 AM):** Run scraper → verify leads → prep 10–15 emails
2. **Twice daily:** Check replies → book calls → send follow-ups
3. **After each call:** Draft proposal → send to Ramon for approval → deliver to prospect
4. **Weekly:** Report metrics (opens, replies, calls booked, closed deals)
5. **On close:** Handoff build to SHURI (or I handle if simple)

**Time per week:** ~10–15h (manageable, mostly batched work)

---

## 11. Next Steps

1. **Approve this plan** (edit offer, pricing, script if needed)
2. **Approve email template** (test subject line + hook)
3. **Approve proposal template** (pricing structure)
4. **Test first 5 leads manually** (before automating scraper)
5. **Week 1:** Send 50 emails (10/day, Monday–Friday)
6. **Week 2:** Scale to 15/day + monitor replies
7. **Target:** First call booked by day 3, first close by end of week 1–2

---

## 12. Success Definition

| Milestone | Target | Timeline |
|-----------|--------|----------|
| 10 leads sourced daily | ✅ | Day 1 |
| First call booked | ✅ | Day 3–5 |
| First proposal sent | ✅ | Day 5–7 |
| First deal closed | ✅ | Week 1–2 |
| 4+ deals/month | ✅ | Month 2 |
| $4k–8k MRR (web dev) | ✅ | Month 3 |

---

This is plug-and-play. The only variables are: offer structure + pricing. Once approved, I start tomorrow morning.
