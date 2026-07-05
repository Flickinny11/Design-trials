import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { flip3dPrimitive } from '@/lib/prism/animatable/primitives/flip-3d';
import { makeTarget, runConformance } from './_conformance';

describe('flip-3d primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(flip3dPrimitive).dispose();
  });

  it('plays: rotation eases 0 -> PI with a scale.x foreshorten dip at midpoint', () => {
    const target = makeTarget(flip3dPrimitive);
    const inst = flip3dPrimitive.create(target);
    const subject = target.subject as Mesh;
    const dur = inst.duration();

    inst.seek(0);
    const rot0 = subject.rotation.y;
    const sx0 = subject.scale.x;

    inst.seek(dur * 0.5);
    const rotMid = subject.rotation.y;
    const sxMid = subject.scale.x;

    inst.seek(dur);
    const rotEnd = subject.rotation.y;
    const sxEnd = subject.scale.x;

    // Full half-turn: end rotation is ~PI, distinct from the start.
    expect(rotMid).toBeGreaterThan(rot0 + 0.1);
    expect(rotEnd).toBeGreaterThan(rotMid + 0.1);
    expect(rotEnd).toBeCloseTo(Math.PI, 2);

    // Foreshorten: scale.x dips near the edge-on midpoint, recovers at the end.
    expect(sxMid).toBeLessThan(sx0 - 0.3);
    expect(sxEnd).toBeCloseTo(sx0, 2);

    inst.dispose();
  });

  it('controls change output: axis dropdown picks rotation.x vs rotation.y', () => {
    const target = makeTarget(flip3dPrimitive);
    const inst = flip3dPrimitive.create(target);
    const subject = target.subject as Mesh;
    const dur = inst.duration();

    inst.setControl('axis', 'y');
    inst.seek(dur);
    const yRot = subject.rotation.y;
    const yRotX = subject.rotation.x;

    inst.dispose();

    const inst2 = flip3dPrimitive.create(target);
    inst2.setControl('axis', 'x');
    inst2.seek(dur);
    const xRotX = subject.rotation.x;

    // Y axis drives rotation.y (not .x); X axis drives rotation.x.
    expect(yRot).toBeGreaterThan(yRotX + 1);
    expect(xRotX).toBeGreaterThan(yRotX + 1);

    inst2.dispose();
  });
});
