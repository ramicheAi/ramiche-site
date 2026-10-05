/**
 * P06 M6 founder approval, bound to one exact ExecutionRequest.
 *
 * An approval is an HMAC over the request's binding hash (contract.ts bindingOf: command, executor, project, origin,
 * branch, head, capability, task, limits, idempotency key), the founder, and an expiry. Changing any of those, or
 * using it after it expires, or by anyone else, fails verification. It grants exactly the bound capability: an L2
 * approval cannot run an L4 request, because the capability is inside the signed binding.
 *
 * The key is derived from the cockpit's existing PARALLAX_CSRF_SECRET with a fixed label, so no new secret exists and
 * a token minted for CSRF can never verify as an approval. A missing or short secret fails closed.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { bindingHash, type ExecutionRequest } from "./contract";

export const APPROVAL_MAX_TTL_MS = 15 * 60 * 1000;
const LABEL = "parallax/p06-m6/execution-approval/v1";

export interface Approval {
  bindingHash: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
  signature: string;
}

export function approvalKey(secret: string | undefined = process.env.PARALLAX_CSRF_SECRET): Buffer | null {
  if (!secret || secret.length < 32) return null;
  return createHmac("sha256", secret).update(LABEL).digest();
}

const payload = (a: Omit<Approval, "signature">) => JSON.stringify([LABEL, a.bindingHash, a.approvedBy, a.approvedAt, a.expiresAt]);
const sign = (key: Buffer, a: Omit<Approval, "signature">) => createHmac("sha256", key).update(payload(a)).digest("hex");

/** The founder approves this exact request. Called only from a founder-authenticated surface. */
export function approve(r: ExecutionRequest, founderUid: string, key: Buffer, now = Date.now(), ttlMs = APPROVAL_MAX_TTL_MS): Approval {
  const body = {
    bindingHash: bindingHash(r), approvedBy: founderUid,
    approvedAt: new Date(now).toISOString(), expiresAt: new Date(now + Math.min(ttlMs, APPROVAL_MAX_TTL_MS)).toISOString(),
  };
  return { ...body, signature: sign(key, body) };
}

export type ApprovalCheck = { ok: true } | { ok: false; code: "approval_missing" | "approval_invalid" | "approval_mismatch" | "approval_expired" | "approval_wrong_founder" | "approval_key_unavailable"; message: string };

export function verifyApproval(r: ExecutionRequest, a: Approval | null | undefined, key: Buffer | null, now = Date.now()): ApprovalCheck {
  if (!key) return { ok: false, code: "approval_key_unavailable", message: "Approvals cannot be checked on this host (no approval key)." };
  if (!a || typeof a !== "object") return { ok: false, code: "approval_missing", message: "This needs your approval first." };
  const fields = [a.bindingHash, a.approvedBy, a.approvedAt, a.expiresAt, a.signature];
  if (!fields.every((f) => typeof f === "string" && f.length > 0) || !/^[0-9a-f]{64}$/.test(a.signature)) {
    return { ok: false, code: "approval_invalid", message: "The approval is malformed." };
  }
  const expected = Buffer.from(sign(key, a), "hex");
  const given = Buffer.from(a.signature, "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, code: "approval_invalid", message: "The approval signature does not verify." };
  if (a.bindingHash !== bindingHash(r)) return { ok: false, code: "approval_mismatch", message: "The approval was for a different request (task, project, commit, capability or limits changed)." };
  if (a.approvedBy !== r.founder.uid) return { ok: false, code: "approval_wrong_founder", message: "The approval was not given by the requesting founder." };
  const exp = Date.parse(a.expiresAt), at = Date.parse(a.approvedAt);
  if (Number.isNaN(exp) || Number.isNaN(at) || exp - at > APPROVAL_MAX_TTL_MS || at > now + 60_000) return { ok: false, code: "approval_invalid", message: "The approval times are invalid." };
  if (now >= exp) return { ok: false, code: "approval_expired", message: "The approval expired. Approve again to run it." };
  return { ok: true };
}
