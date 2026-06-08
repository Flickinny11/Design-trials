import { describe, it, expect } from 'vitest';
import { Mesh, BufferGeometry, type BufferAttribute } from 'three';
import { flagWavePrimitive } from '@/lib/prism/animatable/primitives/flag-wave';
import { makeTarget, runConformance } from './_conformance';

// Sample the z of a vertex near the free right edge (largest amplitude),
// where flag motion is most pronounced. Falls back to whichever vertex has
// the largest base x.
function rightEdgeVertexIndex(posAttr: BufferAttribute): number {
  let best = 0;
  let bestX = -Infinity;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    if (x > bestX) {
      bestX = x;
      best = i;
    }
  }
  return best;
}

describe('flag-wave primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(flagWavePrimitive).dispose();
  });

  it('plays: a right-edge vertex z differs between t=0 and t=mid', () => {
    const target = makeTarget(flagWavePrimitive);
    const inst = flagWavePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const geom = mesh.geometry as BufferGeometry;
    const posAttr = geom.getAttribute('position') as BufferAttribute;
    const idx = rightEdgeVertexIndex(posAttr);

    inst.seek(0);
    const z0 = posAttr.getZ(idx);

    inst.seek(0.7);
    const zMid = posAttr.getZ(idx);

    // A travelling wave: the sampled vertex z moves between the two frames.
    expect(Math.abs(zMid - z0)).toBeGreaterThan(0.01);
    inst.dispose();
  });

  it('controls change output: larger amplitude means larger displacement', () => {
    const target = makeTarget(flagWavePrimitive);
    const inst = flagWavePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const geom = mesh.geometry as BufferGeometry;
    const posAttr = geom.getAttribute('position') as BufferAttribute;
    const idx = rightEdgeVertexIndex(posAttr);

    // Pick a time where sin(...) is clearly non-zero so amplitude scaling shows.
    const SAMPLE_T = 0.9;

    inst.setControl('amplitude', 0.02);
    inst.seek(SAMPLE_T);
    const small = Math.abs(posAttr.getZ(idx));

    inst.setControl('amplitude', 0.5);
    inst.seek(SAMPLE_T);
    const large = Math.abs(posAttr.getZ(idx));

    expect(large).toBeGreaterThan(small + 0.05);
    inst.dispose();
  });
});
