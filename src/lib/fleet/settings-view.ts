/**
 * Display and validation rules for the Fleet model settings.
 *
 * WHY THIS IS SEPARATE FROM THE COMPONENT
 * ---------------------------------------
 * The acceptance rules for this screen are about truth, not rendering: an unavailable registry must
 * never look like an empty one, a rejected write must never look like a success, and the confirmed
 * value must come from the server's read-back rather than from what the user asked for. Those rules
 * are testable without a DOM, so they live here and the component only renders their output.
 *
 * The server side (PR #95) already refuses unknown agents, providers and models, writes only
 * `agents.list[i].model`, and returns the persisted value. This module does not replace those
 * checks; it stops the UI from pretending before the server has answered.
 */

export type RegistryProvider = { name: string; models: string[]; reachability: 'unverified' };

export type RegistryAgent = {
  agentId: string;
  primary: string | null;
  fallbacks: string[];
  unsupported: boolean;
};

export type RegistrySnapshot = {
  agents: RegistryAgent[];
  providers: RegistryProvider[];
  warnings: string[];
  observedAt: string;
};

export type RegistryResponse =
  | { ok: true; source: 'live'; registry: RegistrySnapshot }
  | { ok: false; source: 'unavailable' | 'malformed'; reason?: string; detail?: string };

export type RegistryView =
  | { state: 'loading' }
  // `heading` is rendered above `reason`. They are separate fields because a single sentence cannot
  // both name the category and give the advice without contradicting itself for at least one reason.
  | { state: 'denied'; reason: string; code: string; heading: string }
  | { state: 'unavailable'; reason: string; detail?: string }
  | { state: 'malformed'; reason: string }
  | { state: 'empty'; registry: RegistrySnapshot }
  | { state: 'ready'; registry: RegistrySnapshot };

// requireCommandCenterOwner() can refuse for these reasons (command-center-guard.ts), and every one
// is wrapped identically by ownerDenialResponse as {ok:false, error:"denied", reason}.
//
// The inventory, read from the source rather than guessed, because the previous version of this
// file listed ten codes and called the list complete while the guard was minting templated reasons
// it did not contain:
//
//   session   missing_session, invalid_session, session_expired, not_owner, owner_not_configured
//   origin    cross_site, origin_mismatch, missing_origin
//   unlock_   missing, malformed, not_configured, bad_signature, expired      (command-center-guard.ts:85)
//   device_   not_configured, malformed, not_found, secret_mismatch, revoked,
//             expired, owner_mismatch                                        (command-center-guard.ts:93)
//   plus      device_mismatch (the device cookie and the unlock cookie name different devices)
//
// That is why the write path below gates on the envelope (`error === 'denied'`) instead of on a
// list. A list cannot stay complete: `unlock_${reason}` and `device_${reason}` are built from the
// verifier's own reason union, so any new reason the guard mints would silently fall through to
// "the runtime rejected the change" — an auth refusal blamed on the runtime, on the one credential
// that is most likely to be revoked in normal use.
const UNAUTHORIZED_ORIGIN_REASONS = new Set(['cross_site', 'origin_mismatch', 'missing_origin']);
const SESSION_REASONS = new Set([
  'missing_session',
  'invalid_session',
  'session_expired',
  'missing_unlock',
  'device_mismatch',
]);

/**
 * True when a refusal came from the authorization guard rather than from the runtime's own logic.
 * Prefers the envelope; falls back to the reason shape so a caller that passes only the reason (or
 * a future response that drops `error`) still classifies correctly.
 */
function isAuthDenial(response: unknown, reason: string | undefined): boolean {
  if (response && typeof response === 'object' && (response as { error?: unknown }).error === 'denied') {
    return true;
  }
  if (!reason) return false;
  if (SESSION_REASONS.has(reason)) return true;
  if (UNAUTHORIZED_ORIGIN_REASONS.has(reason)) return true;
  if (reason === 'not_owner' || reason === 'owner_not_configured') return true;
  // The guard's templated reasons. This is a shape check, not a list, so it cannot go stale.
  return reason.startsWith('unlock_') || reason.startsWith('device_');
}

const DEVICE_NOT_RECOGNIZED =
  'this device is not recognized by the runtime; sign in with the owner account, or enroll this device again';
const DEVICE_UNLOCK_STALE =
  'this device’s unlock has expired or is invalid; enter your PIN again, or sign in with the owner account';

/** The one denial message shown for both the GET (registry) and POST (write) auth failures. */
function authDenialMessage(reason: string | undefined): string {
  if (reason && UNAUTHORIZED_ORIGIN_REASONS.has(reason)) {
    return 'the request was blocked for security reasons; reload the page and try again';
  }
  if (reason === 'not_owner') return 'this session is signed in, but not as this runtime’s configured owner';
  if (reason === 'owner_not_configured') return 'no owner is configured for this runtime yet';

  // Device-trust reasons. These are a primary credential on the iMac, so a revoked or expired
  // device is an ordinary daily state, and the advice has to be "re-authenticate or re-enroll",
  // never "the runtime rejected the change".
  if (reason === 'device_revoked') {
    return 'this device’s access was revoked, so it can no longer act as the owner; sign in with the owner account, or enroll this device again';
  }
  if (reason === 'device_expired') {
    return 'this device’s access expired; sign in with the owner account, or enroll this device again';
  }
  if (reason === 'unlock_expired' || reason === 'unlock_bad_signature' || reason === 'unlock_malformed' || reason === 'unlock_missing') {
    return DEVICE_UNLOCK_STALE;
  }
  if (reason === 'unlock_not_configured' || reason === 'device_not_configured') {
    return 'device unlock is not configured on this runtime; sign in with the owner account';
  }
  if (
    reason === 'device_not_found' ||
    reason === 'device_secret_mismatch' ||
    reason === 'device_owner_mismatch' ||
    reason === 'device_malformed' ||
    reason === 'device_mismatch'
  ) {
    return DEVICE_NOT_RECOGNIZED;
  }

  // A future device-trust reason: still a device-credential problem, so give device advice rather
  // than a generic sentence. This is the branch that keeps the message correct without a list.
  if (reason && (reason.startsWith('device_') || reason.startsWith('unlock_'))) return DEVICE_NOT_RECOGNIZED;

  // missing_session / invalid_session / session_expired
  if (!reason || SESSION_REASONS.has(reason)) return 'your session expired; sign in again';
  // An unrecognised denial is still an authorization refusal, so it must not be described as
  // something the runtime did to the change.
  return 'this request was not authorized; sign in again';
}

/**
 * The heading above the denial detail. Carried separately from the detail because the detail is a
 * full sentence: putting "Your session expired." above "this session is signed in, but not as this
 * runtime's configured owner" says two different things in one breath, which is still a lie to the
 * operator even when the detail is right.
 */
export function denialHeading(reason: string | undefined): string {
  if (reason && UNAUTHORIZED_ORIGIN_REASONS.has(reason)) return 'Request blocked.';
  if (reason === 'not_owner') return 'Not the owner.';
  if (reason === 'owner_not_configured') return 'No owner configured.';
  if (reason && (reason.startsWith('unlock_') || reason.startsWith('device_'))) {
    return 'This device is not authorized.';
  }
  if (!reason || SESSION_REASONS.has(reason)) return 'Your session expired.';
  return 'Not authorized.';
}

/** Turn a GET response into exactly one truth state. "No data" and "no answer" are different. */
export function describeRegistry(response: RegistryResponse | null | undefined): RegistryView {
  if (!response) return { state: 'loading' };
  if (response.ok === false) {
    const reason = (response as { reason?: string }).reason;
    // The guard answers {error:"denied", reason} with no `source` for every refusal reason — that
    // is an auth problem, not an unreachable runtime, and telling the operator "runtime
    // unavailable" sends them to debug the wrong thing. Gate strictly on error==='denied' (not on
    // the specific reason value) so every guard refusal lands here, then pick the message by the
    // actual reason instead of defaulting all of them to "session expired".
    if ((response as { error?: string }).error === 'denied') {
      return {
        state: 'denied',
        code: reason ?? 'denied',
        heading: denialHeading(reason),
        reason: authDenialMessage(reason),
      };
    }
    if (response.source === 'malformed') {
      return { state: 'malformed', reason: response.reason ?? 'the registry could not be parsed' };
    }
    return {
      state: 'unavailable',
      reason: response.reason ?? 'the runtime registry is not reachable from here',
      detail: response.detail,
    };
  }
  const { providers, agents } = response.registry;
  // An empty catalogue is a real answer from a runtime that has nothing configured. It must not be
  // shown as an outage, and an outage must not be shown as an empty catalogue.
  // Either half being empty means there is nothing usable to configure. Calling that "ready"
  // gives an operator a table of disabled selects with no explanation.
  if (providers.length === 0 || agents.length === 0) {
    return { state: 'empty', registry: response.registry };
  }
  return { state: 'ready', registry: response.registry };
}

export type SelectionCheck =
  | { ok: true; provider: string; model: string }
  | { ok: false; reason: string };

/**
 * Validate a proposed selection before it is sent.
 *
 * The server validates again and is authoritative; this exists so an operator gets an immediate,
 * specific refusal instead of a round trip, and so a malformed reference cannot reach the writer.
 *
 * Deliberately does NOT refuse a model already used as another agent's primary: a fleet where
 * several agents share one model is normal and the server (PR #95) enforces no such rule. An
 * earlier version of this function refused that case client-only, which silently blocked a
 * legitimate assignment the server would have accepted — exactly the kind of invented rule this
 * module's own doctrine (see header) says the client must not add.
 */
export function checkSelection(snapshot: RegistrySnapshot, agentId: string, ref: string): SelectionCheck {
  const trimmed = typeof ref === 'string' ? ref.trim() : '';
  if (!trimmed) return { ok: false, reason: 'choose a model' };
  // Split on the FIRST slash, exactly like the server's splitRef. Provider model ids can contain
  // slashes (lmstudio/google/gemma-4-e4b) AND spaces (a provider can legitimately advertise
  // "Qwen3 14B"), and the server's own splitRef/validateChange accept both — an earlier version
  // of this check refused any id containing a space, which is the same class of invented
  // client-only rule the header doctrine above says this module must not add (the dropdown itself
  // can offer an option this check then refuses to save).
  const slash = trimmed.indexOf('/');
  if (slash <= 0 || slash === trimmed.length - 1) {
    return { ok: false, reason: 'a selection must be "provider/model"' };
  }
  const provider = trimmed.slice(0, slash);
  const model = trimmed.slice(slash + 1);
  if (!provider || !model) return { ok: false, reason: 'a selection must be exactly "provider/model"' };

  const agent = snapshot.agents.find((a) => a.agentId === agentId);
  if (!agent) return { ok: false, reason: `unknown agent "${agentId}"` };

  const catalogue = snapshot.providers.find((p) => p.name === provider);
  if (!catalogue) return { ok: false, reason: `unknown provider "${provider}"` };
  if (!catalogue.models.includes(model)) {
    return { ok: false, reason: `"${model}" is not offered by ${provider}` };
  }

  if (agent.primary === trimmed) return { ok: false, reason: 'that is already the current model' };

  return { ok: true, provider, model };
}

export type WriteResponse =
  | { ok: true; agentId: string; before: string | null; after: string; backupPath: string; observedAt: string }
  // The guard's denial body is { ok:false, error:"denied", reason } and reaches this function
  // unchanged, so the envelope is part of the shape even though the route's own failures omit it.
  | { ok: false; reason: string; detail?: string; error?: string };

export type WriteView =
  | { state: 'saved'; agentId: string; persisted: string; before: string | null; backupPath: string }
  | { state: 'rejected'; code: string; message: string }
  | { state: 'unavailable'; code: string; message: string }
  | { state: 'unauthorized'; code: string; message: string }
  | { state: 'busy'; code: string; message: string };

const REJECTION_TEXT: Record<string, string> = {
  unknown_agent: 'that agent is not in the runtime configuration',
  invalid_model_ref: 'the selection is not a valid provider/model reference',
  unknown_provider: 'that provider is not configured on the runtime',
  unsupported_model: 'that provider does not offer this model',
  unverifiable_provider: 'the provider could not be verified',
  invalid_existing_model: 'the existing configuration for that agent is malformed',
  readback_mismatch: 'the file did not read back with the value that was written',
};

/**
 * Interpret a write result.
 *
 * A success is only reported when the server returns the value it read back. Anything else is a
 * failure with a specific reason, including the lock case, which is busy rather than broken.
 */
export function describeWrite(
  response: WriteResponse | { ok: true; write?: WriteResponse } | null | undefined,
): WriteView | { state: 'idle' } {
  if (!response) return { state: 'idle' };
  // The route answers { ok, source, write: <WriteResult> }, not the WriteResult itself. Reading the
  // top level produced "Saved and read back: undefined is now undefined" on every success, which is
  // the precise failure this screen exists to prevent.
  const flat = ((response as { write?: WriteResponse }).write ?? response) as WriteResponse;
  if (flat.ok === true) {
    if (typeof flat.after !== 'string' || !flat.after) {
      return { state: 'rejected', code: 'unconfirmed', message: 'the server did not return the value it persisted' };
    }
    return {
      state: 'saved',
      agentId: flat.agentId,
      // The persisted value, not the requested one. If these ever differ the server would have
      // returned readback_mismatch instead, so this is the confirmed value by construction.
      persisted: flat.after,
      before: flat.before,
      backupPath: flat.backupPath,
    };
  }
  const code = flat.reason;
  // Gate on the authorization envelope, not on an enumerated list of reason codes. The guard mints
  // `unlock_${reason}` and `device_${reason}` from verifier unions this file cannot see, so a list
  // is guaranteed to fall behind, and every code it misses is reported as the runtime rejecting the
  // change. See the inventory comment above authDenialMessage.
  if (isAuthDenial(flat, code)) {
    return { state: 'unauthorized', code: code ?? 'denied', message: authDenialMessage(code) };
  }
  if (code === 'locked') return { state: 'busy', code, message: 'another change is in progress; nothing was written' };
  if (code === 'source_unavailable' || code === 'lock_failed' || code === 'write_failed') {
    // Never surface flat.detail here: the route's own detail text for these codes is a
    // filesystem path (e.g. "missing /…/openclaw.json", "cannot create …/.lock"), and nothing
    // user-facing should render a server path. The code already carries the specific reason.
    return { state: 'unavailable', code, message: 'the runtime could not be written' };
  }
  return { state: 'rejected', code, message: REJECTION_TEXT[code] ?? flat.detail ?? 'the runtime rejected the change' };
}

/** Options for a select, grouped by provider, with nothing invented. */
export function selectionOptions(snapshot: RegistrySnapshot): { group: string; value: string; label: string }[] {
  const options: { group: string; value: string; label: string }[] = [];
  for (const provider of snapshot.providers) {
    for (const model of provider.models) {
      options.push({ group: provider.name, value: `${provider.name}/${model}`, label: model });
    }
  }
  return options;
}
