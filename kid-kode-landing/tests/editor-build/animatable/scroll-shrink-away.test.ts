import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { scrollShrinkAwayPrimitive } from '@/lib/prism/animatable/primitives/scroll-shrink-away';
import { makeTarget, runConformance } from './_conformance';

describe('scroll-shrink-away primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollShrinkAwayPrimitive).dispose();
  });

  it('plays: past threshold the card shrinks, rises, and fades', () => {
    const target = makeTarget(scrollShrinkAwayPrimitive);
    const inst = scrollShrinkAwayPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };

    // Before threshold (scroll=0): settled — full scale/opacity, base y.
    target.userData.scroll = 0;
    inst.seek(0);
    const scaleEarly = mesh.scale.x;
    const opEarly = mat.opacity;
    const yEarly = mesh.position.y;

    // Past threshold (scroll=1): shrunk, faded, risen.
    target.userData.scroll = 1;
    inst.seek(0);
    const scaleLate = mesh.scale.x;
    const opLate = mat.opacity;
    const yLate = mesh.position.y;

    expect(scaleEarly).toBeGreaterThan(scaleLate + 0.3); // shrinks
    expect(opEarly).toBeGreaterThan(opLate + 0.3); // fades out
    expect(yLate).toBeGreaterThan(yEarly + 0.3); // rises away
    inst.dispose();
  });

  it('controls change output: smaller minScale shrinks further', () => {
    const target = makeTarget(scrollShrinkAwayPrimitive);
    const inst = scrollShrinkAwayPrimitive.create(target);
    const mesh = target.subject as Mesh;
    target.userData.scroll = 1; // fully past threshold

    inst.setControl('minScale', 0.8);
    inst.seek(0);
    const big = mesh.scale.x;

    inst.setControl('minScale', 0.1);
    inst.seek(0);
    const small = mesh.scale.x;

    expect(big).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
