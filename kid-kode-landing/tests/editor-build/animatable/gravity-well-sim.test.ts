import { describe, it, expect } from 'vitest';
import { gravityWellSimPrimitive } from '@/lib/prism/animatable/primitives/gravity-well-sim';
import { makeTarget, runConformance } from './_conformance';
import type { Points } from 'three';

// Read the rendered head positions (trail index 0 of each particle) out of the
// Points geometry the primitive added to target.object. TRAIL=6 in the source:
// vertices are laid out [p0t0, p0t1, ... p0t5, p1t0, ...]; the head is t0.
const TRAIL = 6;
function readHeads(target: ReturnType<typeof makeTarget>, count: number) {
  const points = target.object.children.find(
    (c) => (c as Points).name === 'gravity-well-sim',
  ) as Points;
  const pos = points.geometry.getAttribute('position');
  const heads: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < count; i++) {
    const v = i * TRAIL; // head vertex of particle i
    heads.push({ x: pos.getX(v), y: pos.getY(v), z: pos.getZ(v) });
  }
  return heads;
}

describe('gravity-well-sim primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(gravityWellSimPrimitive).dispose();
  });

  it('integrates a force field: particle paths CURVE toward the well (not constant-velocity)', () => {
    const target = makeTarget(gravityWellSimPrimitive);
    // Put the well above-and-right of center so the rightward stream gets pulled
    // UP as it passes — a clear, sign-stable deflection a ballistic stream can't
    // produce.
    target.userData.pointer = { x: 0.78, y: 0.82 };
    const inst = gravityWellSimPrimitive.create(target);
    const count = inst.getParams().count as number;

    inst.seek(0);
    let prev = readHeads(target, count);
    const lastAng: (number | undefined)[] = new Array(count).fill(undefined);
    const dt = 1 / 60;
    let maxTurn = 0;
    let sawUpwardPull = false;

    for (let k = 1; k <= 240; k++) {
      inst.seek(k * dt);
      const cur = readHeads(target, count);

      // Signal 1: mean Y of the in-frame stream. With the well high, gravity
      // pulls passing particles upward, so the stream's mean Y rises above its
      // ballistic (flat ~0) baseline at some point. A constant-velocity stream
      // stays centered.
      let sumY = 0;
      let n = 0;
      for (let i = 0; i < count; i++) {
        const h = cur[i];
        if (Math.abs(h.x) < 1.6 && Math.abs(h.y) < 1.6) {
          sumY += h.y;
          n++;
        }
      }
      if (n > 0 && sumY / n > 0.1) sawUpwardPull = true;

      // Signal 2: per-particle heading turn. A straight line never turns; a real
      // force field rotates the velocity vector. Ignore large jumps (respawns).
      for (let i = 0; i < count; i++) {
        const a = prev[i];
        const b = cur[i];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const sp = Math.hypot(dx, dy);
        if (sp > 1e-4 && Math.abs(b.x) < 1.4 && Math.abs(b.y) < 1.4) {
          const ang = Math.atan2(dy, dx);
          const la = lastAng[i];
          if (la !== undefined) {
            let d = Math.abs(ang - la);
            if (d > Math.PI) d = 2 * Math.PI - d;
            if (d < 1.0) maxTurn = Math.max(maxTurn, d); // skip respawn discontinuities
          }
          lastAng[i] = ang;
        }
      }
      prev = cur;
    }

    // A genuine force field bends headings (radians) and deflects the stream
    // toward the high well. Constant velocity would produce neither.
    expect(maxTurn).toBeGreaterThan(0.15); // paths visibly curve
    expect(sawUpwardPull).toBe(true); // stream deflected toward the well

    inst.dispose();
  });

  it('well mass re-bends the FROZEN frame (control is live at a pinned t)', () => {
    const target = makeTarget(gravityWellSimPrimitive);
    target.userData.pointer = { x: 0.62, y: 0.5 };
    const inst = gravityWellSimPrimitive.create(target);
    const count = inst.getParams().count as number;

    // Pin a mid-flow engaged frame (well within duration()=6; ~0.45 phase).
    const PIN = 2.7;

    inst.setControl('mass', 0.5); // weak well: paths barely bend
    inst.seek(PIN);
    const weak = readHeads(target, count);

    inst.setControl('mass', 6); // strong well: paths whip around it
    inst.seek(PIN);
    const strong = readHeads(target, count);

    // The same pinned frame must differ once the well strength changes — proof
    // that mass (a trajectory-only control) is live via markDirty.
    let meanAbsDiff = 0;
    for (let i = 0; i < count; i++) {
      meanAbsDiff +=
        Math.abs(weak[i].x - strong[i].x) +
        Math.abs(weak[i].y - strong[i].y) +
        Math.abs(weak[i].z - strong[i].z);
    }
    meanAbsDiff /= count;
    expect(meanAbsDiff).toBeGreaterThan(0.05);

    inst.dispose();
  });
});
