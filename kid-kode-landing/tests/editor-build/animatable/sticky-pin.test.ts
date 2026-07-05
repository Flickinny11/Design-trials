import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { stickyPinPrimitive } from '@/lib/prism/animatable/primitives/sticky-pin';
import { makeTarget, runConformance } from './_conformance';

describe('sticky-pin primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(stickyPinPrimitive).dispose();
  });

  it('plays: y tracks scroll outside the band but is pinned within it', () => {
    const target = makeTarget(stickyPinPrimitive);
    const inst = stickyPinPrimitive.create(target);
    const mesh = target.subject as Mesh;

    // Default band is [0.3, 0.6]. Drive the scroll driver directly.
    const yAt = (scroll: number) => {
      (target.userData as { scroll: number }).scroll = scroll;
      inst.seek(0);
      return mesh.position.y;
    };

    // Below the band: y changes with scroll (moving freely).
    const yBefore0 = yAt(0.0);
    const yBefore1 = yAt(0.2);
    expect(Math.abs(yBefore1 - yBefore0)).toBeGreaterThan(0.1);

    // Within the band [0.3, 0.6]: y held constant (pinned).
    const yPin0 = yAt(0.35);
    const yPin1 = yAt(0.55);
    expect(Math.abs(yPin1 - yPin0)).toBeLessThan(1e-6);

    // After the band: y changes again with scroll (released, continues).
    const yAfter0 = yAt(0.7);
    const yAfter1 = yAt(0.9);
    expect(Math.abs(yAfter1 - yAfter0)).toBeGreaterThan(0.1);

    inst.dispose();
  });

  it('controls change output: larger travel means larger vertical spread', () => {
    const target = makeTarget(stickyPinPrimitive);
    const inst = stickyPinPrimitive.create(target);
    const mesh = target.subject as Mesh;

    const spreadForTravel = (travel: number) => {
      inst.setControl('travel', travel);
      (target.userData as { scroll: number }).scroll = 0.0;
      inst.seek(0);
      const top = mesh.position.y;
      (target.userData as { scroll: number }).scroll = 1.0;
      inst.seek(0);
      const bottom = mesh.position.y;
      return Math.abs(top - bottom);
    };

    const small = spreadForTravel(0.5);
    const large = spreadForTravel(5);
    expect(large).toBeGreaterThan(small + 0.5);

    inst.dispose();
  });
});
