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
  | { state: 'denied'; reason: string }
  | { state: 'unavailable'; reason: string; detail?: string }
  | { state: 'malformed'; reason: string }
  | { state: 'empty'; registry: RegistrySnapshot }
  | { state: 'ready'; registry: RegistrySnapshot };

/** Turn a GET response into exactly one truth state. "No data" and "no answer" are different. */
export function describeRegistry(response: RegistryResponse | null | undefined): RegistryView {
  if (!response) return { state: 'loading' };
  if (response.ok === false) {
    const reason = (response as { reason?: string }).reason ?? '';
    // The guard answers {error:"denied", reason:"missing_session"} with no `source`. That is an
    // expired session, not an unreachable runtime, and telling the operator "runtime unavailable"
    // sends them to debug the wrong thing.
    if (reason === 'missing_session' || reason === 'denied' || (response as { error?: string }).error === 'denied') {
      return { state: 'denied', reason: 'your session expired; sign in again' };
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
 */
export function checkSelection(
  snapshot: RegistrySnapshot,
  agentId: string,
  ref: string,
  options: { allowDuplicate?: boolean } = {},
): SelectionCheck {
  const trimmed = typeof ref === 'string' ? ref.trim() : '';
  if (!trimmed) return { ok: false, reason: 'choose a model' };
  // Split on the FIRST slash, exactly like the server's splitRef. Provider model ids can contain
  // slashes (lmstudio/google/gemma-4-e4b), and requiring exactly one slash refused options the
  // dropdown itself offered.
  const slash = trimmed.indexOf('/');
  if (trimmed.includes(' ') || slash <= 0 || slash === trimmed.length - 1) {
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

  if (!options.allowDuplicate) {
    const takenBy = snapshot.agents.find((a) => a.agentId !== agentId && a.primary === trimmed);
    if (takenBy) {
      return { ok: false, reason: `already the primary model for ${takenBy.agentId}` };
    }
  }

  if (agent.primary === trimmed) return { ok: false, reason: 'that is already the current model' };

  return { ok: true, provider, model };
}

export type WriteResponse =
  | { ok: true; agentId: string; before: string | null; after: string; backupPath: string; observedAt: string }
  | { ok: false; reason: string; detail?: string };

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
  if (new Set(['missing_session', 'session_expired', 'not_owner', 'owner_not_configured']).has(code)) {
    return { state: 'unauthorized', code, message: 'the session is not authorized for this runtime; sign in again' };
  }
  if (code === 'locked') return { state: 'busy', code, message: 'another change is in progress; nothing was written' };
  if (code === 'source_unavailable' || code === 'lock_failed' || code === 'write_failed') {
    return { state: 'unavailable', code, message: flat.detail ?? 'the runtime could not be written' };
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
