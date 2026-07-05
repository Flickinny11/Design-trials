import { describe, it, expect } from 'vitest';
import { Mesh, type BufferAttribute } from 'three';
import { trampolinePrimitive } from '@/lib/prism/animatable/primitives/trampoline';
import { makeTarget, runConformance } from './_conformance';

/** Index of the vertex nearest the plane center (r≈0). */
function centerVertexIndex(posAttr: BufferAttribute): number {
  let best = 0;
  let bestR = Infinity;
  for (let i = 0; i < posAttr.count; i++) {
    const r = Math.hypot(posAttr.getX(i), posAttr.getY(i));
    if (r < bestR) {
      bestR = r;
      best = i;
    }
  }
  return best;
}

describe('trampoline primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(trampolinePrimitive).dispose();
  });

  it('plays: a center vertex z varies across a cycle (damped center-impulse bounce)', () => {
    const target = makeTarget(trampolinePrimitive);
    const inst = trampolinePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const posAttr = mesh.geometry.getAttribute('position') as BufferAttribute;
    const ci = centerVertexIndex(posAttr);

    // loopRate default 0.6 → cycle length ≈ 1.667s. Sample distinct phases
    // within a single cycle.
    inst.seek(0);
    const z0 = posAttr.getZ(ci);

    // Early-cycle dip: just after the impulse the center is driven (sin>0 → z<0).
    inst.seek(0.25);
    const zMid = posAttr.getZ(ci);

    // A later phase within the same cycle differs again (damped rebound).
    inst.seek(0.9);
    const zLate = posAttr.getZ(ci);

    // At t=0 the impulse is at the cycle start (sin(0)=0) → no displacement.
    expect(Math.abs(z0)).toBeLessThan(1e-6);
    // Mid-cycle the center is visibly displaced.
    expect(Math.abs(zMid)).toBeGreaterThan(0.05);
    // The late frame differs from the mid frame (the bounce evolves over the cycle).
    expect(Math.abs(zLate - zMid)).toBeGreaterThan(0.02);

    inst.dispose();
    // dispose restores the base z (≈0).
    expect(Math.abs(posAttr.getZ(ci))).toBeLessThan(1e-6);
  });

  it('controls change output: larger depth means a deeper center displacement', () => {
    const target = makeTarget(trampolinePrimitive);
    const inst = trampolinePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const posAttr = mesh.geometry.getAttribute('position') as BufferAttribute;
    const ci = centerVertexIndex(posAttr);

    // Sample at a phase where the center is clearly displaced.
    const sampleT = 0.25;

    inst.setControl('depth', 0.2);
    inst.seek(sampleT);
    const shallow = Math.abs(posAttr.getZ(ci));

    inst.setControl('depth', 2);
    inst.seek(sampleT);
    const deep = Math.abs(posAttr.getZ(ci));

    expect(deep).toBeGreaterThan(shallow + 0.1);

    inst.dispose();
  });
});
