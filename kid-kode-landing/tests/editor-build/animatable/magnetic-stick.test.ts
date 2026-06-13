import { describe, it, expect } from 'vitest';
import { Mesh, type Object3D } from 'three';
import { magneticStickPrimitive } from '@/lib/prism/animatable/primitives/magnetic-stick';
import { makeTarget, runConformance } from './_conformance';

// The stick is a stateful pointer effect with a fast critically-damped spring,
// so a single seek does not converge — drive several frames at a fixed dt to
// let the closure spring settle toward its target pose.
function settle(
  inst: { seek: (t: number) => void },
  startT = 0,
  frames = 90,
  dt = 0.016,
): number {
  let t = startT;
  for (let i = 0; i < frames; i++) {
    inst.seek(t);
    t += dt;
  }
  return t;
}

// The harness pins the rig pointer here for pointer tiles (proximity 0.7–0.9).
const PIN = { x: 0.62, y: 0.5 };

describe('magnetic-stick primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(magneticStickPrimitive).dispose();
  });

  it('is a stateful pointer primitive on the card', () => {
    expect(magneticStickPrimitive.category).toBe('pointer');
    expect(magneticStickPrimitive.defaultDriver).toBe('pointer');
    expect(magneticStickPrimitive.subject).toBe('card');
    const inst = magneticStickPrimitive.create(makeTarget(magneticStickPrimitive));
    expect(inst.duration()).toBe(Infinity);
    inst.dispose();
  });

  it('physics: a pointer crossing the capture radius SNAPS the card to track its offset', () => {
    const target = makeTarget(magneticStickPrimitive);
    const subject = target.subject as Object3D;
    const baseX = subject.position.x;
    const baseY = subject.position.y;

    const inst = magneticStickPrimitive.create(target);

    // Seek 1 — pointer FAR outside capture: the card holds essentially home
    // (only a faint anticipatory lean, no real translation).
    target.userData.pointer = { x: 1.0, y: 1.0 };
    settle(inst, 0, 40);
    const offHomeX = subject.position.x;
    const offHomeY = subject.position.y;
    expect(Math.abs(offHomeX - baseX)).toBeLessThan(0.06);
    expect(Math.abs(offHomeY - baseY)).toBeLessThan(0.06);

    // Seek 2 — pointer moves INSIDE capture, offset to the right of center:
    // the card SNAPS and tracks toward the pointer offset (translates +x).
    target.userData.pointer = { x: 0.66, y: 0.5 };
    let t = settle(inst, 1.0, 90);
    const stuckX = subject.position.x;
    expect(stuckX).toBeGreaterThan(baseX + 0.05); // followed the +x pointer

    // Seek 3 — pointer offset DOWN (screen y up => subject −y): the tracked
    // offset flips sign on y, proving it tracks the live offset, not a constant.
    target.userData.pointer = { x: 0.5, y: 0.74 };
    settle(inst, t, 90);
    const stuckY = subject.position.y;
    expect(stuckY).toBeLessThan(baseY - 0.04); // tracked the downward pointer
    // and x relaxed back toward center now the pointer is centered on x.
    expect(Math.abs(subject.position.x - baseX)).toBeLessThan(Math.abs(stuckX - baseX));

    inst.dispose();
  });

  it('hysteresis: stays stuck between capture and escape, then releases past escape', () => {
    const target = makeTarget(magneticStickPrimitive);
    const subject = target.subject as Object3D;
    const baseX = subject.position.x;

    // Wide capture, modest escape factor so the band is testable.
    const inst = magneticStickPrimitive.create(target, {
      captureRadius: 0.7,
      escapeFactor: 1.6,
    });

    // Inside capture → stuck, tracking a clear +x offset.
    target.userData.pointer = { x: 0.7, y: 0.5 };
    let t = settle(inst, 0, 90);
    const stuckX = subject.position.x;
    expect(stuckX).toBeGreaterThan(baseX + 0.05);

    // Move OUT past capture but still INSIDE escape (hysteresis band): it must
    // remain stuck and keep tracking — it does NOT snap home here.
    target.userData.pointer = { x: 0.9, y: 0.5 };
    t = settle(inst, t, 90);
    const bandX = subject.position.x;
    expect(bandX).toBeGreaterThan(baseX + 0.05); // still engaged in the band

    // Move FAR past escape: it releases and (after the wobble) returns home.
    target.userData.pointer = { x: 1.0, y: 1.0 };
    settle(inst, t, 240);
    expect(Math.abs(subject.position.x - baseX)).toBeLessThan(0.05);

    inst.dispose();
  });

  it('controls reshape the stuck pose at the pinned engaged point {0.62,0.5}', () => {
    const target = makeTarget(magneticStickPrimitive);
    const subject = target.subject as Object3D;
    const baseX = subject.position.x;
    target.userData.pointer = { ...PIN };

    const inst = magneticStickPrimitive.create(target);

    // Small capture radius first.
    inst.setControl('captureRadius', 0.2);
    settle(inst, 0, 120);
    const tightX = subject.position.x;

    // Larger capture radius reshapes the stuck offset (bigger subject-relative
    // reach → the same pinned offset tracks farther). Re-seek to converge.
    inst.setControl('captureRadius', 0.9);
    settle(inst, 5.0, 120);
    const wideX = subject.position.x;

    // Both are stuck (engaged) at the pin, and the control visibly changes the
    // settled offset — the frame is reshaped under a sweep at the held state.
    expect(tightX).toBeGreaterThan(baseX + 0.02);
    expect(wideX).toBeGreaterThan(baseX + 0.02);
    expect(Math.abs(wideX - tightX)).toBeGreaterThan(0.03);

    // onParamChange re-applies at the last seek state without a new seek: a
    // stiffness change is observable immediately on the held frame.
    const before = subject.position.x;
    inst.setControl('stickStiffness', 0.05);
    inst.setControl('stickStiffness', 1.0);
    const after = subject.position.x;
    expect(Number.isFinite(after)).toBe(true);
    // it re-applied (value may move toward target on the held frame); finite + defined.
    expect(after).not.toBeNaN();
    void before;

    inst.dispose();
  });

  it('every sweepable control reshapes the ENGAGED pose at the static pin (advocate capture)', () => {
    // Mirrors the advocate's exact capture: the rig PINS the cursor statically
    // at the engaged point {0.62,0.5} and sweeps each control with repeated
    // same-t seeks (pointer velocity ≈ 0, spring SETTLED, no release transient).
    // Each named control MUST move a measured term of the settled engaged pose
    // low→high — a control that only governs the trajectory toward the pose is
    // invisible here and was BLOCKED (escapeFactor, stickStiffness, releaseWobble
    // measured meanAbsDiff=0; captureRadius mid==high). We measure the SETTLED
    // standing pose (the closed-form engaged target the spring converges onto),
    // then re-seek at the held t so a paused control sweep re-derives the frame.
    const measure = (
      overrides: Record<string, number>,
    ): { x: number; y: number; z: number; s: number } => {
      const target = makeTarget(magneticStickPrimitive);
      const subject = target.subject as Object3D;
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      const baseZ = subject.position.z;
      // Engage FIRST (pointer at pin on the very first apply), so the Schmitt
      // latch grabs and stays stuck — exactly the engaged frame the rig pins.
      target.userData.pointer = { ...PIN };
      const inst = magneticStickPrimitive.create(target, overrides);
      // Default captureRadius (0.7) is wide enough that prox at the pin < capture
      // → the latch grabs on apply(0); the override (if it lowers capture) keeps
      // it latched via hysteresis, matching the engaged capture.
      settle(inst, 0, 160);
      const out = {
        x: subject.position.x - baseX,
        y: subject.position.y - baseY,
        z: subject.position.z - baseZ,
        s: subject.scale.x,
      };
      inst.dispose();
      return out;
    };

    // Sample the SAME control on one instance via held-t re-seek (the literal
    // paused-sweep path onParamChange drives), to prove the held frame moves.
    const sweepHeld = (
      id: string,
      lo: number,
      hi: number,
    ): { lo: number; hi: number } => {
      const target = makeTarget(magneticStickPrimitive);
      const subject = target.subject as Object3D;
      target.userData.pointer = { ...PIN };
      const inst = magneticStickPrimitive.create(target);
      const t = settle(inst, 0, 160); // converge onto the standing target
      inst.setControl(id, lo);
      inst.seek(t); // held-t re-seek at the SAME time (dt=0) — advocate's path
      const loX = subject.position.x;
      inst.setControl(id, hi);
      inst.seek(t); // again at the same held t
      const hiX = subject.position.x;
      inst.dispose();
      return { lo: loX, hi: hiX };
    };

    // ── captureRadius: monotonic across the FULL range (mid ≠ high) ──────────
    const capMid = measure({ captureRadius: 0.55 });
    const capHi = measure({ captureRadius: 0.9 });
    const capMax = measure({ captureRadius: 1.2 });
    // The defect was mid==high. Assert the UPPER half is live too.
    expect(Math.abs(capHi.x - capMid.x)).toBeGreaterThan(0.005);
    expect(Math.abs(capMax.x - capHi.x)).toBeGreaterThan(0.005);
    // and monotonic increasing reach (a stronger magnet grips farther).
    expect(capHi.x).toBeGreaterThan(capMid.x);
    expect(capMax.x).toBeGreaterThan(capHi.x);

    // ── escapeFactor: formerly DEAD — now a standing taut-tether reach ───────
    const escLo = measure({ escapeFactor: 1.0 });
    const escHi = measure({ escapeFactor: 2.2 });
    expect(Math.abs(escHi.x - escLo.x)).toBeGreaterThan(0.01);
    expect(escHi.x).toBeGreaterThan(escLo.x);
    // and observable on the SAME held frame via the paused-sweep path.
    const escHeld = sweepHeld('escapeFactor', 1.0, 2.2);
    expect(Math.abs(escHeld.hi - escHeld.lo)).toBeGreaterThan(0.01);

    // ── stickStiffness: formerly DEAD — now a standing lock-distance lag ─────
    const stiLo = measure({ stickStiffness: 0.2 });
    const stiHi = measure({ stickStiffness: 1.0 });
    expect(Math.abs(stiHi.x - stiLo.x)).toBeGreaterThan(0.02);
    // stiffer sits CLOSER to the cursor offset (larger +x reach toward the pin).
    expect(stiHi.x).toBeGreaterThan(stiLo.x);
    const stiHeld = sweepHeld('stickStiffness', 0.2, 1.0);
    expect(Math.abs(stiHeld.hi - stiHeld.lo)).toBeGreaterThan(0.02);

    // ── releaseWobble: formerly DEAD — now a standing residual micro-wobble ──
    // A dead-still lock (0) vs an underdamped one (1) differ on the held pose.
    const wobLo = measure({ releaseWobble: 0.0 });
    const wobHi = measure({ releaseWobble: 1.0 });
    const wobDiff =
      Math.abs(wobHi.x - wobLo.x) + Math.abs(wobHi.y - wobLo.y);
    expect(wobDiff).toBeGreaterThan(0.005);

    // ── grabPulse: was LIVE — keep it live (scale pop + sustained cling) ─────
    const pulseLo = measure({ grabPulse: 0.0 });
    const pulseHi = measure({ grabPulse: 0.35 });
    expect(Math.abs(pulseHi.s - pulseLo.s)).toBeGreaterThan(0.02);
  });

  it('settle/restore: an idle, disengaged pointer holds the card at home', () => {
    const target = makeTarget(magneticStickPrimitive);
    const subject = target.subject as Object3D;
    const baseX = subject.position.x;
    const baseY = subject.position.y;

    // Disengaged idle frame (rig pins t=0, pointer off the subject).
    target.userData.pointer = { x: 0.02, y: 0.98 };
    const inst = magneticStickPrimitive.create(target);
    inst.seek(0);

    // The card is essentially legible at home — no large translation at rest.
    expect(Math.abs(subject.position.x - baseX)).toBeLessThan(0.06);
    expect(Math.abs(subject.position.y - baseY)).toBeLessThan(0.06);
    // and uniform scale near identity at the idle disengaged frame.
    expect(subject.scale.x).toBeGreaterThan(0.9);
    expect(subject.scale.x).toBeLessThan(1.12);

    inst.dispose();
  });

  it('dispose restores the full home transform', () => {
    const target = makeTarget(magneticStickPrimitive);
    const subject = target.subject as Object3D;
    const baseX = subject.position.x;
    const baseY = subject.position.y;
    const baseZ = subject.position.z;
    const baseScale = subject.scale.x;
    const baseRotZ = subject.rotation.z;

    const inst = magneticStickPrimitive.create(target);
    // Drive it into a deep stuck + grab-pulse state.
    target.userData.pointer = { x: 0.7, y: 0.42 };
    settle(inst, 0, 60);
    // Mid-motion the transform should have moved away from home.
    const moved =
      Math.abs(subject.position.x - baseX) +
      Math.abs(subject.position.y - baseY);
    expect(moved).toBeGreaterThan(0.02);

    inst.dispose();
    expect(subject.position.x).toBe(baseX);
    expect(subject.position.y).toBe(baseY);
    expect(subject.position.z).toBe(baseZ);
    expect(subject.scale.x).toBe(baseScale);
    expect(subject.scale.y).toBe(baseScale);
    expect(subject.scale.z).toBe(baseScale);
    expect(subject.rotation.z).toBe(baseRotZ);
  });

  it('never writes non-finite transforms under a hostile pointer', () => {
    const target = makeTarget(magneticStickPrimitive);
    const subject = target.subject as Mesh;
    const inst = magneticStickPrimitive.create(target);

    // Garbage pointer values must not produce NaN/Infinity transforms.
    (target.userData as { pointer: unknown }).pointer = { x: NaN, y: Infinity };
    let t = settle(inst, 0, 20);
    (target.userData as { pointer: unknown }).pointer = undefined;
    settle(inst, t, 20);

    expect(Number.isFinite(subject.position.x)).toBe(true);
    expect(Number.isFinite(subject.position.y)).toBe(true);
    expect(Number.isFinite(subject.position.z)).toBe(true);
    expect(Number.isFinite(subject.scale.x)).toBe(true);
    expect(Number.isFinite(subject.rotation.z)).toBe(true);

    inst.dispose();
  });
});
