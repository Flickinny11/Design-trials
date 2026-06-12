// scroll-scene-scrub — conformance + behavior. Scroll scrubs a paused gsap
// timeline with three labeled acts (rise+tilt-in / yaw presentation turn /
// settle+scale-forward). The pose is a pure function of scroll POSITION (no
// velocity proxy — repeated seeks at the same scroll are idempotent by
// construction, so no separate velocity/state test applies). All travel is
// subject-relative (median bbox dim of the card ≈ 1.12 local units).

import { describe, it, expect } from 'vitest';
import { type Object3D } from 'three';
import { scrollSceneScrubPrimitive } from '@/lib/prism/animatable/primitives/scroll-scene-scrub';
import { makeTarget, runConformance } from './_conformance';

// Defaults encoded in the schema (kept in sync with the implementation).
const RISE_DEFAULT = 0.45; // ×size
const SETTLE_SCALE_DEFAULT = 1.18;
// Implementation constants the numeric assertions derive from.
const LIFT_FRAC = 0.3; // presentation hold = LIFT_FRAC × rise × size above base
const FWD_FRAC = 0.22; // settle-forward z = FWD_FRAC × size
const TILT_IN_RAD = (24 * Math.PI) / 180;
// Card subject median bbox dim (1.74 × 1.12 × 0.14 → median 1.12).
const SIZE = 1.12;

function rig() {
  const target = makeTarget(scrollSceneScrubPrimitive);
  const inst = scrollSceneScrubPrimitive.create(target);
  const subject = target.subject as Object3D;
  const at = (scroll: number, t = 0): void => {
    target.userData.scroll = scroll;
    inst.seek(t);
  };
  return { target, inst, subject, at };
}

describe('scroll-scene-scrub primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollSceneScrubPrimitive).dispose();
  });

  it('plays a three-act film: concrete poses at scroll 0 / 0.5 / 1', () => {
    const { inst, subject, at } = rig();

    // ACT 1 start (scroll=0, the pinned idle frame): risen-from-below rest
    // pose — dropped by rise×size, tilted back, facing front, unscaled. The
    // card is on screen and fully legible (drop ≈ 0.50 keeps it in the
    // fov-40/z-3.2 tile frame), never invisible.
    at(0);
    expect(subject.position.y).toBeCloseTo(-RISE_DEFAULT * SIZE, 3); // −0.504
    expect(subject.rotation.x).toBeCloseTo(TILT_IN_RAD, 3);
    expect(subject.rotation.y).toBeCloseTo(0, 5);
    expect(subject.position.z).toBeCloseTo(0, 5);
    expect(subject.scale.x).toBeCloseTo(1, 5);

    // ACT 2 middle (scroll=0.5, the advocate's pinned control frame): the rise
    // act is complete — the card holds a LIFTED presentation pose (an engaged
    // mid-state, lift = LIFT_FRAC×rise×size) and is mid-way through its yaw
    // presentation turn. Tilt-in has fully resolved; settle has not begun.
    at(0.5);
    expect(subject.position.y).toBeCloseTo(LIFT_FRAC * RISE_DEFAULT * SIZE, 3); // +0.1512
    expect(subject.rotation.x).toBeCloseTo(0, 3);
    expect(Math.abs(subject.rotation.y)).toBeGreaterThan(0.5); // deep in the turn
    expect(subject.position.z).toBeCloseTo(0, 3); // settle not started
    expect(subject.scale.x).toBeGreaterThan(1.005); // partial grow while presenting
    expect(subject.scale.x).toBeLessThan(SETTLE_SCALE_DEFAULT);

    // ACT 3 end (scroll=1): settled — back at base height, facing front, parked
    // forward by FWD_FRAC×size, scaled to exactly settleScale.
    at(1);
    expect(subject.position.y).toBeCloseTo(0, 4);
    expect(subject.rotation.y).toBeCloseTo(0, 4);
    expect(subject.position.z).toBeCloseTo(FWD_FRAC * SIZE, 3); // +0.2464
    expect(subject.scale.x).toBeCloseTo(SETTLE_SCALE_DEFAULT, 3);

    inst.dispose();
  });

  it('acts read as distinct beats, not one blended tween', () => {
    const { inst, subject, at } = rig();

    // Yaw is confined to act 2: ~0 at both ends, peaked through the middle.
    at(0);
    const yawStart = Math.abs(subject.rotation.y);
    at(0.5);
    const yawMid = Math.abs(subject.rotation.y);
    at(1);
    const yawEnd = Math.abs(subject.rotation.y);
    expect(yawStart).toBeLessThan(0.01);
    expect(yawEnd).toBeLessThan(0.01);
    expect(yawMid).toBeGreaterThan(0.5);

    // Settle-forward z is confined to act 3 (starts at progress 0.72 at the
    // default act balance): still ~0 just before the boundary, ramped after.
    at(0.7);
    expect(Math.abs(subject.position.z)).toBeLessThan(0.01);
    at(0.9);
    expect(subject.position.z).toBeGreaterThan(0.1);

    // Tilt-in is confined to act 1: fully resolved by mid-scroll.
    at(0.34);
    expect(Math.abs(subject.rotation.x)).toBeLessThan(0.01);

    inst.dispose();
  });

  it('every control reshapes the pose at scroll=0.5, re-applied by onParamChange without a new seek', () => {
    const { inst, subject, at } = rig();

    // Pin the advocate frame once; all subsequent pose changes must come from
    // setControl alone (onParamChange re-applies at the last seek state).
    at(0.5);
    const y0 = subject.position.y;
    const yaw0 = Math.abs(subject.rotation.y);
    const s0 = subject.scale.x;

    // riseAmount → taller presentation lift at mid.
    inst.setControl('riseAmount', 1.0);
    expect(subject.position.y).toBeGreaterThan(y0 + 0.1);
    inst.setControl('riseAmount', 0.45);

    // turnDeg → wider yaw at mid.
    inst.setControl('turnDeg', 120);
    expect(Math.abs(subject.rotation.y)).toBeGreaterThan(yaw0 + 0.3);
    inst.setControl('turnDeg', 55);

    // settleScale → bigger partial grow at mid.
    inst.setControl('settleScale', 1.6);
    expect(subject.scale.x).toBeGreaterThan(s0 + 0.04);
    inst.setControl('settleScale', 1.18);

    // actBalance → rebuilds act durations; at the same scroll the playhead
    // lands elsewhere in the turn, so the yaw visibly changes.
    inst.setControl('actBalance', 0);
    const yawRiseHeavy = Math.abs(subject.rotation.y);
    inst.setControl('actBalance', 1);
    const yawSettleHeavy = Math.abs(subject.rotation.y);
    expect(Math.abs(yawRiseHeavy - yaw0)).toBeGreaterThan(0.2);
    expect(Math.abs(yawSettleHeavy - yawRiseHeavy)).toBeGreaterThan(0.05);

    inst.dispose();
  });

  it('scrubs deterministically in both directions', () => {
    const { inst, subject, at } = rig();

    at(0.25);
    const y = subject.position.y;
    const yaw = subject.rotation.y;
    const tilt = subject.rotation.x;
    const z = subject.position.z;
    const s = subject.scale.x;

    // Scrub to the end, then back — the same scroll must produce the same pose
    // (fromTo-pinned start values; no playhead-direction state).
    at(1);
    at(0.25);
    expect(subject.position.y).toBeCloseTo(y, 6);
    expect(subject.rotation.y).toBeCloseTo(yaw, 6);
    expect(subject.rotation.x).toBeCloseTo(tilt, 6);
    expect(subject.position.z).toBeCloseTo(z, 6);
    expect(subject.scale.x).toBeCloseTo(s, 6);

    inst.dispose();
  });

  it('dispose restores every transform it touched', () => {
    const { inst, subject, at } = rig();

    const baseY = 0;
    const baseZ = 0;

    at(0.63); // mid-film: y, z, both rotations, and scale all displaced
    expect(
      subject.position.y !== baseY ||
        subject.rotation.y !== 0 ||
        subject.scale.x !== 1,
    ).toBe(true);

    inst.dispose();
    expect(subject.position.y).toBeCloseTo(baseY, 6);
    expect(subject.position.z).toBeCloseTo(baseZ, 6);
    expect(subject.rotation.x).toBeCloseTo(0, 6);
    expect(subject.rotation.y).toBeCloseTo(0, 6);
    expect(subject.scale.x).toBeCloseTo(1, 6);
    expect(subject.scale.y).toBeCloseTo(1, 6);
    expect(subject.scale.z).toBeCloseTo(1, 6);
  });
});
