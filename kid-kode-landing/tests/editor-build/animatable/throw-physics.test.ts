import { describe, it, expect } from 'vitest';
import { Mesh, type Object3D } from 'three';
import { throwPhysicsPrimitive } from '@/lib/prism/animatable/primitives/throw-physics';
import { makeTarget, runConformance } from './_conformance';

// throw-physics is a stateful pointer ballistics primitive: a grab/throw state
// machine integrated frame-by-frame off consecutive seek-time deltas. A single
// seek does not converge — drive several frames at a fixed dt.
function play(
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
// At default grip this lands inside the grip zone → the HELD state shows.
const PIN = { x: 0.62, y: 0.5 };
// A disengaged corner (no cursor near the card).
const OFF = { x: 0.02, y: 0.98 };

describe('throw-physics primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(throwPhysicsPrimitive).dispose();
  });

  it('is a stateful pointer primitive on the card', () => {
    expect(throwPhysicsPrimitive.category).toBe('pointer');
    expect(throwPhysicsPrimitive.defaultDriver).toBe('pointer');
    expect(throwPhysicsPrimitive.subject).toBe('card');
    expect(throwPhysicsPrimitive.difficulty).toBe('hard');
    const inst = throwPhysicsPrimitive.create(makeTarget(throwPhysicsPrimitive));
    expect(inst.duration()).toBe(Infinity);
    inst.dispose();
  });

  it('idle: t=0 with a disengaged pointer holds the card fully at home', () => {
    const target = makeTarget(throwPhysicsPrimitive);
    const subject = target.subject as Object3D;
    const baseX = subject.position.x;
    const baseY = subject.position.y;
    const baseRotZ = subject.rotation.z;

    target.userData.pointer = { ...OFF };
    const inst = throwPhysicsPrimitive.create(target);
    inst.seek(0);

    // Fully legible at home — no translation, no tilt at the idle frame.
    expect(Math.abs(subject.position.x - baseX)).toBeLessThan(1e-6);
    expect(Math.abs(subject.position.y - baseY)).toBeLessThan(1e-6);
    expect(Math.abs(subject.rotation.z - baseRotZ)).toBeLessThan(1e-6);

    inst.dispose();
  });

  it('HELD: a pinned engaged pointer {0.62,0.5} springs the card toward the cursor offset', () => {
    const target = makeTarget(throwPhysicsPrimitive);
    const subject = target.subject as Object3D;
    const baseX = subject.position.x;

    target.userData.pointer = { ...PIN };
    // Isolate the grip-follow read: drag is an INDEPENDENT bold horizontal lag
    // channel (−X, keyed off the control value) that legitimately competes with
    // the +x cursor follow, so zero it here to test the pure grab-toward-cursor
    // behavior this case is named for. The drag lag itself is covered by the
    // BOLD per-control test below.
    const inst = throwPhysicsPrimitive.create(target, { drag: 0 });
    // Repeated seeks at the held pointer — the card should grab and follow the
    // +x cursor offset (pin is right of center), settling into the HELD pose.
    play(inst, 0, 120);

    // It is offset toward the pointer (+x) and stays inside the frame.
    expect(subject.position.x).toBeGreaterThan(baseX + 0.02);
    expect(Number.isFinite(subject.position.x)).toBe(true);
    expect(Number.isFinite(subject.position.y)).toBe(true);

    inst.dispose();
  });

  it('physics: grab → throw → flight; the card sails away from home then returns', () => {
    const target = makeTarget(throwPhysicsPrimitive);
    const subject = target.subject as Object3D;
    const baseX = subject.position.x;
    const baseY = subject.position.y;

    const inst = throwPhysicsPrimitive.create(target, {
      power: 1.0,
      gravity: 0.0, // isolate the launch ballistics (no settling pull yet)
      drag: 0.0,
      bounciness: 0.0, // dead walls → no rebound to muddy the "flew away" read
    });

    // Grab: hold near center, then flick the pointer fast to the right. The card
    // is released the instant the cursor exits the grip zone mid-flick → it
    // SAILS rightward under its own momentum (no held spring holding it).
    target.userData.pointer = { x: 0.5, y: 0.5 };
    let t = play(inst, 0, 8, 0.016);
    let maxX = subject.position.x;
    for (let i = 0; i < 6; i++) {
      target.userData.pointer = { x: 0.5 + 0.08 * (i + 1), y: 0.5 };
      inst.seek(t);
      t += 0.016;
      maxX = Math.max(maxX, subject.position.x);
    }
    target.userData.pointer = { ...OFF };
    // Continue the flight and track how far the card sailed from home.
    for (let i = 0; i < 20; i++) {
      inst.seek(t);
      t += 0.016;
      maxX = Math.max(maxX, subject.position.x);
    }
    // It clearly launched away from home to the right (ballistic travel).
    expect(maxX).toBeGreaterThan(baseX + 0.2);

    // Let it fully settle (flight runs out + RETURN tween) — it eases home.
    play(inst, t, 800, 0.016);
    expect(Math.abs(subject.position.x - baseX)).toBeLessThan(0.05);
    expect(Math.abs(subject.position.y - baseY)).toBeLessThan(0.05);

    inst.dispose();
  });

  it('physics: a bounce reverses lateral flight and kicks spin onto rotation.z', () => {
    const target = makeTarget(throwPhysicsPrimitive);
    const subject = target.subject as Object3D;
    const baseRotZ = subject.rotation.z;

    // Strong throw, low gravity, no drag, high bounciness so it reaches a wall
    // and rebounds well within the frame budget.
    const inst = throwPhysicsPrimitive.create(target, {
      power: 2.0,
      gravity: 0.2,
      drag: 0.0,
      bounciness: 0.85,
    });

    // Grab and fling hard to the right.
    target.userData.pointer = { x: 0.5, y: 0.5 };
    let t = play(inst, 0, 6, 0.016);
    for (let i = 0; i < 6; i++) {
      target.userData.pointer = { x: 0.5 + 0.09 * (i + 1), y: 0.5 };
      inst.seek(t);
      t += 0.016;
    }
    target.userData.pointer = { ...OFF };
    inst.seek(t);
    t += 0.016;

    // Track the x-velocity sign over flight: it starts moving +x, and after a
    // wall bounce it must move −x at some point (sign reversal = a bounce).
    let prevX = subject.position.x;
    let sawRightward = false;
    let sawReversal = false;
    let maxAbsRot = 0;
    for (let i = 0; i < 200; i++) {
      inst.seek(t);
      t += 0.016;
      const x = subject.position.x;
      const v = x - prevX;
      if (v > 1e-4) sawRightward = true;
      if (sawRightward && v < -1e-4) sawReversal = true;
      maxAbsRot = Math.max(maxAbsRot, Math.abs(subject.rotation.z - baseRotZ));
      prevX = x;
    }
    expect(sawRightward).toBe(true); // launched rightward
    expect(sawReversal).toBe(true); // bounced off the right wall
    expect(maxAbsRot).toBeGreaterThan(0.01); // a bounce kicked spin onto z

    inst.dispose();
  });

  it('controls reshape the HELD frame at the pinned engaged point {0.62,0.5}', () => {
    // At the pinned engaged pointer the card is HELD. power (grip reach) and
    // gravity (a downward sag while held) must each visibly move the held pose.
    const measure = (overrides: Record<string, number>): { x: number; y: number } => {
      const target = makeTarget(throwPhysicsPrimitive);
      const subject = target.subject as Object3D;
      target.userData.pointer = { ...PIN };
      const inst = throwPhysicsPrimitive.create(target, overrides);
      play(inst, 0, 160);
      const out = { x: subject.position.x, y: subject.position.y };
      inst.dispose();
      return out;
    };

    // power scales the grip reach → the held +x offset changes with it.
    const powerLo = measure({ power: 0.4 });
    const powerHi = measure({ power: 2.2 });
    expect(Math.abs(powerHi.x - powerLo.x)).toBeGreaterThan(0.01);

    // gravity sags the held card downward → the held y differs across the sweep.
    const gravLo = measure({ gravity: 0.0 });
    const gravHi = measure({ gravity: 4.0 });
    expect(Math.abs(gravHi.y - gravLo.y)).toBeGreaterThan(0.01);
  });

  it('EVERY named control BOLDLY + INDEPENDENTLY reshapes the engaged pose at the STATIC {0.5,0.7} pin (dt=0 repeated same-t seeks — the advocate capture)', () => {
    // ROOT CAUSE the r1 fix missed: the advocate capture rig pins the cursor at
    // EXACTLY {x:0.5, y:0.7} — x DEAD-CENTER (pointer X offset = 0), a PURE
    // VERTICAL downward grip. The r1 standing channels keyed off the pointer X /
    // throw direction, which collapses to straight-down at this pin, so gravity,
    // bounciness, and drag all pushed the SAME −Y axis and all CLAMPED to the same
    // boundY → byte-identical frames → three DEAD controls (advocate meanAbsDiff=0).
    //
    // This test mirrors the rig EXACTLY: pin at {0.5,0.7}, seek the SAME t
    // repeatedly so dt=0 (the paused control sweep), and assert each formerly-dead
    // control moves its OWN axis by a BOLD margin (the advocate target is
    // meanAbsDiff ≥ 6 / changedFrac ≥ 0.12 in pixel space; the live siblings
    // measure 6-24). The card half-extents are halfW≈0.87, halfH≈0.56, so a BOLD
    // pixel delta corresponds to a large fraction of a half-extent in subject
    // units. We assert the underlying pose deltas that PRODUCE those pixels.
    const PIN_T = 1; // matches metrics.json stimulus.controlsPinT
    const measure = (
      overrides: Record<string, number>,
    ): { x: number; y: number; rot: number; sag: number; lag: number; charge: number; chargeTilt: number } => {
      const target = makeTarget(throwPhysicsPrimitive);
      const subject = target.subject as Object3D;
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      const baseRotZ = subject.rotation.z;
      // PIN EXACTLY where the advocate rig pins: x dead-center, y=0.7.
      target.userData.pointer = { x: 0.5, y: 0.7 };
      const inst = throwPhysicsPrimitive.create(target, overrides);
      // Repeated seeks at the SAME t → dt=0 after the first (the rig's paused
      // control sweep). The held pose must be a STANDING function of the params.
      for (let i = 0; i < 8; i++) inst.seek(PIN_T);
      const tp = target.userData.throwPhysics as {
        sag: number;
        lag: number;
        charge: number;
        chargeTilt: number;
      };
      const out = {
        x: subject.position.x - baseX,
        y: subject.position.y - baseY,
        rot: subject.rotation.z - baseRotZ,
        sag: tp.sag,
        lag: tp.lag,
        charge: tp.charge,
        chargeTilt: tp.chargeTilt,
      };
      inst.dispose();
      return out;
    };

    // Subject half-extents (card): halfW≈0.87, halfH≈0.56. The BOLD floor for an
    // independent standing channel — large enough to clear the advocate's pixel
    // gate by a wide margin (live siblings measure 6-24 vs the ~0-3.5 of the dead
    // r1 controls). The computed channel deltas are far above these floors.
    const BOLD_Y = 0.18; // ≈ 0.32·halfH
    const BOLD_X = 0.28; // ≈ 0.32·halfW
    const BOLD_TILT = 0.18; // rad

    // gravity — FORMERLY DEAD (regressed to byte-identical). Now a BOLD downward
    // SAG on its OWN −Y axis: low→high must droop the held y hard AND deepen the
    // published sag. Does NOT touch x (sideways) — that is drag's axis.
    const gLo = measure({ gravity: 0.0 });
    const gHi = measure({ gravity: 5.0 });
    expect(gHi.sag).toBeLessThan(gLo.sag - 0.05); // sag is negative (downward)
    expect(gLo.y - gHi.y).toBeGreaterThan(BOLD_Y); // held card droops boldly down

    // drag — FORMERLY DEAD. Now a BOLD horizontal LAG on its OWN −X axis (a
    // DIFFERENT axis from gravity), keyed off the control VALUE so it drives even
    // at the x-centered pin. low→high must slide the held card sideways hard.
    const dLo = measure({ drag: 0.0 });
    const dHi = measure({ drag: 3.0 });
    expect(dHi.lag).toBeLessThan(dLo.lag - 0.1); // lag is negative (−X)
    expect(Math.abs(dHi.x - dLo.x)).toBeGreaterThan(BOLD_X); // bold sideways slide
    // and it must NOT just be re-using gravity's vertical channel:
    expect(Math.abs(dHi.x - dLo.x)).toBeGreaterThan(Math.abs(dHi.y - dLo.y));

    // bounciness — FORMERLY DEAD. Now a BOLD forward CHARGE pre-load: UPWARD (+Y,
    // the OPPOSITE direction from gravity's sag) PLUS a standing overshoot TILT.
    // low→high must lift the held y AND visibly rotate it — a read distinct from
    // both gravity (down) and drag (sideways).
    const bLo = measure({ bounciness: 0.0 });
    const bHi = measure({ bounciness: 0.92 });
    expect(bHi.charge).toBeGreaterThan(bLo.charge + 0.05);
    expect(bHi.y - bLo.y).toBeGreaterThan(BOLD_Y); // bold UPWARD preload (opposite gravity)
    expect(Math.abs(bHi.rot - bLo.rot)).toBeGreaterThan(BOLD_TILT); // bold charge tilt

    // power stays live (grip reach) — unchanged by the fix.
    const pLo = measure({ power: 0.4 });
    const pHi = measure({ power: 2.2 });
    expect(Math.abs(pHi.y - pLo.y) + Math.abs(pHi.x - pLo.x)).toBeGreaterThan(0.01);
  });

  it('onParamChange re-applies the held pose at the last seek state without a new seek', () => {
    const target = makeTarget(throwPhysicsPrimitive);
    const subject = target.subject as Object3D;
    target.userData.pointer = { ...PIN };

    const inst = throwPhysicsPrimitive.create(target);
    play(inst, 0, 120);
    const before = subject.position.x;

    // Bump power without seeking — the held frame reshapes immediately.
    inst.setControl('power', 2.4);
    const after = subject.position.x;
    expect(Number.isFinite(after)).toBe(true);
    expect(Math.abs(after - before)).toBeGreaterThan(1e-4);

    inst.dispose();
  });

  it('dispose restores the full home transform', () => {
    const target = makeTarget(throwPhysicsPrimitive);
    const subject = target.subject as Object3D;
    const baseX = subject.position.x;
    const baseY = subject.position.y;
    const baseZ = subject.position.z;
    const baseScaleX = subject.scale.x;
    const baseScaleY = subject.scale.y;
    const baseScaleZ = subject.scale.z;
    const baseRotZ = subject.rotation.z;

    const inst = throwPhysicsPrimitive.create(target);

    // Drive it deep into flight (grab, fling, release, mid-air).
    target.userData.pointer = { x: 0.5, y: 0.5 };
    let t = play(inst, 0, 6, 0.016);
    for (let i = 0; i < 6; i++) {
      target.userData.pointer = { x: 0.5 + 0.09 * (i + 1), y: 0.5 };
      inst.seek(t);
      t += 0.016;
    }
    target.userData.pointer = { ...OFF };
    t = play(inst, t, 30);

    const moved =
      Math.abs(subject.position.x - baseX) + Math.abs(subject.position.y - baseY);
    expect(moved).toBeGreaterThan(0.01); // it actually left home mid-flight

    inst.dispose();
    expect(subject.position.x).toBe(baseX);
    expect(subject.position.y).toBe(baseY);
    expect(subject.position.z).toBe(baseZ);
    expect(subject.scale.x).toBe(baseScaleX);
    expect(subject.scale.y).toBe(baseScaleY);
    expect(subject.scale.z).toBe(baseScaleZ);
    expect(subject.rotation.z).toBe(baseRotZ);
  });

  it('never writes non-finite transforms under a hostile pointer', () => {
    const target = makeTarget(throwPhysicsPrimitive);
    const subject = target.subject as Mesh;
    const inst = throwPhysicsPrimitive.create(target);

    (target.userData as { pointer: unknown }).pointer = { x: NaN, y: Infinity };
    let t = play(inst, 0, 20);
    (target.userData as { pointer: unknown }).pointer = undefined;
    t = play(inst, t, 20);
    (target.userData as { pointer: unknown }).pointer = { x: 1e9, y: -1e9 };
    play(inst, t, 20);

    expect(Number.isFinite(subject.position.x)).toBe(true);
    expect(Number.isFinite(subject.position.y)).toBe(true);
    expect(Number.isFinite(subject.position.z)).toBe(true);
    expect(Number.isFinite(subject.scale.x)).toBe(true);
    expect(Number.isFinite(subject.rotation.z)).toBe(true);

    inst.dispose();
  });

  it('determinism: identical seek/pointer sequences yield identical poses', () => {
    const run = (): { x: number; y: number; r: number } => {
      const target = makeTarget(throwPhysicsPrimitive);
      const subject = target.subject as Object3D;
      const inst = throwPhysicsPrimitive.create(target);
      target.userData.pointer = { x: 0.5, y: 0.5 };
      let t = play(inst, 0, 6, 0.016);
      for (let i = 0; i < 6; i++) {
        target.userData.pointer = { x: 0.5 + 0.09 * (i + 1), y: 0.5 };
        inst.seek(t);
        t += 0.016;
      }
      target.userData.pointer = { ...OFF };
      play(inst, t, 80);
      const out = {
        x: subject.position.x,
        y: subject.position.y,
        r: subject.rotation.z,
      };
      inst.dispose();
      return out;
    };
    const a = run();
    const b = run();
    expect(a.x).toBe(b.x);
    expect(a.y).toBe(b.y);
    expect(a.r).toBe(b.r);
  });
});
