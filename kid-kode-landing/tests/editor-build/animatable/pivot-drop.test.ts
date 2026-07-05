import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { pivotDropPrimitive } from '@/lib/prism/animatable/primitives/pivot-drop';
import { makeTarget, runConformance } from './_conformance';

describe('pivot-drop primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(pivotDropPrimitive).dispose();
  });

  it('plays: rotation.x eases from a steep start toward 0', () => {
    const target = makeTarget(pivotDropPrimitive);
    const inst = pivotDropPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const dur = inst.duration();

    inst.seek(0);
    const rot0 = mesh.rotation.x; // steep, negative (face up)

    inst.seek(dur * 0.5);
    const rotMid = mesh.rotation.x;

    inst.seek(dur);
    const rotEnd = mesh.rotation.x; // settled ~0

    // Start is a meaningful negative angle (face up at top hinge).
    expect(rot0).toBeLessThan(-1.0);
    // Mid frame differs from both ends — genuine motion.
    expect(Math.abs(rotMid - rot0)).toBeGreaterThan(0.1);
    expect(Math.abs(rotMid - rotEnd)).toBeGreaterThan(0.1);
    // Settles close to flat by the end.
    expect(Math.abs(rotEnd)).toBeLessThan(0.05);
    inst.dispose();
  });

  it('overshoots near the end with an elastic settle curve', () => {
    const target = makeTarget(pivotDropPrimitive);
    const inst = pivotDropPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const dur = inst.duration();

    inst.setControl('settle', 'elasticOut');
    // Sample the back half of the timeline; an overshooting curve drives
    // rotation.x past 0 (positive) before settling.
    let maxRot = -Infinity;
    for (let i = 5; i <= 10; i++) {
      inst.seek((i / 10) * dur);
      maxRot = Math.max(maxRot, mesh.rotation.x);
    }
    expect(maxRot).toBeGreaterThan(0.0001);
    inst.dispose();
  });

  it('controls change output: larger start angle means steeper initial rotation', () => {
    const target = makeTarget(pivotDropPrimitive);
    const inst = pivotDropPrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('startAngleDeg', 60);
    inst.seek(0);
    const shallow = Math.abs(mesh.rotation.x);

    inst.setControl('startAngleDeg', 120);
    inst.seek(0);
    const steep = Math.abs(mesh.rotation.x);

    expect(steep).toBeGreaterThan(shallow + 0.3);
    inst.dispose();
  });
});
