import { describe, it, expect } from 'vitest';
import { Mesh, BufferGeometry, type BufferAttribute } from 'three';
import { curtainWavePrimitive } from '@/lib/prism/animatable/primitives/curtain-wave';
import { makeTarget, runConformance } from './_conformance';

/** Index of a bottom-hem vertex (max v = lowest y), which sways the most. */
function bottomHemIndex(posAttr: BufferAttribute): number {
  let idx = 0;
  let minY = Infinity;
  for (let i = 0; i < posAttr.count; i++) {
    const y = posAttr.getY(i);
    if (y < minY) {
      minY = y;
      idx = i;
    }
  }
  return idx;
}

describe('curtain-wave primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(curtainWavePrimitive).dispose();
  });

  it('plays: a bottom-hem vertex sways in x across time, pleats present in z', () => {
    const target = makeTarget(curtainWavePrimitive);
    const inst = curtainWavePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const geom = mesh.geometry as BufferGeometry;
    const posAttr = geom.getAttribute('position') as BufferAttribute;
    const hem = bottomHemIndex(posAttr);

    // Sample the hem vertex x at three distinct times — it must move.
    inst.seek(0);
    const x0 = posAttr.getX(hem);
    inst.seek(1.1);
    const x1 = posAttr.getX(hem);
    inst.seek(2.7);
    const x2 = posAttr.getX(hem);

    const span = Math.max(Math.abs(x1 - x0), Math.abs(x2 - x0), Math.abs(x2 - x1));
    expect(span).toBeGreaterThan(0.02);

    // Pleat z-structure present: across the sheet z spans a non-trivial range.
    inst.seek(0.5);
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < posAttr.count; i++) {
      const z = posAttr.getZ(i);
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    expect(maxZ - minZ).toBeGreaterThan(0.05);

    inst.dispose();
  });

  it('controls change output: larger sway means larger hem displacement', () => {
    const target = makeTarget(curtainWavePrimitive);
    const inst = curtainWavePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const geom = mesh.geometry as BufferGeometry;
    const posAttr = geom.getAttribute('position') as BufferAttribute;
    const hem = bottomHemIndex(posAttr);
    const baseX = posAttr.getX(hem);

    // Pick a time where sin(t*speed + v*2) is well away from zero.
    const T = 1.3;

    inst.setControl('swayAmp', 0.05);
    inst.seek(T);
    const small = Math.abs(posAttr.getX(hem) - baseX);

    inst.setControl('swayAmp', 0.6);
    inst.seek(T);
    const large = Math.abs(posAttr.getX(hem) - baseX);

    expect(large).toBeGreaterThan(small + 0.05);
    inst.dispose();
  });
});
