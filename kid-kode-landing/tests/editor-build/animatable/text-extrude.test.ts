import { describe, it, expect } from 'vitest';
import { Group, type Object3D } from 'three';
import { textExtrudePrimitive } from '@/lib/prism/animatable/primitives/text-extrude';
import { makeTarget, runConformance } from './_conformance';

function glyphsOf(root: Object3D): Object3D[] {
  return root.children.length > 0 ? [...root.children] : [root];
}

describe('text-extrude primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(textExtrudePrimitive).dispose();
  });

  it('plays: glyph position.z grows from 0 across the timeline', () => {
    const target = makeTarget(textExtrudePrimitive);
    const inst = textExtrudePrimitive.create(target);
    const glyphs = glyphsOf(target.subject as Group);
    const last = glyphs[glyphs.length - 1];
    const baseZ = last.position.z;
    const dur = inst.duration();

    inst.seek(0);
    const z0 = last.position.z - baseZ;

    inst.seek(dur);
    const zEnd = last.position.z - baseZ;

    // at t=0 the last glyph hasn't punched forward; at the end it has full depth.
    expect(z0).toBeLessThan(0.01);
    expect(zEnd).toBeGreaterThan(z0 + 0.3);
    inst.dispose();

    // dispose restores base z exactly.
    expect(last.position.z).toBeCloseTo(baseZ, 6);
  });

  it('controls change output: larger depth means larger settled z', () => {
    const target = makeTarget(textExtrudePrimitive);
    const inst = textExtrudePrimitive.create(target);
    const glyphs = glyphsOf(target.subject as Group);
    const last = glyphs[glyphs.length - 1];
    const baseZ = last.position.z;
    const dur = inst.duration();

    inst.setControl('depth', 0.2);
    inst.seek(dur);
    const small = last.position.z - baseZ;

    inst.setControl('depth', 2.5);
    inst.seek(dur);
    const large = last.position.z - baseZ;

    expect(large).toBeGreaterThan(small + 0.5);
    inst.dispose();
  });
});
