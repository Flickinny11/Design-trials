import { describe, it, expect } from 'vitest';
import { Group, type Mesh } from 'three';
import { dominoCascadePrimitive } from '@/lib/prism/animatable/primitives/domino-cascade';
import { makeTarget, runConformance } from './_conformance';

// Sum the absolute Z-lean of every visible domino pivot (a topple = nonzero
// rotation.z). A robust scalar for "how far has the cascade progressed".
function totalLean(root: Group): number {
  let sum = 0;
  for (const child of root.children) {
    if (!child.visible) continue;
    sum += Math.abs((child as Group).rotation.z);
  }
  return sum;
}

// Per-tile lean array (index = position in the row), for sequencing assertions.
function leans(root: Group): number[] {
  return root.children
    .filter((c) => c.visible)
    .map((c) => Math.abs((c as Group).rotation.z));
}

function rootOf(target: ReturnType<typeof makeTarget>): Group {
  return target.object.getObjectByName('domino-cascade') as Group;
}

describe('domino-cascade primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(dominoCascadePrimitive).dispose();
  });

  it('topples in sequence — a real contact-triggered chain reaction (not all-at-once)', () => {
    const target = makeTarget(dominoCascadePrimitive);
    const inst = dominoCascadePrimitive.create(target);
    const root = rootOf(target);

    // At t=0 the first tile is knocked but the rest still stand: leading lean
    // present, trailing tiles essentially upright.
    inst.seek(0);
    const l0 = leans(root);
    expect(l0[0]).toBeGreaterThan(0.0); // first tile knocked
    expect(l0[l0.length - 1]).toBeLessThan(0.05); // last tile still standing

    // The first tile must reach a deep lean (it genuinely falls) before the
    // last tile has moved at all — proving a sequential wave, not a uniform
    // staggered tween where everything eases together.
    const D = inst.duration();
    let firstDeepAt = -1;
    let lastStillUprightThen = false;
    const dt = 1 / 120;
    for (let k = 1; k * dt <= D; k++) {
      inst.seek(k * dt);
      const l = leans(root);
      if (firstDeepAt < 0 && l[0] > 1.0) {
        firstDeepAt = k;
        lastStillUprightThen = l[l.length - 1] < 0.1;
      }
    }
    expect(firstDeepAt).toBeGreaterThan(0); // the lead tile actually toppled deep
    expect(lastStillUprightThen).toBe(true); // and the tail hadn't started yet

    // By the end, the whole line has fallen (the wave ran the row): total lean
    // is large and the LAST tile is now down too.
    inst.seek(D);
    const lEnd = leans(root);
    expect(lEnd[lEnd.length - 1]).toBeGreaterThan(1.0); // tail toppled
    expect(totalLean(root)).toBeGreaterThan(leans(root).length * 1.0);

    inst.dispose();
  });

  it('gravity is live at the frozen mid-cascade pin (reset-replay → pure function of params)', () => {
    const target = makeTarget(dominoCascadePrimitive);
    const inst = dominoCascadePrimitive.create(target);
    const root = rootOf(target);

    // Pin a mid-action frame (~0.45 of the default duration): several tiles
    // down, several still standing.
    const PIN = inst.duration() * 0.45;

    // Slow wave (low gravity) → fewer tiles toppled at PIN.
    inst.setControl('gravity', 4);
    inst.seek(PIN);
    const slowLean = totalLean(root);

    // Fast wave (high gravity) → markedly more progress at the SAME t.
    inst.setControl('gravity', 24);
    inst.seek(PIN);
    const fastLean = totalLean(root);

    expect(Math.abs(fastLean - slowLean)).toBeGreaterThan(0.3);
    expect(fastLean).toBeGreaterThan(slowLean); // more gravity = faster cascade

    // Spacing is also a trajectory-only control: wider spacing makes each tile
    // lean further to reach the next, slowing the wave — different frozen frame.
    inst.setControl('gravity', 13);
    inst.setControl('spacing', 0.36);
    inst.seek(PIN);
    const tightLean = totalLean(root);
    inst.setControl('spacing', 0.62);
    inst.seek(PIN);
    const wideLean = totalLean(root);
    expect(Math.abs(tightLean - wideLean)).toBeGreaterThan(0.1);

    inst.dispose();
  });

  it('mid-cascade frame shows a mix of fallen and standing tiles (engaged pose reads physical)', () => {
    const target = makeTarget(dominoCascadePrimitive);
    const inst = dominoCascadePrimitive.create(target);
    const root = rootOf(target);

    inst.seek(inst.duration() * 0.45);
    const l = leans(root);
    const down = l.filter((a) => a > 1.0).length; // toppled
    const standing = l.filter((a) => a < 0.1).length; // still upright
    expect(down).toBeGreaterThan(0);
    expect(standing).toBeGreaterThan(0);

    // Sanity: tiles are thin Box meshes parented under pivots.
    const firstPivot = root.children[0] as Group;
    const mesh = firstPivot.children[0] as Mesh;
    expect(mesh.geometry.type).toBe('BoxGeometry');

    inst.dispose();
  });
});
