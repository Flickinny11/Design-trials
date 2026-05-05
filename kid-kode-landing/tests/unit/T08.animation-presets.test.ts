// T08 unit — PowerPoint preset library maps to cinematic primitives.
//
// Spec ref: PRISM-RENDERER-MIGRATION-SPEC.md §13 L479 — "PowerPoint-style
// entrance/emphasis/exit/motion-path presets pull from the cinematic
// primitives library." (halt-check: PowerPoint presets map to cinematic
// primitives.)
//
// The mapping itself is implementation choice (spec asserts the mapping
// exists but does not enumerate it); the contract these tests pin down is
// (a) every preset names a primitive from the canonical 9-primitive library
// (CINEMATIC-PRIMITIVES-LIBRARY.md), (b) the four PowerPoint buckets are
// each non-empty, and (c) applying a preset emits a CinematicPrimitiveRef
// that the verifier will accept (valid name + valid trigger + params object).

import { describe, expect, it } from 'vitest';
import {
  ANIMATION_PRESET_LIBRARY,
  applyAnimationPreset,
  presetsForCategory,
  type AnimationPresetCategory,
} from '@/lib/prism-graph/animation-presets';
import type { CinematicPrimitiveName, CinematicPrimitiveTrigger, CinematicPrimitiveRef } from '@/lib/prism-graph/cinematic-primitives';

const KNOWN_PRIMITIVES: ReadonlyArray<CinematicPrimitiveName> = [
  'orbit',
  'depth-rotate',
  'dissolve-morph',
  'displacement-transition',
  'parallax-scroll',
  'magnetic-cursor',
  'particle-emerge',
  'fly-through',
  'kinetic-text',
];

const KNOWN_TRIGGERS: ReadonlyArray<CinematicPrimitiveTrigger> = [
  'load',
  'hover',
  'click',
  'scroll',
  'inview',
  'time',
];

const CATEGORIES: ReadonlyArray<AnimationPresetCategory> = [
  'entrance',
  'emphasis',
  'exit',
  'motion-path',
];

describe('T08 ANIMATION_PRESET_LIBRARY', () => {
  it('exposes the four PowerPoint categories (entrance, emphasis, exit, motion-path)', () => {
    for (const cat of CATEGORIES) {
      expect(Object.prototype.hasOwnProperty.call(ANIMATION_PRESET_LIBRARY, cat)).toBe(true);
    }
  });

  it('every category has at least one preset', () => {
    for (const cat of CATEGORIES) {
      const list = ANIMATION_PRESET_LIBRARY[cat];
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
    }
  });

  it('every preset names a primitive from the canonical 9-primitive library', () => {
    for (const cat of CATEGORIES) {
      for (const p of ANIMATION_PRESET_LIBRARY[cat]) {
        expect(KNOWN_PRIMITIVES).toContain(p.primitive);
      }
    }
  });

  it('every preset declares a valid trigger', () => {
    for (const cat of CATEGORIES) {
      for (const p of ANIMATION_PRESET_LIBRARY[cat]) {
        expect(KNOWN_TRIGGERS).toContain(p.trigger);
      }
    }
  });

  it('every preset has a unique id within its category', () => {
    for (const cat of CATEGORIES) {
      const ids = ANIMATION_PRESET_LIBRARY[cat].map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('every preset has a non-empty human label', () => {
    for (const cat of CATEGORIES) {
      for (const p of ANIMATION_PRESET_LIBRARY[cat]) {
        expect(typeof p.label).toBe('string');
        expect(p.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('entrance category includes particle-emerge (CPL L189 — "Used as entrance animation")', () => {
    const entrance = ANIMATION_PRESET_LIBRARY.entrance;
    expect(entrance.some((p) => p.primitive === 'particle-emerge')).toBe(true);
  });

  it('motion-path category references at least one of orbit/fly-through (CPL L57/L209)', () => {
    const mp = ANIMATION_PRESET_LIBRARY['motion-path'];
    expect(mp.some((p) => p.primitive === 'orbit' || p.primitive === 'fly-through')).toBe(true);
  });
});

describe('T08 presetsForCategory', () => {
  it('returns the same list as ANIMATION_PRESET_LIBRARY[cat]', () => {
    for (const cat of CATEGORIES) {
      const got = presetsForCategory(cat);
      expect(got).toEqual(ANIMATION_PRESET_LIBRARY[cat]);
    }
  });

  it('returns an empty array for an unknown category (defensive read)', () => {
    const got = presetsForCategory('nonsense' as AnimationPresetCategory);
    expect(Array.isArray(got)).toBe(true);
    expect(got.length).toBe(0);
  });
});

describe('T08 applyAnimationPreset', () => {
  it('emits a CinematicPrimitiveRef shaped per spec §4 L124', () => {
    const preset = ANIMATION_PRESET_LIBRARY.entrance[0]!;
    const ref: CinematicPrimitiveRef = applyAnimationPreset(preset);
    expect(ref.name).toBe(preset.primitive);
    expect(ref.trigger).toBe(preset.trigger);
    expect(typeof ref.params).toBe('object');
    expect(ref.params).not.toBeNull();
  });

  it('merges preset.defaultParams into the emitted ref params', () => {
    const preset = ANIMATION_PRESET_LIBRARY.entrance.find((p) => Object.keys(p.defaultParams).length > 0);
    if (!preset) return; // some libraries may have empty defaults — only assert if at least one has params
    const ref = applyAnimationPreset(preset);
    for (const [k, v] of Object.entries(preset.defaultParams)) {
      expect(ref.params[k]).toBe(v);
    }
  });

  it('allows caller-supplied param overrides to take precedence over defaults', () => {
    const preset = ANIMATION_PRESET_LIBRARY.entrance[0]!;
    const ref = applyAnimationPreset(preset, { duration: 9.99 });
    expect(ref.params.duration).toBe(9.99);
  });

  it('does not mutate the source preset object', () => {
    const preset = ANIMATION_PRESET_LIBRARY.entrance[0]!;
    const before = JSON.stringify(preset);
    applyAnimationPreset(preset, { foo: 'bar' });
    expect(JSON.stringify(preset)).toBe(before);
  });
});
