// Transmission budget guard (ORRERY No.7 §4 / SC-O10, risk #2).
//
// True transmission (MeshPhysicalNodeMaterial.transmission > 0) forces the
// WebGPU renderer to run a separate screen render of the scene behind each such
// surface (Path B). Those passes are expensive, so the spec fixes a HARD budget
// of ≤2 live transmission surfaces on screen at once. Panels/nav use Path C
// (screen-space UV displacement — no transmission material at all), so they
// never enter this registry.
//
// This module is the single source of truth for the live count. It is a pure
// runtime module (DOM-free, INV-R12 / FP-05): NO window/document access. The
// `window.__PRISM_TRANSMISSION_COUNT__` bridge for verification lives in a
// component file (GraphScene.tsx) and reads `getTransmissionCount()` through a
// live getter.
//
// Contract:
//   • requestTransmission(mat) — call once, right after building a physical
//     material whose resolved spec has transmission > 0. Returns true if the
//     surface is admitted (under budget) and false if it must fall back to a
//     cheaper Path-C approximation. Idempotent per material.
//   • releaseTransmission(mat) — call from the node's cleanup() so navigating
//     away frees the slot.
//   • getTransmissionCount() — live admitted count (what the bridge exposes).

/** Hard ceiling on simultaneous Path-B transmission surfaces (spec §4 risk #2). */
export const MAX_TRANSMISSION = 2;

// Identity set of currently-admitted transmission materials. WeakSet would hide
// the size we need to report, so a plain Set is used and entries are removed in
// releaseTransmission (driven by each node's cleanup()).
const active = new Set<object>();

/** Live count of admitted Path-B transmission surfaces. */
export function getTransmissionCount(): number {
  return active.size;
}

/**
 * Request a transmission slot for `mat`. Admits it (and counts it) when under
 * the budget; otherwise logs the guard line once per over-budget attempt and
 * returns false so the caller downgrades to a Path-C approximation. Re-calling
 * with an already-admitted material is a no-op that returns true.
 */
export function requestTransmission(mat: object): boolean {
  if (active.has(mat)) return true;
  if (active.size >= MAX_TRANSMISSION) {
    // Not an error: the budget held, the surface degrades gracefully.
    console.warn('[PRISM] TRANSMISSION LIMIT: capped at 2');
    return false;
  }
  active.add(mat);
  return true;
}

/** Release a previously-admitted material (call from node cleanup). */
export function releaseTransmission(mat: object): void {
  active.delete(mat);
}

/** Test/reset hook — clears all admitted slots. */
export function __resetTransmissionBudget(): void {
  active.clear();
}
