// EB-09-01 — Animation library catalog (SC-047, SC-048, INV-12).
//
// STUB: types only. Implementation lands in Step 7 of this iteration so
// the failing tests in EB-09-01.animation-library-catalog.test.ts can be
// committed before the catalog data exists (TDD discipline).

import type { CinematicPrimitiveName } from './cinematic-primitives';

export const ANIMATION_METHODOLOGIES = [] as readonly string[] as readonly [
  'i2v Frame-based',
  'Code-based',
  'Hybrid Overlay',
];

export type AnimationMethodology = (typeof ANIMATION_METHODOLOGIES)[number];

export interface AnimationLibraryEntry {
  id: string;
  label: string;
  methodology: AnimationMethodology;
  primitive: CinematicPrimitiveName;
  description?: string;
}

export const ANIMATION_LIBRARY: AnimationLibraryEntry[] = [];

export function getLibraryByMethodology(
  _m: AnimationMethodology,
): AnimationLibraryEntry[] {
  return [];
}
