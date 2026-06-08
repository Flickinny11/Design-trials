import { describe, it, expect } from 'vitest';
import { Mesh, MeshStandardMaterial } from 'three';
import { volumetricConePrimitive } from '@/lib/prism/animatable/primitives/volumetric-cone';
import { makeTarget, runConformance } from './_conformance';

// The cone effect lives in a swapped MeshBasicNodeMaterial whose animation is
// driven by uniform handles. The primitive publishes those handles on
// target.userData.volumetricCone (shared scratch space). Those `.value` fields
// are the CPU-observable state (we never assert on rendered pixels): seek()
// advances uTime and re-reads the live param uniforms; setControl updates them.
type ConeUniforms = {
  uTime: { value: number };
  uSweep: { value: number };
  uSpread: { value: number };
  uDust: { value: number };
  uIntensity: { value: number };
};

describe('volumetric-cone primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(volumetricConePrimitive).dispose();
  });

  it('plays: the sweep clock advances between an early and a late frame', () => {
    const target = makeTarget(volumetricConePrimitive);
    const inst = volumetricConePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const u = target.userData.volumetricCone as ConeUniforms;

    // Proof the GPU effect mounted: host plane's standard material was swapped.
    expect(mesh.material).not.toBeInstanceOf(MeshStandardMaterial);
    // Continuous sweep → stateful duration.
    expect(inst.duration()).toBe(Infinity);

    inst.seek(0);
    const tEarly = u.uTime.value;

    inst.seek(2.5);
    const tLate = u.uTime.value;

    // Concrete numeric motion: the animation clock the shader reads advanced.
    expect(tLate).toBeGreaterThan(tEarly + 1.0);
    expect(tEarly).toBe(0);

    inst.dispose();
  });

  it('controls change output: sweep/intensity uniforms differ at extremes', () => {
    const target = makeTarget(volumetricConePrimitive);
    const inst = volumetricConePrimitive.create(target);
    const u = target.userData.volumetricCone as ConeUniforms;

    // setControl → seek re-reads the live param into its uniform. Assert the
    // uniform the renderer consumes actually changes at two extremes (mirrors
    // slide's distance test).
    inst.setControl('intensity', 0);
    inst.seek(1);
    const intLow = u.uIntensity.value;

    inst.setControl('intensity', 2.5);
    inst.seek(1);
    const intHigh = u.uIntensity.value;

    expect(intHigh).toBeGreaterThan(intLow + 1.0);

    inst.setControl('sweep', 0);
    inst.seek(1);
    const sweepLow = u.uSweep.value;

    inst.setControl('sweep', 2);
    inst.seek(1);
    const sweepHigh = u.uSweep.value;

    expect(sweepHigh).toBeGreaterThan(sweepLow + 1.0);

    inst.dispose();
  });
});
