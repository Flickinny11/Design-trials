import { describe, it, expect } from 'vitest';
import type { Group, Mesh } from 'three';
import { newtonCradlePrimitive } from '@/lib/prism/animatable/primitives/newton-cradle';
import { makeTarget, runConformance } from './_conformance';

// Pull the live ball meshes out of the target group by name so we can read
// genuine simulated positions (subject:'empty' → the primitive builds its own).
function getBalls(target: ReturnType<typeof makeTarget>): Mesh[] {
  const group = target.object.children.find(
    (c) => c.name === 'newton-cradle',
  ) as Group | undefined;
  if (!group) throw new Error('cradle group not mounted');
  return group.children.filter((c) => c.name.startsWith('cradle-ball-')) as Mesh[];
}

describe('newton-cradle primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(newtonCradlePrimitive).dispose();
  });

  it('swings the end ball in and kicks the far ball out (momentum transfer, not easing)', () => {
    const target = makeTarget(newtonCradlePrimitive);
    const inst = newtonCradlePrimitive.create(target);
    const balls = getBalls(target);

    inst.seek(0);
    const n = balls.filter((b) => b.visible).length;
    expect(n).toBeGreaterThanOrEqual(3);
    const last = n - 1;

    // At t=0 the LEFT (index 0) ball is pulled out: its x sits well to the left
    // of the centred row, while the far (last) ball hangs at rest near its pivot.
    const x0Start = balls[0].position.x;
    const xLastStart = balls[last].position.x;
    expect(x0Start).toBeLessThan(xLastStart); // left ball is left of the far ball

    // Scrub the timeline. A real cradle: the left ball loses its displacement as
    // it strikes (x0 returns toward the row), and the impulse races through the
    // dead middle balls so the FAR ball swings OUT to the right (its x exceeds
    // its rest position by a clear margin). Track extremes.
    const D = inst.duration();
    const steps = 600;
    let x0Min = x0Start; // left ball's leftmost (rest is ~ -span/2)
    let x0Max = x0Start; // left ball's rightmost (it should recover ~to rest)
    let xLastMax = xLastStart; // far ball's rightmost kick-out
    let middleMaxAbsTravel = 0; // middle balls should barely move at peak strike

    // Approx rest x of the far ball (its pivot at theta=0) — recompute from the
    // centred row geometry the primitive uses (spacing 2R, R=0.16).
    const R = 0.16;
    const rowSpan = (n - 1) * R * 2;
    const lastPivot = -rowSpan / 2 + last * R * 2;

    for (let k = 1; k <= steps; k++) {
      inst.seek((k / steps) * D);
      x0Min = Math.min(x0Min, balls[0].position.x);
      x0Max = Math.max(x0Max, balls[0].position.x);
      xLastMax = Math.max(xLastMax, balls[last].position.x);
      for (let m = 1; m < last; m++) {
        // distance of a middle ball from its own rest pivot
        const pivotM = -rowSpan / 2 + m * R * 2;
        middleMaxAbsTravel = Math.max(middleMaxAbsTravel, Math.abs(balls[m].position.x - pivotM));
      }
    }

    // The left ball actually swung through (recovered far from its launch point).
    expect(x0Max - x0Min).toBeGreaterThan(0.2);
    // Momentum transferred: the FAR ball kicked out past its rest line.
    expect(xLastMax).toBeGreaterThan(lastPivot + 0.1);
    // Newton's-cradle signature: the middle balls stay comparatively quiet while
    // the ends do the swinging (they transmit the impulse, they don't fling).
    expect(middleMaxAbsTravel).toBeLessThan(xLastMax - lastPivot + 0.05);

    inst.dispose();
  });

  it('gravity changes the frozen frame (trajectory control is live at a pinned t)', () => {
    const target = makeTarget(newtonCradlePrimitive);
    const inst = newtonCradlePrimitive.create(target);
    const balls = getBalls(target);

    // Pin a representative mid-action frame (~0.45 of duration), where the swing
    // is partway through a cycle. Gravity sets the tempo (period ∝ 1/√g), so the
    // standing pose at the SAME pinned t differs between a slow and a fast g.
    const PIN = inst.duration() * 0.45;

    inst.setControl('gravity', 5);
    inst.seek(PIN);
    const slowX0 = balls[0].position.x;
    const slowLast = balls[balls.length - 1].position.x;

    inst.setControl('gravity', 21);
    inst.seek(PIN);
    const fastX0 = balls[0].position.x;
    const fastLast = balls[balls.length - 1].position.x;

    // Different gravity → genuinely different standing pose at the same t (proves
    // markDirty re-runs the sim for trajectory-only controls).
    const delta = Math.abs(fastX0 - slowX0) + Math.abs(fastLast - slowLast);
    expect(delta).toBeGreaterThan(1e-2);

    inst.dispose();
  });

  it('restitution is live at the frozen pin (energy loss changes the pose)', () => {
    const target = makeTarget(newtonCradlePrimitive);
    const inst = newtonCradlePrimitive.create(target);
    const balls = getBalls(target);
    const last = balls.filter((b) => b.visible).length - 1;

    // Late in the run, a lossless cradle (rest=1) is still swinging hard while a
    // lossy one (rest~0.7) has bled energy and slumped toward rest. Compare the
    // far-ball extreme reached up to a late pinned t for the two settings.
    const D = inst.duration();
    const sampleMaxLast = () => {
      let mx = -Infinity;
      for (let k = 1; k <= 400; k++) {
        inst.seek((k / 400) * D);
        mx = Math.max(mx, balls[last].position.x);
      }
      return mx;
    };

    inst.setControl('restitution', 1);
    const lossless = sampleMaxLast();
    inst.setControl('restitution', 0.7);
    const lossy = sampleMaxLast();

    // With heavy loss the far ball never kicks out as far as the lossless case.
    expect(lossless).toBeGreaterThan(lossy + 1e-2);

    inst.dispose();
  });
});
