import { describe, it, expect } from 'vitest';
import { Object3D } from 'three';
import { flipBoardPrimitive } from '@/lib/prism/animatable/primitives/flip-board';
import { makeTarget, runConformance } from './_conformance';

describe('flip-board primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(flipBoardPrimitive).dispose();
  });

  it('plays: rotation.x steps from start angle toward flat (0)', () => {
    const target = makeTarget(flipBoardPrimitive);
    const inst = flipBoardPrimitive.create(target);
    const subject = (target.subject ?? target.object) as Object3D;
    const dur = inst.duration();

    inst.seek(0);
    const rot0 = subject.rotation.x;

    inst.seek(dur * 0.5);
    const rotMid = subject.rotation.x;

    inst.seek(dur);
    const rotEnd = subject.rotation.x;

    // starts tilted (non-zero), ends flat (~0)
    expect(Math.abs(rot0)).toBeGreaterThan(0.5);
    expect(Math.abs(rotEnd)).toBeLessThan(1e-6);
    // mid-frame is between start and end — distinct from both
    expect(Math.abs(rotMid)).toBeLessThan(Math.abs(rot0));
    expect(Math.abs(rotMid)).toBeGreaterThan(Math.abs(rotEnd));
    inst.dispose();
  });

  it('steps in quantized increments, not continuously', () => {
    const target = makeTarget(flipBoardPrimitive);
    const inst = flipBoardPrimitive.create(target);
    const subject = (target.subject ?? target.object) as Object3D;
    const dur = inst.duration();

    inst.setControl('flaps', 4);
    // Sample the start of two adjacent flaps; floor() means the integer step
    // boundary produces a discrete plateau distinct from a continuous ramp.
    const samples: number[] = [];
    for (let i = 0; i <= 20; i++) {
      inst.seek((i / 20) * dur);
      samples.push(subject.rotation.x);
    }
    // There must be at least one pair of adjacent samples that are (nearly)
    // equal — a continuous flip would change on every sample.
    let plateaus = 0;
    for (let i = 1; i < samples.length; i++) {
      if (Math.abs(samples[i] - samples[i - 1]) < 1e-4) plateaus++;
    }
    expect(plateaus).toBeGreaterThan(0);
    inst.dispose();
  });

  it('controls change output: startAngle sets initial tilt magnitude', () => {
    const target = makeTarget(flipBoardPrimitive);
    const inst = flipBoardPrimitive.create(target);
    const subject = (target.subject ?? target.object) as Object3D;

    inst.setControl('startAngleDeg', 60);
    inst.seek(0);
    const small = Math.abs(subject.rotation.x);

    inst.setControl('startAngleDeg', 180);
    inst.seek(0);
    const large = Math.abs(subject.rotation.x);

    expect(large).toBeGreaterThan(small + 0.5);
    inst.dispose();
  });
});
