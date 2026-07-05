import { describe, it, expect } from 'vitest';
import type { Mesh } from 'three';
import { clothDrapeSimPrimitive } from '@/lib/prism/animatable/primitives/cloth-drape-sim';
import { makeTarget, runConformance } from './_conformance';

// Read the lowest world-Y of the deformed plane geometry (the bottom of the sag).
function minVertexY(subject: Mesh): number {
  const pos = subject.geometry.attributes.position;
  let m = Infinity;
  for (let i = 0; i < pos.count; i++) m = Math.min(m, pos.getY(i));
  return m;
}
// Mean absolute Z displacement — proxy for "has real out-of-plane folds".
function meanAbsZ(subject: Mesh): number {
  const pos = subject.geometry.attributes.position;
  let s = 0;
  for (let i = 0; i < pos.count; i++) s += Math.abs(pos.getZ(i));
  return s / pos.count;
}

describe('cloth-drape-sim primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(clothDrapeSimPrimitive).dispose();
  });

  it('drapes under gravity into folds (real XPBD, not a flat sine)', () => {
    const target = makeTarget(clothDrapeSimPrimitive);
    const subject = (target.subject ?? target.object) as Mesh;
    const inst = clothDrapeSimPrimitive.create(target);

    inst.seek(0);
    const y0 = minVertexY(subject); // ~flat sheet bottom near -0.9

    // March the timeline; the unpinned body must fall well BELOW its flat rest
    // and develop genuine out-of-plane folds (non-trivial |z|), and the lowest
    // point must keep moving (a settle/sway) rather than being a static offset.
    const dt = 1 / 60;
    let minSag = y0;
    let maxZ = 0;
    const samples: number[] = [];
    for (let k = 1; k <= 180; k++) {
      inst.seek(k * dt);
      minSag = Math.min(minSag, minVertexY(subject));
      maxZ = Math.max(maxZ, meanAbsZ(subject));
      if (k % 20 === 0) samples.push(minVertexY(subject));
    }

    // It actually sagged a lot below the initial flat hang.
    expect(minSag).toBeLessThan(y0 - 0.3);
    // It folded out of plane (catenary folds, not a flat slab).
    expect(maxZ).toBeGreaterThan(0.02);
    // The sag evolves over time (motion, not a static jump) — at least two
    // samples differ meaningfully.
    const spread = Math.max(...samples) - Math.min(...samples);
    expect(spread).toBeGreaterThan(0.03);

    inst.dispose();
    // dispose restores the original geometry.
    expect(subject.geometry.attributes.position.count).toBeGreaterThan(0);
  });

  it('gravity changes the frozen mid-drape frame (control live at a pinned t)', () => {
    const target = makeTarget(clothDrapeSimPrimitive);
    const subject = (target.subject ?? target.object) as Mesh;
    const inst = clothDrapeSimPrimitive.create(target);

    // Pin a mid-action frame (~0.45 of duration → still falling into folds).
    const PIN = inst.duration() * 0.45;

    inst.setControl('gravity', 3);
    inst.seek(PIN);
    const sagLowG = minVertexY(subject);

    inst.setControl('gravity', 16);
    inst.seek(PIN);
    const sagHighG = minVertexY(subject);

    // Heavier gravity drapes further by the same pinned instant → frozen frame
    // is a standing function of the control (markDirty re-runs to the same t).
    expect(Math.abs(sagHighG - sagLowG)).toBeGreaterThan(0.05);
    expect(sagHighG).toBeLessThan(sagLowG);

    inst.dispose();
  });

  it('pinMode changes the drape silhouette at a pinned frame', () => {
    const target = makeTarget(clothDrapeSimPrimitive);
    const subject = (target.subject ?? target.object) as Mesh;
    const inst = clothDrapeSimPrimitive.create(target);
    const PIN = inst.duration() * 0.45;

    inst.setControl('pinMode', 'corners');
    inst.seek(PIN);
    const cornersZ = meanAbsZ(subject);

    inst.setControl('pinMode', 'top-edge');
    inst.seek(PIN);
    const topEdgeZ = meanAbsZ(subject);

    // Corner-pinned cloth swings into deeper folds than a fully top-edge-held
    // sheet → the silhouettes differ.
    expect(Math.abs(cornersZ - topEdgeZ)).toBeGreaterThan(1e-3);

    inst.dispose();
  });
});
