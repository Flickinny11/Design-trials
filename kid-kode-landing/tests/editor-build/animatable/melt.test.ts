import { describe, it, expect } from 'vitest';
import { Mesh, type BufferAttribute } from 'three';
import { meltPrimitive } from '@/lib/prism/animatable/primitives/melt';
import { makeTarget, runConformance } from './_conformance';

// Sample a vertex's y near the middle of the plane's position buffer.
function sampleY(mesh: Mesh, vertexIndex: number): number {
  const pos = mesh.geometry.getAttribute('position') as BufferAttribute;
  return (pos.array as Float32Array)[vertexIndex * 3 + 1];
}

describe('melt primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(meltPrimitive).dispose();
  });

  it('plays: a sampled vertex y decreases (melts down) as t grows', () => {
    const target = makeTarget(meltPrimitive);
    const inst = meltPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const dur = inst.duration();
    // pick a vertex in the interior of the buffer
    const vi = 1000;

    inst.seek(0);
    const y0 = sampleY(mesh, vi);

    inst.seek(dur * 0.5);
    const yMid = sampleY(mesh, vi);

    inst.seek(dur);
    const yEnd = sampleY(mesh, vi);

    // surface sinks: mid below start, end below mid
    expect(y0).toBeGreaterThan(yMid + 1e-4);
    expect(yMid).toBeGreaterThan(yEnd + 1e-4);

    inst.dispose();
    // dispose restores the base position
    const yRestored = sampleY(mesh, vi);
    expect(Math.abs(yRestored - y0)).toBeLessThan(1e-5);
  });

  it('controls change output: larger drip means a larger drop', () => {
    const target = makeTarget(meltPrimitive);
    const inst = meltPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const dur = inst.duration();
    const vi = 1000;

    inst.seek(0);
    const y0 = sampleY(mesh, vi);

    inst.setControl('drip', 0.1);
    inst.seek(dur);
    const dropSmall = y0 - sampleY(mesh, vi);

    inst.setControl('drip', 2.5);
    inst.seek(dur);
    const dropLarge = y0 - sampleY(mesh, vi);

    expect(dropLarge).toBeGreaterThan(dropSmall + 0.1);
    inst.dispose();
  });
});
