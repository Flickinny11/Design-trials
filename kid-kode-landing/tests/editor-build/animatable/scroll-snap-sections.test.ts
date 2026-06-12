import { describe, it, expect } from 'vitest';
import { type Object3D } from 'three';
import { scrollSnapSectionsPrimitive } from '@/lib/prism/animatable/primitives/scroll-snap-sections';
import { makeTarget, runConformance } from './_conformance';

/** Seek with an explicit scroll value (the host's scroll driver convention). */
function seekScroll(
  inst: ReturnType<typeof scrollSnapSectionsPrimitive.create>,
  target: ReturnType<typeof makeTarget>,
  scroll: number,
): void {
  target.userData.scroll = scroll;
  inst.seek(0);
}

describe('scroll-snap-sections primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollSnapSectionsPrimitive).dispose();
  });

  it('plays: travel is anchored exactly at the detents and spans subject-relative distance', () => {
    const target = makeTarget(scrollSnapSectionsPrimitive);
    const inst = scrollSnapSectionsPrimitive.create(target);
    const subject = target.subject as Object3D;
    const baseY = subject.position.y;

    // Default 4 sections -> detents at 0, 1/3, 2/3, 1. At a detent the shaped
    // progress is EXACT (sigmoid normalized to 0/1 at segment ends), so y at
    // the detents divides the travel into exact thirds.
    seekScroll(inst, target, 0);
    const y0 = subject.position.y;
    seekScroll(inst, target, 1);
    const y1 = subject.position.y;
    const travel = y1 - y0;

    // Subject-relative span: the card subject's median bbox dim is ~1.12, so
    // default 0.7 x size lands the full travel around 0.78 world units.
    expect(travel).toBeGreaterThan(0.4);
    expect(travel).toBeLessThan(1.5);
    // Travel is centered on the rest pose (idle sits half a span below base).
    expect(y0).toBeCloseTo(baseY - travel / 2, 6);

    seekScroll(inst, target, 1 / 3);
    expect(subject.position.y).toBeCloseTo(y0 + travel / 3, 6);
    seekScroll(inst, target, 2 / 3);
    expect(subject.position.y).toBeCloseTo(y0 + (2 * travel) / 3, 6);

    inst.dispose();
  });

  it('quantizes: at max sharpness the card dwells at a detent and jumps mid-segment', () => {
    const target = makeTarget(scrollSnapSectionsPrimitive);
    const inst = scrollSnapSectionsPrimitive.create(target);
    const subject = target.subject as Object3D;

    inst.setControl('sharpness', 1);

    seekScroll(inst, target, 0);
    const y0 = subject.position.y;
    seekScroll(inst, target, 1);
    const travel = subject.position.y - y0;
    const w = 1 / 3; // segment width at 4 sections

    // Dwell: 10% into a segment the card has barely left the detent.
    seekScroll(inst, target, 1 / 3);
    const yDetent = subject.position.y;
    seekScroll(inst, target, 1 / 3 + 0.1 * w);
    expect(Math.abs(subject.position.y - yDetent)).toBeLessThan(0.05 * travel);

    // Jump: 55% into the segment (past the early transition center) the card
    // has already snapped to within 5% of the NEXT detent.
    seekScroll(inst, target, 2 / 3);
    const yNext = subject.position.y;
    seekScroll(inst, target, 1 / 3 + 0.55 * w);
    expect(Math.abs(subject.position.y - yNext)).toBeLessThan(0.05 * travel);

    inst.dispose();
  });

  it('controls reshape the pose at the pinned mid-state (scroll=0.5)', () => {
    const target = makeTarget(scrollSnapSectionsPrimitive);
    const inst = scrollSnapSectionsPrimitive.create(target);
    const subject = target.subject as Object3D;
    const baseY = subject.position.y;
    const baseScaleY = subject.scale.y;

    // sections: 2 -> scroll 0.5 is deep in the single segment's settle (large
    // +y offset); 5 -> scroll 0.5 IS a detent (y exactly at base).
    seekScroll(inst, target, 0.5);
    inst.setControl('sections', 2);
    const y2 = subject.position.y;
    inst.setControl('sections', 5);
    const y5 = subject.position.y;
    expect(Math.abs(y5 - baseY)).toBeLessThan(1e-6);
    expect(Math.abs(y2 - y5)).toBeGreaterThan(0.1);

    // sharpness (back at default sections): soft -> near mid-glide, hard ->
    // pulled onto the upcoming detent. The y offset visibly shifts.
    inst.setControl('sections', 4);
    inst.setControl('sharpness', 0);
    seekScroll(inst, target, 0.5);
    const ySoft = subject.position.y;
    inst.setControl('sharpness', 1);
    seekScroll(inst, target, 0.5);
    const yHard = subject.position.y;
    expect(Math.abs(yHard - ySoft)).toBeGreaterThan(0.05);

    // span: the same shaped progress maps over a longer travel -> bigger offset.
    inst.setControl('sharpness', 0.55);
    inst.setControl('span', 0.3);
    seekScroll(inst, target, 0.5);
    const yShort = subject.position.y - baseY;
    inst.setControl('span', 1.6);
    seekScroll(inst, target, 0.5);
    const yLong = subject.position.y - baseY;
    expect(Math.abs(yLong - yShort)).toBeGreaterThan(0.1);
    expect(Math.abs(yLong)).toBeGreaterThan(Math.abs(yShort));

    // bounce: zero -> undeformed scale; max -> the landing squash is live at
    // the pinned frame (scroll 0.5 sits in the settle window).
    inst.setControl('span', 0.7);
    inst.setControl('bounce', 0);
    seekScroll(inst, target, 0.5);
    const scaleNoBounce = subject.scale.y;
    inst.setControl('bounce', 0.35);
    seekScroll(inst, target, 0.5);
    const scaleFullBounce = subject.scale.y;
    expect(Math.abs(scaleNoBounce - baseScaleY)).toBeLessThan(1e-6);
    expect(Math.abs(scaleFullBounce - scaleNoBounce)).toBeGreaterThan(0.05);

    inst.dispose();
  });

  it('onParamChange re-applies the pose at the last seek state without a new seek', () => {
    const target = makeTarget(scrollSnapSectionsPrimitive);
    const inst = scrollSnapSectionsPrimitive.create(target);
    const subject = target.subject as Object3D;

    seekScroll(inst, target, 0.5);
    const before = subject.position.y;
    // No seek after this — setControl alone must reshape the pinned pose.
    inst.setControl('sections', 2);
    expect(Math.abs(subject.position.y - before)).toBeGreaterThan(0.1);

    inst.dispose();
  });

  it('every sampled frame stays legible and inside the default travel envelope', () => {
    const target = makeTarget(scrollSnapSectionsPrimitive);
    const inst = scrollSnapSectionsPrimitive.create(target);
    const subject = target.subject as Object3D;
    const baseY = subject.position.y;

    seekScroll(inst, target, 0);
    const y0 = subject.position.y;
    seekScroll(inst, target, 1);
    const travel = subject.position.y - y0;

    for (let i = 0; i <= 20; i++) {
      seekScroll(inst, target, i / 20);
      // Position never leaves the +-half-travel envelope around the rest pose.
      expect(Math.abs(subject.position.y - baseY)).toBeLessThanOrEqual(travel / 2 + 1e-9);
      // Scale never collapses or balloons — the subject stays plainly legible.
      expect(subject.scale.y).toBeGreaterThan(0.8);
      expect(subject.scale.y).toBeLessThan(1.25);
      expect(subject.scale.x).toBeGreaterThan(0.8);
      expect(subject.scale.x).toBeLessThan(1.25);
    }

    // The idle frame (scroll=0) is an exact, undeformed rest pose.
    seekScroll(inst, target, 0);
    expect(subject.scale.x).toBeCloseTo(1, 9);
    expect(subject.scale.y).toBeCloseTo(1, 9);

    inst.dispose();
  });

  it('dispose restores position and scale exactly', () => {
    const target = makeTarget(scrollSnapSectionsPrimitive);
    const subject = target.subject as Object3D;
    const baseY = subject.position.y;
    const baseSX = subject.scale.x;
    const baseSY = subject.scale.y;
    const baseSZ = subject.scale.z;

    const inst = scrollSnapSectionsPrimitive.create(target);
    seekScroll(inst, target, 0.7);
    // Mid-play the pose is actually displaced (the test would be vacuous otherwise).
    expect(subject.position.y).not.toBe(baseY);

    inst.dispose();
    expect(subject.position.y).toBe(baseY);
    expect(subject.scale.x).toBe(baseSX);
    expect(subject.scale.y).toBe(baseSY);
    expect(subject.scale.z).toBe(baseSZ);
  });
});
