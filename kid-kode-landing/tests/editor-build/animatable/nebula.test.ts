import { describe, it, expect } from 'vitest';
import { nebulaPrimitive } from '@/lib/prism/animatable/primitives/nebula';
import { makeTarget, runConformance } from './_conformance';

interface NebulaUniforms {
  uTime: { value: number };
  uSpeed: { value: number };
  uScale: { value: number };
  uBrightness: { value: number };
}

describe('nebula primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(nebulaPrimitive).dispose();
  });

  it('plays: the time uniform advances as the timeline seeks', () => {
    const target = makeTarget(nebulaPrimitive);
    const inst = nebulaPrimitive.create(target);
    const u = target.userData.nebula as NebulaUniforms;

    inst.seek(0);
    const t0 = u.uTime.value;

    inst.seek(2.5);
    const tMid = u.uTime.value;

    inst.seek(6);
    const tLate = u.uTime.value;

    // Looping/stateful: distinct seek times yield distinct uTime values, so the
    // domain-warped fbm evaluates at a different point each frame (visible churn).
    expect(tMid).toBeGreaterThan(t0);
    expect(tLate).toBeGreaterThan(tMid);
    inst.dispose();
  });

  it('controls change output: brightness uniform tracks the control extremes', () => {
    const target = makeTarget(nebulaPrimitive);
    const inst = nebulaPrimitive.create(target);
    const u = target.userData.nebula as NebulaUniforms;

    inst.setControl('brightness', 0.2);
    inst.seek(1);
    const dim = u.uBrightness.value;

    inst.setControl('brightness', 3);
    inst.seek(1);
    const bright = u.uBrightness.value;

    expect(bright).toBeGreaterThan(dim + 1);
    inst.dispose();
  });
});
