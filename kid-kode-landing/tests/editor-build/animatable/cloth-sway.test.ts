import { describe, it, expect } from 'vitest';
import { Mesh, BufferGeometry, type BufferAttribute } from 'three';
import { clothSwayPrimitive } from '@/lib/prism/animatable/primitives/cloth-sway';
import { makeTarget, runConformance } from './_conformance';

/** Return base-position bookkeeping for the plane subject. */
function planeInfo(target: ReturnType<typeof makeTarget>) {
  const mesh = target.subject as Mesh;
  const geom = mesh.geometry as BufferGeometry;
  const posAttr = geom.getAttribute('position') as BufferAttribute;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < posAttr.count; i++) {
    const by = posAttr.getY(i);
    if (by < minY) minY = by;
    if (by > maxY) maxY = by;
  }
  // Pick a bottom-row vertex (free) and a top-row vertex (pinned).
  let bottomIdx = 0;
  let topIdx = 0;
  for (let i = 0; i < posAttr.count; i++) {
    if (posAttr.getY(i) <= minY + 1e-6) bottomIdx = i;
    if (posAttr.getY(i) >= maxY - 1e-6) topIdx = i;
  }
  return { mesh, posAttr, bottomIdx, topIdx };
}

describe('cloth-sway primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(clothSwayPrimitive).dispose();
  });

  it('plays: bottom vertex z moves, top vertex stays ~pinned', () => {
    const target = makeTarget(clothSwayPrimitive);
    const inst = clothSwayPrimitive.create(target);
    const { posAttr, bottomIdx, topIdx } = planeInfo(target);

    inst.seek(0);
    const bottom0 = posAttr.getZ(bottomIdx);
    const top0 = posAttr.getZ(topIdx);

    inst.seek(1.7);
    const bottomMid = posAttr.getZ(bottomIdx);
    const topMid = posAttr.getZ(topIdx);

    // The free bottom edge sways: its z differs between t=0 and a mid frame.
    expect(Math.abs(bottomMid - bottom0)).toBeGreaterThan(0.01);
    // The pinned top edge barely moves.
    expect(Math.abs(topMid - top0)).toBeLessThan(0.01);
    inst.dispose();
  });

  it('controls change output: larger amplitude means larger bottom displacement', () => {
    const target = makeTarget(clothSwayPrimitive);
    const inst = clothSwayPrimitive.create(target);
    const { posAttr, bottomIdx } = planeInfo(target);

    inst.setControl('amplitude', 0.05);
    inst.seek(1.0);
    const small = Math.abs(posAttr.getZ(bottomIdx));

    inst.setControl('amplitude', 0.6);
    inst.seek(1.0);
    const large = Math.abs(posAttr.getZ(bottomIdx));

    expect(large).toBeGreaterThan(small + 0.05);
    inst.dispose();
  });
});
