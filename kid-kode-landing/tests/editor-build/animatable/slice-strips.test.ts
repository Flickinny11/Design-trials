import { describe, it, expect } from 'vitest';
import { Group, Mesh, type Material } from 'three';
import { sliceStripsPrimitive } from '@/lib/prism/animatable/primitives/slice-strips';
import { makeTarget, runConformance } from './_conformance';

/** Find the strip-group container the primitive builds into target.object. */
function stripsOf(object: Group): Mesh[] {
  const grp = object.getObjectByName('slice-strips') as Group | undefined;
  if (!grp) return [];
  return grp.children.filter((c): c is Mesh => (c as Mesh).isMesh && c.visible);
}

describe('slice-strips primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(sliceStripsPrimitive).dispose();
  });

  it('plays: a strip position.x converges to 0 across the phase', () => {
    const target = makeTarget(sliceStripsPrimitive);
    const inst = sliceStripsPrimitive.create(target);
    const dur = inst.duration();

    inst.seek(0);
    const early = stripsOf(target.object as Group);
    expect(early.length).toBeGreaterThan(0);
    // Pick the first strip (even index → starts on the -x side).
    const earlyX = early[0].position.x;
    const earlyOpacity = (early[0].material as Material & { opacity: number }).opacity;

    inst.seek(dur);
    const settled = stripsOf(target.object as Group);
    const settledX = settled[0].position.x;
    const settledOpacity = (settled[0].material as Material & { opacity: number }).opacity;

    // Strip slid in: |x| was large at start, ~0 at end.
    expect(Math.abs(earlyX)).toBeGreaterThan(Math.abs(settledX) + 0.5);
    expect(Math.abs(settledX)).toBeLessThan(0.05);
    // Opacity ramps in.
    expect(settledOpacity).toBeGreaterThan(earlyOpacity);
    inst.dispose();
  });

  it('controls change output: larger offset means larger initial displacement', () => {
    const target = makeTarget(sliceStripsPrimitive);
    const inst = sliceStripsPrimitive.create(target);

    inst.setControl('offset', 1);
    inst.seek(0);
    const small = Math.abs(stripsOf(target.object as Group)[0].position.x);

    inst.setControl('offset', 6);
    inst.seek(0);
    const large = Math.abs(stripsOf(target.object as Group)[0].position.x);

    expect(large).toBeGreaterThan(small + 1);
    inst.dispose();
  });
});
