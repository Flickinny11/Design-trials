import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { jellyPrimitive } from '@/lib/prism/animatable/primitives/jelly';
import { makeTarget, runConformance } from './_conformance';

describe('jelly primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(jellyPrimitive).dispose();
  });

  it('plays: non-uniform squash-stretch mid-phase that settles to ~1', () => {
    const target = makeTarget(jellyPrimitive);
    const inst = jellyPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const dur = inst.duration();

    // t=0: scales at base (osc starts at 0).
    inst.seek(0);
    const sx0 = mesh.scale.x;
    const sy0 = mesh.scale.y;

    // Mid-phase peak of the wobble (default freq=4 -> p=0.0625 is a sine peak).
    inst.seek(0.0625 * dur);
    const sxMid = mesh.scale.x;
    const syMid = mesh.scale.y;

    // Non-uniform: x and y differ out of phase during the wobble.
    expect(Math.abs(sxMid - syMid)).toBeGreaterThan(0.1);
    // Mid-phase moved away from the t=0 base.
    expect(Math.abs(sxMid - sx0)).toBeGreaterThan(0.05);

    // Settles: by the end both scales relax back to ~1 (base).
    inst.seek(dur);
    expect(Math.abs(mesh.scale.x - sx0)).toBeLessThan(0.05);
    expect(Math.abs(mesh.scale.y - sy0)).toBeLessThan(0.05);

    inst.dispose();
  });

  it('controls change output: larger wobble means larger mid-phase deformation', () => {
    const target = makeTarget(jellyPrimitive);
    const inst = jellyPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const dur = inst.duration();

    inst.setControl('wobble', 0.05);
    inst.seek(0.0625 * dur);
    const small = Math.abs(mesh.scale.x - mesh.scale.y);

    inst.setControl('wobble', 0.8);
    inst.seek(0.0625 * dur);
    const large = Math.abs(mesh.scale.x - mesh.scale.y);

    expect(large).toBeGreaterThan(small + 0.2);
    inst.dispose();
  });
});
