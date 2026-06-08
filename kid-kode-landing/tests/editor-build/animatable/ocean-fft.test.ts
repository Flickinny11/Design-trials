import { describe, it, expect } from 'vitest';
import { Mesh, PlaneGeometry, type BufferAttribute } from 'three';
import { oceanFftPrimitive } from '@/lib/prism/animatable/primitives/ocean-fft';
import { makeTarget, runConformance } from './_conformance';

// Sum |z| across the plane's vertices — a scalar proxy for the surface's
// displacement energy at a given time.
function zEnergy(attr: BufferAttribute): number {
  let sum = 0;
  for (let i = 0; i < attr.count; i++) sum += Math.abs(attr.getZ(i));
  return sum;
}

describe('ocean-fft primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(oceanFftPrimitive).dispose();
  });

  it('plays: surface displacement differs across distinct times', () => {
    const target = makeTarget(oceanFftPrimitive);
    const inst = oceanFftPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const attr = (mesh.geometry as PlaneGeometry).getAttribute(
      'position',
    ) as BufferAttribute;

    // Pick a vertex away from the origin so directional swells move it.
    const probe = Math.floor(attr.count / 3);

    inst.seek(0);
    const z0 = attr.getZ(probe);
    const e0 = zEnergy(attr);

    inst.seek(1.3);
    const zMid = attr.getZ(probe);
    const eMid = zEnergy(attr);

    inst.seek(2.6);
    const zLate = attr.getZ(probe);

    // The probed vertex's z moves between distinct frames (rolling ocean).
    expect(Math.abs(zMid - z0)).toBeGreaterThan(1e-4);
    expect(Math.abs(zLate - zMid)).toBeGreaterThan(1e-4);
    // Overall displacement energy is non-trivial and changes over time.
    expect(eMid).toBeGreaterThan(0);
    expect(Math.abs(eMid - e0)).toBeGreaterThan(1e-3);

    inst.dispose();
    // dispose restores the flat rest surface (z ~ 0 everywhere).
    expect(zEnergy(attr)).toBeLessThan(1e-4);
  });

  it('controls change output: higher choppiness means larger displacement', () => {
    const target = makeTarget(oceanFftPrimitive);
    const inst = oceanFftPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const attr = (mesh.geometry as PlaneGeometry).getAttribute(
      'position',
    ) as BufferAttribute;

    inst.setControl('choppiness', 0.1);
    inst.seek(1.0);
    const calm = zEnergy(attr);

    inst.setControl('choppiness', 2.5);
    inst.seek(1.0);
    const rough = zEnergy(attr);

    expect(rough).toBeGreaterThan(calm + 1.0);
    inst.dispose();
  });
});
