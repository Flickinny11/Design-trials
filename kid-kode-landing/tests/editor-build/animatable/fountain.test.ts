import { describe, it, expect } from 'vitest';
import { Points, type BufferAttribute } from 'three';
import { fountainPrimitive } from '@/lib/prism/animatable/primitives/fountain';
import { makeTarget, runConformance } from './_conformance';

/** Read the position array of the generated Points cloud from target.object. */
function posArray(object: import('three').Object3D): Float32Array {
  const pts = object.getObjectByName('fountain-jet') as Points;
  const attr = pts.geometry.getAttribute('position') as BufferAttribute;
  return attr.array as Float32Array;
}

describe('fountain primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(fountainPrimitive).dispose();
  });

  it('plays: a particle y traces a parabola across seek times', () => {
    const target = makeTarget(fountainPrimitive);
    const inst = fountainPrimitive.create(target);
    const arr = posArray(target.object);

    // Particle 0's life = (t*RATE + offset0) mod 1. Sample three times that
    // straddle the arc; the y value must change between an early and a mid/late
    // frame (rise then fall under gravity).
    inst.seek(0);
    const y0 = arr[1];

    inst.seek(0.9);
    const yMid = arr[1];

    inst.seek(1.8);
    const yLate = arr[1];

    // y is not constant across the timeline (visible motion).
    expect(Math.abs(yMid - y0)).toBeGreaterThan(0.05);
    expect(Math.abs(yLate - yMid)).toBeGreaterThan(0.001);
    inst.dispose();
  });

  it('controls change output: larger force jets particles higher', () => {
    const target = makeTarget(fountainPrimitive);
    const inst = fountainPrimitive.create(target);
    const arr = posArray(target.object);

    // The jet's peak height (max y over the cloud) scales with the upward
    // velocity term vy*force*life, so larger force reaches higher.
    const maxY = (): number => {
      let m = -Infinity;
      for (let i = 0; i < arr.length; i += 3) if (arr[i + 1] > m) m = arr[i + 1];
      return m;
    };

    inst.setControl('force', 0.6);
    inst.seek(0.5);
    const small = maxY();

    inst.setControl('force', 4);
    inst.seek(0.5);
    const large = maxY();

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
