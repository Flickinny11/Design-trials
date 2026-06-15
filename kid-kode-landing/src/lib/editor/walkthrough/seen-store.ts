'use client';

// GUIDED-TIPS — first-visit "seen" flag (D5 / C2).
//
// Persisted in localStorage so the walkthrough auto-launches exactly ONCE on a
// fresh profile, then never auto-launches again — while the lightbulb can always
// re-trigger it. This is editor-local UI state, NOT graph data (INV-2): no node
// position/behavior is touched. localStorage access is fine here — this module
// lives under src/lib/editor/** (outside the FP-05 runtime/node scope).

const SEEN_KEY = 'prism.guidedTips.seen.v1';

export function hasSeenWalkthrough(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    // Private-mode / disabled storage: treat as "seen" so we never nag on every
    // load when we cannot persist the flag (FP-4 guards the inverse — never
    // re-launching every load).
    return true;
  }
}

export function markWalkthroughSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* storage unavailable — nothing to persist */
  }
}

/** Verification + "reset onboarding" hook: clear the flag so the next load
 *  auto-launches again (C2 fresh-profile proof). */
export function clearWalkthroughSeen(): void {
  try {
    window.localStorage.removeItem(SEEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export const WALKTHROUGH_SEEN_KEY = SEEN_KEY;
