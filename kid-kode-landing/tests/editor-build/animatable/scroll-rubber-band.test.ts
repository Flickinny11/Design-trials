import { describe, it, expect } from 'vitest';
import { Mesh, type Material, type Object3D } from 'three';
import { scrollRubberBandPrimitive } from '@/lib/prism/animatable/primitives/scroll-rubber-band';
import { makeTarget, runConformance } from './_conformance';
import type { Animatable, AnimatableTarget } from '@/lib/prism/animatable/contract';

/** Drive one scroll-frame: set the scroll signal, then seek the clock. */
function seekAt(inst: Animatable, target: AnimatableTarget, t: number, scroll: number): void {
  target.userData.scroll = scroll;
  inst.seek(t);
}

describe('scroll-rubber-band primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollRubberBandPrimitive).dispose();
  });

  it('idle frame (scroll=0) is a legible rest pose: in-frame offset, zero deformation', () => {
    const target = makeTarget(scrollRubberBandPrimitive);
    const inst = scrollRubberBandPrimitive.create(target);
    const subject = target.subject as Object3D;

    seekAt(inst, target, 0, 0);
    // Rests low on the band (negative y offset), but well inside the tile frame.
    expect(subject.position.y).toBeLessThan(-0.02);
    expect(subject.position.y).toBeGreaterThan(-0.45);
    // No motion yet -> no tension deformation: scale is exactly base.
    expect(subject.scale.x).toBeCloseTo(1, 9);
    expect(subject.scale.y).toBeCloseTo(1, 9);
    expect(subject.scale.z).toBeCloseTo(1, 9);
    inst.dispose();
  });

  it('scroll response: exact anchor ratios + linear middle vs compressed ends', () => {
    const target = makeTarget(scrollRubberBandPrimitive);
    const inst = scrollRubberBandPrimitive.create(target);
    const subject = target.subject as Object3D;
    const baseY = 0; // card subject mounts at the group origin

    seekAt(inst, target, 0, 0);
    const pos0 = subject.position.y;
    seekAt(inst, target, 1, 0.4);
    const pos04 = subject.position.y;
    seekAt(inst, target, 2, 0.5);
    const pos05 = subject.position.y;
    seekAt(inst, target, 3, 0.9);
    const pos09 = subject.position.y;
    seekAt(inst, target, 4, 1);
    const pos1 = subject.position.y;

    // The sigmoid's anchor points are exact for ANY resistance: g(0)=0,
    // g(0.5)=0.5, g(1)=1 with rest anchor 0.3 ->
    //   offset(0)/offset(0.5) = (0-0.3)/(0.5-0.3) = -1.5
    //   offset(1)/offset(0.5) = (1-0.3)/(0.5-0.3) = 3.5
    expect((pos0 - baseY) / (pos05 - baseY)).toBeCloseTo(-1.5, 6);
    expect((pos1 - baseY) / (pos05 - baseY)).toBeCloseTo(3.5, 6);

    // Engaged mid-state: at scroll=0.5 the card sits visibly ABOVE rest/base.
    expect(pos05 - baseY).toBeGreaterThan(0.05);

    // Rubber-band feel: near-linear middle, straining ends. The same 0.1 of
    // scroll moves the card far more through the middle than at the top end.
    const midStep = pos05 - pos04;
    const endStep = pos1 - pos09;
    expect(midStep).toBeGreaterThan(0);
    expect(endStep).toBeGreaterThan(0);
    expect(midStep / endStep).toBeGreaterThan(2.5);
    inst.dispose();
  });

  it('resistance reshapes the WHOLE position curve (visible away from anchors)', () => {
    const soft = makeTarget(scrollRubberBandPrimitive);
    const instSoft = scrollRubberBandPrimitive.create(soft, { resistance: 0.5 });
    const hard = makeTarget(scrollRubberBandPrimitive);
    const instHard = scrollRubberBandPrimitive.create(hard, { resistance: 8 });

    seekAt(instSoft, soft, 0, 0);
    seekAt(instSoft, soft, 1, 0.25);
    seekAt(instHard, hard, 0, 0);
    seekAt(instHard, hard, 1, 0.25);

    const ySoft = (soft.subject as Object3D).position.y;
    const yHard = (hard.subject as Object3D).position.y;
    // High resistance flattens the ends: at scroll=0.25 the stiff band has
    // barely left the rest pose, the near-linear band is much further along.
    expect(ySoft - yHard).toBeGreaterThan(0.05);
    instSoft.dispose();
    instHard.dispose();
  });

  it('strain release: reversing out of the end zone twangs through a damped elastic settle', () => {
    // Instance A scrolls deep into the top end zone, then reverses.
    const a = makeTarget(scrollRubberBandPrimitive);
    const instA = scrollRubberBandPrimitive.create(a);
    const subjA = a.subject as Object3D;
    seekAt(instA, a, 0, 0);
    seekAt(instA, a, 0.5, 0.5);
    seekAt(instA, a, 1, 0.9);
    seekAt(instA, a, 1.5, 0.99); // deep in the end zone -> strain stored
    seekAt(instA, a, 2, 0.8); // reversal -> release fires at t=2

    // Instance B reaches the same scroll WITHOUT entering the end zone: its
    // position is the pure resisted mapping (no twang). Position is
    // time-independent absent a release, so one read suffices.
    const b = makeTarget(scrollRubberBandPrimitive);
    const instB = scrollRubberBandPrimitive.create(b);
    seekAt(instB, b, 0, 0);
    seekAt(instB, b, 0.5, 0.4);
    seekAt(instB, b, 1, 0.8);
    const pure = (b.subject as Object3D).position.y;

    // Early in the settle the twang pulls back toward center (below pure)...
    seekAt(instA, a, 2.08, 0.8);
    const early = subjA.position.y;
    expect(pure - early).toBeGreaterThan(0.04);

    // ...half a wobble later it overshoots the other way (above pure)...
    seekAt(instA, a, 2.24, 0.8);
    const swing = subjA.position.y;
    expect(swing - pure).toBeGreaterThan(0.015);

    // ...and the oscillation is damped: two seconds on, it has settled.
    seekAt(instA, a, 4, 0.8);
    expect(Math.abs(subjA.position.y - pure)).toBeLessThan(0.005);

    instA.dispose();
    instB.dispose();
  });

  it('controls reshape the ENGAGED pose at scroll=0.5 with no further seek (onParamChange re-applies)', () => {
    const target = makeTarget(scrollRubberBandPrimitive);
    const inst = scrollRubberBandPrimitive.create(target);
    const subject = target.subject as Object3D;

    // Approach the pinned frame with motion (the rig's cosine stimulus has
    // peak velocity at scroll=0.5) so the impulse envelope is charged.
    seekAt(inst, target, 0, 0);
    seekAt(inst, target, 0.5, 0.25);
    seekAt(inst, target, 1, 0.5);

    // Engaged mid-state: midrange tension stretches the card along the axis.
    const stretch1 = subject.scale.y;
    expect(stretch1).toBeGreaterThan(1.1);
    // Volume-preserving: the cross axes pinch while the travel axis stretches.
    expect(subject.scale.x).toBeLessThan(1);
    const posY1 = subject.position.y;

    // resistance sweep (no seek): stiffer band = more midrange tension.
    inst.setControl('resistance', 8);
    const stretch2 = subject.scale.y;
    expect(stretch2).toBeGreaterThan(stretch1 + 0.05);
    expect(subject.position.y).toBeCloseTo(posY1, 6); // mapping midpoint unmoved

    // elasticity sweep (no seek): a dead band stops deforming entirely.
    inst.setControl('elasticity', 0);
    expect(subject.scale.y).toBeCloseTo(1, 6);
    inst.setControl('elasticity', 0.55);

    // span sweep (no seek): the engaged offset scales linearly with travel.
    inst.setControl('span', 0.9);
    const posY2 = subject.position.y;
    expect(posY2 / posY1).toBeCloseTo(0.9 / 0.5, 5);

    // axis sweep (no seek): the whole pose pivots onto x; y returns to base.
    inst.setControl('axis', 'x');
    expect(subject.position.x).toBeCloseTo(posY2, 6);
    expect(subject.position.y).toBeCloseTo(0, 9);
    expect(subject.scale.x).toBeGreaterThan(1.05);

    inst.dispose();
  });

  it('dispose restores transforms exactly and never touched materials', () => {
    const target = makeTarget(scrollRubberBandPrimitive);
    const subject = target.subject as Object3D;
    const basePos = subject.position.clone();
    const baseScale = subject.scale.clone();

    const inst = scrollRubberBandPrimitive.create(target);
    // Full workout including a strain release.
    seekAt(inst, target, 0, 0);
    seekAt(inst, target, 0.5, 0.5);
    seekAt(inst, target, 1, 0.98);
    seekAt(inst, target, 1.5, 0.7);
    inst.setControl('axis', 'x');
    inst.dispose();

    expect(subject.position.x).toBe(basePos.x);
    expect(subject.position.y).toBe(basePos.y);
    expect(subject.position.z).toBe(basePos.z);
    expect(subject.scale.x).toBe(baseScale.x);
    expect(subject.scale.y).toBe(baseScale.y);
    expect(subject.scale.z).toBe(baseScale.z);

    // Transform-only primitive: the subject's own materials were never written.
    const mat = (subject as Mesh).material as Material & { opacity: number };
    expect(mat.opacity).toBe(1);
  });
});
