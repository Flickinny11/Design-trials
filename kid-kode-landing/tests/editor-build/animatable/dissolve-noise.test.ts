import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { dissolveNoisePrimitive } from '@/lib/prism/animatable/primitives/dissolve-noise';
import { makeTarget, runConformance } from './_conformance';

describe('dissolve-noise primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(dissolveNoisePrimitive).dispose();
  });

  it('plays: uThreshold uniform sweeps 0 -> 1 across the timeline', () => {
    const target = makeTarget(dissolveNoisePrimitive);
    const inst = dissolveNoisePrimitive.create(target);
    const mesh = target.subject as Mesh;
    // swapped to a node material whose opacityNode drives the dissolve.
    expect((mesh.material as unknown as { opacityNode?: unknown }).opacityNode).toBeTruthy();

    const u = target.userData.uThreshold as { value: number };
    const dur = inst.duration();

    inst.seek(0);
    const start = u.value;
    inst.seek(dur * 0.5);
    const mid = u.value;
    inst.seek(dur);
    const end = u.value;

    // mid-animation frame differs from t=0 AND from the settled end.
    expect(mid).toBeGreaterThan(start + 0.05);
    expect(end).toBeGreaterThan(mid + 0.05);
    expect(start).toBeLessThan(0.05);
    expect(end).toBeGreaterThan(0.95);

    inst.dispose();
    // dispose restores the original (non-node) material.
    expect((mesh.material as unknown as { opacityNode?: unknown }).opacityNode).toBeFalsy();
  });

  it('controls: noise scale at two extremes changes the resolved param + uniform', () => {
    const target = makeTarget(dissolveNoisePrimitive);
    const inst = dissolveNoisePrimitive.create(target);

    inst.setControl('noiseScale', 2);
    inst.seek(0.1);
    const small = inst.getParams().noiseScale as number;

    inst.setControl('noiseScale', 40);
    inst.seek(0.1);
    const large = inst.getParams().noiseScale as number;

    expect(large).toBeGreaterThan(small + 0.5);
    inst.dispose();
  });
});
