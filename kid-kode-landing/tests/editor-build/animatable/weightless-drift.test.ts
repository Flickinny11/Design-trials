import { describe, it, expect } from 'vitest';
import { weightlessDriftPrimitive } from '@/lib/prism/animatable/primitives/weightless-drift';
import { makeTarget, runConformance } from './_conformance';

describe('weightless-drift primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(weightlessDriftPrimitive).dispose();
  });

  it('drifts with constant momentum and bounces elastically off the walls', () => {
    const target = makeTarget(weightlessDriftPrimitive);
    const subject = target.subject ?? target.object;
    const inst = weightlessDriftPrimitive.create(target);

    inst.seek(0);
    const x0 = subject.position.x;
    const y0 = subject.position.y;
    const rot0 = subject.rotation.z;

    // Sample the trajectory. A real elastic wall bounce means a velocity
    // component reverses sign — observable as the per-frame delta in x (or y)
    // flipping sign. An easing curve toward a target would not produce this
    // kind of momentum-preserving reflection.
    const dt = 1 / 90;
    let prevX = x0;
    let prevY = y0;
    let prevDX = 0;
    let prevDY = 0;
    let sawXBounce = false;
    let sawYBounce = false;
    let maxAbsX = Math.abs(x0);
    let maxAbsY = Math.abs(y0);
    let totalTravel = 0;

    for (let k = 1; k <= 540; k++) {
      inst.seek(k * dt);
      const cx = subject.position.x;
      const cy = subject.position.y;
      const dx = cx - prevX;
      const dy = cy - prevY;
      totalTravel += Math.abs(dx) + Math.abs(dy);
      maxAbsX = Math.max(maxAbsX, Math.abs(cx));
      maxAbsY = Math.max(maxAbsY, Math.abs(cy));
      if (k > 2 && Math.abs(prevDX) > 1e-5 && Math.sign(dx) !== Math.sign(prevDX)) {
        sawXBounce = true; // x velocity reversed → bounced off a left/right wall
      }
      if (k > 2 && Math.abs(prevDY) > 1e-5 && Math.sign(dy) !== Math.sign(prevDY)) {
        sawYBounce = true; // y velocity reversed → bounced off a top/bottom wall
      }
      prevDX = dx;
      prevDY = dy;
      prevX = cx;
      prevY = cy;
    }

    // It genuinely traveled a meaningful distance (not parked).
    expect(totalTravel).toBeGreaterThan(1.0);
    // It reached near the box walls (the drift fills the viewport envelope).
    expect(maxAbsX).toBeGreaterThan(0.9);
    // It bounced off at least one wall (momentum-preserving reflection).
    expect(sawXBounce || sawYBounce).toBe(true);
    // It tumbled: rotation advanced under constant angular momentum.
    inst.seek(540 * dt);
    expect(Math.abs(subject.rotation.z - rot0)).toBeGreaterThan(0.5);

    inst.dispose();
  });

  it('speed is live at the frozen pin (control changes the pinned frame)', () => {
    const target = makeTarget(weightlessDriftPrimitive);
    const subject = target.subject ?? target.object;
    const inst = weightlessDriftPrimitive.create(target);

    // Pin a representative engaged frame mid-drift (≈0.45 of the 6s duration).
    // Sweeping a trajectory-only control (speed) must change the frozen frame:
    // the replay stepper re-seeds and replays to the same t on markDirty, so the
    // card sits somewhere different along its path.
    const PIN = 2.7;

    inst.setControl('speed', 0.2);
    inst.seek(PIN);
    const slowX = subject.position.x;
    const slowY = subject.position.y;

    inst.setControl('speed', 1.6);
    inst.seek(PIN);
    const fastX = subject.position.x;
    const fastY = subject.position.y;

    const moved = Math.hypot(fastX - slowX, fastY - slowY);
    expect(moved).toBeGreaterThan(1e-3);

    // The bounds control is also live at the same pin.
    inst.setControl('bounds', 0.7);
    inst.seek(PIN);
    const tightX = subject.position.x;
    inst.setControl('bounds', 1.3);
    inst.seek(PIN);
    const wideX = subject.position.x;
    expect(Math.abs(wideX - tightX)).toBeGreaterThan(1e-3);

    inst.dispose();
  });
});
