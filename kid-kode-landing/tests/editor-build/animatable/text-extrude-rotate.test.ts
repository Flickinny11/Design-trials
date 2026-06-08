import { describe, it, expect } from 'vitest';
import { Group, Mesh } from 'three';
import { textExtrudeRotatePrimitive } from '@/lib/prism/animatable/primitives/text-extrude-rotate';
import { makeTarget, runConformance } from './_conformance';

describe('text-extrude-rotate primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(textExtrudeRotatePrimitive).dispose();
  });

  it('plays: glyphs extrude forward in Z and rotate to face viewer', () => {
    const target = makeTarget(textExtrudeRotatePrimitive);
    const inst = textExtrudeRotatePrimitive.create(target);
    const glyphs = (target.subject as Group).children as Mesh[];
    const dur = inst.duration();

    // Early frame: glyphs are far back (negative z) and turned away.
    inst.seek(dur * 0.05);
    const z0 = glyphs[0].position.z;
    const rot0 = Math.abs(glyphs[0].rotation.y);

    // Settled end: z back to ~0 and rotation back to ~0.
    inst.seek(dur);
    const zEnd = glyphs[0].position.z;
    const rotEnd = Math.abs(glyphs[0].rotation.y);

    // position.z moves forward (more negative early -> ~0 settled).
    expect(zEnd).toBeGreaterThan(z0 + 1);
    // rotation.y unwinds toward facing the viewer.
    expect(rot0).toBeGreaterThan(rotEnd + 0.1);

    inst.dispose();
  });

  it('controls change output: larger depth means farther initial Z', () => {
    const target = makeTarget(textExtrudeRotatePrimitive);
    const inst = textExtrudeRotatePrimitive.create(target);
    const glyphs = (target.subject as Group).children as Mesh[];

    inst.setControl('depth', 2);
    inst.seek(0);
    const shallow = glyphs[0].position.z;

    inst.setControl('depth', 10);
    inst.seek(0);
    const deep = glyphs[0].position.z;

    // Deeper extrude starts farther back (more negative Z).
    expect(shallow).toBeGreaterThan(deep + 1);

    inst.dispose();
  });
});
