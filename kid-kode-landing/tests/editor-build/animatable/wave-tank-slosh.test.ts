import { describe, it, expect } from 'vitest';
import { Mesh, type BufferAttribute } from 'three';
import { waveTankSloshPrimitive } from '@/lib/prism/animatable/primitives/wave-tank-slosh';
import { makeTarget, runConformance } from './_conformance';

// Weighted x-centroid of the water surface: Σ x·max(z,0) / Σ max(z,0). This
// tracks WHERE THE BULK of the water is piled along the tank — the slosh signal.
function bulkCentroidX(target: ReturnType<typeof makeTarget>): number {
  const mesh = target.subject as Mesh;
  const pos = mesh.geometry.getAttribute('position') as BufferAttribute;
  let num = 0;
  let den = 0;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const w = z > 0 ? z : 0; // crests carry the bulk
    num += pos.getX(i) * w;
    den += w;
  }
  return den > 1e-9 ? num / den : 0;
}

// Peak surface displacement magnitude (proves a real surface, not a flat plane).
function maxAbsZ(target: ReturnType<typeof makeTarget>): number {
  const mesh = target.subject as Mesh;
  const pos = mesh.geometry.getAttribute('position') as BufferAttribute;
  let m = 0;
  for (let i = 0; i < pos.count; i++) m = Math.max(m, Math.abs(pos.getZ(i)));
  return m;
}

describe('wave-tank-slosh primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(waveTankSloshPrimitive).dispose();
  });

  it('sloshes: the water bulk piles to one side, then surges to the other (mass transport, not a ripple)', () => {
    const target = makeTarget(waveTankSloshPrimitive);
    // Park the pointer dead-centre so the deterministic periodic tilt drives it.
    target.userData.pointer = { x: 0.5, y: 0.5 };
    const inst = waveTankSloshPrimitive.create(target);

    inst.seek(0);
    const flat = maxAbsZ(target); // starts ~flat at rest

    let minCx = Infinity;
    let maxCx = -Infinity;
    let peakSurface = 0;
    const dt = 1 / 60;
    for (let k = 1; k <= 360; k++) {
      inst.seek(k * dt);
      const cx = bulkCentroidX(target);
      if (Number.isFinite(cx)) {
        minCx = Math.min(minCx, cx);
        maxCx = Math.max(maxCx, cx);
      }
      peakSurface = Math.max(peakSurface, maxAbsZ(target));
    }

    // A real surface develops (not the near-flat rest state).
    expect(peakSurface).toBeGreaterThan(flat + 0.02);
    // The bulk travels a meaningful distance across the tank...
    expect(maxCx - minCx).toBeGreaterThan(0.2);
    // ...and crosses the centreline — it piles on BOTH walls (surges back),
    // which a static tilt or a symmetric ripple would not do.
    expect(minCx).toBeLessThan(-0.02);
    expect(maxCx).toBeGreaterThan(0.02);

    inst.dispose();
  });

  it('slosh control is live at the frozen pin (markDirty re-runs to the same t)', () => {
    const target = makeTarget(waveTankSloshPrimitive);
    target.userData.pointer = { x: 0.5, y: 0.5 };
    const inst = waveTankSloshPrimitive.create(target);

    // Mid-action pin (the rig freezes ~0.45 of a finite duration; this sim is
    // Infinity-duration, so pick an absolute mid-slosh time).
    const PIN = 1.7;

    inst.setControl('slosh', 0.05);
    inst.seek(PIN);
    const calm = maxAbsZ(target);

    inst.setControl('slosh', 1.0);
    inst.seek(PIN);
    const driven = maxAbsZ(target);

    // Same pinned t, different drive → the frozen surface must visibly differ.
    expect(Math.abs(driven - calm)).toBeGreaterThan(1e-3);

    inst.dispose();
  });

  it('tilt control is live at the frozen pin (trajectory-only control still moves the frame)', () => {
    const target = makeTarget(waveTankSloshPrimitive);
    target.userData.pointer = { x: 0.5, y: 0.5 };
    const inst = waveTankSloshPrimitive.create(target);
    const PIN = 1.3;

    inst.setControl('tilt', -1);
    inst.seek(PIN);
    const left = bulkCentroidX(target);

    inst.setControl('tilt', 1);
    inst.seek(PIN);
    const right = bulkCentroidX(target);

    expect(Math.abs(right - left)).toBeGreaterThan(1e-3);

    inst.dispose();
  });
});
