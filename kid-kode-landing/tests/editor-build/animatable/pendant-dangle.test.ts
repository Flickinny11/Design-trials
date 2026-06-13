import { describe, it, expect } from 'vitest';
import { Mesh, Object3D } from 'three';
import { pendantDanglePrimitive } from '@/lib/prism/animatable/primitives/pendant-dangle';
import { makeTarget, runConformance } from './_conformance';

// The harness pins the rig pointer at an ENGAGED point for control sweeps.
const PIN = { x: 0.62, y: 0.5 };
// The idle frame is pinned t=0 with the pointer DISENGAGED (rig center).
const CENTER = { x: 0.5, y: 0.5 };

/** Settle the position-steered angular spring by seeking forward with a fixed
 *  dt; the hang angle converges toward the pointer-derived target. */
function settle(inst: { seek: (t: number) => void }, start = 0, frames = 90, dt = 0.016): void {
  for (let i = 0; i < frames; i++) inst.seek(start + i * dt);
}

describe('pendant-dangle primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(pendantDanglePrimitive).dispose();
  });

  it('rests legible and near-vertical at the idle frame, hanger rig present', () => {
    const target = makeTarget(pendantDanglePrimitive);
    target.userData.pointer = { ...CENTER };
    const inst = pendantDanglePrimitive.create(target);
    const subject = target.subject as Object3D;

    // Idle: a single t=0 seek with the pointer disengaged → fully legible at home.
    inst.seek(0);
    expect(Math.abs(subject.rotation.z)).toBeLessThan(0.05);
    expect(Math.abs(subject.position.x)).toBeLessThan(0.05);
    // The hanging rig (pivot pin + cord) reads even at rest.
    expect(target.object.getObjectByName('pendant-cord')).toBeTruthy();
    expect(target.object.getObjectByName('pendant-pin')).toBeTruthy();

    inst.dispose();
  });

  it('hangs from a TOP pivot: rotation plus arc translation, not spin-in-place', () => {
    const target = makeTarget(pendantDanglePrimitive);
    target.userData.pointer = { x: 0.9, y: 0.5 }; // cursor well to the right
    const inst = pendantDanglePrimitive.create(target);
    const subject = target.subject as Object3D;

    settle(inst);

    const theta = subject.rotation.z;
    // Tips toward the cursor: pointer right of center → swings to a real angle.
    expect(Math.abs(theta)).toBeGreaterThan(0.05);
    // Translate-rotate-translate about the TOP pivot above the card: the origin
    // swings along an arc — x displaces, the bottom swings wide while the top
    // (the pivot) barely moves. y rises (pivot is above), never sinks.
    expect(Math.abs(subject.position.x)).toBeGreaterThan(0.02);
    expect(Math.sign(subject.position.x)).toBe(Math.sign(theta));
    expect(subject.position.y).toBeGreaterThanOrEqual(-1e-6);

    inst.dispose();
  });

  it('pointer position steers the hang direction: opposite sides tip opposite ways', () => {
    const target = makeTarget(pendantDanglePrimitive);
    const subject = target.subject as Object3D;
    const inst = pendantDanglePrimitive.create(target);
    inst.setControl('ambientSway', 0); // isolate the steering from the living hold

    target.userData.pointer = { x: 0.85, y: 0.5 };
    settle(inst);
    const right = subject.rotation.z;

    target.userData.pointer = { x: 0.15, y: 0.5 };
    settle(inst, 1.6);
    const left = subject.rotation.z;

    expect(right).not.toBeCloseTo(left, 2);
    expect(Math.sign(right)).not.toBe(Math.sign(left));

    inst.dispose();
  });

  it('physics response: damped spring integrates with a moving pointer across seeks', () => {
    const target = makeTarget(pendantDanglePrimitive);
    const subject = target.subject as Object3D;
    target.userData.pointer = { x: 0.95, y: 0.5 }; // a hard pull to one side
    const inst = pendantDanglePrimitive.create(target);
    inst.setControl('ambientSway', 0);

    // Three consecutive seeks with the steady offset: the angle must build
    // monotonically toward the target (spring accelerating from rest), with a
    // concrete nonzero magnitude after a few frames.
    inst.seek(0);
    const a0 = subject.rotation.z;
    inst.seek(0.05);
    const a1 = subject.rotation.z;
    inst.seek(0.1);
    const a2 = subject.rotation.z;

    expect(Math.abs(a0)).toBeLessThan(1e-9); // first seek: dt=0, still at rest
    expect(Math.abs(a1)).toBeGreaterThan(Math.abs(a0)); // spring starts moving
    expect(Math.abs(a2)).toBeGreaterThan(Math.abs(a1)); // keeps building toward target
    expect(Math.abs(a2)).toBeLessThan(0.55); // bounded — stays inside the tile

    inst.dispose();
  });

  it('settles toward home when the cursor returns to center (gravity restore)', () => {
    const target = makeTarget(pendantDanglePrimitive);
    const subject = target.subject as Object3D;
    target.userData.pointer = { x: 0.95, y: 0.5 };
    const inst = pendantDanglePrimitive.create(target);
    inst.setControl('ambientSway', 0); // isolate from the living hold

    settle(inst); // swing out toward the cursor
    expect(Math.abs(subject.rotation.z)).toBeGreaterThan(0.05);

    // Cursor returns to center → gravity restores toward vertical.
    target.userData.pointer = { ...CENTER };
    settle(inst, 1.6, 200);
    expect(Math.abs(subject.rotation.z)).toBeLessThan(0.02);
    expect(Math.abs(subject.position.x)).toBeLessThan(0.02);

    inst.dispose();
  });

  it('every control reshapes the pinned engaged frame {0.62,0.5}', () => {
    const target = makeTarget(pendantDanglePrimitive);
    target.userData.pointer = { ...PIN };
    const inst = pendantDanglePrimitive.create(target);
    const subject = target.subject as Object3D;

    // Engage the pinned frame, then PAUSE at a fixed t. Repeated seeks at one t
    // advance nothing (dt=0), so the paused frame is reproducible.
    settle(inst);
    const tPaused = 90 * 0.016;
    inst.seek(tPaused); // land on the paused phase
    const baseTheta = subject.rotation.z;
    const baseX = subject.position.x;
    expect(Math.abs(baseTheta)).toBeGreaterThan(0.02); // engaged tip, never flat

    inst.seek(tPaused);
    expect(subject.rotation.z).toBeCloseTo(baseTheta, 10);

    // chainLength: same hang angle, longer arm → larger arc displacement + cord.
    const cord = target.object.getObjectByName('pendant-cord') as Mesh;
    const baseCordLen = cord.scale.y;
    inst.setControl('chainLength', 1.3);
    expect(Math.abs(subject.position.x - baseX)).toBeGreaterThan(0.02);
    expect(cord.scale.y).toBeGreaterThan(baseCordLen * 1.8);
    inst.setControl('chainLength', 0.45);

    // gravity reshapes the equilibrium hang angle at the pinned offset.
    inst.seek(tPaused);
    const refTheta = subject.rotation.z;
    inst.setControl('gravity', 3);
    expect(Math.abs(subject.rotation.z - refTheta)).toBeGreaterThan(0.01);
    inst.setControl('gravity', 1);

    // damping firms the hang (changes the steady deflection) — visible reshape.
    inst.seek(tPaused);
    const refTheta2 = subject.rotation.z;
    inst.setControl('damping', 1);
    expect(Math.abs(subject.rotation.z - refTheta2)).toBeGreaterThan(0.005);
    inst.setControl('damping', 0.4);

    // ambientSway scales the living micro-sway (nonzero at the paused t by design).
    inst.seek(tPaused);
    const refTheta3 = subject.rotation.z;
    inst.setControl('ambientSway', 1);
    expect(Math.abs(subject.rotation.z - refTheta3)).toBeGreaterThan(0.005);
    inst.setControl('ambientSway', 0.45);

    inst.dispose();
  });

  // The advocate's EXACT capture: pin the cursor STATICALLY at the engaged point,
  // settle the spring, then sweep each formerly-dead control low→mid→high with
  // REPEATED same-t seeks (dt=0 → no integration, no release transient, velocity
  // ≈ 0). damping and ambientSway were measured byte-identical there and BLOCKED
  // the tile. This asserts each now drives the SETTLED engaged pose monotonically
  // and well above the sensor-noise floor — a standing function, not a transient.
  it('damping + ambientSway visibly reshape the SETTLED pinned pose (advocate capture, dt=0)', () => {
    const target = makeTarget(pendantDanglePrimitive);
    target.userData.pointer = { ...PIN };
    const inst = pendantDanglePrimitive.create(target);
    const subject = target.subject as Object3D;
    const cord = target.object.getObjectByName('pendant-cord') as Mesh;

    // Settle the spring at the engaged pin, then PAUSE at a fixed t. Every read
    // below is at this single t with dt=0 — exactly what the static capture sees.
    settle(inst);
    const tPaused = 90 * 0.016;
    inst.seek(tPaused);

    // The frozen frame is reproducible: a repeated same-t seek advances nothing.
    const settledTheta = subject.rotation.z;
    inst.seek(tPaused);
    expect(subject.rotation.z).toBeCloseTo(settledTheta, 10);
    expect(Math.abs(settledTheta)).toBeGreaterThan(0.05); // engaged, not flat

    // The cord is mounted and reads at the pin (a sampled frame is never empty).
    expect(cord).toBeTruthy();
    expect(cord.scale.y).toBeGreaterThan(0);

    // ── DAMPING sweep at the STATIC pin (ambientSway held fixed to isolate it) ──
    // Lower damping holds a LARGER standing residual lean past vertical; higher
    // damping sits closer to the bare equilibrium. The pose must move monotonically
    // and the low→high change must clear the noise floor on BOTH θ and the arc-x.
    inst.setControl('ambientSway', 0.45);
    inst.setControl('damping', 0.05);
    const dLoZ = subject.rotation.z;
    const dLoX = subject.position.x;
    inst.setControl('damping', 0.5);
    const dMiZ = subject.rotation.z;
    inst.setControl('damping', 1);
    const dHiZ = subject.rotation.z;
    const dHiX = subject.position.x;

    // Monotonic in θ across the sweep (lightly damped = larger |tilt|).
    expect(Math.abs(dLoZ)).toBeGreaterThan(Math.abs(dMiZ));
    expect(Math.abs(dMiZ)).toBeGreaterThan(Math.abs(dHiZ));
    // Above-noise standing change low→high (the advocate noise floor was ~0.001
    // meanAbsDiff; this is a real geometric reshape of the frozen frame).
    expect(Math.abs(dLoZ - dHiZ)).toBeGreaterThan(0.02);
    expect(Math.abs(dLoX - dHiX)).toBeGreaterThan(0.02); // the card body visibly moves
    inst.setControl('damping', 0.4);

    // ── ambientSway sweep at the STATIC pin (re-seek to the same paused t) ──────
    // Higher ambientSway grows the standing ambient lean amplitude on the engaged
    // pose — a standing offset, not a wave-phase difference that vanishes at a
    // fixed t. Monotonic and above-noise on both θ and the arc-x.
    inst.seek(tPaused);
    inst.setControl('ambientSway', 0);
    const aLoZ = subject.rotation.z;
    const aLoX = subject.position.x;
    inst.setControl('ambientSway', 0.5);
    const aMiZ = subject.rotation.z;
    inst.setControl('ambientSway', 1);
    const aHiZ = subject.rotation.z;
    const aHiX = subject.position.x;

    // Monotonic: more ambientSway = larger |standing lean| at the engaged pin.
    expect(Math.abs(aHiZ)).toBeGreaterThan(Math.abs(aMiZ));
    expect(Math.abs(aMiZ)).toBeGreaterThan(Math.abs(aLoZ));
    expect(Math.abs(aHiZ - aLoZ)).toBeGreaterThan(0.02);
    expect(Math.abs(aHiX - aLoX)).toBeGreaterThan(0.02);
    inst.setControl('ambientSway', 0.45);

    inst.dispose();
  });

  it('the standing residual stays at home when DISENGAGED (idle legible, no spurious tilt)', () => {
    // The standing damping/ambient terms are gated on engagement, so a disengaged
    // cursor (center) holds NO residual regardless of damping/ambientSway — the
    // idle frame stays legible at home (no regression of the advocate's idle pass).
    const target = makeTarget(pendantDanglePrimitive);
    target.userData.pointer = { ...CENTER };
    const inst = pendantDanglePrimitive.create(target);
    const subject = target.subject as Object3D;

    settle(inst, 0, 200); // let any spring motion fully settle at center
    inst.setControl('damping', 0.05); // the extreme that holds the most residual
    inst.setControl('ambientSway', 1); // and the most ambient lean
    expect(Math.abs(subject.rotation.z)).toBeLessThan(0.05);
    expect(Math.abs(subject.position.x)).toBeLessThan(0.05);

    inst.dispose();
  });

  it('onParamChange re-applies the pose at the last seek state with no driver tick', () => {
    const target = makeTarget(pendantDanglePrimitive);
    target.userData.pointer = { ...PIN };
    const inst = pendantDanglePrimitive.create(target);
    const subject = target.subject as Object3D;

    settle(inst);
    const before = subject.rotation.z;
    // No seek() between — setControl alone must re-apply the pose.
    inst.setControl('gravity', 4);
    expect(subject.rotation.z).not.toBe(before);

    inst.dispose();
  });

  it('dispose restores the subject pose exactly and removes the rig it created', () => {
    const target = makeTarget(pendantDanglePrimitive);
    const subject = target.subject as Object3D;
    const r0 = subject.rotation.z;
    const x0 = subject.position.x;
    const y0 = subject.position.y;
    const childCount = target.object.children.length;

    target.userData.pointer = { x: 0.85, y: 0.4 };
    const inst = pendantDanglePrimitive.create(target);
    settle(inst);
    expect(target.object.getObjectByName('pendant-cord')).toBeTruthy();

    inst.dispose();
    expect(subject.rotation.z).toBe(r0);
    expect(subject.position.x).toBe(x0);
    expect(subject.position.y).toBe(y0);
    expect(target.object.getObjectByName('pendant-cord')).toBeFalsy();
    expect(target.object.getObjectByName('pendant-pin')).toBeFalsy();
    expect(target.object.children.length).toBe(childCount);
  });
});
