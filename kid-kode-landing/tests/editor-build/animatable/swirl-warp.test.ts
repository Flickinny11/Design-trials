import { describe, it, expect } from 'vitest';
import { swirlWarpPrimitive } from '@/lib/prism/animatable/primitives/swirl-warp';
import { makeTarget, runConformance } from './_conformance';

type Uniform = { value: number };

describe('swirl-warp primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(swirlWarpPrimitive).dispose();
  });

  it('plays: whirlpool twist unwinds and progress rises across the timeline', () => {
    const target = makeTarget(swirlWarpPrimitive);
    const inst = swirlWarpPrimitive.create(target);
    const dur = inst.duration();

    inst.seek(0);
    const twist0 = (target.userData.swirlTwist as Uniform).value;
    const prog0 = (target.userData.swirlProgress as Uniform).value;

    inst.seek(dur / 2);
    const twistMid = (target.userData.swirlTwist as Uniform).value;

    inst.seek(dur);
    const twistEnd = (target.userData.swirlTwist as Uniform).value;
    const progEnd = (target.userData.swirlProgress as Uniform).value;

    // Twist is max at t=0 and unwinds toward 0 as it settles — distinct early,
    // mid, and end frames.
    expect(twist0).toBeGreaterThan(twistMid + 0.1);
    expect(twistMid).toBeGreaterThan(twistEnd);
    expect(twistEnd).toBeLessThan(0.001);
    // Reveal progress rises from 0 to 1.
    expect(progEnd).toBeGreaterThan(prog0 + 0.5);

    inst.dispose();
  });

  it('controls change output: larger swirl means larger initial twist', () => {
    const target = makeTarget(swirlWarpPrimitive);
    const inst = swirlWarpPrimitive.create(target);

    inst.setControl('swirl', 1);
    inst.seek(0);
    const small = (target.userData.swirlTwist as Uniform).value;

    inst.setControl('swirl', 8);
    inst.seek(0);
    const large = (target.userData.swirlTwist as Uniform).value;

    expect(large).toBeGreaterThan(small + 1);

    inst.dispose();
  });
});
