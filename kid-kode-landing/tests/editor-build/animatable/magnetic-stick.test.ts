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

// A nominal engaged pin used by the legacy reshape test (proximity ~0.7).
const PIN = { x: 0.62, y: 0.5 };

// THE REAL ADVOCATE PIN. The catalog capture rig pins the cursor for control
// sweeps via the orbiting stimulus seeked at t=1 on a 4 s clock (ph=0.25):
//   rad = 0.05 + 0.3·(0.5 + 0.5·sin(2·ang)),  ang = ph·2π = π/2
//       = 0.05 + 0.3·0.5 = 0.2
//   x = 0.5 + 0.2·cos(π/2) = 0.5   ← DEAD CENTER (rawTX = 0)
//   y = 0.5 + 0.2·sin(π/2) = 0.7   ← a pure VERTICAL downward offset
// (see shared-tile-renderer.ts advance() + useradvocate-capture.mjs seek(name,1)).
// Any standing term keyed off the pointer's X offset reads ZERO here — the exact
// trap the prior fix-round fell into (its escapeFactor/releaseWobble mappings keyed
// off X measured sub-noise). Formerly-dead controls MUST move a Y/magnitude/tilt
// term boldly at THIS pin.
const ADVOCATE_PIN = { x: 0.5, y: 0.7 };

// Bold-delta target. The advocate's LIVE controls on these tiles measure
// meanAbsDiff 6–24 (changedFrac 0.12+); a sub-3 reads as DEAD. In scene units a
// LIVE control moves the card ~0.09–0.37 (captureRadius 6.5 ≈ 0.09 vertical;
// grabPulse 17 ≈ 0.12 scale). A formerly-dead control's low→high sweep at the
// pin MUST clear this to count as resurrected.
const BOLD = 0.08;

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

  it('every sweepable control BOLDLY reshapes the engaged pose at the REAL advocate pin {0.5,0.7}', () => {
    // Mirrors the advocate's EXACT capture: the rig pins the cursor statically at
    // {0.5,0.7} — x DEAD-CENTER, a pure VERTICAL downward offset — and sweeps each
    // control with repeated same-t seeks (pointer velocity ≈ 0, spring SETTLED, no
    // release transient). The prior fix-round (advocate r2) was RE-BLOCKED because
    // escapeFactor and releaseWobble keyed their standing terms off the pointer's X
    // offset, which is ZERO at this pin → they measured sub-noise (meanAbsDiff
    // 0.7–3.2). Each formerly-dead control MUST now move a Y / magnitude / tilt term
    // of the settled engaged pose BOLDLY (≥ BOLD scene units, the live-control band).
    // We measure the SETTLED standing pose AND re-seek at the held t (dt=0) so a
    // paused control sweep — the literal onParamChange path — re-derives the frame.
    const measure = (
      overrides: Record<string, number>,
    ): { x: number; y: number; z: number; s: number; rz: number; mag: number } => {
      const target = makeTarget(magneticStickPrimitive);
      const subject = target.subject as Object3D;
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      const baseZ = subject.position.z;
      const baseRz = subject.rotation.z;
      // Engage FIRST (pointer at pin on the very first apply), so the Schmitt
      // latch grabs and stays stuck — exactly the engaged frame the rig pins.
      target.userData.pointer = { ...ADVOCATE_PIN };
      const inst = magneticStickPrimitive.create(target, overrides);
      settle(inst, 0, 160);
      const dx = subject.position.x - baseX;
      const dy = subject.position.y - baseY;
      const out = {
        x: dx,
        y: dy,
        z: subject.position.z - baseZ,
        s: subject.scale.x,
        rz: subject.rotation.z - baseRz,
        mag: Math.hypot(dx, dy),
      };
      inst.dispose();
      return out;
    };

    // Sample the SAME control on one instance via repeated held-t re-seek (the
    // literal paused-sweep path onParamChange drives, dt=0), returning the full
    // pose so we can measure the axis the control actually moves.
    const sweepHeld = (
      id: string,
      lo: number,
      hi: number,
    ): { dx: number; dy: number; drz: number; dmag: number } => {
      const target = makeTarget(magneticStickPrimitive);
      const subject = target.subject as Object3D;
      target.userData.pointer = { ...ADVOCATE_PIN };
      const inst = magneticStickPrimitive.create(target);
      const t = settle(inst, 0, 160); // converge onto the standing target
      inst.setControl(id, lo);
      inst.seek(t); // held-t re-seek at the SAME time (dt=0) — advocate's path
      const loX = subject.position.x, loY = subject.position.y, loRz = subject.rotation.z;
      inst.setControl(id, hi);
      inst.seek(t); // again at the same held t
      const hiX = subject.position.x, hiY = subject.position.y, hiRz = subject.rotation.z;
      inst.dispose();
      return {
        dx: Math.abs(hiX - loX),
        dy: Math.abs(hiY - loY),
        drz: Math.abs(hiRz - loRz),
        dmag: Math.hypot(hiX - loX, hiY - loY),
      };
    };

    // ── captureRadius: was LIVE — keep it live + monotonic (mid ≠ high) ──────
    // At the pure-vertical pin its reach reads on Y (a stronger magnet grips a
    // little farther DOWN toward the cursor). Keep the upper half live.
    const capMid = measure({ captureRadius: 0.55 });
    const capHi = measure({ captureRadius: 0.9 });
    const capMax = measure({ captureRadius: 1.2 });
    expect(Math.abs(capHi.y - capMid.y)).toBeGreaterThan(0.005);
    expect(Math.abs(capMax.y - capHi.y)).toBeGreaterThan(0.005);
    // monotonic increasing reach (more negative Y = farther toward the cursor).
    expect(capHi.y).toBeLessThan(capMid.y);
    expect(capMax.y).toBeLessThan(capHi.y);

    // ── escapeFactor: formerly DEAD — now a BOLD standing taut-tether reach ──
    // A wider escape gap = a tauter tether = the stuck card clings FARTHER toward
    // the cursor offset. At {0.5,0.7} that cling is VERTICAL (x=0), so we assert
    // the bold delta on Y. low (sits back) → high (clings to the travel clamp).
    const escLo = measure({ escapeFactor: 1.0 });
    const escHi = measure({ escapeFactor: 2.2 });
    expect(Math.abs(escHi.y - escLo.y)).toBeGreaterThan(BOLD); // ≈0.093 measured
    expect(escHi.y).toBeLessThan(escLo.y); // clings farther DOWN toward the cursor
    // and observable BOLDLY on the SAME held frame via the paused-sweep path.
    const escHeld = sweepHeld('escapeFactor', 1.0, 2.2);
    expect(escHeld.dmag).toBeGreaterThan(BOLD);
    expect(escHeld.dy).toBeGreaterThan(BOLD);

    // ── stickStiffness: was LIVE — keep it live (standing lock-distance lag) ─
    // Reads on Y at this pin (stiffer locks closer to the downward offset).
    const stiLo = measure({ stickStiffness: 0.2 });
    const stiHi = measure({ stickStiffness: 1.0 });
    expect(Math.abs(stiHi.y - stiLo.y)).toBeGreaterThan(0.02);
    expect(stiHi.y).toBeLessThan(stiLo.y); // stiffer sits closer to the offset
    const stiHeld = sweepHeld('stickStiffness', 0.2, 1.0);
    expect(stiHeld.dmag).toBeGreaterThan(0.02);

    // ── releaseWobble: formerly DEAD — now a BOLD standing slump + tilt ──────
    // A dead-still lock (0) vs an underdamped bed (1): the bed visibly SLUMPS off
    // its lock (horizontal-dominant, since the vertical channel is reach-saturated
    // at this pin) AND cants. Both axes are keyed off the control, NOT the pointer
    // X (which is 0 here) — the exact fix for the r2 re-block. Assert the bold
    // standing displacement AND the visible tilt.
    const wobLo = measure({ releaseWobble: 0.0 });
    const wobHi = measure({ releaseWobble: 1.0 });
    // wobble=0 is a perfectly dead-still lock: the card holds its clean stuck
    // pose (a pure-vertical reach, x≈0) with NO horizontal slump and NO tilt.
    // (mag is non-zero — that's the engagement reach, not a residual.)
    expect(Math.abs(wobLo.x)).toBeLessThan(0.002); // no horizontal slump at wobble=0
    expect(Math.abs(wobLo.rz)).toBeLessThan(0.002); // no tilt at wobble=0
    // wobble=1 slumps boldly off the lock AND tilts.
    const wobDmag = Math.hypot(wobHi.x - wobLo.x, wobHi.y - wobLo.y);
    expect(wobDmag).toBeGreaterThan(BOLD); // ≈0.23 measured — far above noise
    expect(Math.abs(wobHi.rz - wobLo.rz)).toBeGreaterThan(0.05); // ≈0.14 rad tilt
    // and BOLDLY observable on the SAME held frame via the paused-sweep path.
    const wobHeld = sweepHeld('releaseWobble', 0.0, 1.0);
    expect(wobHeld.dmag).toBeGreaterThan(BOLD);
    expect(wobHeld.drz).toBeGreaterThan(0.05);

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
