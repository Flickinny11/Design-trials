// EB-09-01 — Animation library catalog (SC-047, SC-048, INV-12).
//
// Spec refs:
//   §9 SC-047  Animation library catalog UI preserves all three
//              methodologies (i2v frame-based, code-based, hybrid overlay)
//              as distinct categories.
//   §9 SC-048  Library entries reference the 9 cinematic primitives from
//              CINEMATIC-PRIMITIVES-LIBRARY.md — no new primitives invented.
//   §9 INV-12  Curated fixed library of exactly 9 primitives. Codegen
//              selects by name; no scene-level animation authored from
//              scratch.
//
// PRISM-MOCK-APP-BUILD-SPEC §1.2.3 defines the three methodologies. The
// editor-build spec (cross-ref table line 20) carries the *concepts*
// forward and reinterprets the implementations against the Three.js
// runtime per INV-11/12. The catalog below maps each of the canonical 9
// primitives to its primary methodology bucket.

import type { CinematicPrimitiveName } from './cinematic-primitives';

export const ANIMATION_METHODOLOGIES = [
  'i2v Frame-based',
  'Code-based',
  'Hybrid Overlay',
] as const;

export type AnimationMethodology = (typeof ANIMATION_METHODOLOGIES)[number];

export interface AnimationLibraryEntry {
  id: string;
  label: string;
  methodology: AnimationMethodology;
  primitive: CinematicPrimitiveName;
  description?: string;
}

// Each of the 9 primitives appears at least once. Methodology assignment
// follows the spec's intent (PRISM-MOCK-APP-BUILD-SPEC §1.2.3) reinterpreted
// against the Three.js runtime:
//   - i2v Frame-based: pixel-internal animation (shader/material/text-shader
//     primitives whose visible motion is "inside" the element).
//   - Code-based: scene-graph transform tweens — primitives that animate an
//     Object3D's position/rotation/scale as a whole.
//   - Hybrid Overlay: composite/overlay-layer effects — primitives that
//     emit additional layers (particles, depth maps) on top of the base
//     element rather than transforming it directly.
export const ANIMATION_LIBRARY: AnimationLibraryEntry[] = [
  {
    id: 'dissolve-morph-i2v',
    label: 'Dissolve morph (shader)',
    methodology: 'i2v Frame-based',
    primitive: 'dissolve-morph',
    description: 'Pixel-level dissolve between two states via TSL shader.',
  },
  {
    id: 'displacement-transition-i2v',
    label: 'Displacement transition (shader)',
    methodology: 'i2v Frame-based',
    primitive: 'displacement-transition',
    description: 'Displacement-mapped wipe between frames; pixels animate in-place.',
  },
  {
    id: 'kinetic-text-i2v',
    label: 'Kinetic text (MSDF shader)',
    methodology: 'i2v Frame-based',
    primitive: 'kinetic-text',
    description: 'Per-glyph kinetic shader effects on MSDF-rendered text.',
  },
  {
    id: 'orbit-code',
    label: 'Orbit (transform)',
    methodology: 'Code-based',
    primitive: 'orbit',
    description: 'GSAP timeline animates Object3D position around a pivot.',
  },
  {
    id: 'depth-rotate-code',
    label: 'Depth rotate (transform)',
    methodology: 'Code-based',
    primitive: 'depth-rotate',
    description: 'GSAP rotation tween on Object3D Euler axes.',
  },
  {
    id: 'parallax-scroll-code',
    label: 'Parallax scroll (transform)',
    methodology: 'Code-based',
    primitive: 'parallax-scroll',
    description: 'Scroll-bound translation; depth-weighted by node layer.',
  },
  {
    id: 'magnetic-cursor-code',
    label: 'Magnetic cursor (transform)',
    methodology: 'Code-based',
    primitive: 'magnetic-cursor',
    description: 'Pointer-driven sprung translation toward cursor.',
  },
  {
    id: 'fly-through-code',
    label: 'Fly-through (camera transform)',
    methodology: 'Code-based',
    primitive: 'fly-through',
    description: 'Camera timeline tween along a target path.',
  },
  {
    id: 'particle-emerge-overlay',
    label: 'Particle emerge (overlay)',
    methodology: 'Hybrid Overlay',
    primitive: 'particle-emerge',
    description: 'Emits a particle overlay layer above the base element.',
  },
];

export function getLibraryByMethodology(
  m: AnimationMethodology,
): AnimationLibraryEntry[] {
  return ANIMATION_LIBRARY.filter((e) => e.methodology === m);
}
