import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { brushedMetalPrimitive } from '@/lib/prism/animatable/primitives/brushed-metal';
import { makeTarget, runConformance } from './_conformance';

interface BrushedUniforms {
  uSweep: { value: number };
  uGrainFreq: { value: number };
  uIntensity: { value: number };
  uWidth: { value: number };
}

function brushedOf(target: ReturnType<typeof makeTarget>): BrushedUniforms {
  const mesh = target.subject as Mesh;
  return (mesh.material as unknown as { userData: { brushed: BrushedUniforms } }).userData.brushed;
}

describe('brushed-metal primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(brushedMetalPrimitive).dispose();
  });

  it('plays: the sweep uniform advances between an early and a later frame', () => {
    const target = makeTarget(brushedMetalPrimitive);
    const inst = brushedMetalPrimitive.create(target);
    const u = brushedOf(target);

    inst.seek(0);
    const sweep0 = u.uSweep.value;

    inst.seek(1.0);
    const sweepMid = u.uSweep.value;

    inst.seek(2.3);
    const sweepLate = u.uSweep.value;

    // The sweep position must change as the animation plays (looping, stateful).
    expect(sweepMid).not.toBe(sweep0);
    expect(sweepLate).not.toBe(sweepMid);
    inst.dispose();
  });

  it('controls change output: grainFreq extremes drive different grain uniform', () => {
    const target = makeTarget(brushedMetalPrimitive);
    const inst = brushedMetalPrimitive.create(target);
    const u = brushedOf(target);

    inst.setControl('grainFreq', 20);
    inst.seek(0.5);
    const low = u.uGrainFreq.value;

    inst.setControl('grainFreq', 120);
    inst.seek(0.5);
    const high = u.uGrainFreq.value;

    expect(high).toBeGreaterThan(low + 50);
    expect(low).toBe(20);
    expect(high).toBe(120);
    inst.dispose();
  });
});
