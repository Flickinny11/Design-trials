import { describe, it, expect } from 'vitest';
import { inkSpreadPrimitive } from '@/lib/prism/animatable/primitives/ink-spread';
import { makeTarget, runConformance } from './_conformance';

describe('ink-spread primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(inkSpreadPrimitive).dispose();
  });

  it('plays: the ink radius grows from the center over the timeline', () => {
    const target = makeTarget(inkSpreadPrimitive);
    const inst = inkSpreadPrimitive.create(target);
    const dur = inst.duration();

    inst.seek(0);
    const r0 = target.userData.inkRadius as number;

    inst.seek(dur * 0.5);
    const rMid = target.userData.inkRadius as number;

    inst.seek(dur);
    const rEnd = target.userData.inkRadius as number;

    // starts at ~0, blooms outward; mid frame differs from both ends
    expect(r0).toBeLessThan(0.05);
    expect(rMid).toBeGreaterThan(r0 + 0.1);
    expect(rEnd).toBeGreaterThan(rMid + 0.05);
    inst.dispose();
  });

  it('controls change output: longer duration means a smaller radius at a fixed time', () => {
    const target = makeTarget(inkSpreadPrimitive);
    const inst = inkSpreadPrimitive.create(target);

    inst.setControl('duration', 1);
    inst.seek(0.5);
    const fast = target.userData.inkRadius as number;

    inst.setControl('duration', 6);
    inst.seek(0.5);
    const slow = target.userData.inkRadius as number;

    // at the same wall-clock t, the shorter animation is further along
    expect(fast).toBeGreaterThan(slow + 0.1);
    inst.dispose();
  });
});
