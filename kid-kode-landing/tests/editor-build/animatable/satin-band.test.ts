import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { satinBandPrimitive } from '@/lib/prism/animatable/primitives/satin-band';
import { makeTarget, runConformance } from './_conformance';

interface SatinUniforms {
  uSweep: { value: number };
  uWidth: { value: number };
  uSoftPow: { value: number };
  uIntensity: { value: number };
}

function uniformsOf(target: ReturnType<typeof makeTarget>): SatinUniforms {
  const mesh = target.subject as Mesh;
  const mat = mesh.material as unknown as { userData: { satin: SatinUniforms } };
  return mat.userData.satin;
}

describe('satin-band primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(satinBandPrimitive).dispose();
  });

  it('plays: the sweep uniform advances and loops across the timeline', () => {
    const target = makeTarget(satinBandPrimitive);
    const inst = satinBandPrimitive.create(target);
    const u = uniformsOf(target);

    inst.seek(0);
    const sweep0 = u.uSweep.value;

    inst.seek(1.2);
    const sweepMid = u.uSweep.value;

    // The band has visibly glided: a mid frame differs from t=0.
    expect(Math.abs(sweepMid - sweep0)).toBeGreaterThan(0.05);

    // Looping/stateful: duration is Infinity (animates continuously across t).
    expect(inst.duration()).toBe(Infinity);

    inst.dispose();
  });

  it('controls change output: intensity extremes drive different emissive scale', () => {
    const target = makeTarget(satinBandPrimitive);
    const inst = satinBandPrimitive.create(target);
    const u = uniformsOf(target);

    inst.setControl('intensity', 0);
    inst.seek(0.5);
    const low = u.uIntensity.value;

    inst.setControl('intensity', 1.5);
    inst.seek(0.5);
    const high = u.uIntensity.value;

    expect(high).toBeGreaterThan(low + 0.5);

    // Softness extremes change the feather exponent (broad vs tighter).
    inst.setControl('softness', 1);
    inst.seek(0.5);
    const soft = u.uSoftPow.value;

    inst.setControl('softness', 0.1);
    inst.seek(0.5);
    const tight = u.uSoftPow.value;

    expect(tight).toBeGreaterThan(soft + 0.5);

    inst.dispose();
  });
});
