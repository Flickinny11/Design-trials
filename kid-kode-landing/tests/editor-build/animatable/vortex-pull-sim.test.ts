import { describe, it, expect } from 'vitest';
import type { Points } from 'three';
import { vortexPullSimPrimitive } from '@/lib/prism/animatable/primitives/vortex-pull-sim';
import { makeTarget, runConformance } from './_conformance';

// Pull the generated THREE.Points back out of the target so we can read the
// actual integrated particle positions (this is a subject:'empty' primitive).
function getPoints(object: { children: unknown[] }): Points {
  const pts = (object.children as Points[]).find((c) => c.name === 'vortex-pull-sim');
  if (!pts) throw new Error('vortex-pull-sim points not mounted');
  return pts;
}

function posArray(pts: Points): Float32Array {
  return pts.geometry.getAttribute('position').array as Float32Array;
}

// Mean radius (xy) over the first `count` active particles.
function meanRadius(arr: Float32Array, count: number): number {
  let s = 0;
  for (let i = 0; i < count; i++) {
    const x = arr[i * 3];
    const y = arr[i * 3 + 1];
    s += Math.sqrt(x * x + y * y);
  }
  return s / count;
}

describe('vortex-pull-sim primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(vortexPullSimPrimitive).dispose();
  });

  it('integrates a real vortex field: particles swirl, draw inward, and spin faster near the eye', () => {
    const target = makeTarget(vortexPullSimPrimitive);
    const inst = vortexPullSimPrimitive.create(target);
    const pts = getPoints(target.object);
    const COUNT = 200; // sample a stable subset of active particles
    const arr = posArray(pts);

    // t=0 baseline.
    inst.seek(0);
    const r0 = meanRadius(arr, COUNT);

    // Track a single tracer particle's angular position + radius over time to
    // prove (a) tangential swirl and (b) angular speed rises as radius falls —
    // the conservation-of-angular-momentum signature of a true vortex, which a
    // closed-form constant-omega spiral does NOT exhibit.
    const TRACER = 7;
    const dt = 1 / 60;
    // Seed prevAng from the t=0 frame so the first delta isn't a seam artifact.
    inst.seek(0);
    let prevAng = Math.atan2(arr[TRACER * 3 + 1], arr[TRACER * 3]);
    let prevR = Math.sqrt(arr[TRACER * 3] ** 2 + arr[TRACER * 3 + 1] ** 2);
    const rStart = prevR;
    let totalTurn = 0;
    let movedInward = false;
    let rAtFar = -1;
    let rAtNear = -1;
    let omegaFar = 0;
    let omegaNear = 0;

    for (let k = 1; k <= 220; k++) {
      inst.seek(k * dt);
      const x = arr[TRACER * 3];
      const y = arr[TRACER * 3 + 1];
      const ang = Math.atan2(y, x);
      const r = Math.sqrt(x * x + y * y);
      // Unwrapped angular delta (handle the −pi/pi seam).
      let dAng = ang - prevAng;
      if (dAng > Math.PI) dAng -= 2 * Math.PI;
      if (dAng < -Math.PI) dAng += 2 * Math.PI;
      totalTurn += dAng;
      // Capture angular speed at a far radius (early, still wide) vs a near
      // radius (after the pull has drawn it in) — same tracer, on the way in.
      if (r > rStart - 0.04 && rAtFar < 0) {
        rAtFar = r;
        omegaFar = Math.abs(dAng) / dt;
      }
      if (r < rStart - 0.18 && rAtNear < 0 && rAtFar > 0) {
        rAtNear = r;
        omegaNear = Math.abs(dAng) / dt;
      }
      // The tracer drew meaningfully inward from its start radius.
      if (r < rStart - 0.1) movedInward = true;
      prevAng = ang;
      prevR = r;
    }
    void prevR;

    // It genuinely swirled (accumulated real rotation, not a static cloud).
    expect(Math.abs(totalTurn)).toBeGreaterThan(1.0);
    // The field pulls inward: the tracer drew toward the eye at some point.
    expect(movedInward).toBe(true);
    // Whole cloud tightened on average (inward radial pull is real).
    const rLate = meanRadius(arr, COUNT);
    expect(rLate).toBeLessThan(r0);
    // Angular momentum signature: faster spin when closer in.
    expect(rAtNear).toBeGreaterThan(0);
    expect(rAtFar).toBeGreaterThan(0);
    expect(omegaNear).toBeGreaterThan(omegaFar);

    inst.dispose();
  });

  it('swirl control is live at a frozen pin (markDirty re-runs the sim to the same t)', () => {
    const target = makeTarget(vortexPullSimPrimitive);
    const inst = vortexPullSimPrimitive.create(target);
    const pts = getPoints(target.object);
    const arr = posArray(pts);
    const COUNT = 200;
    const PIN = 1.4; // mid-action: well into the pull, tight funnel forming

    // Snapshot the cloud centroid-distance with two very different swirl values
    // at the SAME pinned time. With markDirty wired, the frozen frame must move.
    const snapshot = (): number[] => {
      const out: number[] = [];
      for (let i = 0; i < COUNT; i++) {
        out.push(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]);
      }
      return out;
    };

    inst.setControl('swirl', 0.5);
    inst.seek(PIN);
    const lowSwirl = snapshot();
    const rLow = meanRadius(arr, COUNT);

    inst.setControl('swirl', 3.8);
    inst.seek(PIN);
    const highSwirl = snapshot();
    const rHigh = meanRadius(arr, COUNT);

    // Aggregate per-particle displacement between the two swirl settings.
    let diff = 0;
    for (let i = 0; i < lowSwirl.length; i++) diff += Math.abs(highSwirl[i] - lowSwirl[i]);
    diff /= lowSwirl.length;
    expect(diff).toBeGreaterThan(1e-2); // frozen frame visibly changed

    // And the two are not accidentally identical radii.
    expect(Math.abs(rHigh - rLow)).toBeGreaterThan(1e-3);

    // A trajectory-only control (drag) must ALSO move the frozen frame.
    inst.setControl('drag', 0.02);
    inst.seek(PIN);
    const lowDrag = snapshot();
    inst.setControl('drag', 0.85);
    inst.seek(PIN);
    const highDrag = snapshot();
    let dragDiff = 0;
    for (let i = 0; i < lowDrag.length; i++) dragDiff += Math.abs(highDrag[i] - lowDrag[i]);
    dragDiff /= lowDrag.length;
    expect(dragDiff).toBeGreaterThan(1e-2);

    inst.dispose();
  });
});
