import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { elasticPrimitive } from '@/lib/prism/animatable/primitives/elastic';
import { makeTarget, runConformance } from './_conformance';

describe('elastic primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(elasticPrimitive).dispose();
  });

  it('plays: scale springs 0 -> 1 with an overshoot >1, opacity rises', () => {
    const target = makeTarget(elasticPrimitive);
    const inst = elasticPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const s0 = mesh.scale.x;
    const op0 = mat.opacity;

    // sample across the phase to capture the mid-phase overshoot.
    let peak = -Infinity;
    for (let i = 1; i <= 40; i++) {
      inst.seek((i / 40) * dur);
      if (mesh.scale.x > peak) peak = mesh.scale.x;
    }

    inst.seek(dur);
    const sEnd = mesh.scale.x;
    const opEnd = mat.opacity;

    // starts collapsed, settles to full scale ~1
    expect(s0).toBeLessThan(sEnd - 0.3);
    expect(sEnd).toBeGreaterThan(0.95);
    expect(sEnd).toBeLessThan(1.05);
    // overshoot: some mid frame exceeds the settled scale
    expect(peak).toBeGreaterThan(1.02);
    // opacity rises across the eased phase
    expect(opEnd).toBeGreaterThan(op0);
    inst.dispose();
  });

  it('controls change output: larger amplitude means a larger overshoot', () => {
    const target = makeTarget(elasticPrimitive);
    const inst = elasticPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const dur = inst.duration();

    const peakFor = (amp: number): number => {
      inst.setControl('amplitude', amp);
      let peak = -Infinity;
      for (let i = 1; i <= 40; i++) {
        inst.seek((i / 40) * dur);
        if (mesh.scale.x > peak) peak = mesh.scale.x;
      }
      return peak;
    };

    const smallAmp = peakFor(0);
    const largeAmp = peakFor(2);

    expect(largeAmp).toBeGreaterThan(smallAmp + 0.05);
    inst.dispose();
  });
});
