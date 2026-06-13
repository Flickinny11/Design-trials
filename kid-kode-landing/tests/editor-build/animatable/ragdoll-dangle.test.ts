import { describe, it, expect } from 'vitest';
import { Object3D, Vector3 } from 'three';
import { ragdollDanglePrimitive } from '@/lib/prism/animatable/primitives/ragdoll-dangle';
import { makeTarget, runConformance } from './_conformance';

/** Find a named joint mesh in the rig and read its world-ish local position. */
function jointPos(target: { object: Object3D }, name: string): Vector3 {
  let found: Object3D | null = null;
  target.object.traverse((o) => {
    if (!found && o.name === name) found = o;
  });
  if (!found) throw new Error(`joint ${name} not found`);
  return (found as Object3D).position.clone();
}

describe('ragdoll-dangle primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(ragdollDanglePrimitive).dispose();
  });

  it('flops under gravity: a limb genuinely swings and overshoots (real XPBD state, not easing)', () => {
    const target = makeTarget(ragdollDanglePrimitive);
    const inst = ragdollDanglePrimitive.create(target);

    // Sample the LEFT arm joint across the swing. A real ragdoll limb hung from a
    // swinging hand travels a meaningful arc AND reverses direction (overshoot /
    // rebound) — the sign of its per-frame x-delta flips at least once.
    const dt = 1 / 90;
    let prevX = 0;
    let prevDelta = 0;
    let sawReversal = false;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    inst.seek(0);
    const arm0 = jointPos(target, 'ragdoll-joint-3');
    prevX = arm0.x;
    for (let k = 1; k <= 360; k++) {
      inst.seek(k * dt);
      const arm = jointPos(target, 'ragdoll-joint-3');
      const delta = arm.x - prevX;
      if (k > 3 && Math.sign(delta) !== 0 && Math.sign(prevDelta) !== 0 && Math.sign(delta) !== Math.sign(prevDelta)) {
        sawReversal = true;
      }
      minX = Math.min(minX, arm.x);
      maxX = Math.max(maxX, arm.x);
      minY = Math.min(minY, arm.y);
      prevDelta = delta;
      prevX = arm.x;
    }
    // It swept a real horizontal arc (momentum), not a tiny jitter.
    expect(maxX - minX).toBeGreaterThan(0.2);
    // It reversed direction at least once — a swing, not a one-way drift.
    expect(sawReversal).toBe(true);
    // It hung BELOW the anchor (gravity pulled it down).
    expect(minY).toBeLessThan(0.6);

    inst.dispose();
  });

  it('gravity reshapes the frozen frame (control is live at a pinned t via markDirty)', () => {
    const target = makeTarget(ragdollDanglePrimitive);
    const inst = ragdollDanglePrimitive.create(target);

    // Pin a mid-action engaged frame (~0.45 of the 3.4s duration → mid-flop).
    const PIN = 0.45 * 3.4;

    // A leg joint hangs differently under weak vs strong gravity — under heavy
    // gravity the limbs trail straighter down; light gravity lets them float wide.
    inst.setControl('gravity', 3);
    inst.seek(PIN);
    const lowG = jointPos(target, 'ragdoll-joint-5');

    inst.setControl('gravity', 20);
    inst.seek(PIN);
    const highG = jointPos(target, 'ragdoll-joint-5');

    expect(lowG.distanceTo(highG)).toBeGreaterThan(1e-3);

    inst.dispose();
  });

  it('floppiness reshapes the frozen frame (limb compliance is live at the pin)', () => {
    const target = makeTarget(ragdollDanglePrimitive);
    const inst = ragdollDanglePrimitive.create(target);
    const PIN = 0.45 * 3.4;

    // Loose limbs lag/overshoot the swinging torso further than stiff ones, so an
    // arm joint sits in a measurably different place at the same pinned t.
    inst.setControl('floppiness', 0.05);
    inst.seek(PIN);
    const stiffArm = jointPos(target, 'ragdoll-joint-4');

    inst.setControl('floppiness', 0.95);
    inst.seek(PIN);
    const floppyArm = jointPos(target, 'ragdoll-joint-4');

    expect(stiffArm.distanceTo(floppyArm)).toBeGreaterThan(1e-3);

    inst.dispose();
  });
});
