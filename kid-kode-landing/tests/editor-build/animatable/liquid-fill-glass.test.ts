import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { liquidFillGlassPrimitive } from '@/lib/prism/animatable/primitives/liquid-fill-glass';
import { makeTarget, runConformance } from './_conformance';

describe('liquid-fill-glass primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(liquidFillGlassPrimitive).dispose();
  });

  it('plays: uFill rises from 0 across the timeline and a node material is installed', () => {
    // GPU/TSL: pixels cannot be read headlessly. Assert the CPU-observable fill
    // uniform rises and the glass mesh gained a node material with mixing nodes.
    const target = makeTarget(liquidFillGlassPrimitive);
    const inst = liquidFillGlassPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as unknown as { thicknessNode?: unknown; colorNode?: unknown };
    expect(mat.thicknessNode).toBeTruthy();
    expect(mat.colorNode).toBeTruthy();

    const uFill = target.userData.uFill as { value: number };

    inst.seek(0);
    const fillStart = uFill.value;

    inst.seek(2);
    const fillMid = uFill.value;

    // fill rises from the start of the animation
    expect(fillStart).toBe(0);
    expect(fillMid).toBeGreaterThan(fillStart + 0.05);
    // settled end: fill is fully clamped at 1 long after the fill completes
    inst.seek(100);
    expect(uFill.value).toBe(1);
    // mid frame differs from both ends
    expect(fillMid).toBeLessThan(1);

    inst.dispose();
    // dispose restores the original (non-node) material
    expect((mesh.material as unknown as { thicknessNode?: unknown }).thicknessNode).toBeFalsy();
  });

  it('controls: a faster fillSpeed produces a higher fill at the same time', () => {
    const target = makeTarget(liquidFillGlassPrimitive);
    const inst = liquidFillGlassPrimitive.create(target);
    const uFill = target.userData.uFill as { value: number };

    inst.setControl('fillSpeed', 0.05);
    inst.seek(2);
    const slow = uFill.value;

    inst.setControl('fillSpeed', 0.4);
    inst.seek(2);
    const fast = uFill.value;

    expect(fast).toBeGreaterThan(slow + 0.05);
    inst.dispose();
  });
});
