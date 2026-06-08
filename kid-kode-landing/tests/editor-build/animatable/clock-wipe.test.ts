import { describe, it, expect } from 'vitest';
import { clockWipePrimitive } from '@/lib/prism/animatable/primitives/clock-wipe';
import { makeTarget, runConformance } from './_conformance';

// The CPU-observable is the progress uniform handle the primitive stashes on
// target.userData.clockProgress — its .value advances 0 -> 1 as seek walks the
// timeline. (We never assert on rendered pixels; headless has no real GPU.)

describe('clock-wipe primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(clockWipePrimitive).dispose();
  });

  it('plays: the clock-hand progress uniform sweeps 0 -> 1', () => {
    const target = makeTarget(clockWipePrimitive);
    const inst = clockWipePrimitive.create(target);
    const u = target.userData.clockProgress as { value: number };
    const dur = inst.duration();

    inst.seek(0);
    const p0 = u.value;

    inst.seek(dur * 0.5);
    const pMid = u.value;

    inst.seek(dur);
    const pEnd = u.value;

    // hand starts unswept, advances by mid-frame, and is fully swept at the end
    expect(p0).toBeLessThan(0.05);
    expect(pMid).toBeGreaterThan(p0 + 0.1);
    expect(pEnd).toBeGreaterThan(pMid + 0.1);
    expect(pEnd).toBeGreaterThan(0.95);
    inst.dispose();
  });

  it('controls change output: shorter duration sweeps further by a fixed time', () => {
    const target = makeTarget(clockWipePrimitive);
    const inst = clockWipePrimitive.create(target);
    const u = target.userData.clockProgress as { value: number };

    // At a fixed wall-clock time of 0.5s:
    inst.setControl('duration', 4); // slow clock -> barely started
    inst.seek(0.5);
    const slow = u.value;

    inst.setControl('duration', 0.5); // fast clock -> fully (or nearly) swept
    inst.seek(0.5);
    const fast = u.value;

    expect(fast).toBeGreaterThan(slow + 0.3);
    inst.dispose();
  });
});
