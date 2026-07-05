import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { scalePopPrimitive } from '@/lib/prism/animatable/primitives/scale-pop';
import { makeTarget, runConformance } from './_conformance';

describe('scale-pop primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scalePopPrimitive).dispose();
  });

  it('plays: scale grows from startScale toward 1 across the timeline', () => {
    const target = makeTarget(scalePopPrimitive);
    const inst = scalePopPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const dur = inst.duration();
    inst.seek(0);
    const a = mesh.scale.x;
    inst.seek(dur);
    const b = mesh.scale.x;
    // start ~ startScale (0.2), end ~ 1 — assert they differ by > 0.3.
    expect(b - a).toBeGreaterThan(0.3);
    expect(a).toBeLessThan(0.5);
    expect(b).toBeGreaterThan(0.9);
    inst.dispose();
  });

  it('controls change output: a larger startScale lifts the initial scale', () => {
    const target = makeTarget(scalePopPrimitive);
    const inst = scalePopPrimitive.create(target);
    const mesh = target.subject as Mesh;
    inst.seek(0);
    const lowStart = mesh.scale.x;
    inst.setControl('startScale', 0.8);
    inst.seek(0);
    const highStart = mesh.scale.x;
    expect(highStart).toBeGreaterThan(lowStart);
    inst.dispose();
  });
});
