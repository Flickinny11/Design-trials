import { describe, it, expect } from 'vitest';
import { Group } from 'three';
import { blockTopplePrimitive } from '@/lib/prism/animatable/primitives/block-topple';
import { makeTarget, runConformance } from './_conformance';

// Pull the live block meshes out of the group the primitive adds to target.object.
function blockMeshes(object: Group) {
  const grp = object.children.find((c) => c.name === 'block-topple');
  if (!grp) throw new Error('block-topple group not mounted');
  return grp.children.filter((c) => c.name.startsWith('block-'));
}

// Only the currently-active (visible) blocks; the others are parked off-screen.
function visibleMeshes(object: Group) {
  return blockMeshes(object).filter((m) => m.visible);
}

describe('block-topple primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(blockTopplePrimitive).dispose();
  });

  it('topples and scatters under real rigid physics (rotation + fall, not easing)', () => {
    const target = makeTarget(blockTopplePrimitive);
    const inst = blockTopplePrimitive.create(target);

    inst.seek(0);
    const meshes = visibleMeshes(target.object as Group);
    // Initial: an upright stack — every block essentially un-rotated, ascending Y.
    const restY = meshes.map((m) => m.position.y);
    const restAng = meshes.map((m) => Math.abs(m.rotation.z));
    expect(Math.max(...restAng)).toBeLessThan(0.1); // starts upright
    // Stack ascends: top block sits above the bottom block.
    expect(restY[restY.length - 1]).toBeGreaterThan(restY[0] + 0.2);

    // Advance through the topple; track the maximum rotation any block reaches
    // and how far the stack scatters horizontally. A toppling (vs. sliding or
    // easing) stack means a block actually ROTATES well past upright.
    const dur = inst.duration();
    let maxAng = 0;
    let maxSpreadX = 0;
    let lowestY = Infinity;
    const baseSpread =
      Math.max(...meshes.map((m) => m.position.x)) - Math.min(...meshes.map((m) => m.position.x));
    for (let k = 1; k <= 240; k++) {
      inst.seek((k / 240) * dur);
      for (const m of meshes) {
        maxAng = Math.max(maxAng, Math.abs(m.rotation.z));
        lowestY = Math.min(lowestY, m.position.y);
      }
      const xs = meshes.map((m) => m.position.x);
      maxSpreadX = Math.max(maxSpreadX, Math.max(...xs) - Math.min(...xs));
    }

    expect(maxAng).toBeGreaterThan(0.6); // a block tumbled (>~35°), genuine topple
    expect(maxSpreadX).toBeGreaterThan(baseSpread + 0.25); // blocks scattered apart
    // Blocks fell toward the floor as the stack came down.
    expect(lowestY).toBeLessThan(restY[restY.length - 1] - 0.3);

    inst.dispose();
  });

  it('hit impulse is live at the frozen pin (mid-topple frame changes with the control)', () => {
    const target = makeTarget(blockTopplePrimitive);
    const inst = blockTopplePrimitive.create(target);
    const meshes = visibleMeshes(target.object as Group);

    // PIN at ~0.45 of duration — mid-topple, where the impulse strongly shapes
    // how far the stack has scattered. Re-seek the SAME t twice with different
    // impulse; reset-replay makes the frame a pure function of params, so it must
    // differ (proves onParamChange→markDirty drives the trajectory control).
    const PIN = inst.duration() * 0.45;

    inst.setControl('impulse', 2.0);
    inst.seek(PIN);
    const soft = meshes.map((m) => ({ x: m.position.x, a: m.rotation.z }));

    inst.setControl('impulse', 8.5);
    inst.seek(PIN);
    const hard = meshes.map((m) => ({ x: m.position.x, a: m.rotation.z }));

    let maxDx = 0;
    let maxDa = 0;
    for (let i = 0; i < meshes.length; i++) {
      maxDx = Math.max(maxDx, Math.abs(hard[i].x - soft[i].x));
      maxDa = Math.max(maxDa, Math.abs(hard[i].a - soft[i].a));
    }
    expect(maxDx + maxDa).toBeGreaterThan(0.05); // the pinned frame genuinely changed

    inst.dispose();
  });
});
