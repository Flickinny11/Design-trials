import { describe, it, expect } from 'vitest';
import { springArrivePrimitive } from '@/lib/prism/animatable/primitives/spring-arrive';
import { makeTarget, runConformance } from './_conformance';

describe('spring-arrive primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(springArrivePrimitive).dispose();
  });

  it('flies in from off-screen and OVERSHOOTS past rest (damped spring, not a monotone ease)', () => {
    const target = makeTarget(springArrivePrimitive);
    const subject = target.subject ?? target.object;
    const inst = springArrivePrimitive.create(target);

    inst.seek(0);
    const restX = 0; // card rest is the origin; offset is measured from there
    const restY = 0;
    const startX = subject.position.x;
    const startY = subject.position.y;
    const startDist = Math.hypot(startX - restX, startY - restY);
    expect(startDist).toBeGreaterThan(0.7); // genuinely begins off-screen

    // Sample the trajectory. A real underdamped spring: the signed offset along
    // the entry axis starts large-positive, crosses zero (passes rest), and goes
    // NEGATIVE (overshoot) before ringing back — a monotone ease never goes
    // negative. We also track that it ultimately approaches rest.
    const axX = startX / startDist;
    const axY = startY / startDist;
    const dt = 1 / 120;
    let minSigned = startDist; // along-axis signed offset
    let endDist = startDist;
    for (let k = 1; k <= 360; k++) {
      inst.seek(k * dt);
      const ox = subject.position.x - restX;
      const oy = subject.position.y - restY;
      const signed = ox * axX + oy * axY; // projection onto the entry axis
      minSigned = Math.min(minSigned, signed);
      endDist = Math.hypot(ox, oy);
    }

    // Overshoot: the card passed rest and came out the FAR side (signed < 0).
    expect(minSigned).toBeLessThan(-1e-3);
    // Ring-down: by the end it has settled close to rest.
    expect(endDist).toBeLessThan(startDist * 0.5);

    inst.dispose();
  });

  it('stiffness changes the frozen mid-overshoot frame (control is live at a pinned t)', () => {
    const target = makeTarget(springArrivePrimitive);
    const subject = target.subject ?? target.object;
    const inst = springArrivePrimitive.create(target);

    // Pin a mid-action frame near the rig's ~0.45 frozen phase.
    const PIN = springArrivePrimitive.create(makeTarget(springArrivePrimitive)).duration() * 0.45;

    inst.setControl('stiffness', 40);
    inst.seek(PIN);
    const soft = subject.position.x;

    inst.setControl('stiffness', 300);
    inst.seek(PIN);
    const stiff = subject.position.x;

    // Sweeping stiffness must move the pinned frame (markDirty re-runs the ODE).
    expect(Math.abs(stiff - soft)).toBeGreaterThan(1e-3);

    // Damping must also be live at the same pin (trajectory-only control).
    inst.setControl('damping', 1);
    inst.seek(PIN);
    const underdamped = subject.position.x;
    inst.setControl('damping', 24);
    inst.seek(PIN);
    const overdamped = subject.position.x;
    expect(Math.abs(underdamped - overdamped)).toBeGreaterThan(1e-3);

    inst.dispose();
  });
});
