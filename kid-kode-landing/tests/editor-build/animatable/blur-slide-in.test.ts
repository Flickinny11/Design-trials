import { describe, it, expect } from 'vitest';
import { Mesh, Group, type Material } from 'three';
import { blurSlideInPrimitive } from '@/lib/prism/animatable/primitives/blur-slide-in';
import { makeTarget, runConformance } from './_conformance';

function mainMat(target: ReturnType<typeof makeTarget>): Material & { opacity: number } {
  const mesh = target.subject as Mesh;
  return mesh.material as Material & { opacity: number };
}

function ghostGroup(target: ReturnType<typeof makeTarget>): Group {
  const subject = target.subject as Mesh;
  const parent = subject.parent ?? target.object;
  const g = parent.children.find((c) => c.name === 'blur-slide-in-ghosts');
  return g as Group;
}

describe('blur-slide-in primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(blurSlideInPrimitive).dispose();
  });

  it('plays: main card slides in (position.x) and ghosts converge + fade', () => {
    const target = makeTarget(blurSlideInPrimitive);
    const inst = blurSlideInPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mainMat(target);
    const dur = inst.duration();
    const gg = ghostGroup(target);
    const ghost0 = gg.children[0] as Mesh;

    // Early frame: card is offset to the left, ghosts spread + visible.
    inst.seek(dur * 0.15);
    const xEarly = mesh.position.x;
    const opEarly = mat.opacity;
    const ghostOffsetEarly = Math.abs(ghost0.position.x - mesh.position.x);
    const ghostOpacityEarly = (ghost0.material as Material & { opacity: number }).opacity;

    // Settled frame: card at origin, ghosts collapsed onto it and faded out.
    inst.seek(dur);
    const xEnd = mesh.position.x;
    const opEnd = mat.opacity;
    const ghostOffsetEnd = Math.abs(ghost0.position.x - mesh.position.x);
    const ghostOpacityEnd = (ghost0.material as Material & { opacity: number }).opacity;

    // Main card position.x moves toward 0 (rightward) and opacity rises.
    expect(xEnd).toBeGreaterThan(xEarly + 0.3);
    expect(opEnd).toBeGreaterThan(opEarly);
    // Ghost offset shrinks to ~0 and ghost opacity fades to ~0 by the end.
    expect(ghostOffsetEarly).toBeGreaterThan(ghostOffsetEnd + 0.001);
    expect(ghostOpacityEnd).toBeLessThan(ghostOpacityEarly);
    expect(ghostOpacityEnd).toBeLessThan(0.001);

    inst.dispose();
  });

  it('controls change output: more ghosts means more visible ghost copies', () => {
    const target = makeTarget(blurSlideInPrimitive);
    const inst = blurSlideInPrimitive.create(target);
    const dur = inst.duration();
    const gg = ghostGroup(target);

    const countVisible = () =>
      gg.children.filter((c) => c.visible).length;

    inst.setControl('ghosts', 2);
    inst.seek(dur * 0.2);
    const few = countVisible();

    inst.setControl('ghosts', 5);
    inst.seek(dur * 0.2);
    const many = countVisible();

    expect(many).toBeGreaterThan(few);
    expect(few).toBe(2);
    expect(many).toBe(5);

    inst.dispose();
  });
});
