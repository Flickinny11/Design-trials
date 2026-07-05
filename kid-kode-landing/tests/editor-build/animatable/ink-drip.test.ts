import { describe, it, expect } from 'vitest';
import { inkDripPrimitive } from '@/lib/prism/animatable/primitives/ink-drip';
import { makeTarget, runConformance } from './_conformance';

describe('ink-drip primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(inkDripPrimitive).dispose();
  });

  it('plays: time uniform advances across the timeline', () => {
    const target = makeTarget(inkDripPrimitive);
    const inst = inkDripPrimitive.create(target);
    const uTime = target.userData.uTime as { value: number };

    inst.seek(0);
    const t0 = uTime.value;

    inst.seek(1.5);
    const tMid = uTime.value;

    inst.seek(3.0);
    const tEnd = uTime.value;

    // The driver clock visibly advances the effect (looping/Infinity duration).
    expect(t0).toBe(0);
    expect(tMid).toBeGreaterThan(t0);
    expect(tEnd).toBeGreaterThan(tMid);
    inst.dispose();
  });

  it('controls change output: columns and width knobs alter the uniforms', () => {
    const target = makeTarget(inkDripPrimitive);
    const inst = inkDripPrimitive.create(target);
    const uColumns = target.userData.uColumns as { value: number };
    const uWidth = target.userData.uWidth as { value: number };

    inst.setControl('columns', 3);
    inst.setControl('width', 0.2);
    inst.seek(0.5);
    const colsLow = uColumns.value;
    const widthLow = uWidth.value;

    inst.setControl('columns', 10);
    inst.setControl('width', 1.5);
    inst.seek(0.5);
    const colsHigh = uColumns.value;
    const widthHigh = uWidth.value;

    expect(colsHigh).toBeGreaterThan(colsLow + 0.5);
    expect(widthHigh).toBeGreaterThan(widthLow + 0.5);
    inst.dispose();
  });
});
