import { describe, it, expect } from 'vitest';
import { Points } from 'three';
import { collisionBallsPrimitive } from '@/lib/prism/animatable/primitives/collision-balls';
import { makeTarget, runConformance } from './_conformance';

/** Pull the live position attribute array the primitive writes each seek. */
function positionsOf(object: { children: unknown[] }): Float32Array {
  const pts = (object.children as Points[]).find((c) => c instanceof Points) as Points;
  return pts.geometry.getAttribute('position').array as Float32Array;
}

describe('collision-balls primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(collisionBallsPrimitive).dispose();
  });

  it('plays: ball positions advance and a collision changes velocity', () => {
    const target = makeTarget(collisionBallsPrimitive);
    const inst = collisionBallsPrimitive.create(target);
    const pos = positionsOf(target.object as unknown as { children: unknown[] });

    // Frame at t=0: initial seeded positions.
    inst.seek(0);
    const x0 = pos[0];
    const y0 = pos[1];

    // Mid frame: the sim has stepped forward → ball 0 has moved.
    inst.seek(0.5);
    const xMid = pos[0];
    const yMid = pos[1];

    const moved = Math.hypot(xMid - x0, yMid - y0);
    expect(moved).toBeGreaterThan(0.05);

    // Velocity change: sample per-step displacement (one sim step per sample,
    // dt = 1/60 to match the fixed sim step) and find a frame where ball 0's
    // velocity direction flips sign on an axis — that flip can only come from a
    // wall reflection or a ball-ball collision reversing its velocity.
    const dt = 1 / 60;
    let sawDirectionChange = false;
    let prevVx = 0;
    let prevVy = 0;
    let prev = { x: pos[0], y: pos[1] };
    // Re-establish a known baseline at t=1.
    inst.seek(1);
    prev = { x: pos[0], y: pos[1] };
    for (let k = 1; k <= 1200 && !sawDirectionChange; k++) {
      inst.seek(1 + k * dt);
      const cx = pos[0];
      const cy = pos[1];
      const vX = cx - prev.x;
      const vY = cy - prev.y;
      if (k > 1) {
        // A sign flip on either axis means a wall or ball-ball collision
        // reversed this ball's velocity component.
        if (
          (Math.sign(vX) !== Math.sign(prevVx) && Math.abs(vX) > 1e-6 && Math.abs(prevVx) > 1e-6) ||
          (Math.sign(vY) !== Math.sign(prevVy) && Math.abs(vY) > 1e-6 && Math.abs(prevVy) > 1e-6)
        ) {
          sawDirectionChange = true;
        }
      }
      prevVx = vX;
      prevVy = vY;
      prev = { x: cx, y: cy };
    }
    expect(sawDirectionChange).toBe(true);

    inst.dispose();
  });

  it('controls change output: higher speed moves balls farther over the same time', () => {
    const target = makeTarget(collisionBallsPrimitive);
    const inst = collisionBallsPrimitive.create(target);
    const pos = positionsOf(target.object as unknown as { children: unknown[] });

    inst.seek(0);
    const sx = pos[0];
    const sy = pos[1];

    // Slow: small displacement at t=0.2.
    inst.setControl('speed', 0.2);
    inst.seek(0.2);
    const slow = Math.hypot(pos[0] - sx, pos[1] - sy);

    // Fast (reset by seeking backward to 0 first): larger displacement at same t.
    inst.seek(0);
    inst.setControl('speed', 4);
    inst.seek(0.2);
    const fast = Math.hypot(pos[0] - sx, pos[1] - sy);

    expect(fast).toBeGreaterThan(slow + 0.05);

    inst.dispose();
  });
});
