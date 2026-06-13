import { describe, it, expect } from 'vitest';
import { magnetSnapPrimitive } from '@/lib/prism/animatable/primitives/magnet-snap';
import { makeTarget, runConformance } from './_conformance';

// Pointer 0..1 (center 0.5,0.5) maps to scene ±1.05. This magnet sits off-center.
const SPAN = 1.05;
const POINTER = { x: 0.82, y: 0.7 };
const targetScene = {
  x: (POINTER.x - 0.5) * 2 * SPAN,
  y: (POINTER.y - 0.5) * 2 * SPAN,
};

describe('magnet-snap primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(magnetSnapPrimitive).dispose();
  });

  it('yanks the card toward the pointer and OVERSHOOTS (real momentum, not a lerp)', () => {
    const target = makeTarget(magnetSnapPrimitive);
    target.userData.pointer = { ...POINTER };
    const subject = target.subject ?? target.object;
    const inst = magnetSnapPrimitive.create(target);

    const D = inst.duration();
    const N = 600;

    inst.seek(0);
    const startDist = Math.hypot(
      subject.position.x - targetScene.x,
      subject.position.y - targetScene.y,
    );

    // Track the signed displacement from the magnet along the X approach axis.
    // A pure lerp monotonically shrinks the gap to zero. Real spring momentum
    // OVERSHOOTS: the card crosses past the magnet (sign flip of (pos - target)),
    // proving inertia carried it through.
    inst.seek(0);
    const sx0 = subject.position.x - targetScene.x;
    let crossedPast = false;
    let minDist = startDist;
    for (let k = 1; k <= N; k++) {
      inst.seek((k / N) * D);
      const sx = subject.position.x - targetScene.x;
      const dist = Math.hypot(
        subject.position.x - targetScene.x,
        subject.position.y - targetScene.y,
      );
      minDist = Math.min(minDist, dist);
      // Sign flip vs the starting side = it shot past the magnet.
      if (Math.sign(sx) !== Math.sign(sx0) && Math.abs(sx) > 0.04) crossedPast = true;
    }

    // It genuinely traveled a long way toward the magnet...
    expect(startDist).toBeGreaterThan(0.4);
    expect(minDist).toBeLessThan(0.15);
    // ...and overshot past it (momentum), not just eased to a stop.
    expect(crossedPast).toBe(true);

    inst.dispose();
  });

  it('rings down — swing amplitude decays over time (energy lost → it sticks, not orbits)', () => {
    const target = makeTarget(magnetSnapPrimitive);
    target.userData.pointer = { ...POINTER };
    const subject = target.subject ?? target.object;
    const inst = magnetSnapPrimitive.create(target);

    const D = inst.duration();
    const N = 1200;

    // Distance-to-magnet over the whole timeline.
    const dists: number[] = [];
    for (let k = 0; k <= N; k++) {
      inst.seek((k / N) * D);
      dists.push(
        Math.hypot(subject.position.x - targetScene.x, subject.position.y - targetScene.y),
      );
    }

    // Once the card has reached the magnet the first time (initial approach),
    // every later excursion is an overshoot SWING. A damped spring loses energy,
    // so the worst overshoot early after first-contact must exceed the worst
    // overshoot late in the timeline. (An undamped orbit would not decay.)
    let firstHitK = -1;
    for (let k = 0; k < dists.length; k++) {
      if (dists[k] < 0.12) {
        firstHitK = k;
        break;
      }
    }
    expect(firstHitK).toBeGreaterThan(0); // it actually snapped onto the magnet

    const afterHit = dists.slice(firstHitK);
    const mid = Math.floor(afterHit.length / 2);
    const earlySwing = Math.max(...afterHit.slice(0, mid));
    const lateSwing = Math.max(...afterHit.slice(mid));
    // Genuine ring-down: later swings are markedly smaller than earlier ones.
    expect(earlySwing).toBeGreaterThan(0.1); // there WAS a real overshoot
    expect(lateSwing).toBeLessThan(earlySwing * 0.85);

    inst.dispose();
  });

  it('pull changes the frozen frame (control live at a pinned t -> markDirty works)', () => {
    const target = makeTarget(magnetSnapPrimitive);
    target.userData.pointer = { ...POINTER };
    const subject = target.subject ?? target.object;
    const inst = magnetSnapPrimitive.create(target);

    // Pin a mid-action frame (~0.45 of duration): mid-overshoot near the magnet,
    // where the spring tuning is fully visible.
    const PIN = inst.duration() * 0.45;

    inst.setControl('pull', 40);
    inst.seek(PIN);
    const weak = { x: subject.position.x, y: subject.position.y };

    inst.setControl('pull', 300);
    inst.seek(PIN);
    const strong = { x: subject.position.x, y: subject.position.y };

    // Same t, different pull → reset-replay recomputes → frozen frame differs.
    const delta = Math.hypot(strong.x - weak.x, strong.y - weak.y);
    expect(delta).toBeGreaterThan(1e-3);

    // Damping also bites at the same pin (independent control liveness).
    inst.setControl('pull', 150);
    inst.setControl('damping', 0.3);
    inst.seek(PIN);
    const lowDamp = { x: subject.position.x, y: subject.position.y };
    inst.setControl('damping', 11);
    inst.seek(PIN);
    const highDamp = { x: subject.position.x, y: subject.position.y };
    expect(Math.hypot(highDamp.x - lowDamp.x, highDamp.y - lowDamp.y)).toBeGreaterThan(1e-3);

    inst.dispose();
  });
});
