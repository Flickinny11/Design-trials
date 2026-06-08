import { describe, it, expect } from 'vitest';
import { Mesh, type Object3D } from 'three';
import { chromaticBlurPrimitive } from '@/lib/prism/animatable/primitives/chromatic-blur';
import { makeTarget, runConformance } from './_conformance';

/** Find the two ghost clones the primitive adds as siblings of the subject. */
function ghostClones(parent: Object3D, subject: Object3D): Mesh[] {
  return parent.children.filter((c) => c !== subject) as Mesh[];
}

describe('chromatic-blur primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(chromaticBlurPrimitive).dispose();
  });

  it('plays: ghost offsets shrink to ~0 and ghosts fade out across the phase', () => {
    const target = makeTarget(chromaticBlurPrimitive);
    const inst = chromaticBlurPrimitive.create(target);
    const subject = target.subject as Object3D;
    const parent = subject.parent as Object3D;
    const dur = inst.duration();

    const ghosts = ghostClones(parent, subject);
    expect(ghosts.length).toBe(2);
    const [g0, g1] = ghosts;

    inst.seek(0);
    // separation between the two ghosts at the start
    const sep0 = Math.hypot(g0.position.x - g1.position.x, g0.position.y - g1.position.y);
    // grab a ghost material opacity at t=0 (ghost root mesh material)
    const op0 = (g0.material as { opacity: number }).opacity;

    inst.seek(dur);
    const sepDur = Math.hypot(g0.position.x - g1.position.x, g0.position.y - g1.position.y);
    const opDur = (g0.material as { opacity: number }).opacity;

    // channels converge: separation collapses toward registration
    expect(sep0).toBeGreaterThan(sepDur + 0.05);
    expect(sepDur).toBeLessThan(0.02);
    // ghosts fade out as they register
    expect(op0).toBeGreaterThan(opDur);
    expect(opDur).toBeLessThan(0.05);
    inst.dispose();
  });

  it('controls change output: larger split means larger initial ghost separation', () => {
    const target = makeTarget(chromaticBlurPrimitive);
    const inst = chromaticBlurPrimitive.create(target);
    const subject = target.subject as Object3D;
    const parent = subject.parent as Object3D;
    const [g0, g1] = ghostClones(parent, subject);

    inst.setControl('split', 0.02);
    inst.seek(0);
    const small = Math.hypot(g0.position.x - g1.position.x, g0.position.y - g1.position.y);

    inst.setControl('split', 0.4);
    inst.seek(0);
    const large = Math.hypot(g0.position.x - g1.position.x, g0.position.y - g1.position.y);

    expect(large).toBeGreaterThan(small + 0.1);
    inst.dispose();
  });
});
