# AI Call Agent — Functional Spec (Parallax "BEACON Voice")

**Status:** Spec for review. Nothing built yet.
**Author:** Parallax COO (Claude Code) · **Date:** 2026-06-13
**Repos:** engine → `ramiche-site` (Command Center funnel) · product/sell → `parallax-site`
**One line:** Close the loop we started 4 days ago — the funnel already *finds* and *researches* local businesses; this layer *calls them, qualifies them, captures exactly what they need, and hands a ready-to-build brief to the `web-client-delivery` skill — with you as the single approval gate.*

---

## 0. READ THIS FIRST — the verdict and the one decision you must make

You asked for "undetectable — you should not be able to tell it's an AI." I'm not going to rubber-stamp that, because as written it is **illegal in the United States and most of your target markets**, and it's the one thing that could turn BEACON from an asset into a liability. Here's the honest version, and it's *better*:

> **The goal is not "fool people into thinking it's human." The goal is "so good that it doesn't matter that it's AI" + a one-line disclosure that doesn't kill the call.** That is exactly how the best agencies run this. Disclosed, sub-second-latency, human-quality voice agents still book meetings. Undisclosed deception gets you TCPA lawsuits ($500–$1,500 *per call*), state bot-law violations, and one viral "this company AI-spammed me pretending to be a person" post that taxes the BEACON brand we're building. (Business Bible: ~37 magic moments to offset 1 tragic moment. Brand is our cheapest moat — don't poison it on day one.)

**THE DECISION (pick one — the whole architecture branches here):**

| Option | What it is | Legal risk | My rec |
|---|---|---|---|
| **A — Consented outbound** | AI only calls leads who micro-opted-in (replied "yes call me" to our cold email, or filled a form). Cold email → reply → **legal, warm, consented call** within 60s. | Low | ✅ **Start here** |
| **B — Disclosed cold outbound (B2B)** | AI cold-calls businesses' *published* numbers, discloses "I'm an AI assistant calling on behalf of Parallax," scrubbed against DNC. | Medium (manage carefully) | Phase 2 |
| **C — Inbound AI receptionist** | The same engine answers calls *for* our clients' businesses. Fully consented (they called the business). Pure MRR. | None | ✅ **The real money — build in parallel** |
| **D — Undisclosed "undetectable" cold calls** | What you literally asked for. | **Illegal — TCPA + state + EU.** | ❌ Will not build |

My recommendation: **A + C now, B in phase 2, never D.** Option **C is the part you're not thinking about and it's the bigger business** — see §12.1. Tell me if you disagree; everything below assumes A+C.

---

## 1. Do I understand the vision? (stated back)

Yes. The system you're describing, end to end:

```
Prospector finds local + international businesses with weak online presence
        │   (built — lead-fit.ts, prospector/daily)
        ▼
Diagnose researches each one's digital health + gaps
        │   (built — pipeline/diagnose)
        ▼
►  AI CALL AGENT calls them, sounds incredible, qualifies + closes,     ◄  NEW
   captures EXACTLY what they need in a structured brief, in any language,
   translates it for you to read
        │
        ▼
You OBSERVE every call + APPROVE the brief                              ◄  YOUR SEAT
        │
        ▼
web-client-delivery skill builds the site + SEO + AI-visibility
        │   (built — .agents/skills/web-client-delivery)
        ▼
You APPROVE the finished project before it ever reaches the client      ◄  YOUR SEAT
        │
        ▼
Deploy + onboard + recurring services (incl. selling them their OWN AI receptionist)
```

You sit at two gates — **approve the brief** and **approve the finished project** — and observe everything in between. Everything cheap and reversible runs without you. That's the COO model applied to a sales floor.

---

## 2. The adversarial review (failure case first — the 4 things that kill this)

1. **"Spam Likely" labeling kills pickup before a word is spoken.** Naive AI dialing from a fresh number gets carrier-flagged within hours; pickup craters to ~1–5%. The single biggest reason DIY AI-calling fails. → We solve it with STIR/SHAKEN attestation, branded CNAM caller ID, number warm-up, local-presence numbers, and low daily volume per number (§12.3). This is non-optional infrastructure, not a nice-to-have.
2. **Over-promising on the call creates a delivery you can't meet.** If the agent free-styles a price or promises a feature outside `services-catalog.ts`, you've manufactured a "tragic moment." → The agent is **hard-locked to the catalog** and cannot quote or promise off-list (§5.3).
3. **The legal surface is real and you're in a two-party-consent recording state (FL).** TCPA artificial-voice rules (FCC, Feb 2024), state bot-disclosure laws, EU AI Act Art. 50, DNC scrubbing, GDPR/CASL for international, and Florida's all-party recording-consent law all apply. → Disclosure-first + consent-gated outbound (§15).
4. **Unit economics can quietly bleed.** At ~$0.07–0.15/min with 20–40% pickup, cost-per-booked-meeting is real money. Volume cures volatility *and* burns cash if the script doesn't convert. → We instrument leading indicators from call one (§13) and start on consented leads (highest connect + close).

If it survives those four, the upside is large: a 24/7 closer that responds in <60s (Business Bible: <60s response ≈ **+391%** close likelihood), in every language your ICP speaks, that never forgets to follow up — feeding a build system you already own.

---

## 3. System architecture (the engine)

### 3.1 Where it plugs into what exists

| Existing piece (verified) | What the call layer adds |
|---|---|
| `src/lib/lead-fit.ts` — fit scoring, ICP verticals/cities | Call only `qualified === true` leads; reuse `ICP_CITIES` for local-presence number selection. |
| `src/app/api/command-center/pipeline/diagnose/route.ts` — digital-health research | The agent walks into the call already knowing their gaps — it doesn't ask "do you have a website," it says "I noticed you don't come up on Google Maps." |
| `src/lib/services-catalog.ts` — SKUs + `recommendBundle(gaps)` | The agent's *only* sellable menu. It pitches the bundle the diagnose step already computed. Hard guardrail. |
| `src/lib/lead-gen.ts` — `startBackgroundGen`, `callProxyJSON`, `pipeline_leads.meta` | Same pattern: a call writes its structured result to `meta.discovery`, status-polled by the UI. |
| `src/app/api/command-center/leads/send/route.ts` — Send button = approval gate | The call agent copies this exact gate model: **placing a call and sending a project are both gated actions.** |
| `.agents/skills/web-client-delivery/SKILL.md` | Receives `meta.discovery` as its input brief — no re-gathering. |
| `pipeline_leads` / `pipeline_events` tables | New event kinds: `call_placed`, `call_completed`, `call_booked`, `consent_captured`. |

### 3.2 New components to build

```
src/lib/voice/
  call-agent.ts        — orchestrates a call: dial → converse → capture → write meta.discovery
  call-script.ts       — the CLOSER state machine + objection library (§5)
  discovery-schema.ts  — the structured "what the client needs" object (§6)
  voice-provider.ts    — thin adapter over the telephony/voice platform (§4)
  compliance.ts        — DNC scrub, consent check, recording-consent line, disclosure line (§15)
  call-scorecard.ts    — post-call QA scoring + leading indicators (§13)

src/app/api/command-center/voice/
  call/route.ts        — POST { leadId } → place a call (GATED). Mirrors leads/send.
  call/webhook/route.ts— provider webhooks: events, transcript chunks, end-of-call
  call/queue/route.ts  — the auto-dial queue (consented leads, <60s trigger)
  call/[callId]/route.ts — fetch one call: recording, transcript, translation, discovery, score

src/app/command-center/call-center/page.tsx
  — YOUR observation + approval cockpit (§9)
```

### 3.3 Data flow of a single call

```
trigger (lead replied "call me" / you click Call)
  → compliance.ts: DNC + consent + time-of-day + dedupe check  ──fail──▶ skip + log
  → voice-provider.ts: provision/select local-presence number, dial
  → on answer: disclosure line + (if recording) consent line
  → call-script.ts drives CLOSER, grounded in this lead's diagnose gaps + catalog
  → live: STT → Claude → TTS loop (<800ms/turn), barge-in, backchannels
  → live transcript + translation streamed to call-center cockpit
  → on close/book: capture discovery-schema object
  → write pipeline_leads.meta.discovery + meta.callRecordingUrl + meta.callScore
  → insert pipeline_events: call_completed
  → notify you: "Call done with {business} — review the brief"   ◀ YOUR GATE
```

---

## 4. The voice stack (how it sounds *indistinguishably human in quality*)

The single biggest "tell" is **latency**. Humans answer in ~500ms. Target the full turn budget:

```
end-of-user-speech → first-audio-out  ≤ 800ms (ideal), ≤ 1000ms (hard cap)
   Deepgram Nova streaming STT (endpointing)      ~100–200ms
   Claude (Sonnet for conversation)               ~250–400ms first token (streaming)
   ElevenLabs Flash v2.5 / Cartesia Sonic TTS     ~75–90ms first audio
```

### 4.1 Recommended platform (don't hand-build the media plane)

**Recommendation: ElevenLabs Conversational AI or Vapi as the orchestration layer, Twilio (or SignalWire) for PSTN.** Rationale:

- **ElevenLabs Conversational AI** — best-in-class voice realism + built-in turn-taking + Twilio integration. Highest "doesn't sound like a bot" ceiling. Best if voice quality is the #1 priority (it is).
- **Vapi** — bring-your-own Claude + Deepgram + ElevenLabs; most control over the script state machine; ~$0.05/min platform + provider costs. Best if we want the CLOSER logic fully in our code.
- **Bland.ai** — cheapest, vertically integrated, built for high-volume cold outreach with "pathways." Best for phase-2 volume once the script is proven.
- **SignalWire** — you already named a page "signal-wire"; they have an AI Agent product. Viable, but voice realism trails ElevenLabs.

> Decision deferred to build time — start with **Vapi + Claude + Deepgram + ElevenLabs** (max control over our doctrine-encoded script) and A/B the fully-integrated ElevenLabs agent against it.

### 4.2 The human-realism checklist (every one is a known "tell" if missing)

- **Sub-second latency** (above) — the #1 tell.
- **Barge-in / interruption handling** — the moment the prospect speaks, the agent stops talking. Non-negotiable; robots talk over people.
- **Backchannels** — "mhm," "right," "gotcha," "yeah totally" while listening.
- **Natural fillers + micro-pauses** — "uh, let me see…," a beat before answering a hard question (instant perfect answers feel synthetic).
- **Prosody + warmth** — emotive TTS, not flat. Slight smile in the voice.
- **Disfluency budget** — occasional self-correction ("so it's — well, it's basically…"). Tuned, not overdone.
- **Voice identity** — a **consented** Pro Voice Clone (yours, Ramon, or a hired voice actor with a signed release). Never clone a specific real person to deceive. One warm, trustworthy, region-appropriate voice per language.
- **Variable timing** — don't respond in exactly 700ms every time; jitter it like a human.

### 4.3 The honesty line (required, and it barely costs you anything)

Opening, said warmly and fast, not as a disclaimer dump:

> *"Hey, this is Mercury — I'm an AI assistant with Parallax, calling about your business's online presence real quick — did I catch you at an okay time?"*

Data point worth internalizing: a *helpful* disclosed agent that gets to the point converts nearly as well as a hidden one, and it's the only version that survives contact with a lawyer or a journalist. When asked "wait, are you a robot?" the agent answers **honestly and disarmingly** ("Ha — yep, I'm an AI, but a real person at Parallax reviews everything and builds your site. Want the 30-second version?") and keeps going. Honesty handled well *builds* the trust the close depends on.

---

## 5. Conversation design — the CLOSER framework, encoded

This is the moat. A generic AI-caller is a commodity. **Ours runs Ramon's Business Bible doctrine as a state machine** — that's the part a competitor with the same API keys can't copy.

### 5.1 The call state machine (maps 1:1 to the Bible's CLOSER)

```
GREET + DISCLOSE  → warm, fast, permission ("got 60 seconds?")
CLARIFY           → "what made me reach out: you're not showing up when people
                     search {their service} in {their city}" (uses diagnose data)
LABEL the gap     → get them to admit the problem: "are you getting customers
                     from Google right now, or mostly word-of-mouth?"
OVERVIEW the pain → quantify inaction: "every month without it, the searches that
                     would've found you are finding {competitor} instead"
SELL the vacation → the Three-Pillar Pitch (humans remember in 3s): more customers,
                     look established, never miss a lead — NOT "a website with X pages"
EXPLAIN concerns  → AAA on objections (§5.2): Acknowledge → Associate → Ask
BOOK / CLOSE      → soft close to a 15-min review with you, OR card-on-file deposit
                     to start (Bible: Sid Cassidy "card before first session")
REINFORCE         → confirm next step by name, send SMS recap, set follow-up
CAPTURE           → fill the discovery object (§6) before hanging up
```

### 5.2 Objection library (AAA — Acknowledge, Associate, Ask)

Pre-built, doctrine-grounded, peeling the **Onion of Blame** (Time → Money → Spouse → Self):

- **"I'm too busy."** → "Totally — that's actually the reason this helps; busy means you're leaving money on the table you can't get to. It's done-for-you, you'd spend maybe 20 minutes total. Want me to show you what it'd look like?"
- **"How much?"** → quote *only* the `recommendBundle` number, anchored to value, never negotiated down (Bible: change terms, never the anchor).
- **"I need to think about it."** → "Makes sense — usually 'think about it' means there's one thing you're not sure on. What's the piece you'd want answered?" (decisions run on information, not time).
- **"Let me ask my partner."** → shift permission → support; isolate the real objection.
- **"Are you a robot?"** → the honest line (§4.3).

### 5.3 Guardrails (hard limits — the agent physically cannot)

- **Cannot quote a price outside `services-catalog.ts` bands** or invent a SKU.
- **Cannot promise a timeline, feature, or outcome** not in the catalog/delivery playbook.
- **Cannot proceed if consent/DNC check fails** (§15).
- **Cannot claim to be human** if asked directly.
- **Must escalate to you (warm transfer or book) on:** a buying signal above a threshold, an angry caller, a legal/contractual question, or anything off-script. Better to hand you a hot lead than to wing it.
- **RAG-grounded** on the Parallax offer docs so it never hallucinates about us.

---

## 6. What it captures — the discovery data model (the heart of "do the work efficiently")

This is the object that makes delivery efficient: the agent leaves the call knowing *everything* `web-client-delivery` needs, so the build doesn't stall on missing info. Written to `pipeline_leads.meta.discovery`.

```ts
// src/lib/voice/discovery-schema.ts
export interface CallDiscovery {
  // — identity & contact —
  business: { name: string; vertical: string; city: string; ownerName?: string };
  bestContact: { phone?: string; email?: string; preferredChannel: "phone"|"sms"|"email"; bestTime?: string };
  language: string;                 // detected primary language of the call (§8)

  // — what they need (drives the build) —
  servicesWanted: GapId[];          // mapped to services-catalog GapIds
  recommendedBundle: string[];      // service ids the agent pitched (from recommendBundle)
  budgetSignal: "low"|"mid"|"high"|"unknown";
  timeline: "asap"|"weeks"|"exploring"|"unknown";
  decisionMaker: boolean;           // are we talking to the person who decides?

  // — brand & assets (so design isn't guesswork) —
  brand: { vibe?: string; colorsLiked?: string; competitorsAdmired?: string[]; competitorsToBeat?: string[] };
  existingAssets: { logo?: boolean; photos?: boolean; menu?: boolean; domain?: string; socials?: string[] };
  mustHaves: string[];              // booking, online ordering, payments, multilingual site, etc.

  // — close state —
  outcome: "booked"|"deposit_taken"|"callback"|"not_interested"|"no_answer"|"voicemail";
  depositTaken?: { amount: number; stripeRef?: string };
  nextStep: { type: "review_call"|"send_proposal"|"start_build"|"followup"; whenISO?: string };
  objections: string[];

  // — compliance & provenance —
  consent: { toCall: boolean; toRecord: boolean; capturedISO: string };
  callId: string; recordingUrl?: string; transcriptUrl?: string; durationSec: number;
  agentScore?: number;              // QA scorecard (§13)
}
```

Because `servicesWanted` is typed to the existing `GapId` union, the brief drops straight into `recommendBundle()` and the `web-client-delivery` skill with **zero re-keying**. That's the loop closing.

---

## 7. How we train it to sound incredible *and* close

Training is three layers — **persona, doctrine, and a feedback loop** — not a one-shot prompt.

### 7.1 Persona (voice + character)
- One named agent per language ("Mercury" EN). Backstory, tone (sharp, warm, a little bold — the Parallax brand voice), a consented cloned voice (§4.2).
- A "do/don't" style card: contractions yes, corporate-speak no, never robotic enthusiasm, mirror the prospect's energy.

### 7.2 Doctrine (the closing brain)
- The CLOSER state machine (§5) + AAA objection library + Onion of Blame, lifted directly from `BUSINESS_BIBLE.md`. This is prompt + few-shot, not fine-tuning.
- **Golden transcripts**: 15–30 hand-written ideal calls covering the common verticals (restaurant, gym, salon, contractor…) and the common objections. These are the few-shot exemplars and the eval gold set.
- RAG over the Parallax offer + `services-catalog.ts` so claims are grounded.

### 7.3 The feedback loop (how it gets better every week — Bible §7)
```
every real call → recorded + transcribed + auto-scored (call-scorecard.ts)
   → failures (lost close, missed capture, compliance slip) become new few-shot fixes
   → winning openers/rebuttals get promoted to the 70% core (Bible 70/20/10)
   → weekly: review leading indicators, A/B the next hook
```
- **Simulated-call eval harness**: Claude role-plays 50 difficult prospects (skeptical, busy, foreign-language, "are you a robot," price-shopper) against the agent nightly. Score booking rate, capture completeness, compliance pass, zero-hallucination. Gate any script change on the eval before it touches a real number.
- **Blind "is it a bot" QA** (internal only): rate naturalness 1–5; anything <4 gets voice/latency tuning. The bar is *quality*, never deception.
- Fine-tune only if prompt+RAG plateaus (rarely needed in 2026 with a strong base model).

---

## 8. Multilingual + live translation (for you to observe)

Your ICP already demands this — Miami/Hialeah (Spanish, Haitian Creole), plus Portuguese (Brazil), and international expansion. Language is a **feature, not an afterthought**.

- **Auto-detect** the prospect's language in the first seconds; the agent switches and runs the whole call natively (Deepgram + ElevenLabs are multilingual; a native-sounding voice per language).
- **Dual transcript**: store the call in the **original language** *and* a live **English translation** so you can read/observe any call regardless of language. The discovery object's `language` field tags it.
- **Your cockpit shows both** side by side (§9), with the recording.
- Phase 1 languages: **English, Spanish, Haitian Creole, Portuguese** (your actual market). Add per expansion.

---

## 9. Your seat — observe + approve (the cockpit)

New page: `command-center/call-center/page.tsx`. This is where you "just observe and approve."

- **Queue**: scheduled / in-progress / completed calls, with the consented-lead pipeline feeding it.
- **Live listen-in**: monitor an in-progress call (audio + live dual-language transcript). Optional **whisper/barge-in** to take over (warm transfer to you).
- **Call review card** (per completed call): recording, full transcript + translation, sentiment, **the captured `discovery` brief**, the AI-recommended bundle, the QA score.
- **Two gates, both explicit buttons (mirroring `leads/send`):**
  1. **"Approve brief → generate proposal/kit"** — turns the discovery into the kit/proposal (reuses existing `leads/kit`).
  2. **"Approve project → deliver"** — only after `web-client-delivery` builds it, you approve before the client ever sees it.
- **Nothing auto-sends to a client.** Calls are gated, briefs are gated, the final project is gated. You observe everything; you approve the irreversible, outward-facing moments. (COO escalation rule + your existing Send-gate pattern.)

---

## 10. The closed loop (end to end, with the gates marked)

```
1. Prospector + diagnose                          [auto]   — built
2. Cold email (services-catalog bundle)           [GATE: Send] — built (leads/send)
3. Reply "call me" / form opt-in                  [auto capture → consent]
4. AI call within 60s                             [GATE: auto on consent, or you click Call]
5. Qualify + close + capture discovery            [auto, you can listen live]
6. Review the brief                               [GATE: you approve]   ◀
7. web-client-delivery builds site + SEO + GEO    [auto]   — built
8. Review the finished project                    [GATE: you approve]   ◀
9. Deploy + onboard                               [auto + deploy-to-vercel]
10. Recurring services + sell them an AI receptionist  [MRR loop]
```

Two human gates (6, 8) plus two action-gates (2, 4). Everything else compounds on its own. That's "I just observe and approve."

---

## 11. Parallax website tie-in (`/Users/admin/parallax-site`)

The call agent isn't just an internal tool — it's **proof and product** on the site:

1. **Voice-enable the concierge ("MERCURY").** `AI-CONCIERGE-WIDGET-SPEC.md` already specs the living agent with a "v2: voice" path. The call-agent voice stack *is* that v2. A visitor clicks "talk to me" → same engine, in the browser. **The widget demonstrates the exact product we sell.** (The spec's own proof footer: *"You're talking to a real Parallax agent — want one running yours?"*)
2. **New product page: "AI Voice Receptionist / AI Voice Agent"** under `/solutions` — the inbound SKU (§12.1). The site sells what the engine does.
3. **Add to the BEACON offer** (`BEACON-GTM-PACK.md`) and the services catalog as a new SKU (§12.1).
4. **"Request a callback" → consented outbound.** A form on the site that triggers a legal, warm, <60s call. The site becomes a lead-source that feeds the engine with pre-consented leads (Option A).
5. **Inbound number on the contact page** answered by the agent after hours — never miss a lead, and it's a live demo.

---

## 12. What you're NOT thinking about (the gaps that matter)

### 12.1 ⭐ The inbound receptionist is the bigger, safer business
The same engine, pointed *inward* for our clients, becomes **"AI Voice Receptionist"** — answers their phone 24/7, books appointments, captures leads, in every language their customers speak. It is: fully consented (no TCPA cold-call risk), **sticky MRR** (the #1 lever on the S-Tier screen), expensive (high margin), and a moat (tuned per their business). We already sell an `ai_chatbot` "AI Site Assistant — 24/7 receptionist" SKU as text; **voice is the 5–10× version.** New SKU: `ai_receptionist`, monthly $300–1,500. *This may be the best thing in this whole spec.*

### 12.2 Consent-based outbound beats cold (Option A)
The highest-converting, lowest-risk cold motion isn't cold at all: cold email → reply/opt-in → **legal warm call in 60s**. Your existing `leads/send` already produces the email; we add a reply/opt-in capture that auto-queues a consented call. This is why I recommend starting with Option A.

### 12.3 Call deliverability is its own discipline (or pickup = ~2%)
STIR/SHAKEN attestation, branded CNAM caller ID, number warm-up, **local-presence numbers** matched to `ICP_CITIES`, low daily volume per number, and active spam-label monitoring (FreeCallerRegistry). Skip this and the whole thing fails silently. Budget for it.

### 12.4 The no-answer reality — most calls don't connect
20–40% pickup means the flow must handle **voicemail drop + SMS follow-up + scheduled retry** as first-class paths, not edge cases. Multi-touch, not one-shot.

### 12.5 Recording consent — you're in an all-party state
Florida (and CA, and others) require **all-party consent** to record. The agent must say the consent line and log `consent.toRecord` before recording. International adds GDPR/PECR (EU), CASL/CRTC (Canada). Don't record without the line.

### 12.6 Payment on the call
Card-on-file / deposit to start (Bible: Sid Cassidy). The agent sends a **Stripe payment link via SMS** during or right after the close and logs `depositTaken`. Converts "interested" into "committed" before the call ends.

### 12.7 Data is PII — treat it as a hard gate
Recordings + transcripts are personal data. Storage, retention policy, access control, and deletion-on-request all apply (your standing rule on sensitive data). Encrypt at rest; auto-expire raw recordings after the brief is extracted.

### 12.8 Suppression / dedupe / instant opt-out
Never call a number twice in a window; honor "don't call me" *instantly* and permanently; maintain a suppression list checked in `compliance.ts`. One ignored opt-out is a complaint and a fine.

### 12.9 The reputation tax is asymmetric
Bible math: ~37 magic moments to offset 1 tragic moment. A bad AI call doesn't just lose one lead — it raises CPL across the board and damages BEACON. This is the real reason for disclosure + guardrails, beyond legality.

### 12.10 International is more than translation
Time zones (don't call at 3am local), country-specific consent law, local number provisioning, currency in the quote, and calling-hour windows. The agent needs a per-country compliance profile.

### 12.11 Human escalation is a feature, not a fallback
On a hot buying signal or a frustrated caller, warm-transfer to you live or book you immediately. The agent's job on those is to *hand you the close*, not to force it.

---

## 13. Unit economics (instrument from call #1 — Bible §7 leading indicators)

Track, per the Business Bible's "manage leading not lagging":

```
connect rate · talk-time · qualification rate · book rate · close rate ·
info-capture completeness · compliance-pass rate · hooks tested/week ·
cost per minute · cost per booked meeting · cost per closed deal
```

Rough model to validate before scaling (fill with real numbers in week 1):
```
~$0.07–0.15 / min all-in (telephony + STT + LLM + TTS + platform)
× avg call length × (1 / pickup rate) × (1 / close rate)
= cost per closed deal  →  must be << first-invoice + LTV of the MRR services
```
Start on **consented leads** (highest pickup + close) so the economics are green before touching cold volume. Volume cures volatility — but only once the per-deal math is positive.

---

## 14. Build phases — cheapest test of the riskiest assumption first

Per the Bible launch sequence (validate → off-the-ground → running → scaling):

- **Phase 0 — Validate (this week, ~$0).** Write `discovery-schema.ts`, `call-script.ts` (CLOSER state machine), and the golden transcripts. Run the **simulated-call eval** (Claude vs Claude) — prove the script books and captures before spending a cent on telephony. *Riskiest assumption = "can an AI run our CLOSER doctrine well." Test it for free first.*
- **Phase 1 — One real consented call.** Wire Vapi + Claude + Deepgram + ElevenLabs to **one warm-up number**. You opt in as the first "prospect," then 5 friendly real businesses who replied to a cold email. Listen live. Tune voice + latency + capture.
- **Phase 2 — Running.** Add the call-center cockpit, deliverability stack (§12.3), SMS follow-up, Stripe deposit, dual-language. Turn on the consented-outbound queue. Build the `ai_receptionist` inbound SKU in parallel (§12.1).
- **Phase 3 — Scaling.** Disclosed B2B cold (Option B) on warmed number pools; international profiles; sell the receptionist as MRR; voice-enable the website concierge.

---

## 15. Compliance checklist (the agent enforces these in `compliance.ts`)

- [ ] **Disclosure** — every call opens with "I'm an AI assistant with Parallax."
- [ ] **Consent to call** — Option A (opt-in) preferred; Option B scrubbed against National + state DNC.
- [ ] **Recording consent** — all-party-consent line before any recording (FL/CA/etc.).
- [ ] **Honest-if-asked** — never claims to be human.
- [ ] **Calling hours** — local time, no early/late calls.
- [ ] **Instant opt-out** — honored permanently, suppression list checked every call.
- [ ] **International profile** — GDPR/PECR (EU), CASL/CRTC (Canada) where applicable.
- [ ] **No off-catalog promises** — price/feature/timeline locked to `services-catalog.ts`.
- [ ] **PII handling** — recordings/transcripts encrypted, retention-limited, deletable.
- [ ] **Human escalation** — legal/contractual questions → book you, never answered by the bot.

---

### TL;DR for your decision
Approve **A + C** (consented outbound + inbound receptionist) and I'll start **Phase 0 free** — the discovery schema, the CLOSER script, and the eval harness — so we prove it books before spending a dollar. Say the word on the disclosure posture (§0) and whether the inbound receptionist SKU (§12.1) goes in the catalog now, and this loop closes on top of what we already built.
```
