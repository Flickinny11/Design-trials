import { describe, it, expect } from 'vitest';
import { Group, Mesh, type Material } from 'three';
import { textBlurInPrimitive } from '@/lib/prism/animatable/primitives/text-blur-in';
import { makeTarget, runConformance } from './_conformance';

function glyphScale(target: ReturnType<typeof makeTarget>, i: number): number {
  const root = target.subject as Group;
  return root.children[i].scale.x;
}

function glyphOpacity(target: ReturnType<typeof makeTarget>, i: number): number {
  const root = target.subject as Group;
  const mesh = root.children[i] as Mesh;
  return (mesh.material as Material & { opacity: number }).opacity;
}

describe('text-blur-in primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(textBlurInPrimitive).dispose();
  });

  it('plays: glyphs resolve from overscaled + faded to crisp in sequence', () => {
    const target = makeTarget(textBlurInPrimitive);
    const inst = textBlurInPrimitive.create(target);
    const dur = inst.duration();
    const root = target.subject as Group;
    expect(root.children.length).toBeGreaterThan(1);

    // first glyph (i=0) starts resolving immediately: blurred = overscaled + low opacity
    inst.seek(0);
    const scaleEarly = glyphScale(target, 0);
    const opEarly = glyphOpacity(target, 0);

    inst.seek(dur);
    const scaleSettled = glyphScale(target, 0);
    const opSettled = glyphOpacity(target, 0);

    // overscale (~1.3) resolves down to crisp (1)
    expect(scaleEarly).toBeGreaterThan(scaleSettled + 0.1);
    expect(scaleSettled).toBeCloseTo(1, 5);
    // opacity rises from soft/low to full
    expect(opSettled).toBeGreaterThan(opEarly + 0.3);
    expect(opSettled).toBeCloseTo(1, 5);

    // staggered sequence: at a mid frame an early glyph has resolved further
    // (lower scale / crisper) than a later glyph that hasn't started yet.
    inst.seek(dur * 0.35);
    const last = root.children.length - 1;
    expect(glyphScale(target, 0)).toBeLessThan(glyphScale(target, last) + 1e-6);
    expect(glyphOpacity(target, 0)).toBeGreaterThan(glyphOpacity(target, last) - 1e-6);

    inst.dispose();
    // dispose restores all glyphs to base scale + full opacity
    expect(glyphScale(target, 0)).toBeCloseTo(1, 5);
    expect(glyphOpacity(target, 0)).toBe(1);
  });

  it('controls change output: larger blurAmount means a larger initial overscale', () => {
    const target = makeTarget(textBlurInPrimitive);
    const inst = textBlurInPrimitive.create(target);

    inst.setControl('blurAmount', 0.05);
    inst.seek(0);
    const small = glyphScale(target, 0);

    inst.setControl('blurAmount', 0.4);
    inst.seek(0);
    const large = glyphScale(target, 0);

    expect(large).toBeGreaterThan(small + 0.05);
    inst.dispose();
  });
});
