import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { velvetSheenPrimitive } from '@/lib/prism/animatable/primitives/velvet-sheen';
import { makeTarget, runConformance } from './_conformance';

type UniformHandle = { value: number };
type SheenScratch = {
  uTime: UniformHandle;
  uSpeed: UniformHandle;
  uIntensity: UniformHandle;
  uPower: UniformHandle;
};

describe('velvet-sheen primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(velvetSheenPrimitive).dispose();
  });

  it('plays: seek advances the time uniform and swaps in a node material', () => {
    const target = makeTarget(velvetSheenPrimitive);
    const inst = velvetSheenPrimitive.create(target);
    const mesh = target.subject as Mesh;

    // Material was swapped to a node material for the TSL sheen.
    expect(mesh.material).toBeInstanceOf(MeshStandardNodeMaterial);

    const scratch = target.userData.velvetSheen as SheenScratch;

    inst.seek(0);
    const t0 = scratch.uTime.value;

    inst.seek(2.5);
    const tMid = scratch.uTime.value;

    // uTime advances with seek (the drifting modulation depends on it).
    expect(tMid).toBeGreaterThan(t0);
    expect(tMid).toBeCloseTo(2.5, 5);

    inst.dispose();
  });

  it('controls change output: speed extremes drive a different time-scale uniform', () => {
    const target = makeTarget(velvetSheenPrimitive);
    const inst = velvetSheenPrimitive.create(target);
    const scratch = target.userData.velvetSheen as SheenScratch;

    inst.setControl('speed', 0.05);
    inst.seek(1);
    const slow = scratch.uSpeed.value;

    inst.setControl('speed', 1.5);
    inst.seek(1);
    const fast = scratch.uSpeed.value;

    expect(fast).toBeGreaterThan(slow + 0.5);

    // Intensity is also a live knob and reaches the renderer uniform.
    inst.setControl('intensity', 0);
    inst.seek(1);
    const dim = scratch.uIntensity.value;
    inst.setControl('intensity', 2);
    inst.seek(1);
    const bright = scratch.uIntensity.value;
    expect(bright).toBeGreaterThan(dim + 1);

    inst.dispose();
  });
});
