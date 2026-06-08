import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { scrollFadeStackPrimitive } from '@/lib/prism/animatable/primitives/scroll-fade-stack';
import { makeTarget, runConformance } from './_conformance';

describe('scroll-fade-stack primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollFadeStackPrimitive).dispose();
  });

  it('plays: opacity and position.y rise across the scroll band', () => {
    const target = makeTarget(scrollFadeStackPrimitive);
    const inst = scrollFadeStackPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };

    // Before the enter band: invisible and dropped below.
    target.userData.scroll = 0.0;
    inst.seek(0);
    const opBefore = mat.opacity;
    const yBefore = mesh.position.y;

    // Mid-band: partially visible and lifting into place.
    target.userData.scroll = 0.3;
    inst.seek(0);
    const opMid = mat.opacity;
    const yMid = mesh.position.y;

    // Opacity ramps up across the band.
    expect(opMid).toBeGreaterThan(opBefore + 0.1);
    // Card lifts upward into its settled position.
    expect(yMid).toBeGreaterThan(yBefore + 0.05);
    inst.dispose();
  });

  it('controls change output: larger lift means a lower start position', () => {
    const target = makeTarget(scrollFadeStackPrimitive);
    const inst = scrollFadeStackPrimitive.create(target);
    const mesh = target.subject as Mesh;

    // At the very bottom of the band the card sits at baseY - lift.
    target.userData.scroll = 0.0;

    inst.setControl('lift', 0.5);
    inst.seek(0);
    const ySmallLift = mesh.position.y;

    inst.setControl('lift', 4);
    inst.seek(0);
    const yLargeLift = mesh.position.y;

    // A larger lift drops the pre-band position further below.
    expect(ySmallLift).toBeGreaterThan(yLargeLift + 0.3);
    inst.dispose();
  });
});
