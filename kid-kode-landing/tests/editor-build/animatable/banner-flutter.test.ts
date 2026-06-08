import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { bannerFlutterPrimitive } from '@/lib/prism/animatable/primitives/banner-flutter';
import { makeTarget, runConformance } from './_conformance';

/** Read the z of a non-top vertex (one that should displace). Returns 0 if absent. */
function sampleZ(mesh: Mesh): number {
  const pos = mesh.geometry.attributes.position as { array: Float32Array; count: number };
  // Pick a vertex near the middle of the buffer (away from the pinned top edge).
  const i = Math.floor(pos.count / 2);
  return pos.array[i * 3 + 2];
}

describe('banner-flutter primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(bannerFlutterPrimitive).dispose();
  });

  it('plays: a vertex z varies across the timeline (vertical ripple + gusts)', () => {
    const target = makeTarget(bannerFlutterPrimitive);
    const inst = bannerFlutterPrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.seek(0.0);
    const z0 = sampleZ(mesh);

    inst.seek(0.85);
    const zMid = sampleZ(mesh);

    inst.seek(2.1);
    const zLate = sampleZ(mesh);

    // The ripple displaces a mid vertex's z; distinct frames produce distinct z.
    expect(Math.abs(zMid - z0)).toBeGreaterThan(0.001);
    expect(Math.abs(zLate - zMid)).toBeGreaterThan(0.001);

    // Restores flat geometry on dispose.
    inst.dispose();
    expect(Math.abs(sampleZ(mesh))).toBeLessThan(1e-6);
  });

  it('controls change output: larger amplitude means larger displacement', () => {
    const target = makeTarget(bannerFlutterPrimitive);
    const inst = bannerFlutterPrimitive.create(target);
    const mesh = target.subject as Mesh;

    // Pick a t where sin(...) is well away from zero so amplitude is observable.
    const t = 0.5;

    inst.setControl('amplitude', 0.05);
    inst.seek(t);
    const small = Math.abs(sampleZ(mesh));

    inst.setControl('amplitude', 0.6);
    inst.seek(t);
    const large = Math.abs(sampleZ(mesh));

    expect(large).toBeGreaterThan(small + 0.01);
    inst.dispose();
  });
});
