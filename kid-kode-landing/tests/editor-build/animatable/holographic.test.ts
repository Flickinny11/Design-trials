import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { holographicPrimitive } from '@/lib/prism/animatable/primitives/holographic';
import { makeTarget, runConformance } from './_conformance';

type UniformHandle = { value: number };
type HoloUniforms = {
  uTime: UniformHandle;
  uSpeed: UniformHandle;
  uBandScale: UniformHandle;
  uIntensity: UniformHandle;
};

describe('holographic primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(holographicPrimitive).dispose();
  });

  it('plays: the uTime uniform advances across the timeline (looping → Infinity)', () => {
    // PURE SHADER: pixels cannot be read headlessly. The holo sweep is driven by
    // the uTime uniform; assert its .value changes between an early and a later
    // seek (two distinct t values, since this is a looping/Infinity primitive).
    const target = makeTarget(holographicPrimitive);
    const inst = holographicPrimitive.create(target);
    const mesh = target.subject as Mesh;

    // material was swapped to a node material carrying an emissive node.
    const mat = mesh.material as unknown as { emissiveNode?: unknown };
    expect(mat.emissiveNode).toBeTruthy();
    expect(inst.duration()).toBe(Infinity);

    const uni = target.userData.holographic as HoloUniforms;

    inst.seek(0);
    const early = uni.uTime.value;

    inst.seek(1.5);
    const later = uni.uTime.value;

    expect(later).toBeGreaterThan(early);
    expect(later - early).toBeCloseTo(1.5, 5);

    inst.dispose();
    // dispose restores the original (non-node) material.
    expect((mesh.material as unknown as { emissiveNode?: unknown }).emissiveNode).toBeFalsy();
  });

  it('controls: speed extremes change the observable speed uniform', () => {
    const target = makeTarget(holographicPrimitive);
    const inst = holographicPrimitive.create(target);
    const uni = target.userData.holographic as HoloUniforms;

    inst.setControl('speed', 0.1);
    inst.seek(1);
    const slow = uni.uSpeed.value;

    inst.setControl('speed', 4);
    inst.seek(1);
    const fast = uni.uSpeed.value;

    expect(fast).toBeGreaterThan(slow + 0.5);
    expect(slow).toBe(0.1);
    expect(fast).toBe(4);

    inst.dispose();
  });
});
