import { describe, it, expect } from 'vitest';
import {
  InstancedMesh,
  Matrix4,
  Vector3,
  Quaternion,
  type BufferGeometry,
  type InstancedBufferAttribute,
} from 'three';
import type { MeshBasicNodeMaterial } from 'three/webgpu';
import { hyperspaceWarpPrimitive } from '@/lib/prism/animatable/primitives/hyperspace-warp';
import { makeTarget, runConformance } from './_conformance';

/** Find the built streak InstancedMesh under the target. */
function streaks(target: ReturnType<typeof makeTarget>): InstancedMesh {
  let mesh: InstancedMesh | null = null;
  target.object.traverse((o) => {
    if ((o as InstancedMesh).isInstancedMesh) mesh = o as InstancedMesh;
  });
  if (!mesh) throw new Error('no InstancedMesh built');
  return mesh;
}

/** Per-streak instanced tint attribute (head→tail warmth × brightness). */
function tintAttr(target: ReturnType<typeof makeTarget>): InstancedBufferAttribute {
  const geo = streaks(target).geometry as BufferGeometry;
  return geo.attributes.instanceStreak as InstancedBufferAttribute;
}

/** Decompose instance i's matrix into [radius, length] (radius = |translation in
 *  the xy plane|, length = x-scale of the composed matrix). */
function radiusAndLength(mesh: InstancedMesh, i: number): { radius: number; length: number } {
  const m = new Matrix4();
  mesh.getMatrixAt(i, m);
  const pos = new Vector3();
  const quat = new Quaternion();
  const scl = new Vector3();
  m.decompose(pos, quat, scl);
  return { radius: Math.hypot(pos.x, pos.y), length: scl.x };
}

/** Mean radial distance of the live (rendered) streaks at the current pose. */
function meanRadius(mesh: InstancedMesh): number {
  const n = mesh.count;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += radiusAndLength(mesh, i).radius;
  return sum / Math.max(1, n);
}

/** Mean streak length (x-scale) over the live streaks. */
function meanLength(mesh: InstancedMesh): number {
  const n = mesh.count;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += radiusAndLength(mesh, i).length;
  return sum / Math.max(1, n);
}

/** Sum of |Δ| across two instance-matrix snapshots (frozen-frame diff proxy). */
function matrixDelta(a: Float32Array, b: Float32Array): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]);
  return s;
}

describe('hyperspace-warp primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(hyperspaceWarpPrimitive).dispose();
  });

  it('is a time-driven, looping particles primitive on an empty subject', () => {
    expect(hyperspaceWarpPrimitive.category).toBe('particles');
    expect(hyperspaceWarpPrimitive.subject).toBe('empty');
    expect(hyperspaceWarpPrimitive.defaultDriver).toBe('time');
    expect(hyperspaceWarpPrimitive.volumetric ?? false).toBe(false);

    const target = makeTarget(hyperspaceWarpPrimitive);
    const inst = hyperspaceWarpPrimitive.create(target);
    expect(inst.duration()).toBe(Infinity);
    inst.dispose();
  });

  it('renders instanced streak quads with an additive TSL look (no map)', () => {
    const target = makeTarget(hyperspaceWarpPrimitive);
    const inst = hyperspaceWarpPrimitive.create(target);

    const mesh = streaks(target);
    const mat = mesh.material as MeshBasicNodeMaterial;
    expect(mat.colorNode, 'colorNode carries the streak look').toBeTruthy();
    expect((mat as { map?: unknown }).map, 'no baked texture — falloff is TSL').toBeFalsy();
    expect(mat.transparent, 'transparent for additive glow').toBe(true);
    expect(mat.depthWrite, 'depthWrite off for translucent streaks').toBe(false);

    // Per-streak tint is instanced (feeds colorNode via instancedBufferAttribute).
    const tint = tintAttr(target);
    expect(tint.isInstancedBufferAttribute, 'tint is instanced').toBe(true);
    expect(mesh.count, 'instanceCount drives the draw').toBeGreaterThan(0);

    inst.dispose();
  });

  it('idle (t=0) shows a sensible rest state: streaks present and in-frame', () => {
    const target = makeTarget(hyperspaceWarpPrimitive);
    const inst = hyperspaceWarpPrimitive.create(target);

    inst.seek(0);
    const mesh = streaks(target);
    // At least some live streaks carry visible (non-zero) brightness so the idle
    // tile is not black.
    const tint = tintAttr(target).array as Float32Array;
    let lit = 0;
    for (let i = 0; i < mesh.count * 3; i++) if (tint[i] > 0.02) lit++;
    expect(lit, 'idle frame has lit streaks (not black)').toBeGreaterThan(0);

    // Every live streak's far endpoint stays inside the tile envelope.
    for (let i = 0; i < mesh.count; i++) {
      const { radius, length } = radiusAndLength(mesh, i);
      expect(radius + length, `streak ${i} stays in-frame`).toBeLessThan(3.0);
    }
    inst.dispose();
  });

  it('plays: streaks surge outward — mean radius advances across distinct seeks', () => {
    const target = makeTarget(hyperspaceWarpPrimitive);
    const inst = hyperspaceWarpPrimitive.create(target);

    inst.seek(0.05);
    const mesh = streaks(target);
    const r0 = meanRadius(mesh);

    inst.seek(0.9);
    const r1 = meanRadius(mesh);

    // The radial tunnel evolves between frames (recycling outward → seamless).
    expect(Math.abs(r1 - r0)).toBeGreaterThan(0.02);
    inst.dispose();
  });

  // ── Control liveness at the PINNED engaged frame (W4 #1 failure guard) ──────
  // The advocate sweeps each control low/mid/high at a single frozen pinned t
  // (repeated dt≈0 seeks) and pixel-diffs low-vs-high. Every control must
  // RESHAPE that standing frame with a bold delta — not merely a transient.
  const PIN = 1; // the rig pins control sweeps at t = 1

  it('control: warp speed advances the standing tunnel at the pinned frame', () => {
    const target = makeTarget(hyperspaceWarpPrimitive);
    const inst = hyperspaceWarpPrimitive.create(target);
    const mesh = streaks(target);

    inst.setControl('warpSpeed', 0.15);
    inst.seek(PIN);
    inst.seek(PIN); // repeated dt≈0 seek (frozen-frame discipline)
    const matLow = Float32Array.from(mesh.instanceMatrix.array as Float32Array);

    inst.setControl('warpSpeed', 2.4);
    inst.seek(PIN);
    inst.seek(PIN);
    const matHigh = Float32Array.from(mesh.instanceMatrix.array as Float32Array);

    // Faster warp has evolved the standing field to a visibly different state:
    // every streak's radial position + length shifts. mean-radius is a poor
    // aggregate (a uniform phase shift averages to ~SPAN/2 regardless), so the
    // bold per-instance matrix delta is the real frozen-frame liveness proxy
    // (the advocate pixel-diffs the rendered field, which this models).
    expect(matrixDelta(matLow, matHigh)).toBeGreaterThan(20.0);
    inst.dispose();
  });

  it('control: streak length scales standing streak length at the pinned frame', () => {
    const target = makeTarget(hyperspaceWarpPrimitive);
    const inst = hyperspaceWarpPrimitive.create(target);
    const mesh = streaks(target);

    inst.setControl('streakLength', 0.1);
    inst.seek(PIN);
    inst.seek(PIN);
    const lLow = meanLength(mesh);

    inst.setControl('streakLength', 1.0);
    inst.seek(PIN);
    inst.seek(PIN);
    const lHigh = meanLength(mesh);

    // Longer streaks are unmistakably longer on the frozen frame.
    expect(lHigh).toBeGreaterThan(lLow * 2);
    inst.dispose();
  });

  it('control: star density changes the live streak population at the pinned frame', () => {
    const target = makeTarget(hyperspaceWarpPrimitive);
    const inst = hyperspaceWarpPrimitive.create(target);
    const mesh = streaks(target);

    inst.setControl('density', 40);
    inst.seek(PIN);
    inst.seek(PIN);
    const nLow = mesh.count;

    inst.setControl('density', 240);
    inst.seek(PIN);
    inst.seek(PIN);
    const nHigh = mesh.count;

    expect(nLow).toBeLessThan(nHigh);
    expect(nHigh - nLow).toBeGreaterThan(40);
    inst.dispose();
  });

  it('control: surge depth reshapes the standing field at the pinned frame', () => {
    const target = makeTarget(hyperspaceWarpPrimitive);
    const inst = hyperspaceWarpPrimitive.create(target);
    const mesh = streaks(target);

    inst.setControl('surgeDepth', 0.0);
    inst.seek(PIN);
    inst.seek(PIN);
    const matLow = Float32Array.from(mesh.instanceMatrix.array as Float32Array);

    inst.setControl('surgeDepth', 1.0);
    inst.seek(PIN);
    inst.seek(PIN);
    const matHigh = Float32Array.from(mesh.instanceMatrix.array as Float32Array);

    // The surge wave at the pinned phase pushes the whole field (further +
    // longer) when amplitude is high — a bold frozen-frame delta.
    expect(matrixDelta(matLow, matHigh)).toBeGreaterThan(20.0);
    inst.dispose();
  });

  it('determinism: re-seeking the same t reproduces identical matrices and tints', () => {
    const target = makeTarget(hyperspaceWarpPrimitive);
    const inst = hyperspaceWarpPrimitive.create(target);
    const mesh = streaks(target);

    inst.seek(1.3);
    const matA = Float32Array.from(mesh.instanceMatrix.array as Float32Array);
    const tintA = Float32Array.from(tintAttr(target).array as Float32Array);

    inst.seek(0.4); // scrub away…
    inst.seek(1.3); // …and back: a pure seek reproduces the exact frame
    expect(mesh.instanceMatrix.array as Float32Array).toEqual(matA);
    expect(tintAttr(target).array as Float32Array).toEqual(tintA);

    inst.dispose();
  });

  it('determinism: two independent instances seeked identically match', () => {
    const t1 = makeTarget(hyperspaceWarpPrimitive);
    const t2 = makeTarget(hyperspaceWarpPrimitive);
    const a = hyperspaceWarpPrimitive.create(t1);
    const b = hyperspaceWarpPrimitive.create(t2);

    a.seek(0.77);
    b.seek(0.77);
    expect(streaks(t1).instanceMatrix.array as Float32Array).toEqual(
      streaks(t2).instanceMatrix.array as Float32Array,
    );
    expect(tintAttr(t1).array as Float32Array).toEqual(tintAttr(t2).array as Float32Array);

    a.dispose();
    b.dispose();
  });

  it('dispose frees the geometry and material it created and detaches the mesh', () => {
    const target = makeTarget(hyperspaceWarpPrimitive);
    const inst = hyperspaceWarpPrimitive.create(target);

    const mesh = streaks(target);
    const geometry = mesh.geometry as BufferGeometry;
    const material = mesh.material as MeshBasicNodeMaterial;

    let geometryDisposed = false;
    let materialDisposed = false;
    geometry.addEventListener('dispose', () => {
      geometryDisposed = true;
    });
    material.addEventListener('dispose', () => {
      materialDisposed = true;
    });

    inst.dispose();
    expect(geometryDisposed, 'geometry dispose() fired').toBe(true);
    expect(materialDisposed, 'material dispose() fired').toBe(true);
    expect(target.object.children.includes(mesh), 'mesh removed from target').toBe(false);
  });
});
