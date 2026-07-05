import { describe, it, expect } from 'vitest';
import { fireballBurstPrimitive } from '@/lib/prism/animatable/primitives/fireball-burst';
import { makeTarget, runConformance } from './_conformance';

interface FireballUniforms {
  uTime: { value: number };
  uBurstRate: { value: number };
  uTurb: { value: number };
  uScale: { value: number };
}

describe('fireball-burst primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(fireballBurstPrimitive).dispose();
  });

  it('plays: the time uniform advances across the loop as the timeline seeks', () => {
    const target = makeTarget(fireballBurstPrimitive);
    const inst = fireballBurstPrimitive.create(target);
    const u = target.userData.fireballBurst as FireballUniforms;

    inst.seek(0);
    const t0 = u.uTime.value;

    inst.seek(1.3);
    const tMid = u.uTime.value;

    inst.seek(4);
    const tLate = u.uTime.value;

    // Looping/stateful: distinct seek times yield distinct uTime values, so the
    // loop phase lt = fract(uTime*burstRate) and the rolling fbm evaluate at a
    // different point each frame (the fireball visibly expands then resets).
    expect(tMid).toBeGreaterThan(t0);
    expect(tLate).toBeGreaterThan(tMid);
    inst.dispose();
  });

  it('controls change output: burstRate uniform tracks the control extremes', () => {
    const target = makeTarget(fireballBurstPrimitive);
    const inst = fireballBurstPrimitive.create(target);
    const u = target.userData.fireballBurst as FireballUniforms;

    inst.setControl('burstRate', 0.1);
    inst.seek(1);
    const slow = u.uBurstRate.value;

    inst.setControl('burstRate', 2);
    inst.seek(1);
    const fast = u.uBurstRate.value;

    expect(fast).toBeGreaterThan(slow + 1);
    inst.dispose();
  });
});
