import { describe, it, expect } from 'vitest';
import { type Object3D } from 'three';
import { scrollFlipBookPrimitive } from '@/lib/prism/animatable/primitives/scroll-flip-book';
import { makeTarget, runConformance } from './_conformance';

// Total tumble roll across the whole book (frame 0 → frame N-1): 270°.
const TUMBLE_TOTAL = Math.PI * 1.5;

// NOTE on the scroll rig: this primitive is POSITION-centric by design — the
// pose is a pure function of the scroll value (quantized to a frame index), so
// the advocate's pinned-control sweep at scroll=0.5 (repeated seeks, zero
// velocity) always shows an engaged mid-riffle pose, and every control below
// is asserted to reshape that exact pinned frame. No velocity proxy exists, so
// no velocity/state test applies.

/** Instance with deterministic baseline controls (no hold warp, no jitter) so
 *  frame indices map uniformly: idx = floor(scroll * frames), frames = 8. */
function makeBaseline() {
  const target = makeTarget(scrollFlipBookPrimitive);
  const inst = scrollFlipBookPrimitive.create(target, { holdRatio: 0, jitter: 0 });
  return { target, inst, subject: target.subject as Object3D };
}

describe('scroll-flip-book primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollFlipBookPrimitive).dispose();
  });

  it('scroll response: pristine rest pose at 0, quantized tumble poses at 0.5 and 1', () => {
    const { target, inst, subject } = makeBaseline();

    // scroll=0 → frame 0 = the untouched cover page (idle-frame legibility).
    target.userData.scroll = 0;
    inst.seek(0);
    expect(subject.rotation.z).toBeCloseTo(0, 10);
    expect(subject.position.x).toBeCloseTo(0, 10);
    expect(subject.position.y).toBeCloseTo(0, 10);
    expect(subject.scale.x).toBeCloseTo(1, 10);
    expect(subject.scale.y).toBeCloseTo(1, 10);

    // scroll=0.5 → idx = floor(0.5*8) = 4 → f = 4/7 → rotZ = f * 1.5π.
    target.userData.scroll = 0.5;
    inst.seek(1);
    expect(subject.rotation.z).toBeCloseTo((4 / 7) * TUMBLE_TOTAL, 6);
    // Mid-riffle drift is real (subject-relative, but plainly nonzero).
    expect(Math.abs(subject.position.x)).toBeGreaterThan(0.01);

    // scroll=1 → last frame → the full 270° roll, drift returned to center.
    target.userData.scroll = 1;
    inst.seek(2);
    expect(subject.rotation.z).toBeCloseTo(TUMBLE_TOTAL, 6);
    expect(Math.abs(subject.position.x)).toBeLessThan(1e-6);

    inst.dispose();
  });

  it('hard cuts: pose is EXACTLY identical within a slot, jumps across the boundary', () => {
    const { target, inst, subject } = makeBaseline();

    // Slot 4 spans scroll ∈ [0.5, 0.625) at frames=8 — same page, same pose,
    // bit-for-bit (the stop-motion signature: zero interpolation).
    target.userData.scroll = 0.5;
    inst.seek(0);
    const rotA = subject.rotation.z;
    const posA = subject.position.x;
    target.userData.scroll = 0.62;
    inst.seek(0.1);
    expect(subject.rotation.z).toBe(rotA);
    expect(subject.position.x).toBe(posA);

    // Crossing into slot 5 → a cut: rotation jumps by 1.5π/7 ≈ 0.67 rad —
    // large enough to read as a thumbed page, not a tween.
    target.userData.scroll = 0.63;
    inst.seek(0.2);
    expect(Math.abs(subject.rotation.z - rotA)).toBeGreaterThan(0.3);

    inst.dispose();
  });

  it('controls reshape the pose at scroll=0.5 (the advocate pinned frame)', () => {
    const { target, inst, subject } = makeBaseline();

    target.userData.scroll = 0.5;
    inst.seek(1);
    const tumbleRotZ = subject.rotation.z;

    // frames: fewer pages → a different quantized pose at the same scroll.
    // frames=5 → idx = floor(0.5*5) = 2 → f = 0.5 → rotZ = 0.75π.
    // (onParamChange re-applies at the last seek state — no extra seek here.)
    inst.setControl('frames', 5);
    expect(subject.rotation.z).toBeCloseTo(0.5 * TUMBLE_TOTAL, 6);
    expect(Math.abs(subject.rotation.z - tumbleRotZ)).toBeGreaterThan(0.05);
    inst.setControl('frames', 8);

    // sequence: spin re-poses immediately — yaw appears, tumble roll vanishes.
    inst.setControl('sequence', 'spin');
    expect(Math.abs(subject.rotation.y)).toBeGreaterThan(1); // f=4/7 → yaw ≈ 3.59
    expect(subject.rotation.z).toBeCloseTo(0, 6);
    inst.setControl('sequence', 'tumble');

    // jitter: the hand wobble shifts the SAME frame's pose.
    const cleanX = subject.position.x;
    const cleanRot = subject.rotation.z;
    inst.setControl('jitter', 1);
    const moved =
      Math.abs(subject.position.x - cleanX) + Math.abs(subject.rotation.z - cleanRot);
    expect(moved).toBeGreaterThan(1e-3);
    inst.setControl('jitter', 0);

    // holdRatio: early pages hold longer → a DIFFERENT (earlier) frame is
    // selected at the same scroll → the pinned pose visibly changes.
    inst.setControl('holdRatio', 1);
    expect(Math.abs(subject.rotation.z - cleanRot)).toBeGreaterThan(0.3);

    inst.dispose();
  });

  it('hold warp keeps the endpoints anchored: frame 0 at scroll=0, last frame at scroll=1', () => {
    const target = makeTarget(scrollFlipBookPrimitive);
    const inst = scrollFlipBookPrimitive.create(target, { holdRatio: 1, jitter: 0 });
    const subject = target.subject as Object3D;

    target.userData.scroll = 0;
    inst.seek(0);
    expect(subject.rotation.z).toBeCloseTo(0, 10); // cover page, pristine

    target.userData.scroll = 1;
    inst.seek(1);
    expect(subject.rotation.z).toBeCloseTo(TUMBLE_TOTAL, 6); // back cover

    inst.dispose();
  });

  it('spin keeps every sampled frame legible (constant lean shows a face near edge-on)', () => {
    const { target, inst, subject } = makeBaseline();
    inst.setControl('sequence', 'spin');
    for (let i = 0; i <= 16; i++) {
      target.userData.scroll = i / 16;
      inst.seek(i * 0.1);
      // Scale pulses never collapse the card.
      expect(subject.scale.x).toBeGreaterThan(0.5);
      expect(subject.scale.y).toBeGreaterThan(0.5);
      const idx = Math.min(7, Math.floor((i / 16) * 8));
      // Once spinning, the x-lean keeps a face band visible at any yaw.
      if (idx > 0) expect(subject.rotation.x).toBeGreaterThan(0.1);
      else expect(subject.rotation.x).toBeCloseTo(0, 10);
    }
    inst.dispose();
  });

  it('bounce: arc hops lift the card and squash the grounded frames', () => {
    const { target, inst, subject } = makeBaseline();
    inst.setControl('sequence', 'bounce');

    // frames=8: idx 2 → f=2/7 → mid-arc of hop 1 → lifted, no squash bias.
    target.userData.scroll = 2 / 8 + 0.01;
    inst.seek(0);
    expect(subject.position.y).toBeGreaterThan(0.05);

    // idx 7 → f=1 → grounded landing frame → y≈0, squashed (scaleY < 1 < scaleX).
    target.userData.scroll = 1;
    inst.seek(1);
    expect(Math.abs(subject.position.y)).toBeLessThan(1e-6);
    expect(subject.scale.y).toBeLessThan(0.99);
    expect(subject.scale.x).toBeGreaterThan(1.01);

    inst.dispose();
  });

  it('dispose restores the full transform exactly', () => {
    const target = makeTarget(scrollFlipBookPrimitive);
    const inst = scrollFlipBookPrimitive.create(target); // premium defaults: hold + jitter on
    const subject = target.subject as Object3D;
    const base = {
      px: subject.position.x, py: subject.position.y, pz: subject.position.z,
      rx: subject.rotation.x, ry: subject.rotation.y, rz: subject.rotation.z,
      sx: subject.scale.x, sy: subject.scale.y, sz: subject.scale.z,
    };

    target.userData.scroll = 0.7;
    inst.seek(1);
    target.userData.scroll = 0.3;
    inst.seek(2);
    // It actually moved before dispose.
    expect(
      Math.abs(subject.rotation.z - base.rz) + Math.abs(subject.position.x - base.px),
    ).toBeGreaterThan(1e-3);

    inst.dispose();
    expect(subject.position.x).toBe(base.px);
    expect(subject.position.y).toBe(base.py);
    expect(subject.position.z).toBe(base.pz);
    expect(subject.rotation.x).toBe(base.rx);
    expect(subject.rotation.y).toBe(base.ry);
    expect(subject.rotation.z).toBe(base.rz);
    expect(subject.scale.x).toBe(base.sx);
    expect(subject.scale.y).toBe(base.sy);
    expect(subject.scale.z).toBe(base.sz);
  });
});
