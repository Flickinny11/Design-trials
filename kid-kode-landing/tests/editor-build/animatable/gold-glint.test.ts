import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { goldGlintPrimitive } from '@/lib/prism/animatable/primitives/gold-glint';
import { makeTarget, runConformance } from './_conformance';

type Uni = { value: number };
type GlintScratch = { uSweep: Uni; uTime: Uni; uWidth: Uni; uIntensity: Uni; uTw: Uni };

describe('gold-glint primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(goldGlintPrimitive).dispose();
  });

  it('plays: the sweep band advances across the timeline (and is a node material)', () => {
    const target = makeTarget(goldGlintPrimitive);
    const inst = goldGlintPrimitive.create(target);
    const mesh = target.subject as Mesh;

    // Swapped to a TSL node material with an emissiveNode.
    const mat = mesh.material as unknown as { emissiveNode?: unknown };
    expect(mat.emissiveNode).toBeTruthy();

    const g = target.userData.goldGlint as GlintScratch;

    // Looping primitive: pick two distinct phases within one PERIOD (2.4s).
    inst.seek(0);
    const sweep0 = g.uSweep.value;
    const time0 = g.uTime.value;

    inst.seek(0.6); // ~quarter into the sweep
    const sweepMid = g.uSweep.value;
    const timeMid = g.uTime.value;

    // The band moved along its direction and the twinkle clock advanced.
    expect(Math.abs(sweepMid - sweep0)).toBeGreaterThan(0.1);
    expect(timeMid).toBeGreaterThan(time0);
    inst.dispose();

    // dispose restores the original (non-node) material.
    expect((mesh.material as unknown as { emissiveNode?: unknown }).emissiveNode).toBeFalsy();
  });

  it('controls: width extremes change the band-width uniform; speed changes the sweep advance', () => {
    const target = makeTarget(goldGlintPrimitive);
    const inst = goldGlintPrimitive.create(target);
    const g = target.userData.goldGlint as GlintScratch;

    inst.setControl('width', 0.04);
    inst.seek(0.1);
    const narrow = g.uWidth.value;

    inst.setControl('width', 0.4);
    inst.seek(0.1);
    const wide = g.uWidth.value;

    expect(wide).toBeGreaterThan(narrow + 0.1);

    // Speed extremes: faster speed advances the sweep further at the same t.
    inst.setControl('speed', 0.1);
    inst.seek(0.5);
    const slowSweep = g.uSweep.value;

    inst.setControl('speed', 4);
    inst.seek(0.5);
    const fastSweep = g.uSweep.value;

    expect(fastSweep).not.toBe(slowSweep);
    inst.dispose();
  });
});
