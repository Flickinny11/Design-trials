'use client';
// ORRERY No.7 — Atelier actions (F5.1e): save / share / reset.
// The save payload is the per-layer ControlSchema selection (store.serialize) —
// the save/share/buy contract of spec §3.5. Save persists to localStorage and
// copies the share string to the clipboard; restore() rehydrates it on load.
import { useConfiguratorStore } from '@/stores/useConfiguratorStore';

const STORAGE_KEY = 'orrery-no7-build';

export type AtelierAction = 'save' | 'reset' | 'share';

export function runAtelierAction(action: AtelierAction): void {
  const store = useConfiguratorStore.getState();
  if (action === 'reset') {
    store.reset();
    useConfiguratorStore.setState({ lastReason: 'Reset to the ORRERY No.7 default.' });
    return;
  }
  // save + share both serialize the build; save also persists it.
  const payload = store.serialize();
  try {
    window.localStorage.setItem(STORAGE_KEY, payload);
  } catch {
    /* storage unavailable — non-fatal */
  }
  try {
    void navigator.clipboard?.writeText(payload);
  } catch {
    /* clipboard blocked — non-fatal */
  }
  useConfiguratorStore.setState({ lastReason: 'Saved — configuration copied to clipboard.' });
}

/** Rehydrate a saved build on load. Returns true if one was restored. */
export function restoreSavedBuild(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    return useConfiguratorStore.getState().restore(raw);
  } catch {
    return false;
  }
}
