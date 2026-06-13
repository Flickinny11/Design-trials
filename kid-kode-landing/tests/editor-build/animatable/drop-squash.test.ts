import { describe, it, expect } from 'vitest';
import { dropSquashPrimitive } from '@/lib/prism/animatable/primitives/drop-squash';
import { makeTarget, runConformance } from './_conformance';

describe('drop-squash primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(dropSquashPrimitive).dispose();
  });

  it('falls under gravity and bounces (real velocity state, not easing)', () => {
    const target = makeTarget(dropSquashPrimitive);
    const subject = target.subject ?? target.object;
    const inst = dropSquashPrimitive.create(target);

    inst.seek(0);
    const y0 = subject.position.y;

    // Sample the trajectory; a real bounce means y reaches a low point then
    // rises again (a sign change in the per-frame vertical delta).
    const dt = 1 / 120;
    let prevY = y0;
    let prevDelta = 0;
    let sawRebound = false;
    let minY = y0;
    for (let k = 1; k <= 480; k++) {
      inst.seek(k * dt);
      const cy = subject.position.y;
      const delta = cy - prevY;
      minY = Math.min(minY, cy);
      if (k > 2 && prevDelta < -1e-4 && delta > 1e-4) sawRebound = true; // falling → rising
      prevDelta = delta;
      prevY = cy;
    }
    expect(y0).toBeGreaterThan(minY + 0.1); // it actually dropped
    expect(sawRebound).toBe(true); // it actually bounced back up

    inst.dispose();
  });

  it('squashes on impact, and bounciness changes the frozen frame (control is live at a pinned t)', () => {
    const target = makeTarget(dropSquashPrimitive);
    const subject = target.subject ?? target.object;
    const inst = dropSquashPrimitive.create(target);
    const baseSY = subject.scale.y;

    // Find a frame where the card is squashed (scale.y dipped below rest).
    const dt = 1 / 120;
    let squashedY = baseSY;
    for (let k = 1; k <= 600; k++) {
      inst.seek(k * dt);
      squashedY = Math.min(squashedY, subject.scale.y);
    }
    expect(squashedY).toBeLessThan(baseSY * 0.99); // genuine impact squash

    // Pin a representative engaged frame AFTER the first bounce, where a bouncy
    // card is still airborne while a dead one has settled; sweeping bounciness
    // must change it (reset-replay → frame is a pure function of params).
    const PIN = 1.0;
    inst.setControl('bounciness', 0.2);
    inst.seek(PIN);
    const lowBounce = subject.position.y;
    inst.setControl('bounciness', 0.9);
    inst.seek(PIN);
    const highBounce = subject.position.y;
    expect(Math.abs(highBounce - lowBounce)).toBeGreaterThan(1e-3);

    inst.dispose();
  });
});
