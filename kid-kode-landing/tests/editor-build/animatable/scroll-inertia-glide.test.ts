// scroll-inertia-glide — behavior tests.
//
// The primitive is a Lenis-style first-order tracker: raw scroll maps to a
// travel target along a selectable axis; the pose exponentially chases it
// (pos += (target - pos) * (1 - exp(-k*dt))). We assert:
//  - exact settled (snapped) positions at scroll 0 / 0.5 / 1 on a fresh seek,
//  - visible LAG during fast scroll + convergence (the glide) when scroll rests,
//  - the velocity-proportional trail tilt engages while gliding, settles flat,
//  - smoothness shapes the trail (lower lerp = laggier),
//  - every control re-shapes the pose at a PINNED scroll=0.5 frame via
//    onParamChange (the advocate's paused-sweep contract),
//  - dispose restores position and rotation exactly.

import { describe, it, expect } from 'vitest';
import { Box3, Vector3, type Object3D } from 'three';
import { scrollInertiaGlidePrimitive } from '@/lib/prism/animatable/primitives/scroll-inertia-glide';
import { makeTarget, runConformance } from './_conformance';
import type { AnimatableTarget, ParamState } from '@/lib/prism/animatable/contract';

/** The cosine scroll stimulus the catalog rig drives: scroll(t) over a 4s period. */
const cosineScroll = (t: number): number => 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 4);

/** Measure the subject's bbox height (the primitive's travel unit). */
function subjectHeight(subject: Object3D): number {
  return new Box3().setFromObject(subject).getSize(new Vector3()).y;
}

/** Fresh target + instance with optional param overrides. */
function fresh(overrides?: Partial<ParamState>) {
  const target: AnimatableTarget = makeTarget(scrollInertiaGlidePrimitive);
  const inst = scrollInertiaGlidePrimitive.create(target, overrides);
  return { target, inst, subject: target.subject as Object3D };
}

/** Drive the rig's cosine stimulus from t=0 to t=1s at 60fps (ends pinned at
 *  scroll=0.5 with a HOT velocity — the advocate's paused frame). */
function driveToPin(target: AnimatableTarget, inst: { seek(t: number): void }) {
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    target.userData.scroll = cosineScroll(t);
    inst.seek(t);
  }
}

describe('scroll-inertia-glide primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollInertiaGlidePrimitive).dispose();
  });

  it('scroll-position response: fresh seeks snap to exact settled offsets at scroll 0 / 0.5 / 1', () => {
    // First seek snaps settled (no integration history) — so the mapping is
    // exact: offset = scroll * span * subjectHeight along +y (default axis).
    const span = 0.55; // schema default
    for (const scroll of [0, 0.5, 1]) {
      const { target, inst, subject } = fresh();
      const h = subjectHeight(subject);
      const baseY = subject.position.y;
      target.userData.scroll = scroll;
      inst.seek(0.25); // arbitrary t; first seek snaps regardless
      expect(subject.position.y).toBeCloseTo(baseY + scroll * span * h, 6);
      // Idle-frame legibility: scroll=0 is EXACTLY the rest pose.
      if (scroll === 0) {
        expect(subject.position.x).toBeCloseTo(0, 9);
        expect(subject.position.z).toBeCloseTo(0, 9);
        expect(subject.rotation.x).toBeCloseTo(0, 9);
      }
      inst.dispose();
    }
  });

  it('inertia: fast scroll LAGS behind the target, then glides to rest; trail tilt engages then settles', () => {
    const { target, inst, subject } = fresh();
    const h = subjectHeight(subject);
    const baseY = subject.position.y;
    const baseRotX = subject.rotation.x;
    const targetOff = 0.5 * 0.55 * h; // settled offset for scroll=0.5

    target.userData.scroll = 0;
    inst.seek(0); // snap at rest

    // One fast step: scroll jumps 0 -> 0.5 over 0.1s. Pose must be clearly
    // EN ROUTE: moved, but visibly short of the target (the signature lag).
    target.userData.scroll = 0.5;
    inst.seek(0.1);
    const enRoute = subject.position.y - baseY;
    expect(enRoute).toBeGreaterThan(0.02);
    expect(enRoute).toBeLessThan(targetOff - 0.02);
    // Trail tilt: gliding upward leans the card (rotation.x deviates).
    expect(Math.abs(subject.rotation.x - baseRotX)).toBeGreaterThan(0.005);

    // Page rests at scroll=0.5: repeated seeks converge — the glide-in.
    for (let i = 1; i <= 120; i++) {
      target.userData.scroll = 0.5;
      inst.seek(0.1 + i / 30);
    }
    expect(Math.abs(subject.position.y - baseY - targetOff)).toBeLessThan(0.01);
    // Tilt settles flat once the lag has decayed.
    expect(Math.abs(subject.rotation.x - baseRotX)).toBeLessThan(0.01);

    inst.dispose();
  });

  it('smoothness shapes the trail: lower lerp (more inertia) lags farther behind for the same stimulus', () => {
    const run = (smoothness: number): number => {
      const { target, inst, subject } = fresh({ smoothness });
      const h = subjectHeight(subject);
      const baseY = subject.position.y;
      driveToPin(target, inst);
      const lag = 0.5 * 0.55 * h - (subject.position.y - baseY);
      inst.dispose();
      return lag;
    };
    const laggy = run(0.05);
    const tight = run(0.5);
    expect(laggy).toBeGreaterThan(tight + 0.02);
    expect(tight).toBeGreaterThanOrEqual(-1e-6); // never overshoots past the target
  });

  it('pinned scroll=0.5 frame: repeated same-t seeks are stable, and EVERY control re-shapes the pose immediately', () => {
    const { target, inst, subject } = fresh();
    const h = subjectHeight(subject);
    const baseY = subject.position.y;
    const baseX = subject.position.x;
    const baseZ = subject.position.z;

    driveToPin(target, inst);

    // Advocate pin: repeated seeks at the SAME t hold the frame perfectly still.
    const pinnedY = subject.position.y;
    for (let i = 0; i < 3; i++) inst.seek(1);
    expect(subject.position.y).toBeCloseTo(pinnedY, 12);
    // Engaged mid-state: the pinned pose is clearly displaced from rest.
    expect(pinnedY - baseY).toBeGreaterThan(0.05);

    // span sweep -> settled position grows (no extra seek needed: onParamChange).
    inst.setControl('span', 1.2);
    const spanSweptY = subject.position.y;
    expect(spanSweptY - pinnedY).toBeGreaterThan(0.15);
    inst.setControl('span', 0.55);

    // smoothness sweep -> persisted impulse re-derives the steady lag, so the
    // pinned POSITION visibly differs between a buttery and a tight tracker.
    inst.setControl('smoothness', 0.05);
    const buttery = subject.position.y;
    inst.setControl('smoothness', 0.5);
    const tight = subject.position.y;
    expect(Math.abs(buttery - tight)).toBeGreaterThan(0.05);
    expect(tight).toBeGreaterThan(buttery); // less lag = closer to target
    inst.setControl('smoothness', 0.12);

    // tilt sweep -> the lean at the pinned frame re-shapes.
    inst.setControl('tiltDeg', 25);
    const leanHi = subject.rotation.x;
    inst.setControl('tiltDeg', 0);
    const leanOff = subject.rotation.x;
    expect(Math.abs(leanHi - leanOff)).toBeGreaterThan(0.01);
    expect(leanOff).toBeCloseTo(0, 6); // tilt 0 = perfectly flat
    inst.setControl('tiltDeg', 10);

    // axis sweep -> the offset migrates to the chosen axis; others restore.
    inst.setControl('axis', 'x');
    expect(Math.abs(subject.position.x - baseX)).toBeGreaterThan(0.05);
    expect(subject.position.y).toBeCloseTo(baseY, 9);
    inst.setControl('axis', 'z');
    expect(Math.abs(subject.position.z - baseZ)).toBeGreaterThan(0.05);
    expect(subject.position.x).toBeCloseTo(baseX, 9);

    inst.dispose();
  });

  it('loop wrap (t resets) re-snaps cleanly — no fake impulse carried across the wrap', () => {
    const { target, inst, subject } = fresh();
    const baseY = subject.position.y;
    driveToPin(target, inst); // hot impulse at t=1
    // Rig loops: t wraps back to 0 with scroll=0 — must snap to the exact rest
    // pose (legible idle frame), not lurch from stale velocity.
    target.userData.scroll = 0;
    inst.seek(0);
    expect(subject.position.y).toBeCloseTo(baseY, 9);
    expect(subject.rotation.x).toBeCloseTo(0, 9);
    inst.dispose();
  });

  it('dispose restores position and rotation exactly', () => {
    const { target, inst, subject } = fresh();
    const before = {
      px: subject.position.x, py: subject.position.y, pz: subject.position.z,
      rx: subject.rotation.x, rz: subject.rotation.z,
    };
    driveToPin(target, inst);
    inst.setControl('axis', 'z');
    inst.setControl('span', 1.4);
    target.userData.scroll = 0.9;
    inst.seek(1.5);
    inst.dispose();
    expect(subject.position.x).toBeCloseTo(before.px, 12);
    expect(subject.position.y).toBeCloseTo(before.py, 12);
    expect(subject.position.z).toBeCloseTo(before.pz, 12);
    expect(subject.rotation.x).toBeCloseTo(before.rx, 12);
    expect(subject.rotation.z).toBeCloseTo(before.rz, 12);
  });
});
