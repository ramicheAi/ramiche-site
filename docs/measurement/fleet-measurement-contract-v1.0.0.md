# RAMICHE fleet measurement, event, and consent contract

**Contract version:** `1.0.0-draft.1`

**Date:** 2026-10-09

**Status:** Approval required. This document authorizes no collection, deployment, analytics activation, advertising, publishing, or spend.

**Owners:** Business owner: Ramon Walton. Schema steward: RAMICHE Command Center. Venture implementers remain accountable for their own policy allowlist.

## 1. Failure boundary

This contract exists to prevent five false claims: that unavailable data means zero, that gross Stripe receipts mean profit, that a platform-reported conversion is a unique customer, that a payment is permanent before refund reconciliation, and that one venture's consent permits another venture's tracking.

An implementation is non-compliant if it silently substitutes seed, cached, sample, inferred, or zero-filled data for a failed source. Every read model MUST expose source, retrieval time, coverage, health, and reconciliation status.

## 2. Global prohibitions

1. No raw email, phone number, name, street address, free-form form body, message content, health data, youth data, or full IP address may enter the measurement event store.
2. No cross-venture identity graph, device fingerprint, probabilistic identity match, audience enrichment, or sale/share of event data.
3. No Meta Pixel, TikTok Pixel, Google Ads tag, GTM container, or equivalent third-party advertising pixel unless a future venture-specific policy version explicitly allows it.
4. Parallax remains no-pixel. Its permitted path is bounded first-party UTMs and first-party/server-side events only.
5. Galactik GA4 remains inactive. The existing environment variable is not consent or authorization to load the tag.
6. METTLE events may not be used for youth profiling, behavioral advertising, lookalike audiences, remarketing, or audience enrichment. No minor identifier, birth date, age, team, school, performance result, health signal, or precise location enters this contract's measurement spine.
7. Organic publishing identity grants do not imply paid-ads permissions.
8. Agents may propose or analyze. They may not create campaigns, change budgets, publish, or spend under this contract.

## 3. Canonical event envelope

Every accepted event MUST contain the required fields below. Unknown fields are rejected rather than stored.

| Field | Type | Rule |
|---|---|---|
| `contract_version` | string | Exactly the producer-approved contract version |
| `event_id` | UUIDv7/UUIDv4 string | Generated once at the originating action and reused by browser/server copies |
| `event_name` | enum | One of the approved names in section 4 |
| `occurred_at` | RFC 3339 UTC timestamp | Client/action time; reject more than 24h future or 30d late unless source is an approved reconciliation import |
| `received_at` | RFC 3339 UTC timestamp | Assigned by the collector, never the client |
| `venture` | enum | `parallax`, `galactik`, `mettle`, `ramiche`, `parallax_publish` |
| `environment` | enum | `production`, `preview`, `development`, `synthetic` |
| `anonymous_acquisition_id` | opaque string or null | First-party, random, 128-bit minimum; never derived from PII or device properties |
| `lead_id` | opaque string or null | Internal surrogate after lead creation; no contact data |
| `booking_id` | opaque string or null | Internal/provider surrogate only |
| `checkout_session_id` | string or null | Provider ID; server-originated checkout/payment events only |
| `payment_intent_id` | string or null | Provider ID; server-originated payment/refund events only |
| `currency` | ISO 4217 string or null | Required for monetary events |
| `amount_minor` | integer or null | Signed minor currency units; gross event amount |
| `fee_minor` | integer or null | Actual fee when reconciled; null is unknown, never zero-filled |
| `refund_minor` | integer or null | Cumulative refund amount for reconciliation snapshots; null when not applicable |
| `estimated_cogs_minor` | integer or null | Allowed only with `cogs_method` and model/version provenance |
| `cogs_method` | enum or null | `actual`, `sku_schedule`, or `versioned_estimate`; required when COGS is present |
| `cogs_model_version` | string or null | Required for `sku_schedule` and `versioned_estimate` |
| `consent_state` | enum | `not_required`, `granted`, `denied`, `withdrawn`, `unknown` |
| `collection_basis` | enum | `strictly_necessary`, `consent`, `contract`, `legitimate_interest_reviewed`, `synthetic` |
| `policy_version` | string | Venture policy version that allowed or denied the collection |
| `landing_path` | string or null | Same-site path only; strip query, fragment, and user content |
| `attribution` | object | Allowlisted fields in section 5 only |
| `provenance` | object | Required source evidence in section 7 |
| `synthetic` | boolean | True for QA/internal synthetic journeys; synthetic rows are excluded from business metrics by default |

`anonymous_acquisition_id`, `lead_id`, `booking_id`, `checkout_session_id`, and `payment_intent_id` form a lineage, not a public identity. Join access is restricted to the measurement service role and audited owner views.

## 4. Event names and owners

| Event | Required identifiers | Authoritative producer | Meaning |
|---|---|---|---|
| `landing_viewed` | acquisition ID | First-party venture server/collector | Eligible landing request was observed |
| `lead_submitted` | acquisition ID, lead ID | Lead intake API after durable write | Lead record exists |
| `lead_qualified` | lead ID | CRM after durable stage write | Qualification rule/human decision persisted |
| `booking_started` | acquisition or lead ID | First-party booking handoff | Booking flow opened; not a booking |
| `booking_confirmed` | booking ID, lead ID when available | Booking webhook/reconciliation | Booking exists in source system |
| `checkout_started` | checkout session ID, acquisition/lead ID when available | Server checkout creator | Checkout session created |
| `payment_succeeded` | payment intent ID, checkout session ID | Verified Stripe webhook | Settled-success event received; subject to later refund/dispute |
| `payment_refunded` | payment intent ID | Verified Stripe webhook | Full or partial refund persisted |
| `payment_disputed` | payment intent ID | Verified Stripe webhook | Dispute opened/updated |
| `subscription_cancelled` | provider subscription ID in provenance | Verified Stripe webhook | Subscription cancellation persisted |
| `consent_changed` | acquisition ID when permitted | First-party consent service | Consent grant, denial, or withdrawal changed |

Client-side events are never authoritative for lead creation, bookings, payments, refunds, disputes, fees, or cancellations.

## 5. Attribution allowlist

The `attribution` object rejects every key except:

- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`: UTF-8 strings, 120 characters maximum, control characters removed.
- `platform`: `meta`, `google_ads`, `tiktok`, `other`, or null. This labels evidence and grants no API permission.
- `campaign_id`, `ad_set_id`, `ad_id`, `creative_id`: platform identifiers, 160 characters maximum, only where the venture policy permits paid attribution.
- `click_id_type`: `gclid`, `gbraid`, `wbraid`, `fbclid`, `ttclid`, `other`, or null.
- `click_id_hash`: keyed HMAC of a permitted click ID, never the raw click ID. Key version is recorded in provenance. Hashes are venture-scoped and cannot be joined across ventures.
- `first_touch_event_id` and `last_touch_event_id`: existing event IDs in the same venture.

Query parameters outside the allowlist are discarded before persistence. Marketing fields never override source-of-truth payment or CRM identifiers.

## 6. Venture policy matrix

| Venture | First-party functional events | Bounded UTMs | Paid click-ID HMAC | Third-party analytics | Third-party ad pixels | Profiling/remarketing | Special rule |
|---|---|---|---|---|---|---|---|
| Parallax | Allow | Allow | Deny in v1 | Deny | Deny | Deny | Preserve public no-advertising-pixel posture |
| Galactik | Allow after consent policy approval | Allow after consent policy approval | Deny in v1 | Deny; GA4 stays inactive | Deny | Deny | Existing GA code/config is not activation approval |
| METTLE | Strictly necessary commerce/consent only | Deny in v1 | Deny | Deny | Deny | Deny | No youth profiling or youth data in measurement store |
| RAMICHE | Allow after route-level inventory | Allow | Deny in v1 | Deny in v1 | Deny | Deny | Music/publishing identity is separate from measurement identity |
| Parallax Publish | Billing and delivery operations only | Deny unless separately approved | Deny | Deny | Deny | Deny | Social account grants are publishing grants, not ads grants |

Any `Deny` becomes `Allow` only through a new reviewed policy version and explicit owner approval. Absence from the matrix means deny.

## 7. Data provenance and health

Every event's `provenance` object MUST include:

- `source_system`: stable enum such as `parallax_web`, `command_center_crm`, `stripe_webhook`, `booking_webhook`, or `manual_reconciliation`.
- `source_record_id`: opaque record/event identifier when one exists.
- `source_event_created_at`: source timestamp or null.
- `ingestion_method`: `first_party_server`, `verified_webhook`, `read_only_api`, `approved_import`, or `synthetic_test`.
- `ingestion_run_id`: identifier for replay, audit, and rollback.
- `schema_version`: producer schema version.
- `raw_evidence_hash`: SHA-256/HMAC digest of the canonical source payload where retention policy allows, never a substitute for signature verification.
- `verification`: `verified_signature`, `authenticated_api`, `first_party_write`, `manual_attestation`, or `unverified`.
- `key_version`: required when a keyed HMAC is used.

Read models MUST report `source`, `fetched_at`, `latest_source_at`, `health`, `coverage_start`, `coverage_end`, `unattributed_count`, `conflict_count`, and `reconciliation_status`. Source failure is `unavailable`, not an empty list or zero.

## 8. Deduplication and idempotency

1. The origin creates one `event_id` per real-world action. Browser and server copies MUST carry the same `event_id`.
2. The collector enforces unique `(venture, environment, event_id, event_name)`. Replays return the existing receipt and do not increment metrics.
3. Server-authoritative events win over client copies. A later verified server copy may enrich an existing row but may not mutate immutable origin fields without an audit revision.
4. Stripe events additionally enforce unique provider `event.id`; payments group on `payment_intent_id`; refunds group on provider refund ID and payment intent.
5. Missing shared event IDs do not trigger probabilistic deduplication. Rows remain separate, are flagged `deduplication_status=unresolved`, and lower attribution confidence.
6. Deduplication corrections are append-only revisions with actor, reason, old hash, new hash, and timestamp.

## 9. Refunds, fees, and profit

- `gross_revenue_minor` is the sum of authoritative successful payment amounts.
- `refunds_minor` includes full and partial refunds only after verified webhook/API reconciliation.
- `disputes_minor` is reported separately until resolved.
- `net_revenue_minor = gross_revenue_minor - refunds_minor - resolved_chargebacks_minor`.
- `contribution_minor = net_revenue_minor - actual_fees_minor - actual_or_versioned_estimated_cogs_minor`.
- Unknown fees or COGS remain null. A dashboard may not silently treat null as zero or call the result profit.
- Payment, refund, and dispute events may arrive out of order. The current financial state is derived by replay/reconciliation, while source events remain immutable.

## 10. Attribution confidence

Every attributed conversion exposes a confidence grade and machine-readable reasons:

| Grade | Minimum evidence |
|---|---|
| `A_direct` | Same-venture acquisition lineage reaches authoritative lead/checkout/payment; event IDs deduplicated; consent/policy valid; no conflicting touch |
| `B_joined` | Deterministic same-venture join through lead, booking, checkout, or payment metadata, but one non-critical touch is missing |
| `C_platform_only` | Platform/click evidence exists but no complete first-party lineage to authoritative payment |
| `D_utm_only` | Allowlisted UTM evidence only |
| `U_unattributed` | No permitted evidence |
| `X_conflicted` | Multiple incompatible deterministic claims, policy mismatch, unresolved duplicate, or synthetic/production contamination |

Fleet scorecards MUST show the distribution by grade and conflict/unattributed rates. They may not collapse `C`, `D`, `U`, or `X` into confident ROAS. Attribution uses the stored evidence available under the venture policy; it does not infer cross-device identity.

## 11. Retention, deletion, and consent withdrawal

| Data class | Default retention | Deletion behavior |
|---|---|---|
| Raw rejected payload diagnostics | 7 days, redacted | Hard delete automatically |
| Accepted non-financial event envelope | 13 months | Hard delete identifiers and event row at expiry |
| Click-ID HMAC | 90 days | Hard delete; aggregated non-identifying totals may remain |
| Acquisition-to-lead linkage | 13 months or earlier verified request | Delete linkage; preserve only legally required records |
| Payment/refund/dispute event and audit receipt | 7 years, subject to counsel/accounting approval | Restrict and de-identify where legally allowed; do not erase required financial records |
| Consent receipt | Life of consent plus 6 years, subject to counsel approval | Preserve minimal proof; remove optional linkage on withdrawal |
| Synthetic QA data | 30 days | Hard delete automatically |
| Aggregate scorecard rows | 25 months | Must be non-identifying; recompute after deletion where feasible |

Deletion requests are venture-scoped and identity-verified outside the measurement store. Deletion jobs record request ID, scope, systems checked, row counts, exceptions, lawful-retention reason, actor, and completion time. Consent withdrawal stops future optional collection immediately; it does not rewrite historical lawful financial facts. Failed deletion or downstream propagation is visible and retried, never marked complete.

## 12. Security and access

- Separate service roles for ingestion, reconciliation, and read models; least privilege and no browser access to service keys.
- Encrypt in transit and at rest. HMAC keys are managed outside repositories and logs.
- Owner/auditor access to lineage; agents receive aggregates or explicitly scoped records.
- Log reads of joined lineage and all writes/corrections/deletions.
- No secret, raw webhook payload, contact field, or click ID in application logs.

## 13. Compatibility and change control

- Patch: clarifications that do not change stored fields or permissions.
- Minor: backward-compatible optional fields/events or tighter validation.
- Major: permission expansion, retention expansion, new identity joins, changed meaning, or breaking schema.

Every producer sends `contract_version`. Collectors reject unsupported major versions. Permission expansion always requires Ramon approval, privacy review, and a new venture policy version even if technically backward compatible.

## 14. P0 acceptance checklist

- [ ] Ramon approves this contract and names the schema steward.
- [ ] Legal/privacy reviewer confirms collection bases and retention, especially payment records and METTLE.
- [ ] Each venture owner signs its matrix row.
- [ ] Event schema is converted to machine validation with reject receipts.
- [ ] Deletion and consent-withdrawal runbooks name accountable operators.
- [ ] Synthetic/test isolation and source-health semantics are accepted.

Until those boxes are approved, this remains a concrete draft and no new measurement collection is authorized.

## 15. P1 synthetic exit test

After approval and implementation, one `environment=synthetic` Parallax journey must generate exactly one joined lineage:

`landing_viewed -> lead_submitted -> lead_qualified -> booking_confirmed -> checkout_started -> payment_succeeded -> payment_refunded`

The test must also prove duplicate browser/server submissions count once, stripped UTMs downgrade confidence, denied consent blocks optional collection, a delayed duplicate webhook is idempotent, a refund changes net revenue, synthetic rows never enter production metrics, and forced CRM/source failures render `unavailable` rather than zero.
