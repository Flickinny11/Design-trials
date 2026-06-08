import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { gasFlamePrimitive } from '@/lib/prism/animatable/primitives/gas-flame';
import { makeTarget, runConformance } from './_conformance';

// The visible flame is driven by TSL uniforms on the swapped node material.
// The primitive publishes its live uniform handles onto target.userData.gasFlame
// (the contract's host scratch channel), so the test can read each uniform's
// `.value` — concrete CPU-observable state that seek() and setControl() mutate.
type FlameUniforms = {
  uTime: { value: number };
  uJets: { value: number };
  uFlicker: { value: number };
  uIntensity: { value: number };
};

describe('gas-flame primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(gasFlamePrimitive).dispose();
  });

  it('plays: the time uniform advances across the timeline (continuous loop)', () => {
    const target = makeTarget(gasFlamePrimitive);
    const inst = gasFlamePrimitive.create(target);
    const mesh = target.subject as Mesh;

    // A node material with color + opacity nodes was installed.
    const mat = mesh.material as unknown as { colorNode?: unknown; opacityNode?: unknown };
    expect(mat.colorNode).toBeTruthy();
    expect(mat.opacityNode).toBeTruthy();

    // Looping/stateful effect: duration is Infinity (no settled end).
    expect(inst.duration()).toBe(Infinity);

    const u = target.userData.gasFlame as FlameUniforms;

    inst.seek(0);
    const t0 = u.uTime.value;

    inst.seek(1.7);
    const tMid = u.uTime.value;

    inst.seek(3.4);
    const tLate = u.uTime.value;

    // The time uniform genuinely advances frame to frame → visible motion.
    expect(tMid).toBeGreaterThan(t0);
    expect(tLate).toBeGreaterThan(tMid);
    expect(tMid).toBeCloseTo(1.7, 5);

    inst.dispose();
    // dispose restores the original (non-node) material.
    expect((mesh.material as unknown as { colorNode?: unknown }).colorNode).toBeFalsy();
  });

  it('controls change output: jets and intensity drive their uniforms', () => {
    const target = makeTarget(gasFlamePrimitive);
    const inst = gasFlamePrimitive.create(target);
    const u = target.userData.gasFlame as FlameUniforms;

    inst.setControl('jets', 2);
    inst.seek(0.5);
    const jetsLow = u.uJets.value;
    expect(inst.getParams().jets).toBe(2);

    inst.setControl('jets', 8);
    inst.seek(0.5);
    const jetsHigh = u.uJets.value;

    expect(jetsHigh).toBeGreaterThan(jetsLow + 3);

    inst.setControl('intensity', 0.2);
    inst.seek(0.5);
    const intLow = u.uIntensity.value;

    inst.setControl('intensity', 2.5);
    inst.seek(0.5);
    const intHigh = u.uIntensity.value;

    expect(intHigh).toBeGreaterThan(intLow + 1);

    inst.dispose();
  });
});
