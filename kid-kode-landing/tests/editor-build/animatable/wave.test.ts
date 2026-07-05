import { describe, it, expect } from 'vitest';
import { Mesh, type BufferAttribute } from 'three';
import { wavePrimitive } from '@/lib/prism/animatable/primitives/wave';
import { makeTarget, runConformance } from './_conformance';

describe('wave primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(wavePrimitive).dispose();
  });

  it('plays: a mid vertex z differs between t=0 and t=0.5', () => {
    const target = makeTarget(wavePrimitive);
    const inst = wavePrimitive.create(target);
    const geom = (target.subject as Mesh).geometry;
    const pos = geom.getAttribute('position') as BufferAttribute;
    const mid = Math.floor(pos.count / 2);

    inst.seek(0);
    const z0 = pos.getZ(mid);
    inst.seek(0.5);
    const z1 = pos.getZ(mid);

    expect(Math.abs(z1 - z0)).toBeGreaterThan(0.01);
    inst.dispose();
  });

  it('controls change output: amplitude scales the displacement', () => {
    const target = makeTarget(wavePrimitive);
    const inst = wavePrimitive.create(target);
    const geom = (target.subject as Mesh).geometry;
    const pos = geom.getAttribute('position') as BufferAttribute;

    const totalAbsZ = () => {
      let sum = 0;
      for (let i = 0; i < pos.count; i++) sum += Math.abs(pos.getZ(i));
      return sum;
    };

    inst.setControl('amplitude', 0.5);
    inst.seek(0.25);
    const big = totalAbsZ();
    inst.setControl('amplitude', 0.05);
    inst.seek(0.25);
    const small = totalAbsZ();

    expect(big).toBeGreaterThan(small);
    inst.dispose();
  });
});
