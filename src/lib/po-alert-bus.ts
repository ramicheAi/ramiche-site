/* ============================================================================
 * PARALLAX OS — alert bus. Tiny pub/sub instrument pages use to surface a
 * critical reading on the GLOBAL alert ticker (under the HUD). Replaces the
 * prototype's window.poAlertBus. Pages call set()/clear() from a post-render
 * effect (never during render) with a prevCrit ref for edge detection.
 * ========================================================================== */
import { useSyncExternalStore } from 'react';

export type PoAlert = {
  label: string;
  value: string;
  page: string;       // route id (for navigation)
  pageLabel: string;
  serial: string;
};

const alerts = new Map<string, PoAlert>();
const listeners = new Set<() => void>();
let snapshot: PoAlert[] = [];

function recompute() {
  snapshot = Array.from(alerts.values());
  listeners.forEach((l) => l());
}

export const poAlertBus = {
  set(key: string, a: PoAlert) {
    const prev = alerts.get(key);
    if (prev && prev.value === a.value && prev.label === a.label) return;
    alerts.set(key, a);
    recompute();
  },
  clear(key: string) {
    if (alerts.delete(key)) recompute();
  },
  list(): PoAlert[] {
    return snapshot;
  },
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Subscribe a component to the live alert list. */
export function usePoAlerts(): PoAlert[] {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}
