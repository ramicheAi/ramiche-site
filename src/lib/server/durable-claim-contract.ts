/**
 * Future durable-claim contract — DISABLED, NON-OPERATIONAL.
 *
 * Shape-compatible with P01 `docs/parallax-v5/boundary-contract.md` §4/§6.
 * P03 ships NO ledger, NO storage, NO migration, NO adapter, NO P01 runtime
 * import, and NO wiring. Every claim attempt denies, including when an
 * environment flag requests enablement — enabling is a separate Ramon gate.
 */
export const CLAIM_CONTRACT_VERSION = "p03-claim-contract-draft-1" as const;
export const CLAIMS_ENABLED = false as const;

/** P01 §4 envelope. `null` expiry is a denial condition, never "never expires". */
export interface ActionEnvelope {
  taskId: string;
  taskVersion: string;
  projectId: string;
  tenantId: string;
  payloadSha256: string;
  target: string;
  checkoutDigest: string;
  checkoutId: string;
  branch: string;
  headSha: string;
  scope: readonly string[];
  budget: { unit: string; limit: number } | null;
  evidenceIds: readonly string[];
  evidenceVersion: string;
  idempotencyKey: string;
  expiresAt: string | null;
  provenance: { requestedBy: string; approvedBy: string };
  actionClass: 1 | 2 | 3 | 4 | 5;
}

export type ClaimDenialReason =
  | "claims_disabled"
  | "envelope_incomplete"
  | "expiry_missing"
  | "budget_unknown";

export type ClaimResult = { ok: false; reason: ClaimDenialReason; status: 503 };

/** Pure shape check. Passing shape does NOT authorize anything. */
export function validateEnvelopeShape(
  input: Partial<ActionEnvelope> | null | undefined
): { ok: true } | { ok: false; reason: ClaimDenialReason; missing: string[] } {
  const e = input ?? {};
  const missing: string[] = [];
  const required: (keyof ActionEnvelope)[] = [
    "taskId",
    "taskVersion",
    "projectId",
    "tenantId",
    "checkoutId",
    "branch",
    "headSha",
    "checkoutDigest",
    "payloadSha256",
    "target",
    "evidenceVersion",
    "idempotencyKey",
    "provenance",
    "actionClass",
  ];
  for (const k of required) {
    const v = e[k];
    if (v === undefined || v === null || v === "") missing.push(String(k));
  }
  if (!Array.isArray(e.scope) || e.scope.length === 0) missing.push("scope");
  if (missing.length) return { ok: false, reason: "envelope_incomplete", missing };
  if (!e.expiresAt) return { ok: false, reason: "expiry_missing", missing: ["expiresAt"] };
  if (!e.budget) return { ok: false, reason: "budget_unknown", missing: ["budget"] };
  const validText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
  if (required.filter(k => k !== "provenance" && k !== "actionClass").some(k => !validText(e[k])) ||
      !/^[a-f0-9]{64}$/.test(e.payloadSha256 ?? "") || !/^[a-f0-9]{40,64}$/.test(e.headSha ?? "") ||
      !/^[a-f0-9]{64}$/.test(e.checkoutDigest ?? "") ||
      !e.scope?.every(validText) || !Array.isArray(e.evidenceIds) || !e.evidenceIds.length || !e.evidenceIds.every(validText) ||
      !validText(e.provenance?.requestedBy) || !validText(e.provenance?.approvedBy) ||
      !validText(e.budget.unit) || !Number.isFinite(e.budget.limit) || e.budget.limit < 0 ||
      !Number.isFinite(Date.parse(e.expiresAt)) || ![1,2,3,4,5].includes(e.actionClass ?? 0)) {
    return { ok: false, reason: "envelope_incomplete", missing: ["valid_bound_fields"] };
  }
  return { ok: true };
}

/** Enablement is refused by contract, regardless of environment. */
export function claimsEnabled(
  _env: Record<string, string | undefined> = process.env
): false {
  return false;
}

export function claimBackendStatus(): {
  enabled: false;
  backend: "none";
  contractVersion: typeof CLAIM_CONTRACT_VERSION;
  reason: "disabled_by_contract";
} {
  return {
    enabled: false,
    backend: "none",
    contractVersion: CLAIM_CONTRACT_VERSION,
    reason: "disabled_by_contract",
  };
}

/** Never acquires anything. Touches no storage. */
export async function acquireDurableClaim(
  _envelope: Partial<ActionEnvelope>
): Promise<ClaimResult> {
  return { ok: false, reason: "claims_disabled", status: 503 };
}

/** Future adapter contract only. No implementation is provided or selected. */
export interface DurableClaimStore {
  claim(envelope: ActionEnvelope): Promise<FutureClaimDecision>;
  reconcile(idempotencyKey: string): Promise<FutureClaimDecision>;
}
export type ClaimState = "claimed" | "executing" | "succeeded" | "failed" | "outcome_unknown" | "reconciled";

/** Future result shape only; P03's acquireDurableClaim can never return ok:true.
 * An adapter must atomically bind the complete envelope, prohibit duplicate
 * execution and reconcile outcome_unknown before retry. This type is not proof.
 */
export type FutureClaimDecision = ClaimResult | {
  ok: true;
  claimId: string;
  idempotencyKey: string;
  envelopeSha256: string;
  state: ClaimState;
};
