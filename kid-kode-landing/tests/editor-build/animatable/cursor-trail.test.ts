import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { cursorTrailPrimitive } from '@/lib/prism/animatable/primitives/cursor-trail';
import { makeTarget, runConformance } from './_conformance';

describe('cursor-trail primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(cursorTrailPrimitive).dispose();
  });

  it('plays: position springs toward the pointer-derived target over repeated seeks', () => {
    const target = makeTarget(cursorTrailPrimitive);
    const mesh = target.subject as Mesh;
    const baseX = mesh.position.x;
    const baseY = mesh.position.y;

    // Pin the pointer to a corner so the world target is well off-centre.
    target.userData.pointer = { x: 1, y: 1 };
    const inst = cursorTrailPrimitive.create(target);

    // First spring step.
    inst.seek(0);
    const off1 = Math.hypot(mesh.position.x - baseX, mesh.position.y - baseY);

    // Many more steps with the same pointer — the spring keeps closing in.
    for (let i = 0; i < 60; i++) inst.seek(i / 60);
    const offEnd = Math.hypot(mesh.position.x - baseX, mesh.position.y - baseY);

    // The card moved (first step is non-zero) and kept moving toward the target.
    expect(off1).toBeGreaterThan(0);
    expect(offEnd).toBeGreaterThan(off1 + 0.1);

    // Settled offset should approach the mapped target: range/2 in each axis at
    // pointer (1,1) → target offset (range/2, range/2). Default range 1.4 → 0.7.
    const settled = Math.hypot(mesh.position.x - baseX, mesh.position.y - baseY);
    expect(settled).toBeGreaterThan(0.9); // ~hypot(0.7,0.7) ≈ 0.99 after convergence
    inst.dispose();
  });

  it('controls change output: higher stiffness converges faster (larger early offset)', () => {
    const mkOffsetAfterOneSeek = (stiffness: number) => {
      const target = makeTarget(cursorTrailPrimitive);
      const mesh = target.subject as Mesh;
      const baseX = mesh.position.x;
      const baseY = mesh.position.y;
      target.userData.pointer = { x: 1, y: 1 };
      const inst = cursorTrailPrimitive.create(target);
      inst.setControl('stiffness', stiffness);
      inst.seek(0);
      const off = Math.hypot(mesh.position.x - baseX, mesh.position.y - baseY);
      inst.dispose();
      return off;
    };

    const slow = mkOffsetAfterOneSeek(0.02);
    const fast = mkOffsetAfterOneSeek(0.5);

    // A stiffer spring covers more ground on the very first step.
    expect(fast).toBeGreaterThan(slow + 0.05);
  });
});
