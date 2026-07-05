import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { underwaterCausticsPrimitive } from '@/lib/prism/animatable/primitives/underwater-caustics';
import { makeTarget, runConformance } from './_conformance';

describe('underwater-caustics primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(underwaterCausticsPrimitive).dispose();
  });

  it('plays: the driven phase advances across the (looping) timeline', () => {
    // PURE SHADER: pixels cannot be read headlessly. The animation lives in the
    // uTime uniform, mirrored into userData.phase (uTime * speed). Looping
    // primitive (duration Infinity) — assert two distinct t values produce a
    // concrete numeric change in the driven phase, and the node material is in.
    const target = makeTarget(underwaterCausticsPrimitive);
    const inst = underwaterCausticsPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as unknown as { colorNode?: unknown };
    expect(mat.colorNode).toBeTruthy();
    expect(inst.duration()).toBe(Infinity);

    inst.seek(0);
    const phase0 = target.userData.phase as number;

    inst.seek(3.0);
    const phaseMid = target.userData.phase as number;

    expect(phaseMid).toBeGreaterThan(phase0 + 0.1);
    inst.dispose();
    // dispose restores the original (non-node) material.
    expect((mesh.material as unknown as { colorNode?: unknown }).colorNode).toBeFalsy();
  });

  it('controls change output: speed extremes yield a different driven phase at the same t', () => {
    const target = makeTarget(underwaterCausticsPrimitive);
    const inst = underwaterCausticsPrimitive.create(target);

    inst.setControl('speed', 0.05);
    inst.seek(4.0);
    const slow = target.userData.phase as number;

    inst.setControl('speed', 2);
    inst.seek(4.0);
    const fast = target.userData.phase as number;

    expect(fast).toBeGreaterThan(slow + 1);
    expect(inst.getParams().speed).toBe(2);
    inst.dispose();
  });
});
