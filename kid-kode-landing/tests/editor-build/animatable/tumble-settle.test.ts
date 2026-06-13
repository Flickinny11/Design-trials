import { describe, it, expect } from 'vitest';
import { tumbleSettlePrimitive } from '@/lib/prism/animatable/primitives/tumble-settle';
import { makeTarget, runConformance } from './_conformance';

describe('tumble-settle primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(tumbleSettlePrimitive).dispose();
  });

  it('falls, tumbles end-over-end, and bounces (real rigid-body state, not easing)', () => {
    const target = makeTarget(tumbleSettlePrimitive);
    const subject = target.subject ?? target.object;
    const inst = tumbleSettlePrimitive.create(target);

    inst.seek(0);
    const y0 = subject.position.y;
    const rot0 = subject.rotation.z;

    // Sample the trajectory. A real tumble means the rotation winds past a full
    // turn; a real bounce means the height reaches a low point then rises again
    // (a sign change in the per-frame vertical delta).
    const dt = 1 / 120;
    let prevY = y0;
    let prevDelta = 0;
    let sawRebound = false;
    let minY = y0;
    let maxRot = rot0;
    for (let k = 1; k <= 360; k++) {
      inst.seek(k * dt);
      const cy = subject.position.y;
      const delta = cy - prevY;
      minY = Math.min(minY, cy);
      maxRot = Math.max(maxRot, Math.abs(subject.rotation.z - rot0));
      if (k > 2 && prevDelta < -1e-4 && delta > 1e-4) sawRebound = true; // falling → rising
      prevDelta = delta;
      prevY = cy;
    }
    expect(y0).toBeGreaterThan(minY + 0.1); // it actually dropped
    expect(sawRebound).toBe(true); // it actually bounced back up
    expect(maxRot).toBeGreaterThan(Math.PI * 1.5); // it tumbled past most of a turn

    inst.dispose();
  });

  it('settles flat by the end of its duration (spin and bounce die out)', () => {
    const target = makeTarget(tumbleSettlePrimitive);
    const subject = target.subject ?? target.object;
    const inst = tumbleSettlePrimitive.create(target);

    const D = inst.duration();
    inst.seek(D);
    const restY = subject.position.y;
    // Nudge slightly past the end — once settled the card holds still.
    inst.seek(D + 0.2);
    expect(Math.abs(subject.position.y - restY)).toBeLessThan(1e-6);
    // Final orientation is a face-aligned multiple of π (snapped flat).
    const angle = subject.rotation.z;
    const nearestPi = Math.round(angle / Math.PI) * Math.PI;
    expect(Math.abs(angle - nearestPi)).toBeLessThan(1e-6);

    inst.dispose();
  });

  it('spin changes the frozen mid-tumble frame (control is live at a pinned t)', () => {
    const target = makeTarget(tumbleSettlePrimitive);
    const subject = target.subject ?? target.object;
    const inst = tumbleSettlePrimitive.create(target);

    // Pin the representative engaged frame the rig freezes (~0.45 of duration),
    // mid-tumble. Sweeping spin must change the rotation there (reset-replay →
    // the frozen frame is a pure function of params).
    const PIN = inst.duration() * 0.45;

    inst.setControl('spin', 3);
    inst.seek(PIN);
    const lowSpinRot = subject.rotation.z;
    const lowSpinY = subject.position.y;

    inst.setControl('spin', 15);
    inst.seek(PIN);
    const highSpinRot = subject.rotation.z;

    expect(Math.abs(highSpinRot - lowSpinRot)).toBeGreaterThan(0.3);

    // Gravity is also live at the same pin (trajectory-only control).
    inst.setControl('spin', 9);
    inst.setControl('gravity', 5);
    inst.seek(PIN);
    const lowGravY = subject.position.y;
    inst.setControl('gravity', 20);
    inst.seek(PIN);
    const highGravY = subject.position.y;
    expect(Math.abs(highGravY - lowGravY)).toBeGreaterThan(1e-3);

    // Reference low-spin height kept for clarity that the pin is airborne.
    expect(Number.isFinite(lowSpinY)).toBe(true);

    inst.dispose();
  });
});
