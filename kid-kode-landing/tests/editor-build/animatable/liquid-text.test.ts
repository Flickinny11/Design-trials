import { describe, it, expect } from 'vitest';
import { Group, type Object3D } from 'three';
import { liquidTextPrimitive } from '@/lib/prism/animatable/primitives/liquid-text';
import { makeTarget, runConformance } from './_conformance';

function glyphs(subject: Object3D): Object3D[] {
  return subject instanceof Group ? [...subject.children] : [subject];
}

describe('liquid-text primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(liquidTextPrimitive).dispose();
  });

  it('plays: glyph y AND scale vary by index and time (looping)', () => {
    const target = makeTarget(liquidTextPrimitive);
    const inst = liquidTextPrimitive.create(target);
    const gs = glyphs(target.subject!);
    expect(gs.length).toBeGreaterThan(2);
    expect(inst.duration()).toBe(Infinity);

    // Two distinct t values on the continuous loop.
    inst.seek(0.4);
    const yA = gs.map((g) => g.position.y);
    const scA = gs.map((g) => g.scale.x);

    inst.seek(1.7);
    const yB = gs.map((g) => g.position.y);
    const scB = gs.map((g) => g.scale.x);

    // Position.y changed over time for at least one glyph.
    const yChanged = gs.some((_, i) => Math.abs(yA[i] - yB[i]) > 1e-4);
    expect(yChanged).toBe(true);
    // Scale changed over time for at least one glyph (the liquid breathing).
    const scChanged = gs.some((_, i) => Math.abs(scA[i] - scB[i]) > 1e-4);
    expect(scChanged).toBe(true);

    // At a single instant the wave varies BY INDEX (glyphs are out of phase).
    inst.seek(0.9);
    const ySnap = gs.map((g) => g.position.y);
    const scSnap = gs.map((g) => g.scale.x);
    const yByIndex = ySnap.some((v) => Math.abs(v - ySnap[0]) > 1e-4);
    const scByIndex = scSnap.some((v) => Math.abs(v - scSnap[0]) > 1e-4);
    expect(yByIndex).toBe(true);
    expect(scByIndex).toBe(true);

    inst.dispose();
    // Restored to rest (scale back to 1, y back to base) after dispose.
    for (const g of gs) expect(g.scale.x).toBeCloseTo(1, 5);
  });

  it('controls change output: larger amplitude means larger vertical spread', () => {
    const target = makeTarget(liquidTextPrimitive);
    const inst = liquidTextPrimitive.create(target);
    const gs = glyphs(target.subject!);

    const spreadAt = (): number => {
      inst.seek(0.75);
      const ys = gs.map((g) => g.position.y);
      return Math.max(...ys) - Math.min(...ys);
    };

    inst.setControl('amplitude', 0.02);
    const small = spreadAt();

    inst.setControl('amplitude', 0.5);
    const large = spreadAt();

    expect(large).toBeGreaterThan(small + 0.05);
    inst.dispose();
  });
});
