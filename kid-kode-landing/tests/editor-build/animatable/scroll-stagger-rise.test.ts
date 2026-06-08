import { describe, it, expect } from 'vitest';
import { Group, Mesh, MeshBasicMaterial } from 'three';
import { scrollStaggerRisePrimitive } from '@/lib/prism/animatable/primitives/scroll-stagger-rise';
import { makeTarget, runConformance } from './_conformance';

/** Find the generated band group parented to the subject. */
function bandGroupOf(subject: Mesh | Group): Group {
  let found: Group | null = null;
  subject.traverse((o) => {
    if (o.name === 'stagger-rise-bands') found = o as Group;
  });
  if (!found) throw new Error('band group not found');
  return found;
}

describe('scroll-stagger-rise primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollStaggerRisePrimitive).dispose();
  });

  it('plays: a band reveals (opacity + position.y) as scroll advances', () => {
    const target = makeTarget(scrollStaggerRisePrimitive);
    const inst = scrollStaggerRisePrimitive.create(target);
    const subject = target.subject as Mesh;
    const group = bandGroupOf(subject);

    // Pick the last band (highest reveal point) so the scroll sweep is observable.
    const last = group.children[group.children.length - 1] as Mesh;
    const mat = last.material as MeshBasicMaterial;

    // Early scroll: this band has not yet arrived.
    target.userData.scroll = 0.0;
    inst.seek(0);
    const opEarly = mat.opacity;
    const yEarly = last.position.y;

    // Late scroll: every band has settled.
    target.userData.scroll = 1.0;
    inst.seek(0);
    const opLate = mat.opacity;
    const yLate = last.position.y;

    // Opacity rises and the band lifts up across the scroll sweep.
    expect(opLate).toBeGreaterThan(opEarly + 0.2);
    expect(yLate).toBeGreaterThan(yEarly + 0.1);
    inst.dispose();
  });

  it('controls change output: larger lift means a lower start position', () => {
    const target = makeTarget(scrollStaggerRisePrimitive);
    const inst = scrollStaggerRisePrimitive.create(target);
    const subject = target.subject as Mesh;
    const group = bandGroupOf(subject);
    const last = group.children[group.children.length - 1] as Mesh;

    // Before the band arrives, its y = settledY - lift*(1). Larger lift => lower y.
    target.userData.scroll = 0.0;

    inst.setControl('lift', 0.3);
    inst.seek(0);
    const ySmall = last.position.y;

    inst.setControl('lift', 3);
    inst.seek(0);
    const yLarge = last.position.y;

    expect(ySmall).toBeGreaterThan(yLarge + 0.3);
    inst.dispose();
  });
});
