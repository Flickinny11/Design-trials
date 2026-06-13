import { describe, it, expect } from 'vitest';
import { Sprite } from 'three';
import { pinballBouncePrimitive } from '@/lib/prism/animatable/primitives/pinball-bounce';
import { makeTarget, runConformance } from './_conformance';

// Pull the live ball position out of the sprite's instance-position buffer. The
// pool layout is [ pegs(12) | trail(56) | ball(1) ], so the ball is the LAST
// slot. We read the buffer directly because there is no host subject (empty).
const POOL_BALL_SLOT = 12 + 56; // PEG_MAX + TRAIL_MAX

function ballPos(target: ReturnType<typeof makeTarget>): { x: number; y: number } {
  const sprite = target.object.children.find((o) => o instanceof Sprite) as Sprite;
  const pos = sprite.geometry.getAttribute('instancePosition');
  return { x: pos.getX(POOL_BALL_SLOT), y: pos.getY(POOL_BALL_SLOT) };
}

describe('pinball-bounce primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(pinballBouncePrimitive).dispose();
  });

  it('launches, falls under gravity, and ricochets off the pegs (velocity state, not easing)', () => {
    const target = makeTarget(pinballBouncePrimitive);
    const inst = pinballBouncePrimitive.create(target);

    inst.seek(0);
    const start = ballPos(target);

    // Sample the flight. A genuine ricochet means the ball's vertical motion
    // reverses at least once (falling → rising = a bounce rebound off a peg or
    // wall), AND the horizontal track wanders (it changes direction in x too).
    const dt = 1 / 180;
    let prevY = start.y;
    let prevX = start.x;
    let prevDY = 0;
    let prevDX = 0;
    let sawVerticalRebound = false;
    let sawHorizontalReversal = false;
    let minY = start.y;
    let maxX = start.x;
    let minX = start.x;

    for (let k = 1; k <= 600; k++) {
      inst.seek(k * dt);
      const p = ballPos(target);
      const dy = p.y - prevY;
      const dx = p.x - prevX;
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      minX = Math.min(minX, p.x);
      if (k > 3 && prevDY < -1e-4 && dy > 1e-4) sawVerticalRebound = true; // fell then rose
      if (k > 3 && Math.sign(prevDX) !== 0 && Math.sign(dx) !== 0 && Math.sign(prevDX) !== Math.sign(dx))
        sawHorizontalReversal = true; // bounced sideways
      prevDY = dy;
      prevDX = dx;
      prevY = p.y;
      prevX = p.x;
    }

    expect(start.y).toBeGreaterThan(minY + 0.3); // it actually fell a long way
    expect(sawVerticalRebound).toBe(true); // it actually bounced back up
    expect(sawHorizontalReversal).toBe(true); // it actually ricocheted sideways
    expect(maxX - minX).toBeGreaterThan(0.2); // a real chaotic horizontal wander

    inst.dispose();
  });

  it('lays a visible trail of past positions behind the ball', () => {
    const target = makeTarget(pinballBouncePrimitive);
    const inst = pinballBouncePrimitive.create(target);
    const sprite = target.object.children.find((o) => o instanceof Sprite) as Sprite;
    const col = sprite.geometry.getAttribute('instanceColor');

    // Mid-flight, a chunk of the trail slots (indices 12..67) should be lit
    // (non-zero brightness) — proving the breadcrumb path is populated.
    inst.seek(1.2);
    let litTrail = 0;
    for (let k = 12; k < 12 + 56; k++) {
      const b = col.getX(k) + col.getY(k) + col.getZ(k);
      if (b > 1e-3) litTrail++;
    }
    expect(litTrail).toBeGreaterThan(8);

    inst.dispose();
  });

  it('gravity changes the frozen frame (trajectory control is live at a pinned t)', () => {
    const target = makeTarget(pinballBouncePrimitive);
    const inst = pinballBouncePrimitive.create(target);

    // Pin a representative engaged frame MID-RICOCHET (~0.45·duration). Sweeping
    // gravity must change where the ball sits at the SAME pinned t — proof that
    // reset-replay + markDirty makes a trajectory-only control alive while paused.
    const PIN = 1.5;

    inst.setControl('gravity', 3);
    inst.seek(PIN);
    const low = ballPos(target);

    inst.setControl('gravity', 15);
    inst.seek(PIN);
    const high = ballPos(target);

    const moved = Math.hypot(high.x - low.x, high.y - low.y);
    expect(moved).toBeGreaterThan(1e-3);

    inst.dispose();
  });

  it('bounciness changes the frozen frame (restitution control is live at a pinned t)', () => {
    const target = makeTarget(pinballBouncePrimitive);
    const inst = pinballBouncePrimitive.create(target);
    const PIN = 1.5;

    inst.setControl('bounciness', 0.35);
    inst.seek(PIN);
    const dull = ballPos(target);

    inst.setControl('bounciness', 0.95);
    inst.seek(PIN);
    const lively = ballPos(target);

    const moved = Math.hypot(lively.x - dull.x, lively.y - dull.y);
    expect(moved).toBeGreaterThan(1e-3);

    inst.dispose();
  });
});
