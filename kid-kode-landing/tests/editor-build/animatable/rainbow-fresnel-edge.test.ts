import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { rainbowFresnelEdgePrimitive } from '@/lib/prism/animatable/primitives/rainbow-fresnel-edge';
import { makeTarget, runConformance } from './_conformance';

// The TSL node material drives its look through uniform handles, which the
// primitive publishes onto target.userData. Those uniform `.value`s are the
// CPU-observable state on a headless renderer (pixels cannot be read).
type Uniforms = {
  uTime: { value: number };
  uIntensity: { value: number };
};
function uniformsOf(target: ReturnType<typeof makeTarget>): Uniforms {
  return target.userData.rainbowFresnelEdge as Uniforms;
}

describe('rainbow-fresnel-edge primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(rainbowFresnelEdgePrimitive).dispose();
  });

  it('plays: the time uniform advances between an early and a later frame', () => {
    const target = makeTarget(rainbowFresnelEdgePrimitive);
    const inst = rainbowFresnelEdgePrimitive.create(target);
    const mesh = target.subject as Mesh;

    // Looping/stateful: duration is Infinity.
    expect(inst.duration()).toBe(Infinity);

    // The card panel material was swapped to a node material with an emissiveNode.
    const swapped = mesh.material as unknown as { emissiveNode?: unknown };
    expect(swapped.emissiveNode).toBeTruthy();

    const u = uniformsOf(target);
    inst.seek(0);
    const tEarly = u.uTime.value;
    inst.seek(2.5);
    const tLate = u.uTime.value;

    // Mid-animation frame differs from t=0 (visible spectral drift along the rim).
    expect(tLate).toBeGreaterThan(tEarly + 1.0);
    inst.dispose();

    // dispose restores the original (non-node) material.
    expect((mesh.material as unknown as { emissiveNode?: unknown }).emissiveNode).toBeFalsy();
  });

  it('controls change output: intensity extremes drive the intensity uniform differently', () => {
    const target = makeTarget(rainbowFresnelEdgePrimitive);
    const inst = rainbowFresnelEdgePrimitive.create(target);
    const u = uniformsOf(target);

    inst.setControl('intensity', 0);
    inst.seek(1);
    const low = u.uIntensity.value;

    inst.setControl('intensity', 4);
    inst.seek(1);
    const high = u.uIntensity.value;

    expect(high).toBeGreaterThan(low + 1.0);
    inst.dispose();
  });
});
