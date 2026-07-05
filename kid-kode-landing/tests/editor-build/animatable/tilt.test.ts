import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { tiltPrimitive } from '@/lib/prism/animatable/primitives/tilt';
import { makeTarget, runConformance } from './_conformance';

describe('tilt primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(tiltPrimitive).dispose();
  });

  it('plays: opposite pointer x gives opposite-sign rotation.y', () => {
    // Positive pointer x.
    const tA = makeTarget(tiltPrimitive);
    const instA = tiltPrimitive.create(tA);
    const subjA = tA.subject as Mesh;
    tA.userData.pointer = { x: 1, y: 0 };
    for (let i = 0; i < 10; i++) instA.seek(i * 0.1);
    const ry = subjA.rotation.y;

    // Negative pointer x.
    const tB = makeTarget(tiltPrimitive);
    const instB = tiltPrimitive.create(tB);
    const subjB = tB.subject as Mesh;
    tB.userData.pointer = { x: -1, y: 0 };
    for (let i = 0; i < 10; i++) instB.seek(i * 0.1);
    const ryNeg = subjB.rotation.y;

    expect(ry).toBeGreaterThan(0);
    expect(ryNeg).toBeLessThan(0);
    expect(ry - ryNeg).toBeGreaterThan(0.05);

    instA.dispose();
    instB.dispose();
  });

  it('controls change output: maxTiltDeg=0 yields ~no rotation', () => {
    const t = makeTarget(tiltPrimitive);
    const inst = tiltPrimitive.create(t);
    const subj = t.subject as Mesh;
    inst.setControl('maxTiltDeg', 0);
    t.userData.pointer = { x: 1, y: 0 };
    for (let i = 0; i < 10; i++) inst.seek(i * 0.1);
    expect(Math.abs(subj.rotation.y)).toBeLessThan(0.001);
    inst.dispose();
  });
});
