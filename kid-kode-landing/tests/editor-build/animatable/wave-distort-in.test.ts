import { describe, it, expect } from 'vitest';
import { Mesh, BufferGeometry, type BufferAttribute } from 'three';
import { waveDistortInPrimitive } from '@/lib/prism/animatable/primitives/wave-distort-in';
import { makeTarget, runConformance } from './_conformance';

/** Largest absolute z across all vertices of the subject plane. */
function maxAbsZ(mesh: Mesh): number {
  const pos = (mesh.geometry as BufferGeometry).getAttribute('position') as BufferAttribute;
  let m = 0;
  for (let i = 0; i < pos.count; i++) {
    const z = Math.abs(pos.getZ(i));
    if (z > m) m = z;
  }
  return m;
}

describe('wave-distort-in primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(waveDistortInPrimitive).dispose();
  });

  it('plays: warp is large early and settles to ~flat with opacity rising', () => {
    const target = makeTarget(waveDistortInPrimitive);
    const inst = waveDistortInPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as { opacity: number };
    const dur = inst.duration();

    inst.seek(0.001);
    const warpEarly = maxAbsZ(mesh);
    const opEarly = mat.opacity;

    inst.seek(dur);
    const warpEnd = maxAbsZ(mesh);
    const opEnd = mat.opacity;

    // Strong warp early, flat at the end.
    expect(warpEarly).toBeGreaterThan(0.3);
    expect(warpEnd).toBeLessThan(0.02);
    expect(warpEarly).toBeGreaterThan(warpEnd + 0.3);
    // Opacity rises across the eased phase.
    expect(opEnd).toBeGreaterThan(opEarly);

    inst.dispose();
  });

  it('controls change output: larger start warp means larger early displacement', () => {
    const target = makeTarget(waveDistortInPrimitive);
    const inst = waveDistortInPrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('amplitude', 0.2);
    inst.seek(0.001);
    const small = maxAbsZ(mesh);

    inst.setControl('amplitude', 2);
    inst.seek(0.001);
    const large = maxAbsZ(mesh);

    expect(large).toBeGreaterThan(small + 0.3);

    inst.dispose();
  });
});
