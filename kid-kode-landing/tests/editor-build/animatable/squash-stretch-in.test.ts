import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { squashStretchInPrimitive } from '@/lib/prism/animatable/primitives/squash-stretch-in';
import { makeTarget, runConformance } from './_conformance';

describe('squash-stretch-in primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(squashStretchInPrimitive).dispose();
  });

  it('plays: squashes (scale.x and scale.y inversely related), then settles to 1', () => {
    const target = makeTarget(squashStretchInPrimitive);
    const inst = squashStretchInPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const dur = inst.duration();
    const baseSX = mesh.scale.x;
    const baseSY = mesh.scale.y;

    // Mid-squash frame (within 0..0.3 of the timeline): y dips, x widens.
    inst.seek(dur * 0.25);
    const midSX = mesh.scale.x;
    const midSY = mesh.scale.y;

    // y squashed below base, x stretched above base — inversely related.
    expect(midSY).toBeLessThan(baseSY - 0.1);
    expect(midSX).toBeGreaterThan(baseSX + 0.1);

    // Settled end: both scales return to ~base (identity factor).
    inst.seek(dur);
    expect(mesh.scale.x).toBeCloseTo(baseSX, 2);
    expect(mesh.scale.y).toBeCloseTo(baseSY, 2);

    inst.dispose();
    expect(mesh.scale.x).toBeCloseTo(baseSX, 5);
    expect(mesh.scale.y).toBeCloseTo(baseSY, 5);
  });

  it('controls change output: deeper squash means a lower y-scale dip', () => {
    const target = makeTarget(squashStretchInPrimitive);
    const inst = squashStretchInPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const dur = inst.duration();
    const baseSY = mesh.scale.y;

    // Shallow squash (knob 0.2 → y floor ~0.8).
    inst.setControl('squash', 0.2);
    inst.seek(dur * 0.3);
    const shallow = mesh.scale.y / baseSY;

    // Deep squash (knob 0.6 → y floor ~0.4).
    inst.setControl('squash', 0.6);
    inst.seek(dur * 0.3);
    const deep = mesh.scale.y / baseSY;

    // Deeper squash → lower y-scale.
    expect(deep).toBeLessThan(shallow - 0.1);
    inst.dispose();
  });
});
