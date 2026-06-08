import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { pendulumSettlePrimitive } from '@/lib/prism/animatable/primitives/pendulum-settle';
import { makeTarget, runConformance } from './_conformance';

describe('pendulum-settle primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(pendulumSettlePrimitive).dispose();
  });

  it('plays: rotation.z oscillates (sign flips) and decays to ~0', () => {
    const target = makeTarget(pendulumSettlePrimitive);
    const inst = pendulumSettlePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const dur = inst.duration();

    inst.seek(0);
    const startRot = mesh.rotation.z;

    // Sample early frames within the first swing to catch a sign flip. With
    // default swings=3, the carrier cos(p*3*PI) crosses zero quickly, so an
    // early frame past the first quarter-period has opposite sign to t=0.
    inst.seek(dur * 0.18);
    const earlyRot = mesh.rotation.z;

    inst.seek(dur);
    const endRot = mesh.rotation.z;

    // Starts at a large angle.
    expect(Math.abs(startRot)).toBeGreaterThan(0.3);
    // Oscillates: an early frame has opposite sign to the start.
    expect(Math.sign(earlyRot)).toBe(-Math.sign(startRot));
    // Decays to ~square at the end.
    expect(Math.abs(endRot)).toBeLessThan(0.01);
    inst.dispose();
  });

  it('controls change output: larger start angle means larger initial swing', () => {
    const target = makeTarget(pendulumSettlePrimitive);
    const inst = pendulumSettlePrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('startAngleDeg', 20);
    inst.seek(0);
    const small = Math.abs(mesh.rotation.z);

    inst.setControl('startAngleDeg', 80);
    inst.seek(0);
    const large = Math.abs(mesh.rotation.z);

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
