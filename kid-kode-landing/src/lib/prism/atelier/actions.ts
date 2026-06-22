'use client';
// ORRERY No.7 — Atelier actions (F5.1e): save / share / reset.
// The save payload is the per-layer ControlSchema selection (store.serialize) —
// the save/share/buy contract of spec §3.5. Save persists to localStorage and
// copies the share string to the clipboard; restore() rehydrates it on load.
import { useConfiguratorStore } from '@/stores/useConfiguratorStore';

const STORAGE_KEY = 'orrery-no7-build';

export type AtelierAction = 'save' | 'reset' | 'share' | 'flip' | 'explode' | 'loupe';

interface AtelierRigHandle {
  flip?: (on?: boolean) => boolean;
  explode?: (on?: boolean) => number;
  spinTo?: (y: number, p?: number) => void;
  resumeIdle?: () => void;
}
function rig(): AtelierRigHandle | undefined {
  return (window as unknown as { __ATELIER_RIG__?: AtelierRigHandle }).__ATELIER_RIG__;
}

export function runAtelierAction(action: AtelierAction): void {
  const store = useConfiguratorStore.getState();
  // Inspect controls drive the watch rig directly (SC-V-A4/A5/A6 user-facing).
  if (action === 'flip') {
    const on = rig()?.flip?.();
    useConfiguratorStore.setState({ lastReason: on ? 'Caseback — the movement, in motion.' : 'Dial side.' });
    return;
  }
  if (action === 'explode') {
    const amt = rig()?.explode?.();
    useConfiguratorStore.setState({ lastReason: amt && amt > 0.5 ? 'Exploded — every component.' : 'Reassembled.' });
    return;
  }
  if (action === 'loupe') {
    rig()?.spinTo?.(0, 0.04);
    useConfiguratorStore.setState({ lastReason: 'Scroll / pinch to zoom to the loupe.' });
    return;
  }
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
