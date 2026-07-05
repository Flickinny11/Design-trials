import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { iridescencePrimitive } from '@/lib/prism/animatable/primitives/iridescence';
import { makeTarget, runConformance } from './_conformance';

// The swapped MeshBasicNodeMaterial carries uniform handles whose `.value` is
// CPU-observable (no renderer needed). The primitive publishes them on
// target.userData.iridescence so we can assert real uniform-value motion.
type Uni = { value: number };
type Handles = { uTime: Uni; uSpeed: Uni; uScale: Uni; uSat: Uni };

describe('iridescence primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(iridescencePrimitive).dispose();
  });

  it('plays: the time uniform advances between an early and a later frame', () => {
    const target = makeTarget(iridescencePrimitive);
    const inst = iridescencePrimitive.create(target);
    const mesh = target.subject as Mesh;

    // The swapped node material is in place — proves the GPU path is wired.
    const mat = mesh.material as unknown as { colorNode?: unknown };
    expect(mat.colorNode).toBeTruthy();

    const h = target.userData.iridescence as Handles;

    // Looping primitive: duration is Infinity; pick two distinct t values and
    // assert the time uniform genuinely changed on CPU-observable state.
    expect(inst.duration()).toBe(Infinity);

    inst.seek(0);
    const t0 = h.uTime.value;

    inst.seek(2.5);
    const tMid = h.uTime.value;

    expect(tMid).toBeGreaterThan(t0);
    expect(tMid).toBe(2.5);
    inst.dispose();
    // dispose restores the original (non-node) material.
    expect((mesh.material as unknown as { colorNode?: unknown }).colorNode).toBeFalsy();
  });

  it('controls change output: saturation extremes resolve to different uniform values', () => {
    const target = makeTarget(iridescencePrimitive);
    const inst = iridescencePrimitive.create(target);
    const h = target.userData.iridescence as Handles;

    inst.setControl('saturation', 0);
    inst.seek(0);
    const low = h.uSat.value;

    inst.setControl('saturation', 1);
    inst.seek(0);
    const high = h.uSat.value;

    expect(high).toBeGreaterThan(low + 0.5);
    expect(inst.getParams().saturation).toBe(1);
    inst.dispose();
  });
});
