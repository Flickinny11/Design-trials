import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { causticShimmerPrimitive } from '@/lib/prism/animatable/primitives/caustic-shimmer';
import { makeTarget, runConformance } from './_conformance';

interface ShimmerUniforms {
  uTime: { value: number };
  uScale: { value: number };
  uIntensity: { value: number };
  uSharp: { value: number };
}

function uniforms(target: ReturnType<typeof makeTarget>): ShimmerUniforms {
  return target.userData.causticShimmer as unknown as ShimmerUniforms;
}

describe('caustic-shimmer primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(causticShimmerPrimitive).dispose();
  });

  it('plays: time uniform advances across seek (looping, Infinity duration)', () => {
    const target = makeTarget(causticShimmerPrimitive);
    const inst = causticShimmerPrimitive.create(target);
    const mesh = target.subject as Mesh;
    // The primitive swapped in a node material carrying an emissive caustic.
    expect((mesh.material as unknown as { emissiveNode: unknown }).emissiveNode).toBeDefined();

    // Looping primitive: duration is Infinity, so pick two distinct t values.
    expect(inst.duration()).toBe(Infinity);

    const u = uniforms(target);
    inst.seek(0);
    const tEarly = u.uTime.value;

    inst.seek(2.5);
    const tMid = u.uTime.value;

    // The driver clock visibly advanced the caustic — concrete numeric change.
    expect(tMid).toBeGreaterThan(tEarly + 0.5);
    inst.dispose();
  });

  it('controls change output: speed scales how fast uTime advances', () => {
    const target = makeTarget(causticShimmerPrimitive);
    const inst = causticShimmerPrimitive.create(target);
    const u = uniforms(target);

    inst.setControl('speed', 0.1);
    inst.seek(1);
    const slow = u.uTime.value;

    inst.setControl('speed', 3);
    inst.seek(1);
    const fast = u.uTime.value;

    expect(fast).toBeGreaterThan(slow + 1);
    inst.dispose();
  });

  it('controls change output: intensity extremes drive the bound uniform', () => {
    const target = makeTarget(causticShimmerPrimitive);
    const inst = causticShimmerPrimitive.create(target);
    const u = uniforms(target);

    inst.setControl('intensity', 0);
    inst.seek(0.5);
    const low = u.uIntensity.value;

    inst.setControl('intensity', 2);
    inst.seek(0.5);
    const high = u.uIntensity.value;

    expect(high).toBeGreaterThan(low + 1);
    inst.dispose();
  });
});
