// T08 — PowerPoint preset library mapping to cinematic primitives.
//
// Spec ref: PRISM-RENDERER-MIGRATION-SPEC.md §13 L479 — "PowerPoint-style
// entrance/emphasis/exit/motion-path presets pull from the cinematic
// primitives library."
//
// Spec asserts the mapping exists but does not enumerate it. The four
// PowerPoint buckets are mapped to the canonical 9-primitive library
// (CINEMATIC-PRIMITIVES-LIBRARY.md). Authoritative library text drives
// preset assignment:
//   - particle-emerge (CPL L189): "Used as entrance animation."
//   - kinetic-text (CPL L232): "Replaces SplitText-style entrance animations…"
//   - dissolve-morph (CPL L100): texture morph, used for both entrance and exit.
//   - displacement-transition (CPL L123): texture transition, entrance/exit.
//   - orbit (CPL L57): timeline rotation — emphasis + motion-path.
//   - depth-rotate (CPL L79): mouse/scroll-driven rotation — emphasis.
//   - parallax-scroll (CPL L144): depth response — emphasis.
//   - magnetic-cursor (CPL L166): cursor-attraction — emphasis.
//   - fly-through (CPL L209): camera-driven motion — motion-path.
//
// Output is `CinematicPrimitiveRef` (spec §4 L124) — the verifier and the
// runtime primitive registry consume it directly.

import type {
  CinematicPrimitiveName,
  CinematicPrimitiveParams,
  CinematicPrimitiveRef,
  CinematicPrimitiveTrigger,
} from './cinematic-primitives.ts';

export type AnimationPresetCategory = 'entrance' | 'emphasis' | 'exit' | 'motion-path';

export interface AnimationPreset {
  id: string;
  label: string;
  category: AnimationPresetCategory;
  primitive: CinematicPrimitiveName;
  trigger: CinematicPrimitiveTrigger;
  defaultParams: CinematicPrimitiveParams;
}

export const ANIMATION_PRESET_LIBRARY: Record<AnimationPresetCategory, AnimationPreset[]> = {
  entrance: [
    {
      id: 'entrance-fade-in',
      label: 'Fade In',
      category: 'entrance',
      primitive: 'dissolve-morph',
      trigger: 'inview',
      defaultParams: { duration: 0.6, direction: 'in' },
    },
    {
      id: 'entrance-particle-assemble',
      label: 'Particle Assemble',
      category: 'entrance',
      primitive: 'particle-emerge',
      trigger: 'inview',
      defaultParams: { duration: 1.2, particleCount: 800 },
    },
    {
      id: 'entrance-kinetic-text',
      label: 'Kinetic Text',
      category: 'entrance',
      primitive: 'kinetic-text',
      trigger: 'inview',
      defaultParams: { duration: 0.8, mode: 'chars', stagger: 0.04 },
    },
    {
      id: 'entrance-displacement-wipe',
      label: 'Displacement Wipe',
      category: 'entrance',
      primitive: 'displacement-transition',
      trigger: 'load',
      defaultParams: { duration: 0.9, direction: 'left' },
    },
  ],
  emphasis: [
    {
      id: 'emphasis-orbit',
      label: 'Orbit',
      category: 'emphasis',
      primitive: 'orbit',
      trigger: 'load',
      defaultParams: { duration: 4, axis: 'y', radius: 1 },
    },
    {
      id: 'emphasis-depth-rotate',
      label: 'Depth Rotate',
      category: 'emphasis',
      primitive: 'depth-rotate',
      trigger: 'hover',
      defaultParams: { intensity: 0.6, axis: 'y' },
    },
    {
      id: 'emphasis-parallax-scroll',
      label: 'Parallax Scroll',
      category: 'emphasis',
      primitive: 'parallax-scroll',
      trigger: 'scroll',
      defaultParams: { strength: 0.4, axis: 'y' },
    },
    {
      id: 'emphasis-magnetic-cursor',
      label: 'Magnetic Cursor',
      category: 'emphasis',
      primitive: 'magnetic-cursor',
      trigger: 'hover',
      defaultParams: { radius: 80, strength: 0.5 },
    },
  ],
  exit: [
    {
      id: 'exit-fade-out',
      label: 'Fade Out',
      category: 'exit',
      primitive: 'dissolve-morph',
      trigger: 'click',
      defaultParams: { duration: 0.5, direction: 'out' },
    },
    {
      id: 'exit-displacement-wipe',
      label: 'Displacement Wipe Out',
      category: 'exit',
      primitive: 'displacement-transition',
      trigger: 'click',
      defaultParams: { duration: 0.7, direction: 'right' },
    },
  ],
  'motion-path': [
    {
      id: 'motion-orbit',
      label: 'Orbit Path',
      category: 'motion-path',
      primitive: 'orbit',
      trigger: 'time',
      defaultParams: { duration: 6, axis: 'y', radius: 2 },
    },
    {
      id: 'motion-fly-through',
      label: 'Fly-through',
      category: 'motion-path',
      primitive: 'fly-through',
      trigger: 'click',
      defaultParams: { duration: 1.5, easing: 'power2.inOut' },
    },
  ],
};

export function presetsForCategory(cat: AnimationPresetCategory): AnimationPreset[] {
  if (!Object.prototype.hasOwnProperty.call(ANIMATION_PRESET_LIBRARY, cat)) return [];
  return ANIMATION_PRESET_LIBRARY[cat];
}

export function applyAnimationPreset(
  preset: AnimationPreset,
  overrides?: CinematicPrimitiveParams,
): CinematicPrimitiveRef {
  return {
    name: preset.primitive,
    params: { ...preset.defaultParams, ...(overrides ?? {}) },
    trigger: preset.trigger,
  };
}
