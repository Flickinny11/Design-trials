import { describe, it, expect } from 'vitest';
import { pixelDissolvePrimitive } from '@/lib/prism/animatable/primitives/pixel-dissolve';
import { makeTarget, runConformance } from './_conformance';

describe('pixel-dissolve primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(pixelDissolvePrimitive).dispose();
  });

  it('plays: dissolve progress advances from start to end of the timeline', () => {
    const target = makeTarget(pixelDissolvePrimitive);
    const inst = pixelDissolvePrimitive.create(target);
    const dur = inst.duration();

    inst.seek(0);
    const p0 = target.userData.pixelDissolveProgress as number;

    inst.seek(dur * 0.5);
    const pMid = target.userData.pixelDissolveProgress as number;

    inst.seek(dur);
    const pEnd = target.userData.pixelDissolveProgress as number;

    // progress sweeps 0 -> 1; mid-frame differs from both ends
    expect(pMid).toBeGreaterThan(p0 + 0.05);
    expect(pEnd).toBeGreaterThan(pMid + 0.05);
    expect(p0).toBeLessThan(0.01);
    expect(pEnd).toBeGreaterThan(0.99);

    inst.dispose();
  });

  it('controls change output: shorter duration reaches a given time later in phase', () => {
    const target = makeTarget(pixelDissolvePrimitive);
    const inst = pixelDissolvePrimitive.create(target);

    // At a fixed absolute time, a shorter duration → further along the dissolve.
    inst.setControl('duration', 5);
    inst.seek(1);
    const slow = target.userData.pixelDissolveProgress as number;

    inst.setControl('duration', 0.4);
    inst.seek(1);
    const fast = target.userData.pixelDissolveProgress as number;

    expect(fast).toBeGreaterThan(slow + 0.1);

    inst.dispose();
  });
});
