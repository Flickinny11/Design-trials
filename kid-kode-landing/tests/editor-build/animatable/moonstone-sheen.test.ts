import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { moonstoneSheenPrimitive } from '@/lib/prism/animatable/primitives/moonstone-sheen';
import { makeTarget, runConformance } from './_conformance';

type Uni = { value: number };
type MoonstoneUniforms = { time: Uni; drift: Uni; intensity: Uni };

describe('moonstone-sheen primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(moonstoneSheenPrimitive).dispose();
  });

  it('plays: seeking advances the time uniform and installs a node material', () => {
    // PURE SHADER look (the drifting glow blob lives in the colorNode and is not
    // CPU-readable as pixels). Observable on the CPU: the swapped node material
    // gains a truthy colorNode, and the time uniform advances across the timeline.
    const target = makeTarget(moonstoneSheenPrimitive);
    const inst = moonstoneSheenPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as unknown as { colorNode?: unknown };
    expect(mat.colorNode).toBeTruthy();

    const uniforms = target.userData.moonstoneUniforms as MoonstoneUniforms;

    inst.seek(0);
    const t0 = uniforms.time.value;

    inst.seek(2.5);
    const tMid = uniforms.time.value;

    // The time uniform advances → the glow blob center (sin/cos of uTime) drifts.
    expect(tMid).toBeGreaterThan(t0);
    expect(tMid - t0).toBeCloseTo(2.5, 5);

    inst.dispose();
    // dispose restores the original (non-node) material.
    expect((mesh.material as unknown as { colorNode?: unknown }).colorNode).toBeFalsy();
  });

  it('controls change output: drift extremes produce different live uniform values', () => {
    const target = makeTarget(moonstoneSheenPrimitive);
    const inst = moonstoneSheenPrimitive.create(target);
    const uniforms = target.userData.moonstoneUniforms as MoonstoneUniforms;

    inst.setControl('drift', 0.05);
    inst.seek(1);
    const slow = uniforms.drift.value;

    inst.setControl('drift', 1.2);
    inst.seek(1);
    const fast = uniforms.drift.value;

    expect(fast).toBeGreaterThan(slow + 0.5);

    // Intensity control also feeds the live uniform.
    inst.setControl('intensity', 0);
    inst.seek(1);
    const dim = uniforms.intensity.value;
    inst.setControl('intensity', 1);
    inst.seek(1);
    const bright = uniforms.intensity.value;
    expect(bright).toBeGreaterThan(dim);

    inst.dispose();
  });
});
