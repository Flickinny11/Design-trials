import { describe, it, expect } from 'vitest';
import { jellyCollideSimPrimitive } from '@/lib/prism/animatable/primitives/jelly-collide-sim';
import { Mesh, BufferAttribute } from 'three';
import { makeTarget, runConformance } from './_conformance';

// Read the live deformed lattice bounds (the mesh the primitive built into
// target.object). Returns null until the mesh exists.
function bounds(target: ReturnType<typeof makeTarget>) {
  const mesh = target.object.children.find(
    (c) => c.name === 'jelly-collide-sim',
  ) as Mesh | undefined;
  if (!mesh) return null;
  const pos = mesh.geometry.getAttribute('position') as BufferAttribute;
  const draw = mesh.geometry.getIndex();
  // Only the indexed (live) vertices matter; gather their unique ids.
  const live = new Set<number>();
  const idx = draw!.array as ArrayLike<number>;
  for (let k = 0; k < draw!.count; k++) live.add(idx[k]);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let cx = 0, cy = 0, n = 0;
  for (const i of live) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    cx += x; cy += y; n++;
  }
  return { minX, maxX, minY, maxY, cx: cx / n, cy: cy / n, w: maxX - minX, h: maxY - minY };
}

describe('jelly-collide-sim primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(jellyCollideSimPrimitive).dispose();
  });

  it('throws a jelly cube at the wall and squashes it (real XPBD collision, not easing)', () => {
    const target = makeTarget(jellyCollideSimPrimitive);
    const inst = jellyCollideSimPrimitive.create(target);

    inst.seek(0);
    const b0 = bounds(target)!;
    const startCx = b0.cx;
    const restWidth = b0.w;
    expect(restWidth).toBeGreaterThan(0.1); // a real cube exists

    // Sample the timeline: the cube must (a) travel RIGHT toward the wall, then
    // (b) COMPRESS against it (its width dips well below the rest width while its
    // right edge is jammed at the wall) — a genuine collision squash.
    const D = inst.duration();
    let maxCx = startCx; // furthest-right the body got
    let minWidthAtWall = restWidth; // narrowest width while pressed on the wall
    let sawContact = false;
    for (let k = 1; k <= 160; k++) {
      inst.seek((k / 160) * D);
      const b = bounds(target)!;
      maxCx = Math.max(maxCx, b.cx);
      // "At the wall": right edge has reached the wall plane (~1.04).
      if (b.maxX > 0.98) {
        sawContact = true;
        minWidthAtWall = Math.min(minWidthAtWall, b.w);
      }
    }

    expect(maxCx).toBeGreaterThan(startCx + 0.4); // it flew toward the wall
    expect(sawContact).toBe(true); // it reached the wall
    expect(minWidthAtWall).toBeLessThan(restWidth * 0.9); // it visibly squashed

    inst.dispose();
  });

  it('throwSpeed changes the frozen mid-squash frame (control is live at a pinned t)', () => {
    const target = makeTarget(jellyCollideSimPrimitive);
    const inst = jellyCollideSimPrimitive.create(target);

    // PIN mid-action: ~0.45 of duration lands the cube pressed against the wall,
    // mid-squash. Sweeping throwSpeed must change that frozen frame because the
    // reset-replay stepper recomputes the whole trajectory (markDirty).
    const PIN = inst.duration() * 0.45;

    inst.setControl('throwSpeed', 2.0);
    inst.seek(PIN);
    const slow = bounds(target)!;

    inst.setControl('throwSpeed', 7.0);
    inst.seek(PIN);
    const fast = bounds(target)!;

    // A faster throw arrives sooner and is deeper into the squash at the same t →
    // the body's centre-x and/or compressed width differ measurably.
    const moved = Math.abs(fast.cx - slow.cx) + Math.abs(fast.w - slow.w);
    expect(moved).toBeGreaterThan(1e-3);

    inst.dispose();
  });
});
