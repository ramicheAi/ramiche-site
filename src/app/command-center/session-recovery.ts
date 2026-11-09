/**
 * Browser-side decision for CC-SECURITY-COMPLETION-02 session recovery.
 *
 * The layout must not lock the founder out of a page just because the server cannot
 * issue a founder session. Two states look identical from a bare 401 but mean opposite
 * things:
 *
 *   - Guard off (CC_FOUNDER_GUARD_ENFORCE unset): sessionStorage is still the only lock,
 *     exactly as before this feature. A 401 here is normal and must NOT clear the local
 *     unlock.
 *   - Guard on but no signing secret: every privileged route returns 503, so clearing the
 *     local unlock and asking for the PIN again can never succeed. That is a loop, not a
 *     recovery.
 *
 * Only "guard on, secret present, session missing/expired/revoked" is a real recovery.
 */

export type SessionStatePayload = {
  authenticated?: boolean;
  reason?: string;
  enforcement?: { on?: boolean; routes?: string[] };
};

export type RecoveryDecision = { recover: false } | { recover: true; notice: string };

export function decideSessionRecovery(
  status: number,
  payload: SessionStatePayload | null,
): RecoveryDecision {
  if (status !== 401) return { recover: false };
  if (payload?.enforcement?.on !== true) return { recover: false };
  if (payload.reason === "not_configured") return { recover: false };
  if (payload.reason === "expired") {
    return { recover: true, notice: "Your founder session expired. Enter the PIN to unlock again." };
  }
  if (payload.reason === "revoked") {
    return { recover: true, notice: "Your founder session was revoked. Enter the PIN to unlock again." };
  }
  return {
    recover: true,
    notice: "The server no longer recognises this session. Enter the PIN to unlock again.",
  };
}
