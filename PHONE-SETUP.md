# PHONE-SETUP.md — The Parallax Line (Phase 1: Ramon's 30 minutes)

Goal: a business number owned by Parallax Ventures Inc that (a) shows the company
on caller ID where carriers allow it, (b) powers click-to-call from the Command
Center, (c) later feeds the BEACON inbound AI receptionist on the same number.

Cost: ~$1.15/mo for the number + ~$0.014/min outbound. Realistic total at current
volume: **$10–20/mo.** (Approved by Ramon 2026-07-08.)

---

## Step 1 — Create the Twilio account (company asset, not personal)
1. https://www.twilio.com/try-twilio — sign up with a **Parallax email**, not gmail.
2. Company profile: Parallax Ventures Inc + business address. This matters for
   STIR/SHAKEN attestation and CNAM later.
3. Upgrade out of trial (add card): trial accounts watermark calls with a robo
   preamble — useless for sales calls.

## Step 2 — Buy the number
1. Console → Phone Numbers → Buy a Number.
2. Filter: **Local**, area code **954** (or 754) — local presence lifts answer
   rates with Broward targets more than anything else.
3. Voice capability required; SMS nice-to-have (follow-up texts later).

## Step 3 — Caller ID name (CNAM)
1. Console → Phone Numbers → the number → configure **CNAM / Caller ID name**
   (under Voice settings; Twilio calls it "CNAM Registration", takes days to
   propagate through carrier databases).
2. Display string is limited to **15 characters**. Use: `PARALLAX VNTRS`
3. Reality check: business landlines (most of our targets) will show it; personal
   cells mostly show just the number. Do not pay for "branded calling" yet.

## Step 4 — Trust / anti-spam (10 minutes that protect the whole motion)
1. Console → Trust Hub → create a **Customer Profile** for Parallax Ventures Inc
   and attach the number → gets SHAKEN **A-attestation** on our calls.
2. Register the number at **freecallerregistry.com** (one form covers the three
   big carrier-reputation vendors) — business name, number, "customer service /
   sales" use, low volume.
3. Rules of the road (doctrine, not config): human-initiated one-at-a-time calls
   only (no autodialer, ever — TCPA/FTSA), keep it under ~50 dials/day on a fresh
   number, and put the number on the website + GBP + email signatures so its
   footprint looks legitimate because it is.

## Step 5 — Voicemail + inbound forward (a returned call must never die)
1. The number → Voice Configuration → "A call comes in" → for now: **forward to
   Ramon's cell**. (Later this becomes the BEACON AI receptionist — same number.)
2. Record the voicemail greeting on your cell's forwarded no-answer path, or set
   a Twilio Studio flow later. Minimum viable: forward + your cell's voicemail.

## Step 6 — Keys for the Command Center (hands to Claude/Atlas when done)
Console → Account → API keys & tokens:
- Account SID (`AC…`) and Auth Token
- Create an **API key** (Standard) → SID (`SK…`) + Secret
- Console → Voice → TwiML Apps → Create: name `CC click-to-call`,
  Voice Request URL = `https://command.parallaxvinc.com/api/command-center/voice/twiml`
  (POST) → note the App SID (`AP…`)

Then add to `ramiche-site/.env.local`:
```
TWILIO_ACCOUNT_SID=AC…
TWILIO_AUTH_TOKEN=…
TWILIO_API_KEY_SID=SK…
TWILIO_API_KEY_SECRET=…
TWILIO_TWIML_APP_SID=AP…
TWILIO_PHONE_NUMBER=+1954…
```
…and say the word — the server side (`/api/command-center/voice/token|twiml|recording`)
is already built and env-gated; Phase 2 finishes the in-browser dialer the same day.

---

## Recording policy (locked — Fla. Stat. §934.03, all-party consent)
- **Cold calls: never recorded.** No exceptions; a violation is felony-grade.
- **Booked/discovery calls: recordable** only with the spoken disclosure up front
  ("quick heads up, I record my calls so I don't miss details — that okay?").
  The UI keeps recording OFF by default; the toggle exists only on booked calls.
- The always-legal coaching loop is the 20-second post-call debrief field in the
  Deal Room (your own notes, transcribed/dictated) — use it on every dial.

## Phase map
- **Phase 0 (live now):** dial from cell → log outcome + debrief in CC →
  callbacks auto-scheduled and surfaced on the Leads list.
- **Phase 1 (this file):** Ramon stands up the number.
- **Phase 2 (built same-day once keys land):** in-browser click-to-call from the
  Deal Room, auto-logged duration, consent-gated recording, transcripts on the lead.
- **Phase 3:** same number into Vapi → BEACON inbound receptionist (spec + Vapi
  integration already in repo: `AI-CALL-AGENT-SPEC.md`, `src/lib/voice/`).
