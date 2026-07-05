import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { dissolveToDustPrimitive } from '@/lib/prism/animatable/primitives/dissolve-to-dust';
import { makeTarget, runConformance } from './_conformance';

describe('dissolve-to-dust primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(dissolveToDustPrimitive).dispose();
  });

  it('plays: glyphs fade out and scatter outward across the timeline', () => {
    const target = makeTarget(dissolveToDustPrimitive);
    const inst = dissolveToDustPrimitive.create(target);
    const glyph = target.subject!.children[0] as Mesh;
    const mat = glyph.material as Material & { opacity: number };
    const rest = glyph.position.clone();
    const dur = inst.duration();

    inst.seek(0);
    const op0 = mat.opacity;
    const distStart = glyph.position.distanceTo(rest);

    inst.seek(dur);
    const op1 = mat.opacity;
    const distEnd = glyph.position.distanceTo(rest);

    // Opacity ~1 at t=0, ~0 at t=duration (drops > 0.5).
    expect(op0).toBeGreaterThan(0.95);
    expect(op1).toBeLessThan(0.05);
    expect(op0 - op1).toBeGreaterThan(0.5);
    // Position magnitude grows outward.
    expect(distEnd).toBeGreaterThan(distStart);
    expect(distEnd).toBeGreaterThan(0.1);
    // Scale shrinks toward zero.
    expect(glyph.scale.x).toBeLessThan(0.05);

    inst.dispose();
    // dispose restores rest state.
    expect(mat.opacity).toBeGreaterThan(0.95);
    expect(glyph.position.distanceTo(rest)).toBeLessThan(1e-6);
    expect(glyph.scale.x).toBeCloseTo(1, 5);
  });

  it('controls change output: spread scales the scatter distance', () => {
    const target = makeTarget(dissolveToDustPrimitive);
    const inst = dissolveToDustPrimitive.create(target);
    const glyph = target.subject!.children[0] as Mesh;
    const rest = glyph.position.clone();
    const dur = inst.duration();

    inst.setControl('spread', 3);
    inst.seek(dur);
    const wide = glyph.position.distanceTo(rest);

    inst.setControl('spread', 0.5);
    inst.seek(dur);
    const narrow = glyph.position.distanceTo(rest);

    expect(wide).toBeGreaterThan(narrow);
    inst.dispose();
  });
});
