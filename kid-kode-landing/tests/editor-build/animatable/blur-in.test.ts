import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { blurInPrimitive } from '@/lib/prism/animatable/primitives/blur-in';
import { makeTarget, runConformance } from './_conformance';

describe('blur-in primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(blurInPrimitive).dispose();
  });

  it('plays: opacity resolves 0 to 1 and scale shrinks toward 1', () => {
    const target = makeTarget(blurInPrimitive);
    const inst = blurInPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const a = mat.opacity;
    const scaleStart = mesh.scale.x;

    inst.seek(dur);
    const b = mat.opacity;
    const scaleEnd = mesh.scale.x;

    // Opacity rises across the timeline by more than 0.5.
    expect(a).toBeLessThan(0.1);
    expect(b).toBeGreaterThan(0.9);
    expect(b - a).toBeGreaterThan(0.5);

    // Scale shrinks toward 1 (starts > 1, ends ~1).
    expect(scaleStart).toBeGreaterThan(1.0);
    expect(scaleEnd).toBeCloseTo(1.0, 2);
    expect(scaleEnd).toBeLessThan(scaleStart);

    inst.dispose();
  });

  it('controls change output: amount drives jitter amplitude', () => {
    const target = makeTarget(blurInPrimitive);
    const inst = blurInPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const dur = inst.duration();

    // With amount 0, mid-timeline position jitter must be zero.
    inst.setControl('amount', 0);
    inst.seek(dur * 0.5);
    expect(mesh.position.x).toBeCloseTo(0, 6);
    expect(mesh.position.y).toBeCloseTo(0, 6);

    // With a high amount, mid-timeline jitter is non-zero on at least one axis.
    inst.setControl('amount', 1);
    inst.seek(dur * 0.5);
    const off = Math.abs(mesh.position.x) + Math.abs(mesh.position.y);
    expect(off).toBeGreaterThan(0);

    inst.dispose();
  });
});
