import { describe, it, expect } from 'vitest';
import { Group, Mesh, type Material } from 'three';
import { textMagneticInPrimitive } from '@/lib/prism/animatable/primitives/text-magnetic-in';
import { makeTarget, runConformance } from './_conformance';

describe('text-magnetic-in primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(textMagneticInPrimitive).dispose();
  });

  it('plays: a glyph converges from scattered offset to its rest slot', () => {
    const target = makeTarget(textMagneticInPrimitive);
    const root = target.subject as Group;
    const glyph = root.children[0] as Mesh;
    const restX = glyph.position.x;
    const restY = glyph.position.y;
    const mat = (glyph.material as Material & { opacity: number });

    const inst = textMagneticInPrimitive.create(target);
    const dur = inst.duration();

    inst.seek(0);
    const offset0 = Math.hypot(glyph.position.x - restX, glyph.position.y - restY);
    const op0 = mat.opacity;

    inst.seek(dur);
    const offsetEnd = Math.hypot(glyph.position.x - restX, glyph.position.y - restY);
    const opEnd = mat.opacity;

    // starts scattered far from rest, ends snapped onto the rest slot
    expect(offset0).toBeGreaterThan(offsetEnd + 0.5);
    expect(offsetEnd).toBeLessThan(0.01);
    // opacity ramps in across the phase
    expect(opEnd).toBeGreaterThan(op0);
    inst.dispose();
  });

  it('controls change output: larger scatter means larger initial offset', () => {
    const target = makeTarget(textMagneticInPrimitive);
    const root = target.subject as Group;
    const glyph = root.children[0] as Mesh;
    const restX = glyph.position.x;
    const restY = glyph.position.y;

    const inst = textMagneticInPrimitive.create(target);

    inst.setControl('scatter', 1);
    inst.seek(0);
    const small = Math.hypot(glyph.position.x - restX, glyph.position.y - restY);

    inst.setControl('scatter', 6);
    inst.seek(0);
    const large = Math.hypot(glyph.position.x - restX, glyph.position.y - restY);

    expect(large).toBeGreaterThan(small + 0.5);
    inst.dispose();
  });
});
