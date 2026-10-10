# P2 Revenue Attribution Design

Status: implementation-ready design and inactive boundary contract. No tracking, vendor activation, database migration, production change, or historical backfill is included.

Date: 2026-10-10

## Failure case first

The current system cannot prove which acquisition source produced net revenue. The repository has useful pieces, but they are disconnected:

- `/free-audit` creates or updates a Supabase lead and records a consent event. It marks every submission `qualified`, overwrites prior `meta` during dedupe, and stores email and business name inside event detail.
- `/studio-inquiry` classifies an inquiry but writes to local JSON. That storage is ephemeral on serverless infrastructure and never joins the CRM.
- qualification and pipeline events exist in Supabase, but source is a free-form string and there is no stable acquisition-touch or consent snapshot.
- call discovery can report `booked`, but the repository contains no durable sales-booking provider, booking table, or booking webhook.
- three checkout routes create Stripe sessions, but none carries a CRM lead ID, booking ID, or immutable attribution ID across every product path.
- the Stripe webhook verifies signatures but has no event-ID ledger, no replay protection, no refund handling, and no write to the Command Center revenue model.
- the Command Center revenue endpoint lists only bounded recent Stripe objects. Pipeline `wonValue` is opportunity value, not collected cash, and neither view establishes net revenue after refunds and fees.
- Vercel Analytics and Speed Insights are mounted globally. No repository consent manager or youth-specific analytics gate was found. P2 must not add behavioral tracking on top of that gap.

The result is directional funnel reporting, not auditable acquisition-to-cash attribution.

## Decision

Use a first-party, append-only event spine with Stripe as the only automated cash authority. The key LUDUS move is **The Honest Loop** (Experimental): every scorecard number must expose its source health, consent status, reconciliation state, and unknowns. The convention inverted is silent attribution guessing. P2 never substitutes last-click, pipeline value, or a missing fee with a confident zero.

## Canonical journey

| Stage | Canonical event | Authority | Required join | Success proof |
|---|---|---|---|---|
| Acquisition | `acquisition.captured` | first-party server | anonymous session only when consent permits | allowed touch stored or explicit `none` |
| Lead | `lead.created` | CRM intake | `lead_id` | durable lead plus consent snapshot |
| Qualification | `qualification.completed` | qualification engine | `lead_id` | decision, reason code, model/rule version |
| Booking | `booking.created` | approved booking provider | `lead_id`, `booking_id` | provider webhook, not a success-page claim |
| Meeting | `booking.completed`, `.canceled`, `.no_show` | booking provider or authorized operator | `booking_id` | terminal booking status |
| Checkout | `checkout.created` | server Stripe session creator | `lead_id`, optional `booking_id`, `checkout_id` | Stripe Checkout Session ID in metadata |
| Payment | `payment.succeeded`, `.failed` | signed Stripe webhook | Stripe customer/session/payment IDs | payment fact with currency and livemode |
| Refund | `refund.succeeded` | signed Stripe webhook | original payment plus refund ID | refund amount and reason class |

Each producer supplies a stable `source_event_id`. The storage layer creates a unique constraint over `source:event_name:source_event_id`. First write wins; a payload mismatch for an existing key is an error and pages the reconciliation queue.

## Boundary contract

`src/lib/attribution-contract.ts` is the executable v1 boundary. It intentionally contains no writer. It requires:

- versioned event names and ISO timestamps;
- tenant and source provenance;
- a source event ID for idempotency;
- explicit consent and youth context on every event;
- attribution only after analytics consent and never for possible or confirmed youth context;
- revenue facts only from Stripe or an explicit manual reconciliation source;
- integer minor units and an explicit `null` when fees are not known.

The contract stores no name, email, phone, date of birth, medical data, street address, raw URL, raw referrer, IP address, user agent, call transcript, or free-text notes.

## Identity and joining

1. Before consent, do not create a durable cross-session visitor profile. Functional session state may carry a short-lived random request correlation ID.
2. After explicit analytics consent in a non-youth context, a first-party touch may be linked to a lead at form submission.
3. Lead creation returns `lead_id`; downstream qualification and booking use that value.
4. Checkout metadata uses opaque IDs only: `tenant_id`, `lead_id`, `booking_id`, and `attribution_version`. Never copy email, DOB, medical data, campaign URLs, or consent text into Stripe metadata.
5. Stripe customer and payment IDs are joined server-side from signed webhook payloads.
6. Deterministic joins by email are prohibited for attribution. The existing free-audit email dedupe may remain a CRM behavior, but it must not invent an acquisition link or overwrite earlier consent history.

## Attribution rule

Phase 1 scorecards expose three separate views, never one blended claim:

- first known consented touch;
- last known consented touch before lead creation;
- operational source recorded by the CRM.

An attributed conversion requires an unbroken allowed ID chain. If the chain is absent, consent is denied/unknown, youth context applies, or timestamps conflict, the conversion is `unattributed` with a reason code. There is no probabilistic identity stitching, fingerprinting, cross-device joining, or retroactive enrichment.

## Revenue truth

Stripe webhook facts are authoritative for automated cash reporting:

- gross collected = successful settled payment amounts;
- refunds = successful refund amounts, including partial refunds;
- fees = Stripe balance-transaction fees when available;
- net cash = gross collected minus refunds minus fees;
- net revenue = net cash minus taxes, transfers, chargebacks, and other adjustments only after each component is explicitly modeled.

Until those additional components exist, the UI must say `net cash`, not `net revenue`. Missing fees or unhandled currencies produce `unknown`, not zero. Test-mode and live-mode facts never mix. Each currency is reported separately; no exchange-rate conversion is inferred.

Pipeline value, proposal value, Checkout Session creation, payment-page success redirects, and active subscription MRR are not cash receipts.

## Privacy, consent, and METTLE youth safeguards

- Essential transaction and security events are distinct from analytics and marketing consent.
- Consent is versioned, purpose-specific, timestamped, and append-only. Withdrawal stops future optional collection; deletion/retention policy is handled separately.
- For `possible` or `confirmed` youth context, discard campaign parameters, click IDs, raw referrers, device identifiers, and behavioral analytics. Link commercial events to the adult payer or organization only.
- Do not place athlete names, DOB, medical information, attendance, performance, guardian details, or call recordings in attribution events or Stripe metadata.
- METTLE acquisition reporting is organization/adult-payer level. Athlete-level product analytics is a separate, gated program and is out of scope.
- No ad-platform conversion API, retargeting pixel, enhanced conversion, customer-list upload, or cross-platform shadow funnel is permitted in P2.
- Existing globally mounted analytics must receive a separate consent/youth audit before P2 activation.

## Scorecard

Every metric carries period, timezone, currency, source status, freshness, and reconciliation status.

| Layer | Metric | Numerator / denominator | Guardrail |
|---|---|---|---|
| Acquisition | consented leads by channel | allowed-touch leads | show unattributed separately |
| Speed | median and p90 lead response time | first human/agent response minus lead time | failed source is not zero |
| Quality | qualification rate | qualified / evaluated | exclude unevaluated |
| Booking | booking rate | bookings created / qualified | provider-confirmed only |
| Show | show rate | completed / terminal bookings | no-show and canceled separate |
| Checkout | checkout rate | sessions created / completed bookings | creation is not payment |
| Cash | payer conversion | unique successful payers / qualified leads | signed webhook only |
| Cash | gross collected | successful payment amount | by currency and livemode |
| Cash | refunds and refund rate | refunded amount / gross collected | partial refunds supported |
| Cash | net cash | gross minus refunds minus fees | unknown if any component missing |
| Attribution | attributable-cash coverage | cash with allowed complete chain / total cash | target before optimization, not a vanity KPI |
| Health | duplicate/rejected/orphan events | ingestion counts | visible and alertable |

Do not calculate CAC, ROAS, or LTV until spend imports, refund truth, and attribution coverage pass acceptance gates.

## Acceptance tests

### Contract

- a replay of the same source event creates one fact;
- a changed payload on the same idempotency key fails loudly;
- unknown/denied analytics consent removes attribution;
- possible/confirmed youth context removes every acquisition identifier;
- PII keys and arbitrary nested payloads are rejected;
- currency values are safe integers in minor units;
- a refund subtracts only once and links to its original payment;
- missing fee truth produces `unknown` net cash.

### Integration

- free-audit, studio inquiry, qualification, booking, each checkout route, payment, and refund emit the same schema in shadow mode;
- Stripe webhook retries and out-of-order delivery converge to one result;
- test mode is isolated from live mode;
- orphan payment and orphan booking queues are non-empty/fail-visible when joins break;
- a source outage returns a health failure, not an empty scorecard;
- every scorecard cell traces to source event IDs without exposing PII.

### Outside-in

- submit one adult test lead with analytics denied and prove no optional touch is stored;
- submit one possible-youth test lead and prove click/referrer fields are absent end to end;
- replay a signed Stripe test webhook and prove idempotency;
- issue a partial Stripe test refund and prove gross, refund, and net cash independently;
- inspect the rendered Command Center as an operator and confirm unknown/stale states are visible.

## Phased implementation

### Phase 0: contract and inventory, this change

- land the inactive contract and tests;
- approve event names, consent purposes, youth policy, retention, and the booking authority;
- no database or runtime integration.

### Phase 1: shadow spine

- add additive `attribution_events`, consent history, source-health, and reconciliation-queue migrations with deny-by-default RLS;
- add a server-only writer behind `CC_ATTRIBUTION_EVENTS=0` by default;
- dual-write only in preview/test after approval;
- add Stripe event idempotency before adding more webhook event types.

### Phase 2: first-party joins

- repair `/studio-inquiry` into the CRM;
- preserve free-audit consent history and remove PII from timeline detail;
- choose and integrate the booking authority;
- pass opaque join IDs into all three checkout routes;
- handle successful/failed payments and refunds from signed webhooks.

### Phase 3: scorecard

- build source-health and reconciliation views first;
- add funnel and cash scorecards with unknown/unattributed buckets;
- run the outside-in acceptance suite in preview;
- hold production activation for explicit approval.

### Phase 4: optional acquisition expansion

- only after coverage and consent gates pass, consider approved spend imports or platform conversion APIs;
- each vendor activation is a separate privacy, legal, credentials, and production approval.

## Remaining gates

1. Confirm authoritative booking provider and webhook semantics.
2. Approve consent language, retention/deletion policy, and jurisdictional review.
3. Decide whether globally mounted Vercel Analytics is permitted before consent, especially on METTLE/youth surfaces.
4. Approve Supabase migration and preview-only flag activation.
5. Provide a valid GitHub credential before any branch can be pushed or a PR opened.
6. Keep production pinned until preview evidence and an explicit deployment authorization exist.
