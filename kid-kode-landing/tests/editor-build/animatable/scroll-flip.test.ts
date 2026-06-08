import { describe, it, expect } from 'vitest';
import type { Object3D } from 'three';
import { scrollFlipPrimitive } from '@/lib/prism/animatable/primitives/scroll-flip';
import { makeTarget, runConformance } from './_conformance';

describe('scroll-flip primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollFlipPrimitive).dispose();
  });

  it('plays: rotation tracks scroll — steep at scroll=0, flat at scroll=1', () => {
    const target = makeTarget(scrollFlipPrimitive);
    const inst = scrollFlipPrimitive.create(target);
    const subject = target.subject as Object3D;

    // Default axis is 'y'.
    target.userData.scroll = 0;
    inst.seek(0);
    const rotStart = subject.rotation.y;

    target.userData.scroll = 1;
    inst.seek(2);
    const rotEnd = subject.rotation.y;

    // Card starts strongly turned (edge-on) and locks flat at the band end.
    expect(Math.abs(rotStart)).toBeGreaterThan(1.5);
    expect(Math.abs(rotEnd)).toBeLessThan(0.05);
    expect(Math.abs(rotStart)).toBeGreaterThan(Math.abs(rotEnd) + 1.0);

    // Foreshorten dip: scale.x dips at the edge-on scroll value (mid-flip,
    // where the card passes through 90deg) and is restored flat at the end.
    // Sweep to find the minimum scale.x across the timeline.
    let minScale = Infinity;
    for (let i = 0; i <= 10; i++) {
      target.userData.scroll = i / 10;
      inst.seek((i / 10) * 4);
      if (subject.scale.x < minScale) minScale = subject.scale.x;
    }
    target.userData.scroll = 1;
    inst.seek(4);
    const scaleFlat = subject.scale.x;
    expect(scaleFlat).toBeGreaterThan(minScale + 0.05);

    inst.dispose();
  });

  it('controls change output: larger startAngle means a steeper turn at scroll=0', () => {
    const target = makeTarget(scrollFlipPrimitive);
    const inst = scrollFlipPrimitive.create(target);
    const subject = target.subject as Object3D;
    target.userData.scroll = 0;

    inst.setControl('startAngleDeg', 60);
    inst.seek(0);
    const shallow = Math.abs(subject.rotation.y);

    inst.setControl('startAngleDeg', 180);
    inst.seek(0);
    const steep = Math.abs(subject.rotation.y);

    expect(steep).toBeGreaterThan(shallow + 0.5);
    inst.dispose();
  });
});
