import { describe, it, expect } from 'vitest';
import { type Object3D } from 'three';
import { scrubMorphPrimitive } from '@/lib/prism/animatable/primitives/scrub-morph';
import { makeTarget, runConformance } from './_conformance';

describe('scrub-morph primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrubMorphPrimitive).dispose();
  });

  it('plays: scroll scrubs rotation.y and scale monotonically', () => {
    const target = makeTarget(scrubMorphPrimitive);
    const inst = scrubMorphPrimitive.create(target);
    const subject = target.subject as Object3D;

    // scroll = 0 → identity pose
    target.userData.scroll = 0;
    inst.seek(0);
    const rot0 = subject.rotation.y;
    const scale0 = subject.scale.x;

    // scroll = 0.5 → mid morph
    target.userData.scroll = 0.5;
    inst.seek(0.5);
    const rotMid = subject.rotation.y;
    const scaleMid = subject.scale.x;

    // scroll = 1 → settled end
    target.userData.scroll = 1;
    inst.seek(1);
    const rotEnd = subject.rotation.y;
    const scaleEnd = subject.scale.x;

    // rotation and scale track scroll monotonically up
    expect(rotMid).toBeGreaterThan(rot0 + 0.1);
    expect(rotEnd).toBeGreaterThan(rotMid + 0.1);
    expect(scaleMid).toBeGreaterThan(scale0 + 0.05);
    expect(scaleEnd).toBeGreaterThan(scaleMid + 0.05);

    // bidirectional: scrubbing back to 0 returns to identity
    target.userData.scroll = 0;
    inst.seek(0);
    expect(subject.rotation.y).toBeCloseTo(rot0, 5);
    expect(subject.scale.x).toBeCloseTo(scale0, 5);

    inst.dispose();
  });

  it('controls change output: larger maxRotDeg means larger rotation at full scroll', () => {
    const target = makeTarget(scrubMorphPrimitive);
    const inst = scrubMorphPrimitive.create(target);
    const subject = target.subject as Object3D;

    target.userData.scroll = 1;

    inst.setControl('maxRotDeg', 30);
    inst.seek(1);
    const small = subject.rotation.y;

    inst.setControl('maxRotDeg', 300);
    inst.seek(1);
    const large = subject.rotation.y;

    expect(large).toBeGreaterThan(small + 0.5);
    inst.dispose();
  });
});
