import { describe, it, expect } from 'vitest';
import { Group, Mesh } from 'three';
import { voxelizePrimitive } from '@/lib/prism/animatable/primitives/voxelize';
import { makeTarget, runConformance } from './_conformance';

/** Find the voxel grid Group the primitive builds into target.object. */
function findGrid(object: import('three').Object3D): Group {
  let grid: Group | null = null;
  object.traverse((o) => {
    if (o.name === 'voxelize-grid') grid = o as Group;
  });
  if (!grid) throw new Error('voxelize-grid not found');
  return grid;
}

/** First visible voxel mesh in the grid. */
function firstVisibleVoxel(grid: Group): Mesh {
  const m = grid.children.find((c) => (c as Mesh).visible) as Mesh | undefined;
  if (!m) throw new Error('no visible voxel');
  return m;
}

describe('voxelize primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(voxelizePrimitive).dispose();
  });

  it('plays: voxels move from scattered toward their flat grid slot', () => {
    const target = makeTarget(voxelizePrimitive);
    const inst = voxelizePrimitive.create(target);
    const grid = findGrid(target.object);
    const dur = inst.duration();

    inst.seek(0);
    const voxel = firstVisibleVoxel(grid);
    const p0 = voxel.position.clone();
    const op0 = (voxel as Mesh).visible
      ? ((voxel.material as { opacity: number }).opacity)
      : 0;
    // |z| offset is large while scattered (biased toward viewer).
    const absZ0 = Math.abs(p0.z);

    inst.seek(dur);
    const pEnd = voxel.position.clone();
    const opEnd = (voxel.material as { opacity: number }).opacity;
    const absZEnd = Math.abs(pEnd.z);

    // Mid-frame check: a frame between start and end differs from both.
    inst.seek(dur * 0.5);
    const pMid = voxel.position.clone();

    // The voxel converges to its flat grid slot (z -> ~0) by the end.
    expect(absZ0).toBeGreaterThan(absZEnd + 0.3);
    // Position visibly changes across the timeline.
    expect(p0.distanceTo(pEnd)).toBeGreaterThan(0.3);
    // Mid differs from both endpoints (real in-between motion).
    expect(pMid.distanceTo(p0)).toBeGreaterThan(0.001);
    expect(pMid.distanceTo(pEnd)).toBeGreaterThan(0.001);
    // Opacity rises as voxels settle.
    expect(opEnd).toBeGreaterThan(op0);

    inst.dispose();
  });

  it('controls change output: larger scatter means larger initial spread', () => {
    const target = makeTarget(voxelizePrimitive);
    const inst = voxelizePrimitive.create(target);
    const grid = findGrid(target.object);

    inst.setControl('scatter', 1);
    inst.seek(0);
    const small = firstVisibleVoxel(grid).position.length();

    inst.setControl('scatter', 6);
    inst.seek(0);
    const large = firstVisibleVoxel(grid).position.length();

    expect(large).toBeGreaterThan(small + 0.3);

    inst.dispose();
  });
});
