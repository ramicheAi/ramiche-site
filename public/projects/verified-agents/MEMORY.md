# Verified AI Agent Business — Memory

## Key Decisions
- **Mar 8:** Ramon decided to build Verified AI Agent business. Starting with legal (THEMIS). Meeting lawyer in Atlanta Mar 12.
- **Mar 8:** Partnership with Eric (Ramon's close friend). Structure TBD.
- **Mar 9:** All 17 agents consulted for their vertical input. Deadline: Mar 11 EOD.
- **Mar 9:** Pricing: $100-250/hr rental. Expert Imprint fee: $25-50K. Marketplace cut: 30%.

## Key Events
- **Mar 9 06:44 AM:** VERIFIED-AGENT-STRATEGY.md compiled (comprehensive — 10 parts + 2 appendices). 0/17 agent responses received (sent at 00:25 AM, agents offline). Report built from: STRATEGY.md master doc, 64-question interview doc, ARCHITECTURE.md, DECISIONS.md. Will be updated with agent responses by Mar 11 EOD.
- **Mar 9 08:23 AM:** MERCURY first to respond — full 4-section doc: 7 sales services ($200-400/hr), Josh Braun as expert, Sales Integrity Score (SIS) certification, GTM strategy with pricing tiers. File: `agents/shared/mercury-verified-agent-response.md`
- **Mar 9 09:10 AM:** CONSULTATION-REPORT.md created. 1/17 responses. Urgent follow-ups sent to 16 non-responders with Tue EOD hard deadline.

## Key Insights
- Meet Mobile has NO API (dead end for swim data)
- SwimCloud API is private (403), scraping works
- Legal AI competitors: Harvey AI, CoCounsel, Casetext
- Critical legal risk: UPL (Unauthorized Practice of Law) — varies by state
- FL Bar Rule 4-5.5 and GA Rule 5.5 are the specific UPL provisions to discuss
- Fee-splitting between lawyers and non-lawyers is prohibited in most states (ABA Rule 5.4)

## Key Events (continued)
- **Mar 22 07:30 PM:** Verified Agents Marketplace LIVE at `/agents/verified` on parallax-site. 18 agents, 6 tiers, hourly rates, session calculator, expert imprint pricing. Commit `0577828`. Verified 200 OK.
- **Mar 22 03:20 PM:** Pricing Modeler integrated at `/pricing/modeler` on ramiche-site. Interactive rate/hours/margin calculator. Verified 200 OK.

## Documents
- Interview prep: `workspace-themis/attorney-interview-questions.md` (64 questions)
- Strategy doc: `projects/verified-agents/STRATEGY.md`
- **Marketplace:** `parallax-site/src/app/agents/verified/page.tsx` (564 lines)
- **Pricing Modeler:** `ramiche-site/src/app/pricing/modeler/page.tsx`
- **Mar 22 07:55 PM:** Certification Framework page LIVE at `/agents/verified/certification`. 4 levels (Bronze→Platinum), 7-step process, 6 quality metrics, Expert Imprint program ($25-50K + 10-15% royalty). Commit `6f28576`. Verified 200 OK.
