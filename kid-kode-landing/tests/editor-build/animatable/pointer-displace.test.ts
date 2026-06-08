import { describe, it, expect } from 'vitest';
import { Mesh, BufferGeometry, type BufferAttribute } from 'three';
import { pointerDisplacePrimitive } from '@/lib/prism/animatable/primitives/pointer-displace';
import { makeTarget, runConformance } from './_conformance';

// Plane base XY spans -0.9..0.9; uv = (base + 0.9) / 1.8. The vertex nearest the
// plane center maps to uv ≈ (0.5, 0.5).
function posAttr(target: { subject: unknown }): BufferAttribute {
  const mesh = target.subject as Mesh;
  const geom = mesh.geometry as BufferGeometry;
  return geom.getAttribute('position') as BufferAttribute;
}

describe('pointer-displace primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(pointerDisplacePrimitive).dispose();
  });

  it('plays: a vertex under the pointer is displaced; a far vertex is unchanged', () => {
    const target = makeTarget(pointerDisplacePrimitive);
    const inst = pointerDisplacePrimitive.create(target);
    const attr = posAttr(target);

    // Cache base z values up front.
    const baseZ: number[] = [];
    for (let i = 0; i < attr.count; i++) baseZ.push(attr.getZ(i));

    // Tight dimple so far vertices are genuinely untouched.
    inst.setControl('radius', 0.1);
    // Pointer at plane center → the center vertex (uv ~0.5,0.5) should move.
    target.userData.pointer = { x: 0.5, y: 0.5 };
    inst.seek(0);

    // Find the vertex whose uv is nearest center and one near a corner.
    let centerIdx = 0;
    let cornerIdx = 0;
    let bestC = Infinity;
    let bestK = -Infinity;
    for (let i = 0; i < attr.count; i++) {
      const u = (attr.getX(i) + 0.9) / 1.8;
      const v = (attr.getY(i) + 0.9) / 1.8;
      const dc = (u - 0.5) * (u - 0.5) + (v - 0.5) * (v - 0.5);
      const dk = u * u + v * v; // distance from corner (0,0)
      if (dc < bestC) { bestC = dc; centerIdx = i; }
      if (u <= 0.06 && v <= 0.06 && dk > bestK) { bestK = dk; cornerIdx = i; }
    }

    const zCenterEarly = attr.getZ(centerIdx);
    // Center vertex displaced away from its base (dimples down → negative).
    expect(Math.abs(zCenterEarly - baseZ[centerIdx])).toBeGreaterThan(0.1);
    // Corner vertex (far from pointer) effectively unchanged.
    expect(Math.abs(attr.getZ(cornerIdx) - baseZ[cornerIdx])).toBeLessThan(0.02);

    // Move the pointer to the corner → now the corner vertex moves and the old
    // center vertex springs back (mid/late frame differs from the early frame).
    const uC = (attr.getX(cornerIdx) + 0.9) / 1.8;
    const vC = (attr.getY(cornerIdx) + 0.9) / 1.8;
    target.userData.pointer = { x: uC, y: vC };
    inst.seek(1);

    expect(Math.abs(attr.getZ(cornerIdx) - baseZ[cornerIdx])).toBeGreaterThan(0.1);
    // Center vertex differs between the two frames (pointer moved away).
    expect(Math.abs(attr.getZ(centerIdx) - zCenterEarly)).toBeGreaterThan(0.05);

    inst.dispose();
    // dispose restores base positions.
    expect(Math.abs(attr.getZ(centerIdx) - baseZ[centerIdx])).toBeLessThan(1e-5);
  });

  it('controls change output: larger depth means larger displacement', () => {
    const target = makeTarget(pointerDisplacePrimitive);
    const inst = pointerDisplacePrimitive.create(target);
    const attr = posAttr(target);
    target.userData.pointer = { x: 0.5, y: 0.5 };

    // Locate the center vertex + its base z.
    let centerIdx = 0;
    let best = Infinity;
    for (let i = 0; i < attr.count; i++) {
      const u = (attr.getX(i) + 0.9) / 1.8;
      const v = (attr.getY(i) + 0.9) / 1.8;
      const dc = (u - 0.5) * (u - 0.5) + (v - 0.5) * (v - 0.5);
      if (dc < best) { best = dc; centerIdx = i; }
    }
    const baseZ = (() => {
      // base z before any displacement: dispose first to be safe, then read.
      inst.dispose();
      return attr.getZ(centerIdx);
    })();

    inst.setControl('depth', 0.1);
    inst.seek(0);
    const small = Math.abs(attr.getZ(centerIdx) - baseZ);

    inst.setControl('depth', 2);
    inst.seek(0);
    const large = Math.abs(attr.getZ(centerIdx) - baseZ);

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
