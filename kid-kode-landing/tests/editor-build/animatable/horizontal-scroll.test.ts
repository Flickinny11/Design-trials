import { describe, it, expect } from 'vitest';
import { type Object3D } from 'three';
import { horizontalScrollPrimitive } from '@/lib/prism/animatable/primitives/horizontal-scroll';
import { makeTarget, runConformance } from './_conformance';

describe('horizontal-scroll primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(horizontalScrollPrimitive).dispose();
  });

  it('plays: scroll drives position.x across the travel span', () => {
    const target = makeTarget(horizontalScrollPrimitive);
    const inst = horizontalScrollPrimitive.create(target);
    const subject = target.subject as Object3D;

    // Early scroll (start of span).
    target.userData.scroll = 0;
    inst.seek(0);
    const xStart = subject.position.x;

    // Mid scroll.
    target.userData.scroll = 0.5;
    inst.seek(0);
    const xMid = subject.position.x;

    // Late scroll (end of span).
    target.userData.scroll = 1;
    inst.seek(0);
    const xEnd = subject.position.x;

    // Mid differs from start, and end differs from mid: motion is real.
    expect(Math.abs(xMid - xStart)).toBeGreaterThan(0.3);
    expect(Math.abs(xEnd - xMid)).toBeGreaterThan(0.3);
    // Full travel spans the configured distance (default 4).
    expect(Math.abs(xEnd - xStart)).toBeGreaterThan(3);
    inst.dispose();
  });

  it('controls change output: larger distance means larger travel span', () => {
    const target = makeTarget(horizontalScrollPrimitive);
    const inst = horizontalScrollPrimitive.create(target);
    const subject = target.subject as Object3D;

    const spanFor = (dist: number): number => {
      inst.setControl('distance', dist);
      target.userData.scroll = 0;
      inst.seek(0);
      const a = subject.position.x;
      target.userData.scroll = 1;
      inst.seek(0);
      const b = subject.position.x;
      return Math.abs(b - a);
    };

    const small = spanFor(0.5);
    const large = spanFor(8);
    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
