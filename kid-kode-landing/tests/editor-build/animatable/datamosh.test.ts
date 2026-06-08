import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { datamoshPrimitive } from '@/lib/prism/animatable/primitives/datamosh';
import { makeTarget, runConformance } from './_conformance';

// The primitive stashes its live uniform handles on target.userData.datamosh
// (the shared scratch space the contract provides). Reading their .value is
// fully CPU-observable — no GPU, no pixel sampling.
function moshUniforms(target: ReturnType<typeof makeTarget>): {
  uProgress: { value: number };
  uMosh: { value: number };
  uBlocks: { value: number };
  uSmear: { value: number };
} {
  return (target.userData as Record<string, unknown>).datamosh as {
    uProgress: { value: number };
    uMosh: { value: number };
    uBlocks: { value: number };
    uSmear: { value: number };
  };
}

describe('datamosh primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(datamoshPrimitive).dispose();
  });

  it('plays: block-smear decays to clean while reveal rises across the timeline', () => {
    const target = makeTarget(datamoshPrimitive);
    const inst = datamoshPrimitive.create(target);
    const u = moshUniforms(target);
    const dur = inst.duration();

    inst.seek(0);
    const moshStart = u.uMosh.value;
    const progStart = u.uProgress.value;

    inst.seek(dur * 0.5);
    const progMid = u.uProgress.value;

    inst.seek(dur);
    const moshEnd = u.uMosh.value;
    const progEnd = u.uProgress.value;

    // Block displacement amount starts high (smear visible) and snaps to ~0.
    expect(moshStart).toBeGreaterThan(moshEnd + 0.3);
    expect(moshEnd).toBeLessThan(0.05);
    // Reveal/progress rises monotonically and settles opaque.
    expect(progMid).toBeGreaterThan(progStart);
    expect(progEnd).toBeGreaterThan(progMid - 1e-9);
    expect(progEnd).toBeGreaterThan(0.9);

    inst.dispose();
  });

  it('controls change output: smear + blocks knobs flow to their uniforms', () => {
    const target = makeTarget(datamoshPrimitive);
    const inst = datamoshPrimitive.create(target);
    const u = moshUniforms(target);

    inst.setControl('smear', 0.0);
    inst.seek(0);
    const smearSmall = u.uSmear.value;

    inst.setControl('smear', 0.4);
    inst.seek(0);
    const smearLarge = u.uSmear.value;

    expect(smearLarge).toBeGreaterThan(smearSmall + 0.3);

    inst.setControl('blocks', 4);
    inst.seek(0);
    const blocksFew = u.uBlocks.value;

    inst.setControl('blocks', 24);
    inst.seek(0);
    const blocksMany = u.uBlocks.value;

    expect(blocksMany).toBeGreaterThan(blocksFew + 10);

    inst.dispose();
  });
});
