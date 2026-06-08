import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { glimmerDustPrimitive } from '@/lib/prism/animatable/primitives/glimmer-dust';
import { makeTarget, runConformance } from './_conformance';

interface Uni {
  value: number;
}
interface GlimmerUniforms {
  time: Uni;
  density: Uni;
  flicker: Uni;
  intensity: Uni;
  sharp: Uni;
}

describe('glimmer-dust primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(glimmerDustPrimitive).dispose();
  });

  it('plays: a node material is installed and the time uniform advances across seeks', () => {
    // PURE SHADER (TSL): pixels cannot be read headlessly. Assert the card gained
    // a MeshStandardNodeMaterial with a truthy emissiveNode, and that the time
    // uniform driving the stepped-flicker hash advances between an early and a
    // late seek (CPU-observable via the exposed uniform handle).
    const target = makeTarget(glimmerDustPrimitive);
    const inst = glimmerDustPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as unknown as { emissiveNode?: unknown };
    expect(mat.emissiveNode).toBeTruthy();

    const uniforms = target.userData.glimmerUniforms as GlimmerUniforms;

    inst.seek(0);
    const t0 = uniforms.time.value;

    inst.seek(1.37);
    const tMid = uniforms.time.value;

    inst.seek(3.5);
    const tLate = uniforms.time.value;

    // Time uniform advances monotonically -> the floor(uTime*flickerRate) step
    // re-rolls the glimmer hash, producing visible flicker.
    expect(tMid).toBeGreaterThan(t0);
    expect(tLate).toBeGreaterThan(tMid);

    inst.dispose();
    // dispose restores the original (non-node) material.
    expect((mesh.material as unknown as { emissiveNode?: unknown }).emissiveNode).toBeFalsy();
  });

  it('controls: density extremes change the live shader uniform', () => {
    const target = makeTarget(glimmerDustPrimitive);
    const inst = glimmerDustPrimitive.create(target);
    const uniforms = target.userData.glimmerUniforms as GlimmerUniforms;

    inst.setControl('density', 20);
    inst.seek(0.5);
    const low = uniforms.density.value;

    inst.setControl('density', 120);
    inst.seek(0.5);
    const high = uniforms.density.value;

    expect(inst.getParams().density).toBe(120);
    expect(high).toBeGreaterThan(low + 50);
    inst.dispose();
  });
});
