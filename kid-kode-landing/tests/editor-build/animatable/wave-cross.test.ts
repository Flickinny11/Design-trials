import { describe, it, expect } from 'vitest';
import { Mesh, BufferGeometry, type BufferAttribute } from 'three';
import { waveCrossPrimitive } from '@/lib/prism/animatable/primitives/wave-cross';
import { makeTarget, runConformance } from './_conformance';

/** Sum of |z| across all vertices — a single scalar that captures surface displacement. */
function zEnergy(mesh: Mesh): number {
  const posAttr = (mesh.geometry as BufferGeometry).getAttribute('position') as BufferAttribute;
  let sum = 0;
  for (let i = 0; i < posAttr.count; i++) sum += Math.abs(posAttr.getZ(i));
  return sum;
}

describe('wave-cross primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(waveCrossPrimitive).dispose();
  });

  it('plays: a vertex z varies across time (crossing waves animate)', () => {
    const target = makeTarget(waveCrossPrimitive);
    const inst = waveCrossPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const posAttr = (mesh.geometry as BufferGeometry).getAttribute('position') as BufferAttribute;

    // Looping/stateful primitive → duration is Infinity; pick distinct t values.
    expect(inst.duration()).toBe(Infinity);

    inst.seek(0.0);
    const energy0 = zEnergy(mesh);
    // A representative interior vertex's z at t=0.
    const probe = Math.floor(posAttr.count * 0.37);
    const z0 = posAttr.getZ(probe);

    inst.seek(0.9);
    const energyMid = zEnergy(mesh);
    const zMid = posAttr.getZ(probe);

    // The surface is genuinely displaced (not flat).
    expect(energy0).toBeGreaterThan(0.5);
    // And the displacement field has moved: total energy and the probe vertex
    // both change between frames.
    expect(Math.abs(energyMid - energy0)).toBeGreaterThan(0.01);
    expect(Math.abs(zMid - z0)).toBeGreaterThan(1e-4);

    inst.dispose();
    // dispose restores the flat base plane (z ≈ 0 everywhere).
    expect(zEnergy(mesh)).toBeLessThan(1e-4);
  });

  it('controls change output: amplitude scales surface displacement', () => {
    const target = makeTarget(waveCrossPrimitive);
    const inst = waveCrossPrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('amplitude', 0.02);
    inst.seek(0.6);
    const low = zEnergy(mesh);

    inst.setControl('amplitude', 0.5);
    inst.seek(0.6);
    const high = zEnergy(mesh);

    expect(high).toBeGreaterThan(low + 0.5);
    inst.dispose();
  });
});
