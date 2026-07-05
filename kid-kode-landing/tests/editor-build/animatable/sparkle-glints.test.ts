import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { sparkleGlintsPrimitive } from '@/lib/prism/animatable/primitives/sparkle-glints';
import { makeTarget, runConformance } from './_conformance';

type Uniform = { value: number };
type SparkleScratch = {
  uTime: Uniform;
  uDensity: Uniform;
  uSpeed: Uniform;
  uThreshold: Uniform;
};

describe('sparkle-glints primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(sparkleGlintsPrimitive).dispose();
  });

  it('plays: looping uTime uniform advances across distinct frames', () => {
    // PURE SHADER: pixels cannot be read headlessly. Assert CPU-observable state
    // — the driven uTime uniform's .value — advances between two distinct frames,
    // and that the swapped node material carries a truthy colorNode.
    const target = makeTarget(sparkleGlintsPrimitive);
    const inst = sparkleGlintsPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as unknown as { colorNode?: unknown };
    expect(mat.colorNode).toBeTruthy();

    const scratch = target.userData.sparkleGlints as SparkleScratch;
    expect(scratch).toBeTruthy();

    // Looping primitive (duration Infinity): pick two distinct t values.
    inst.seek(0);
    const t0 = scratch.uTime.value;

    inst.seek(2.5);
    const tMid = scratch.uTime.value;

    inst.seek(5.0);
    const tEnd = scratch.uTime.value;

    // uTime tracks the master clock: each frame is a concrete numeric change.
    expect(t0).toBe(0);
    expect(tMid).toBeGreaterThan(t0 + 0.5);
    expect(tEnd).toBeGreaterThan(tMid + 0.5);

    inst.dispose();
    // dispose restores the original (non-node) material.
    expect((mesh.material as unknown as { colorNode?: unknown }).colorNode).toBeFalsy();
  });

  it('controls: changing density changes the driven uniform output', () => {
    const target = makeTarget(sparkleGlintsPrimitive);
    const inst = sparkleGlintsPrimitive.create(target);
    const scratch = target.userData.sparkleGlints as SparkleScratch;

    inst.setControl('density', 2);
    inst.seek(1.0);
    const lowDensity = scratch.uDensity.value;

    inst.setControl('density', 24);
    inst.seek(1.0);
    const highDensity = scratch.uDensity.value;

    expect(highDensity).toBeGreaterThan(lowDensity + 1);
    expect(lowDensity).toBe(2);
    expect(highDensity).toBe(24);

    // onParamChange also applies immediately (no re-seek needed).
    inst.setControl('speed', 4);
    expect(scratch.uSpeed.value).toBe(4);

    inst.dispose();
  });
});
