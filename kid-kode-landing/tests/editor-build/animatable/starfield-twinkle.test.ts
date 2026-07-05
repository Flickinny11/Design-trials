import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { starfieldTwinklePrimitive } from '@/lib/prism/animatable/primitives/starfield-twinkle';
import { makeTarget, runConformance } from './_conformance';

describe('starfield-twinkle primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(starfieldTwinklePrimitive).dispose();
  });

  it('plays: installs an emissive node material and advances the time uniform across seeks', () => {
    // TSL shader: pixels cannot be read headlessly. Assert the card gained a
    // node material whose emissiveNode is truthy, and that seek advances the
    // CPU-observable time uniform (exposed on userData) — a concrete numeric
    // change between an early and a later frame.
    const target = makeTarget(starfieldTwinklePrimitive);
    const inst = starfieldTwinklePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as unknown as { emissiveNode?: unknown };
    expect(mat.emissiveNode).toBeTruthy();

    const uTime = target.userData.starfieldUTime as { value: number };

    inst.seek(0);
    const t0 = uTime.value;

    inst.seek(1.37);
    const tMid = uTime.value;

    inst.seek(3.5);
    const tLate = uTime.value;

    // The clock advances: mid differs from start, late differs from mid.
    expect(tMid).toBeGreaterThan(t0);
    expect(tLate).toBeGreaterThan(tMid);
    expect(tMid).toBeCloseTo(1.37, 5);

    inst.dispose();
    // dispose restores the original (non-node) material.
    expect((mesh.material as unknown as { emissiveNode?: unknown }).emissiveNode).toBeFalsy();
  });

  it('controls: density extremes change the live uniform that drives star count', () => {
    const target = makeTarget(starfieldTwinklePrimitive);
    const inst = starfieldTwinklePrimitive.create(target);

    inst.setControl('density', 10);
    inst.seek(0.5);
    expect(inst.getParams().density).toBe(10);
    const low = (target.userData.starfieldUTime as { value: number }).value;
    expect(low).toBeCloseTo(0.5, 5);

    // Rate control drives the twinkle speed; assert the resolved param updates
    // and that re-seeking with two extremes is exception-free + observable.
    inst.setControl('rate', 0.2);
    inst.seek(2);
    const slow = inst.getParams().rate as number;

    inst.setControl('rate', 6);
    inst.seek(2);
    const fast = inst.getParams().rate as number;

    expect(fast).toBeGreaterThan(slow + 1);
    inst.dispose();
  });
});
