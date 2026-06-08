import { describe, it, expect } from 'vitest';
import { Mesh, type BufferAttribute } from 'three';
import { rippleInterferencePrimitive } from '@/lib/prism/animatable/primitives/ripple-interference';
import { makeTarget, runConformance } from './_conformance';

describe('ripple-interference primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(rippleInterferencePrimitive).dispose();
  });

  it('plays: a vertex z varies across the timeline', () => {
    const target = makeTarget(rippleInterferencePrimitive);
    const inst = rippleInterferencePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const pos = mesh.geometry.getAttribute('position') as BufferAttribute;

    // Sample a vertex away from the central nodal axis so displacement is clear.
    const idx = Math.floor(pos.count * 0.37);

    inst.seek(0);
    const z0 = pos.getZ(idx);

    inst.seek(0.6);
    const zMid = pos.getZ(idx);

    inst.seek(1.3);
    const zLate = pos.getZ(idx);

    // Mid frame differs from t=0, and late differs from mid: continuous motion.
    expect(Math.abs(zMid - z0)).toBeGreaterThan(1e-4);
    expect(Math.abs(zLate - zMid)).toBeGreaterThan(1e-4);
    inst.dispose();
  });

  it('controls change output: higher frequency reshapes the displacement field', () => {
    const target = makeTarget(rippleInterferencePrimitive);
    const inst = rippleInterferencePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const pos = mesh.geometry.getAttribute('position') as BufferAttribute;

    // Sum of |z| across the surface is a stable scalar signature of the field;
    // changing freq across extremes must change it.
    const surfaceEnergy = (): number => {
      let e = 0;
      for (let i = 0; i < pos.count; i++) e += Math.abs(pos.getZ(i));
      return e;
    };

    inst.setControl('freq', 6);
    inst.seek(0.5);
    const low = surfaceEnergy();

    inst.setControl('freq', 24);
    inst.seek(0.5);
    const high = surfaceEnergy();

    expect(Math.abs(high - low)).toBeGreaterThan(1e-3);
    inst.dispose();
  });
});
