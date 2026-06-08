/* ============================================================================
 * PARALLAX OS — sound bridge. Maps the prototype's poSound cue names onto the
 * existing cc-sounds.ts Web Audio synth (single source of audio truth).
 * Off by default (autoplay-safe); toggled in the Tweaks panel. Key: "po-sound".
 * ========================================================================== */
import { play as ccPlay, setSoundEnabled as ccSetEnabled } from '@/lib/cc-sounds';

export type PoCue = 'nav' | 'blip' | 'open' | 'dispatch' | 'success' | 'alert' | 'boot';

const MAP: Record<PoCue, Parameters<typeof ccPlay>[0]> = {
  nav: 'tap',
  blip: 'notify',
  open: 'dispatch',
  dispatch: 'dispatch',
  success: 'success',
  alert: 'alert',
  boot: 'boot',
};

let enabled = false;
const LS_KEY = 'po-sound';

export function initPoSound(): void {
  if (typeof window === 'undefined') return;
  try { enabled = localStorage.getItem(LS_KEY) === '1'; } catch { /* ignore */ }
  // keep cc-sounds in sync so its own gate doesn't silence us when on
  ccSetEnabled(enabled);
}

export function isPoSoundEnabled(): boolean { return enabled; }

export function setPoSoundEnabled(on: boolean): void {
  enabled = on;
  try { localStorage.setItem(LS_KEY, on ? '1' : '0'); } catch { /* ignore */ }
  ccSetEnabled(on);
}

export function poPlay(cue: PoCue): void {
  if (!enabled) return;
  try { ccPlay(MAP[cue] ?? 'tap'); } catch { /* best-effort */ }
}
