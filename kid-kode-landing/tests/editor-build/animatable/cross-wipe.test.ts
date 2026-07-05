import { describe, it, expect } from 'vitest';
import { crossWipePrimitive } from '@/lib/prism/animatable/primitives/cross-wipe';
import { makeTarget, runConformance } from './_conformance';

type UProgress = { uProgress: { value: number }; uSoftness: { value: number } };

describe('cross-wipe primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(crossWipePrimitive).dispose();
  });

  it('plays: the cross progress uniform grows from the center outward', () => {
    const target = makeTarget(crossWipePrimitive);
    const inst = crossWipePrimitive.create(target);
    const handles = target.userData.crossWipe as UProgress;
    const dur = inst.duration();

    inst.seek(0);
    const p0 = handles.uProgress.value;

    inst.seek(dur * 0.5);
    const pMid = handles.uProgress.value;

    inst.seek(dur);
    const pEnd = handles.uProgress.value;

    // arms start collapsed (progress ~0) and thicken outward over the timeline
    expect(pMid).toBeGreaterThan(p0 + 0.05);
    expect(pEnd).toBeGreaterThan(pMid);
    inst.dispose();
  });

  it('controls change output: larger thickness reveals further at the same phase', () => {
    const target = makeTarget(crossWipePrimitive);
    const inst = crossWipePrimitive.create(target);
    const handles = target.userData.crossWipe as UProgress;
    const dur = inst.duration();

    inst.setControl('thickness', 0.1);
    inst.seek(dur);
    const thin = handles.uProgress.value;

    inst.setControl('thickness', 0.6);
    inst.seek(dur);
    const thick = handles.uProgress.value;

    expect(thick).toBeGreaterThan(thin + 0.1);
    inst.dispose();
  });
});
