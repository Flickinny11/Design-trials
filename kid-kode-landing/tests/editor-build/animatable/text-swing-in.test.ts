import { describe, it, expect } from 'vitest';
import { Mesh, type Material, type Object3D } from 'three';
import { textSwingInPrimitive } from '@/lib/prism/animatable/primitives/text-swing-in';
import { makeTarget, runConformance } from './_conformance';

function firstGlyph(root: Object3D): Object3D {
  return root.children.length > 0 ? root.children[0] : root;
}

describe('text-swing-in primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(textSwingInPrimitive).dispose();
  });

  it('plays: glyph rotation.z oscillates and decays while opacity ramps', () => {
    const target = makeTarget(textSwingInPrimitive);
    const inst = textSwingInPrimitive.create(target);
    const root = target.subject as Object3D;
    const glyph = firstGlyph(root) as Mesh;
    const mat = glyph.material as Material & { opacity: number };
    const dur = inst.duration();

    // Early (just released): large tilt, near-invisible.
    inst.seek(dur * 0.02);
    const rotEarly = glyph.rotation.z;
    const opEarly = mat.opacity;

    // Settled end: hangs straight (rotation ~0) and fully visible.
    inst.seek(dur);
    const rotEnd = glyph.rotation.z;
    const opEnd = mat.opacity;

    // Damped swing: early tilt is large, settled tilt is ~0.
    expect(Math.abs(rotEarly)).toBeGreaterThan(Math.abs(rotEnd) + 0.1);
    expect(Math.abs(rotEnd)).toBeLessThan(0.02);
    // Opacity ramps up across the swing.
    expect(opEnd).toBeGreaterThan(opEarly);

    // Oscillation: the cosine envelope crosses through opposite-sign tilts as it
    // rings, so two distinct mid-swing samples are not monotonic in one direction.
    inst.seek(dur * 0.08);
    const a = glyph.rotation.z;
    inst.seek(dur * 0.30);
    const b = glyph.rotation.z;
    expect(a).not.toBeCloseTo(b, 3);
    inst.dispose();
  });

  it('controls change output: larger startAngleDeg means larger initial tilt', () => {
    const target = makeTarget(textSwingInPrimitive);
    const inst = textSwingInPrimitive.create(target);
    const root = target.subject as Object3D;
    const glyph = firstGlyph(root);
    const dur = inst.duration();

    inst.setControl('startAngleDeg', 20);
    inst.seek(dur * 0.02);
    const small = Math.abs(glyph.rotation.z);

    inst.setControl('startAngleDeg', 80);
    inst.seek(dur * 0.02);
    const large = Math.abs(glyph.rotation.z);

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
