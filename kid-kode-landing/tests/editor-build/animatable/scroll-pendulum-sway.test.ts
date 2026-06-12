import { describe, it, expect } from 'vitest';
import { Mesh, Object3D } from 'three';
import { scrollPendulumSwayPrimitive } from '@/lib/prism/animatable/primitives/scroll-pendulum-sway';
import { makeTarget, runConformance } from './_conformance';

/** The harness/advocate rig's scroll stimulus: scroll(t) = 0.5 - 0.5*cos(2πt/4). */
const cosineScroll = (t: number): number => 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 4);

describe('scroll-pendulum-sway primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollPendulumSwayPrimitive).dispose();
  });

  it('rests legible and near-square at scroll=0 with the hanger rig visible (idle frame)', () => {
    const target = makeTarget(scrollPendulumSwayPrimitive);
    const inst = scrollPendulumSwayPrimitive.create(target);
    const subject = target.subject as Object3D;

    target.userData.scroll = 0;
    inst.seek(0);

    // Fully legible at rest: essentially square, essentially centered.
    expect(Math.abs(subject.rotation.z)).toBeLessThan(0.02);
    expect(Math.abs(subject.position.x)).toBeLessThan(0.02);
    // The pendant rig (pivot pin + cord) reads even at rest.
    expect(target.object.getObjectByName('pendulum-cord')).toBeTruthy();
    expect(target.object.getObjectByName('pendulum-pin')).toBeTruthy();

    inst.dispose();
  });

  it('scroll sweep kicks a hanging swing: rotation plus pivot-arm translation, not spin-in-place', () => {
    const target = makeTarget(scrollPendulumSwayPrimitive);
    const inst = scrollPendulumSwayPrimitive.create(target);
    const subject = target.subject as Object3D;

    // Drive the rig cosine stimulus from t=0 to t=1 (scroll 0 -> 0.5, max velocity).
    for (let i = 0; i <= 15; i++) {
      const t = i / 15;
      target.userData.scroll = cosineScroll(t);
      inst.seek(t);
    }

    const theta = subject.rotation.z;
    expect(Math.abs(theta)).toBeGreaterThan(0.04); // engaged swing
    // Translate-rotate-translate about the TOP pivot: the origin swings along an
    // arc — x displaces with the same sign as the angle, y rises (never sinks).
    expect(Math.abs(subject.position.x)).toBeGreaterThan(0.02);
    expect(Math.sign(subject.position.x)).toBe(Math.sign(theta));
    expect(subject.position.y).toBeGreaterThanOrEqual(-1e-6);

    inst.dispose();
  });

  it('inertia carries the swing while scroll holds; stillness settles it (velocity/state)', () => {
    const target = makeTarget(scrollPendulumSwayPrimitive);
    const inst = scrollPendulumSwayPrimitive.create(target);
    const subject = target.subject as Object3D;
    inst.setControl('ambientSway', 0); // isolate the physics from the living hold

    // Pump: full cosine sweep 0..2s (scroll 0 -> 1).
    for (let i = 0; i <= 30; i++) {
      const t = (i / 30) * 2;
      target.userData.scroll = cosineScroll(t);
      inst.seek(t);
    }

    // Hold scroll at 1. Early: the spring still rings (inertia carries it).
    target.userData.scroll = 1;
    let prev = subject.rotation.z;
    let earlyMax = 0;
    for (let i = 1; i <= 6; i++) {
      inst.seek(2 + i * 0.1);
      earlyMax = Math.max(earlyMax, Math.abs(subject.rotation.z - prev));
      prev = subject.rotation.z;
    }
    expect(earlyMax).toBeGreaterThan(0.003);

    // Let it settle for ~5s of held scroll.
    for (let i = 1; i <= 48; i++) inst.seek(2.6 + i * 0.1);

    // Late: settled — per-step deltas collapse to ~0.
    prev = subject.rotation.z;
    let lateMax = 0;
    for (let i = 1; i <= 6; i++) {
      inst.seek(7.4 + i * 0.1);
      lateMax = Math.max(lateMax, Math.abs(subject.rotation.z - prev));
      prev = subject.rotation.z;
    }
    expect(lateMax).toBeLessThan(0.002);
    // Settled INTO the scroll-position drag lean — still engaged, never empty.
    expect(Math.abs(subject.rotation.z)).toBeGreaterThan(0.05);

    inst.dispose();
  });

  it('every control reshapes the pinned t=1 / scroll=0.5 frame (advocate control-sweep)', () => {
    const target = makeTarget(scrollPendulumSwayPrimitive);
    const inst = scrollPendulumSwayPrimitive.create(target);
    const subject = target.subject as Object3D;

    // Worst-case pin: a DIRECT first seek at t=1 (no impulse history at all).
    target.userData.scroll = 0.5;
    inst.seek(1);
    const baseTheta = subject.rotation.z;
    expect(Math.abs(baseTheta)).toBeGreaterThan(0.02); // engaged mid-state, never flat

    // Repeated seeks at the same t are stable (paused frame is reproducible).
    inst.seek(1);
    expect(subject.rotation.z).toBeCloseTo(baseTheta, 10);

    // swayGain reshapes the scroll-position lean.
    inst.setControl('swayGain', 3);
    expect(Math.abs(subject.rotation.z - baseTheta)).toBeGreaterThan(0.05);
    inst.setControl('swayGain', 1.2);
    expect(subject.rotation.z).toBeCloseTo(baseTheta, 6);

    // damping firms the drag lean + suppresses ambient — visible pose change.
    inst.setControl('damping', 1);
    expect(Math.abs(subject.rotation.z - baseTheta)).toBeGreaterThan(0.02);
    inst.setControl('damping', 0.35);
    expect(subject.rotation.z).toBeCloseTo(baseTheta, 6);

    // ambientSway scales the living micro-sway (nonzero at t=1 by design).
    inst.setControl('ambientSway', 1);
    expect(Math.abs(subject.rotation.z - baseTheta)).toBeGreaterThan(0.02);
    inst.setControl('ambientSway', 0.4);
    expect(subject.rotation.z).toBeCloseTo(baseTheta, 6);

    // pivotLength: same angle, longer arm -> visibly larger displacement + longer cord.
    const baseX = subject.position.x;
    const cord = target.object.getObjectByName('pendulum-cord') as Mesh;
    const baseCordLen = cord.scale.y;
    inst.setControl('pivotLength', 1.2);
    expect(Math.abs(subject.position.x - baseX)).toBeGreaterThan(0.02);
    expect(cord.scale.y).toBeGreaterThan(baseCordLen * 2);

    inst.dispose();
  });

  it('dispose restores the subject pose exactly and removes the rig it created', () => {
    const target = makeTarget(scrollPendulumSwayPrimitive);
    const subject = target.subject as Object3D;
    const r0 = subject.rotation.z;
    const x0 = subject.position.x;
    const y0 = subject.position.y;
    const childCount = target.object.children.length;

    const inst = scrollPendulumSwayPrimitive.create(target);
    for (let i = 0; i <= 12; i++) {
      const t = i / 8;
      target.userData.scroll = cosineScroll(t);
      inst.seek(t);
    }
    expect(target.object.getObjectByName('pendulum-cord')).toBeTruthy();

    inst.dispose();
    expect(subject.rotation.z).toBe(r0);
    expect(subject.position.x).toBe(x0);
    expect(subject.position.y).toBe(y0);
    expect(target.object.getObjectByName('pendulum-cord')).toBeFalsy();
    expect(target.object.getObjectByName('pendulum-pin')).toBeFalsy();
    expect(target.object.children.length).toBe(childCount);
  });
});
