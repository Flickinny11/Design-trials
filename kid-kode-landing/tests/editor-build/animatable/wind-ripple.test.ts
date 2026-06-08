import { describe, it, expect } from 'vitest';
import { Mesh, PlaneGeometry, type BufferAttribute } from 'three';
import { windRipplePrimitive } from '@/lib/prism/animatable/primitives/wind-ripple';
import { makeTarget, runConformance } from './_conformance';

// Snapshot the full z column of the plane's position attribute.
function zColumn(mesh: Mesh): Float32Array {
  const attr = (mesh.geometry as PlaneGeometry).attributes.position as BufferAttribute;
  const out = new Float32Array(attr.count);
  for (let i = 0; i < attr.count; i++) out[i] = attr.getZ(i);
  return out;
}

// Sum of |z| — total displacement magnitude across the surface.
function totalAbsZ(mesh: Mesh): number {
  const z = zColumn(mesh);
  let s = 0;
  for (let i = 0; i < z.length; i++) s += Math.abs(z[i]);
  return s;
}

describe('wind-ripple primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(windRipplePrimitive).dispose();
  });

  it('plays: vertex displacement changes over time and the gust band moves', () => {
    const target = makeTarget(windRipplePrimitive);
    const inst = windRipplePrimitive.create(target);
    const mesh = target.subject as Mesh;

    // Two distinct frames of a looping effect.
    inst.seek(0.4);
    const early = zColumn(mesh);

    inst.seek(1.6);
    const mid = zColumn(mesh);

    // The displacement field is non-trivial (the surface actually ripples).
    let earlyMag = 0;
    for (let i = 0; i < early.length; i++) earlyMag += Math.abs(early[i]);
    expect(earlyMag).toBeGreaterThan(0.05);

    // The field is different between the two frames (band swept + ripple moved).
    let diff = 0;
    for (let i = 0; i < early.length; i++) diff += Math.abs(early[i] - mid[i]);
    expect(diff).toBeGreaterThan(0.05);

    inst.dispose();
  });

  it('restores base z on dispose', () => {
    const target = makeTarget(windRipplePrimitive);
    const inst = windRipplePrimitive.create(target);
    const mesh = target.subject as Mesh;

    const base = zColumn(mesh);
    inst.seek(1.1);
    inst.dispose();
    const after = zColumn(mesh);

    let diff = 0;
    for (let i = 0; i < base.length; i++) diff += Math.abs(base[i] - after[i]);
    expect(diff).toBeLessThan(1e-5);
  });

  it('controls change output: larger amplitude means more total displacement', () => {
    const target = makeTarget(windRipplePrimitive);
    const inst = windRipplePrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('amplitude', 0.04);
    inst.seek(0.7);
    const small = totalAbsZ(mesh);

    inst.setControl('amplitude', 0.6);
    inst.seek(0.7);
    const large = totalAbsZ(mesh);

    expect(large).toBeGreaterThan(small + 0.1);
    inst.dispose();
  });
});
