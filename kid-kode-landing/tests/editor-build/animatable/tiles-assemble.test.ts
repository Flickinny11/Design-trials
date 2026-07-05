import { describe, it, expect } from 'vitest';
import { Group, Mesh, type Material } from 'three';
import { tilesAssemblePrimitive } from '@/lib/prism/animatable/primitives/tiles-assemble';
import { makeTarget, runConformance } from './_conformance';

// Pull the tile grid the primitive built into target.object.
function grid(object: Group): Group {
  const g = object.getObjectByName('tiles-assemble-grid') as Group | null;
  if (!g) throw new Error('tiles-assemble-grid not found');
  return g;
}

// First active (visible) tile.
function firstActiveTile(object: Group): Mesh {
  const g = grid(object);
  for (const child of g.children) {
    if ((child as Mesh).visible) return child as Mesh;
  }
  throw new Error('no active tile');
}

describe('tiles-assemble primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(tilesAssemblePrimitive).dispose();
  });

  it('plays: a tile converges to its slot (z -> 0) and rotation -> 0 while opacity rises', () => {
    const target = makeTarget(tilesAssemblePrimitive);
    const inst = tilesAssemblePrimitive.create(target);
    const dur = inst.duration();
    const object = target.object as Group;

    // The leading (top-left) tile settles first, so measure it at start vs end.
    const tile = firstActiveTile(object);
    const mat = tile.material as Material & { opacity: number };

    inst.seek(0);
    const z0 = tile.position.z;
    const rot0 = Math.abs(tile.rotation.x) + Math.abs(tile.rotation.y) + Math.abs(tile.rotation.z);
    const op0 = mat.opacity;

    inst.seek(dur);
    const zEnd = tile.position.z;
    const rotEnd = Math.abs(tile.rotation.x) + Math.abs(tile.rotation.y) + Math.abs(tile.rotation.z);
    const opEnd = mat.opacity;

    // Started pushed back in depth (z negative), settles to the flat face (~0).
    expect(z0).toBeLessThan(zEnd - 1);
    expect(Math.abs(zEnd)).toBeLessThan(0.01);
    // Flip rotation collapses to flat.
    expect(rotEnd).toBeLessThan(rot0 - 0.1);
    // Opacity ramps up.
    expect(opEnd).toBeGreaterThan(op0);

    inst.dispose();
  });

  it('controls change output: deeper depth means a tile starts further back in z', () => {
    const target = makeTarget(tilesAssemblePrimitive);
    const inst = tilesAssemblePrimitive.create(target);
    const object = target.object as Group;
    const tile = firstActiveTile(object);

    inst.setControl('depth', 2);
    inst.seek(0);
    const zShallow = tile.position.z;

    inst.setControl('depth', 8);
    inst.seek(0);
    const zDeep = tile.position.z;

    // Deeper start pushes the tile further back (more negative z).
    expect(zDeep).toBeLessThan(zShallow - 1);

    inst.dispose();
  });
});
