import { describe, it, expect } from 'vitest';
import { Mesh, type Material, type Object3D } from 'three';
import { textPerspectiveInPrimitive } from '@/lib/prism/animatable/primitives/text-perspective-in';
import { makeTarget, runConformance } from './_conformance';

function firstGlyphMat(root: Object3D): Material & { opacity: number } {
  const glyph = root.children[0] ?? root;
  const m = (glyph as Mesh).material;
  const mat = Array.isArray(m) ? m[0] : m;
  return mat as Material & { opacity: number };
}

describe('text-perspective-in primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(textPerspectiveInPrimitive).dispose();
  });

  it('plays: group rotation.x falls from tilt to ~0 and glyph opacity rises', () => {
    const target = makeTarget(textPerspectiveInPrimitive);
    const inst = textPerspectiveInPrimitive.create(target);
    const root = target.subject as Object3D;
    const mat = firstGlyphMat(root);
    const dur = inst.duration();

    inst.seek(0);
    const rot0 = root.rotation.x;
    const op0 = mat.opacity;

    inst.seek(dur);
    const rotEnd = root.rotation.x;
    const opEnd = mat.opacity;

    // Tilt resolves: starts tilted, ends ~flat.
    expect(rot0).toBeGreaterThan(rotEnd + 0.3);
    expect(Math.abs(rotEnd)).toBeLessThan(0.01);
    // First glyph opacity rises across the timeline.
    expect(opEnd).toBeGreaterThan(op0);
    inst.dispose();
  });

  it('controls change output: larger tiltDeg means larger initial rotation.x', () => {
    const target = makeTarget(textPerspectiveInPrimitive);
    const inst = textPerspectiveInPrimitive.create(target);
    const root = target.subject as Object3D;

    inst.setControl('tiltDeg', 30);
    inst.seek(0);
    const small = root.rotation.x;

    inst.setControl('tiltDeg', 80);
    inst.seek(0);
    const large = root.rotation.x;

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
