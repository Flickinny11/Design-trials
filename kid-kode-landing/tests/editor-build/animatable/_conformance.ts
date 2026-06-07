// Shared Animatable-contract conformance harness. Every catalog primitive test
// calls runConformance(def). Runs headless (node env, no GPU): node materials
// construct fine; we never invoke a renderer.

import { Scene } from 'three';
import { expect } from 'vitest';
import { buildSubject } from '@/lib/prism/animatable/subjects';
import type {
  AnimatableTarget,
  Control,
  PrimitiveDefinition,
} from '@/lib/prism/animatable/contract';

export function makeTarget(def: PrimitiveDefinition): AnimatableTarget {
  const scene = new Scene();
  const { object, subject } = buildSubject(def.subject);
  scene.add(object);
  // Synthetic driver inputs the stage would supply.
  return { object, subject, scene, userData: { pointer: { x: 0.5, y: 0.5 }, scroll: 0.5 } };
}

function isNumeric(c: Control): c is Extract<Control, { type: 'knob' | 'fader' }> {
  return c.type === 'knob' || c.type === 'fader';
}

/** Full contract conformance + smoke of seek/controls. Throws via expect on
 *  any violation. Returns the live instance for primitive-specific assertions
 *  (caller must dispose). */
export function runConformance(def: PrimitiveDefinition) {
  expect(typeof def.name, 'name is a string').toBe('string');
  expect(def.name.length, 'name non-empty').toBeGreaterThan(0);
  expect(def.schema.length, 'schema has controls').toBeGreaterThan(0);

  const target = makeTarget(def);
  const inst = def.create(target);

  for (const m of [
    'duration',
    'seek',
    'controls',
    'setControl',
    'getParams',
    'serialize',
    'dispose',
  ] as const) {
    expect(typeof (inst as unknown as Record<string, unknown>)[m], `has ${m}()`).toBe('function');
  }

  const dur = inst.duration();
  expect(dur === Infinity || (Number.isFinite(dur) && dur > 0), 'duration > 0 or Infinity').toBe(true);
  expect(inst.controls(), 'controls() returns the schema').toBe(def.schema);

  // seek across the timeline must not throw.
  const D = Number.isFinite(dur) ? dur : 4;
  for (let i = 0; i <= 8; i++) {
    target.userData.scroll = i / 8;
    target.userData.pointer = { x: Math.cos(i), y: Math.sin(i) };
    inst.seek((i / 8) * D);
  }

  // serialize round-trips identity + params.
  const s = inst.serialize();
  expect(s.name).toBe(def.name);
  expect(s.category).toBe(def.category);
  expect(typeof s.params).toBe('object');

  // controls work: changing a numeric control updates resolved params, and a
  // re-seek with the new value must not throw.
  const numeric = def.schema.find(isNumeric);
  if (numeric) {
    const before = inst.getParams()[numeric.id] as number;
    const next = before === numeric.max ? numeric.min : numeric.max;
    inst.setControl(numeric.id, next);
    expect(inst.getParams()[numeric.id], 'setControl updates param').toBe(next);
    inst.seek(D / 2);
  }

  return inst;
}
