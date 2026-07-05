import { describe, it, expect } from 'vitest';
import { type Object3D } from 'three';
import { scrollZoomPrimitive } from '@/lib/prism/animatable/primitives/scroll-zoom';
import { makeTarget, runConformance } from './_conformance';

describe('scroll-zoom primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollZoomPrimitive).dispose();
  });

  it('plays: scale tracks scroll position', () => {
    const target = makeTarget(scrollZoomPrimitive);
    const subject = target.subject as Object3D;
    const inst = scrollZoomPrimitive.create(target);

    // Low scroll → small scale.
    (target.userData as { scroll: number }).scroll = 0;
    inst.seek(0);
    const lowScale = subject.scale.x;

    // High scroll → larger scale (linear mode).
    (target.userData as { scroll: number }).scroll = 1;
    inst.seek(0);
    const highScale = subject.scale.x;

    expect(highScale).toBeGreaterThan(lowScale + 0.3);
    inst.dispose();
  });

  it('controls change output: wider maxScale means larger high-scroll scale', () => {
    const target = makeTarget(scrollZoomPrimitive);
    const subject = target.subject as Object3D;
    const inst = scrollZoomPrimitive.create(target);

    (target.userData as { scroll: number }).scroll = 1;

    inst.setControl('maxScale', 1);
    inst.seek(0);
    const small = subject.scale.x;

    inst.setControl('maxScale', 2.5);
    inst.seek(0);
    const large = subject.scale.x;

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
