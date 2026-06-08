import { describe, it, expect } from 'vitest';
import { Mesh, BufferGeometry, type BufferAttribute } from 'three';
import { sailBulgePrimitive } from '@/lib/prism/animatable/primitives/sail-bulge';
import { makeTarget, runConformance } from './_conformance';

/** Index of the vertex closest to the centered origin (cx=cy=0). */
function centerVertexIndex(base: Float32Array, count: number): number {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < count; i++) {
    const bx = base[i * 3], by = base[i * 3 + 1];
    if (bx < minX) minX = bx;
    if (bx > maxX) maxX = bx;
    if (by < minY) minY = by;
    if (by > maxY) maxY = by;
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  let best = 0;
  let bestR = Infinity;
  for (let i = 0; i < count; i++) {
    const cx = (base[i * 3] - minX) / spanX - 0.5;
    const cy = (base[i * 3 + 1] - minY) / spanY - 0.5;
    const r = cx * cx + cy * cy;
    if (r < bestR) {
      bestR = r;
      best = i;
    }
  }
  return best;
}

describe('sail-bulge primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(sailBulgePrimitive).dispose();
  });

  it('plays: a center vertex z varies with time while edges stay ~pinned', () => {
    const target = makeTarget(sailBulgePrimitive);
    const inst = sailBulgePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const geom = mesh.geometry as BufferGeometry;
    const posAttr = geom.getAttribute('position') as BufferAttribute;
    const count = posAttr.count;
    const base = new Float32Array(posAttr.array as ArrayLike<number>);
    const ci = centerVertexIndex(base, count);

    // Bump gustiness to max so the gust envelope swings the center billow.
    inst.setControl('gustiness', 1);

    inst.seek(0);
    const centerZ0 = posAttr.getZ(ci);
    // an edge/corner vertex (index 0 is a plane corner) stays ~pinned
    const edgeZ0 = posAttr.getZ(0);

    // gust = 0.6 + 0.4*sin(t*0.5); sin peaks at t = PI ~= 3.14.
    inst.seek(Math.PI);
    const centerZmid = posAttr.getZ(ci);
    const edgeZmid = posAttr.getZ(0);

    // Center billow z moves meaningfully across time.
    expect(Math.abs(centerZmid - centerZ0)).toBeGreaterThan(0.05);
    // The center actually bulges (non-trivial displacement off the base plane).
    expect(Math.abs(centerZ0)).toBeGreaterThan(0.2);
    // Edges stay essentially pinned at both frames.
    expect(Math.abs(edgeZ0)).toBeLessThan(0.05);
    expect(Math.abs(edgeZmid)).toBeLessThan(0.05);

    inst.dispose();
    // dispose restores base positions.
    expect(posAttr.getZ(ci)).toBeCloseTo(base[ci * 3 + 2], 5);
  });

  it('controls change output: larger bulge means a deeper center billow', () => {
    const target = makeTarget(sailBulgePrimitive);
    const inst = sailBulgePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const geom = mesh.geometry as BufferGeometry;
    const posAttr = geom.getAttribute('position') as BufferAttribute;
    const count = posAttr.count;
    const base = new Float32Array(posAttr.array as ArrayLike<number>);
    const ci = centerVertexIndex(base, count);

    // Hold gustiness at 0 so gust=1.0 (steady) and bulge is the only driver.
    inst.setControl('gustiness', 0);

    inst.setControl('bulge', 0.2);
    inst.seek(0);
    const shallow = Math.abs(posAttr.getZ(ci));

    inst.setControl('bulge', 3);
    inst.seek(0);
    const deep = Math.abs(posAttr.getZ(ci));

    expect(deep).toBeGreaterThan(shallow + 1.0);
    inst.dispose();
  });
});
