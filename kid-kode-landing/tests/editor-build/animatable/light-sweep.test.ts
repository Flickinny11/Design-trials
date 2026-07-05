import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { lightSweepPrimitive } from '@/lib/prism/animatable/primitives/light-sweep';
import { makeTarget, runConformance } from './_conformance';

describe('light-sweep primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(lightSweepPrimitive).dispose();
  });

  it('plays: the sweep band advances across the surface over the loop', () => {
    // GPU shader effect — pixels cannot be read headlessly. The band position is
    // published to host scratch each seek; assert it advances between an early
    // and a later frame, and that a node material with a truthy emissiveNode was
    // installed on the card.
    const target = makeTarget(lightSweepPrimitive);
    const inst = lightSweepPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as unknown as { emissiveNode?: unknown };
    expect(mat.emissiveNode).toBeTruthy();

    // Looping primitive: pick two distinct t values within one loop.
    inst.seek(0);
    const sweep0 = target.userData.lightSweep as number;
    inst.seek(1.2);
    const sweepMid = target.userData.lightSweep as number;

    expect(typeof sweep0).toBe('number');
    expect(Math.abs(sweepMid - sweep0)).toBeGreaterThan(0.1);

    inst.dispose();
    // dispose restores the original (non-node) material.
    expect((mesh.material as unknown as { emissiveNode?: unknown }).emissiveNode).toBeFalsy();
  });

  it('controls: changing speed changes how far the band travels per unit time', () => {
    const target = makeTarget(lightSweepPrimitive);
    const inst = lightSweepPrimitive.create(target);

    // Slow speed: small advance over a fixed dt.
    inst.setControl('speed', 0.1);
    inst.seek(0);
    const a0 = target.userData.lightSweep as number;
    inst.seek(0.5);
    const aSlow = Math.abs((target.userData.lightSweep as number) - a0);

    // Fast speed: larger advance over the same dt.
    inst.setControl('speed', 3);
    inst.seek(0);
    const b0 = target.userData.lightSweep as number;
    inst.seek(0.5);
    const bFast = Math.abs((target.userData.lightSweep as number) - b0);

    expect(bFast).toBeGreaterThan(aSlow + 0.05);
    inst.dispose();
  });
});
