import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { softBodyBouncePrimitive } from '@/lib/prism/animatable/primitives/soft-body-bounce';
import { makeTarget, runConformance } from './_conformance';

// Helpers to read the soft-body mesh the primitive builds into target.object.
function findMesh(target: ReturnType<typeof makeTarget>): Mesh {
  const m = target.object.getObjectByName('soft-body-bounce');
  expect(m, 'soft-body mesh exists').toBeTruthy();
  return m as Mesh;
}

// Lowest / highest Y over the mesh's active vertices, plus its X-extent (width).
function bounds(mesh: Mesh): { minY: number; maxY: number; spanX: number; meanY: number } {
  const pos = mesh.geometry.getAttribute('position');
  let minY = Infinity;
  let maxY = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  let sumY = 0;
  let n = 0;
  // Only count vertices that participate in an active triangle (the index set).
  const index = mesh.geometry.getIndex();
  const seen = new Set<number>();
  if (index) {
    for (let k = 0; k < index.count; k++) seen.add(index.getX(k));
  }
  for (const i of seen) {
    const y = pos.getY(i);
    const x = pos.getX(i);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    sumY += y;
    n++;
  }
  return { minY, maxY, spanX: maxX - minX, meanY: sumY / n };
}

describe('soft-body-bounce primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(softBodyBouncePrimitive).dispose();
  });

  it('drops, then SQUASHES on floor impact (real deformation, not a scale tween)', () => {
    const target = makeTarget(softBodyBouncePrimitive);
    const inst = softBodyBouncePrimitive.create(target);
    const mesh = findMesh(target);

    inst.seek(0);
    const start = bounds(mesh);
    const startSpanX = start.spanX;
    const startMeanY = start.meanY;

    // Sample the timeline: the blob must (a) translate downward (its mean Y
    // falls well below the start), and (b) at some frame WIDEN sideways beyond
    // its rest width — genuine squash, since the mesh vertices ARE the
    // simulated particles (a pure scale tween can't widen the index-bounded
    // lattice independent of height).
    const dt = 1 / 90;
    let lowestMeanY = startMeanY;
    let widest = startSpanX;
    let flattest = Infinity; // smallest (maxY-minY) = most pancaked
    for (let k = 1; k <= 360; k++) {
      inst.seek(k * dt);
      const b = bounds(mesh);
      lowestMeanY = Math.min(lowestMeanY, b.meanY);
      widest = Math.max(widest, b.spanX);
      flattest = Math.min(flattest, b.maxY - b.minY);
    }

    // It actually fell.
    expect(startMeanY - lowestMeanY).toBeGreaterThan(0.3);
    // It actually deformed: widened past rest AND flattened past rest height.
    const startHeight = start.maxY - start.minY;
    expect(widest).toBeGreaterThan(startSpanX * 1.02); // bulged sideways
    expect(flattest).toBeLessThan(startHeight * 0.96); // squashed flatter

    inst.dispose();
  });

  it('bounces back up after the first impact (a physical rebound event)', () => {
    const target = makeTarget(softBodyBouncePrimitive);
    const inst = softBodyBouncePrimitive.create(target);
    const mesh = findMesh(target);

    inst.seek(0);
    const dt = 1 / 90;
    let prevMean = bounds(mesh).meanY;
    let prevDelta = 0;
    let sawRebound = false;
    for (let k = 1; k <= 360; k++) {
      inst.seek(k * dt);
      const mean = bounds(mesh).meanY;
      const delta = mean - prevMean;
      // falling (delta<0) → rising (delta>0) = a rebound.
      if (k > 4 && prevDelta < -2e-4 && delta > 2e-4) sawRebound = true;
      prevDelta = delta;
      prevMean = mean;
    }
    expect(sawRebound).toBe(true);

    inst.dispose();
  });

  it('gravity is live at the frozen pin (control changes the same paused frame)', () => {
    const target = makeTarget(softBodyBouncePrimitive);
    const inst = softBodyBouncePrimitive.create(target);
    const mesh = findMesh(target);

    // Pin a mid-action frame near the rig's ~0.45 freeze (mid first squash).
    const PIN = softBodyBouncePrimitive.create(makeTarget(softBodyBouncePrimitive));
    PIN.dispose();
    const dur = inst.duration();
    const pinT = dur * 0.45;

    inst.setControl('gravity', 4);
    inst.seek(pinT);
    const slow = bounds(mesh).meanY;

    inst.setControl('gravity', 20);
    inst.seek(pinT);
    const fast = bounds(mesh).meanY;

    // Heavier gravity → the blob has fallen/impacted more by the same pinned t.
    // markDirty re-runs the sim to the SAME t, so the frozen frame must differ.
    expect(Math.abs(fast - slow)).toBeGreaterThan(1e-3);

    inst.dispose();
  });

  it('stiffness is live at the frozen pin (trajectory-only control via markDirty)', () => {
    const target = makeTarget(softBodyBouncePrimitive);
    const inst = softBodyBouncePrimitive.create(target);
    const mesh = findMesh(target);

    const pinT = inst.duration() * 0.45;

    inst.setControl('stiffness', 0.06); // very soft → big squash at impact
    inst.seek(pinT);
    const softHeight = (() => {
      const b = bounds(mesh);
      return b.maxY - b.minY;
    })();

    inst.setControl('stiffness', 1.0); // rigid → holds shape
    inst.seek(pinT);
    const stiffHeight = (() => {
      const b = bounds(mesh);
      return b.maxY - b.minY;
    })();

    // Different stiffness ⇒ different deformed silhouette at the same pinned t.
    expect(Math.abs(stiffHeight - softHeight)).toBeGreaterThan(1e-3);

    inst.dispose();
  });
});
