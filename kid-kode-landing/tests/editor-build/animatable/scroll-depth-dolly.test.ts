import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { scrollDepthDollyPrimitive } from '@/lib/prism/animatable/primitives/scroll-depth-dolly';
import { makeTarget, runConformance } from './_conformance';

describe('scroll-depth-dolly primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollDepthDollyPrimitive).dispose();
  });

  it('plays: position.z and scale track scroll', () => {
    const target = makeTarget(scrollDepthDollyPrimitive);
    const inst = scrollDepthDollyPrimitive.create(target);
    const mesh = target.subject as Mesh;

    // scroll near 0 → far + small
    target.userData.scroll = 0;
    inst.seek(0);
    const zFar = mesh.position.z;
    const scaleFar = mesh.scale.x;

    // scroll near 1 → near + large
    target.userData.scroll = 1;
    inst.seek(0);
    const zNear = mesh.position.z;
    const scaleNear = mesh.scale.x;

    // z dollies forward (toward the viewer = larger z)
    expect(zNear).toBeGreaterThan(zFar + 1);
    // coupled perspective scale grows
    expect(scaleNear).toBeGreaterThan(scaleFar + 0.3);
    inst.dispose();
  });

  it('controls change output: farZ moves the far end of the dolly', () => {
    const target = makeTarget(scrollDepthDollyPrimitive);
    const inst = scrollDepthDollyPrimitive.create(target);
    const mesh = target.subject as Mesh;
    target.userData.scroll = 0; // sample the far end

    inst.setControl('farZ', -12);
    inst.seek(0);
    const deep = mesh.position.z;

    inst.setControl('farZ', -2);
    inst.seek(0);
    const shallow = mesh.position.z;

    // a deeper farZ pushes the card further from the viewer (smaller z)
    expect(shallow).toBeGreaterThan(deep + 5);
    inst.dispose();
  });

  it('fadeEnds dissolves the card at the extremes', () => {
    const target = makeTarget(scrollDepthDollyPrimitive);
    const inst = scrollDepthDollyPrimitive.create(target);
    const mat = (target.subject as Mesh).material as Material & { opacity: number };

    target.userData.scroll = 0.5; // mid → full opacity
    inst.seek(0);
    const mid = mat.opacity;

    target.userData.scroll = 1; // end → faded
    inst.seek(0);
    const end = mat.opacity;

    expect(mid).toBeGreaterThan(end + 0.3);
    inst.dispose();
  });
});
