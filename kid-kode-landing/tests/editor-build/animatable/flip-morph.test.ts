import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { flipMorphPrimitive } from '@/lib/prism/animatable/primitives/flip-morph';
import { makeTarget, runConformance } from './_conformance';

// Default params: duration 1.4s, fromScale 0.32, corner 'tl', aspectSkew 0.22,
// curve 'backOut'. The card subject measures ~1.74 x 1.12, so the corner
// offsets land around (±1.0, ±0.73) and the z-lift arc peaks near +0.31.

describe('flip-morph primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(flipMorphPrimitive).dispose();
  });

  it('plays: corner thumbnail pose morphs to full layout with independent eases and arrival overshoot', () => {
    const target = makeTarget(flipMorphPrimitive);
    const inst = flipMorphPrimitive.create(target);
    const subject = target.subject as Mesh;
    const mat = subject.material as Material & { opacity: number };
    const baseX = subject.position.x;
    const baseY = subject.position.y;
    const baseZ = subject.position.z;
    const dur = inst.duration();
    expect(dur).toBeCloseTo(1.4, 5);

    // FIRST pose (t=0): small thumbnail tucked toward the top-left corner,
    // wider-than-tall (the aspect-skew crop), flat on the resting plane.
    inst.seek(0);
    expect(subject.position.x).toBeLessThan(baseX - 0.5);
    expect(subject.position.y).toBeGreaterThan(baseY + 0.3);
    expect(subject.position.z).toBeCloseTo(baseZ, 5);
    expect(subject.scale.x).toBeLessThan(0.55);
    expect(subject.scale.x).toBeGreaterThan(subject.scale.y + 0.08);
    // FLIP morphs never fade — the element exists fully in both states.
    expect(mat.opacity).toBe(1);

    // Mid-flight (p=0.5): the z-lift arc carries the card toward the camera.
    inst.seek(dur * 0.5);
    expect(subject.position.z).toBeGreaterThan(baseZ + 0.1);
    expect(mat.opacity).toBe(1);

    // Independent eases (p=0.35): scale-x leads, scale-y lags, so the aspect
    // is still resolving mid-flight — strictly between square (1) and the
    // start ratio (~1.56).
    inst.seek(dur * 0.35);
    const ratioMid = subject.scale.x / subject.scale.y;
    expect(ratioMid).toBeGreaterThan(1.02);
    expect(ratioMid).toBeLessThan(1.45);

    // Arrival overshoot (p=0.7, backOut): position pushes slightly PAST the
    // rest pose (away from the corner) and scale-x exceeds 1 before settling.
    inst.seek(dur * 0.7);
    expect(subject.position.x).toBeGreaterThan(baseX + 0.02);
    expect(subject.scale.x).toBeGreaterThan(1.01);

    // LAST pose (t=dur): lands exactly on the full layout — no distortion.
    inst.seek(dur);
    expect(subject.position.x).toBeCloseTo(baseX, 4);
    expect(subject.position.y).toBeCloseTo(baseY, 4);
    expect(subject.position.z).toBeCloseTo(baseZ, 4);
    expect(subject.scale.x).toBeCloseTo(1, 4);
    expect(subject.scale.y).toBeCloseTo(1, 4);
    expect(Math.abs(subject.scale.x - subject.scale.y)).toBeLessThan(1e-4);
    inst.dispose();
  });

  it('controls change output: corner flips the start quadrant, fromScale sizes the thumbnail, aspectSkew sets the start aspect', () => {
    const target = makeTarget(flipMorphPrimitive);
    const inst = flipMorphPrimitive.create(target);
    const subject = target.subject as Mesh;
    const baseX = subject.position.x;
    const baseY = subject.position.y;

    // corner: 'br' mirrors the start pose into the bottom-right quadrant.
    inst.setControl('corner', 'br');
    inst.seek(0);
    expect(subject.position.x).toBeGreaterThan(baseX + 0.5);
    expect(subject.position.y).toBeLessThan(baseY - 0.3);

    // fromScale: a larger thumbnail starts visibly bigger.
    inst.setControl('fromScale', 0.7);
    inst.seek(0);
    const big = subject.scale.x;
    inst.setControl('fromScale', 0.15);
    inst.seek(0);
    const small = subject.scale.x;
    expect(big).toBeGreaterThan(small + 0.4);

    // aspectSkew: 0 starts square; 0.6 starts at a 4:1 aspect ratio.
    inst.setControl('fromScale', 0.32);
    inst.setControl('aspectSkew', 0);
    inst.seek(0);
    expect(subject.scale.x / subject.scale.y).toBeCloseTo(1, 3);
    inst.setControl('aspectSkew', 0.6);
    inst.seek(0);
    expect(subject.scale.x / subject.scale.y).toBeCloseTo(4, 2);
    inst.dispose();
  });

  it('dispose restores the subject transform exactly', () => {
    const target = makeTarget(flipMorphPrimitive);
    const subject = target.subject as Mesh;
    const basePos = subject.position.clone();
    const baseScale = subject.scale.clone();
    const inst = flipMorphPrimitive.create(target);

    inst.seek(0.31); // mid-flight — transform is mutated
    expect(Math.abs(subject.position.x - basePos.x)).toBeGreaterThan(0.05);
    expect(Math.abs(subject.scale.y - baseScale.y)).toBeGreaterThan(0.05);

    inst.dispose();
    expect(subject.position.x).toBe(basePos.x);
    expect(subject.position.y).toBe(basePos.y);
    expect(subject.position.z).toBe(basePos.z);
    expect(subject.scale.x).toBe(baseScale.x);
    expect(subject.scale.y).toBe(baseScale.y);
    expect(subject.scale.z).toBe(baseScale.z);
  });
});
