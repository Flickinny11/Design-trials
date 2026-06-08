import { describe, it, expect } from 'vitest';
import { inkSwirlPrimitive } from '@/lib/prism/animatable/primitives/ink-swirl';
import { makeTarget, runConformance } from './_conformance';

type U = { value: number };

describe('ink-swirl primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(inkSwirlPrimitive).dispose();
  });

  it('plays: the swirl time uniform advances across the timeline', () => {
    const target = makeTarget(inkSwirlPrimitive);
    const inst = inkSwirlPrimitive.create(target);

    // Looping vortex (duration === Infinity) — pick two distinct t values.
    inst.seek(0);
    const t0 = (target.userData.inkSwirlTime as U).value;

    inst.seek(1.7);
    const tMid = (target.userData.inkSwirlTime as U).value;

    // A mid-animation frame differs from t=0 (the spiral arms have rotated).
    expect(tMid).toBeGreaterThan(t0 + 0.5);
    expect(t0).toBe(0);
    inst.dispose();
  });

  it('controls change output: scale knob drives the live uniform to two extremes', () => {
    const target = makeTarget(inkSwirlPrimitive);
    const inst = inkSwirlPrimitive.create(target);
    const uScale = target.userData.inkSwirlScale as U;

    inst.setControl('scale', 1);
    inst.seek(0.5);
    const low = uScale.value;

    inst.setControl('scale', 10);
    inst.seek(0.5);
    const high = uScale.value;

    expect(high).toBeGreaterThan(low + 5);
    inst.dispose();
  });
});
