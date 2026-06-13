import { describe, it, expect } from 'vitest';
import {
  Sprite,
  InstancedMesh,
  Matrix4,
  Vector3,
  Quaternion,
  type BufferGeometry,
  type InstancedBufferAttribute,
} from 'three';
import type { PointsNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu';
import { constellationNetPrimitive } from '@/lib/prism/animatable/primitives/constellation-net';
import { makeTarget, runConformance } from './_conformance';

// ── Discovery helpers ──────────────────────────────────────────────────────
/** The instanced star Sprite under the target. */
function starSprite(target: ReturnType<typeof makeTarget>): Sprite {
  let s: Sprite | null = null;
  target.object.traverse((o) => {
    if ((o as Sprite).isSprite) s = o as Sprite;
  });
  if (!s) throw new Error('no star Sprite built');
  return s;
}

/** The link InstancedMesh under the target. */
function linkMesh(target: ReturnType<typeof makeTarget>): InstancedMesh {
  let m: InstancedMesh | null = null;
  target.object.traverse((o) => {
    if ((o as InstancedMesh).isInstancedMesh) m = o as InstancedMesh;
  });
  if (!m) throw new Error('no link InstancedMesh built');
  return m;
}

function starPositions(target: ReturnType<typeof makeTarget>): Float32Array {
  const geo = starSprite(target).geometry as BufferGeometry;
  return (geo.attributes.instancePosition as InstancedBufferAttribute).array as Float32Array;
}

function linkBrightness(target: ReturnType<typeof makeTarget>): Float32Array {
  const geo = linkMesh(target).geometry as BufferGeometry;
  return (geo.attributes.instanceLink as InstancedBufferAttribute).array as Float32Array;
}

/** Count links that actually render: per-instance brightness > 0. (A parked
 *  link carries zero brightness and is invisible regardless of its matrix — the
 *  matrix of a collapsed slot decomposes ambiguously, so brightness is the
 *  authoritative render-visibility signal.) */
function liveLinkCount(target: ReturnType<typeof makeTarget>): number {
  const arr = linkBrightness(target);
  let live = 0;
  for (let i = 0; i < arr.length; i += 3) {
    if (arr[i] > 0 || arr[i + 1] > 0 || arr[i + 2] > 0) live++;
  }
  return live;
}

/** A link's per-instance scale is also recoverable from its matrix; used to
 *  assert live links are correctly oriented/stretched (length > thickness). */
function maxLinkLength(target: ReturnType<typeof makeTarget>): number {
  const im = linkMesh(target);
  const m = new Matrix4();
  const p = new Vector3();
  const q = new Quaternion();
  const s = new Vector3();
  let maxLen = 0;
  const bright = linkBrightness(target);
  for (let i = 0; i < im.count; i++) {
    if (!(bright[i * 3] > 0 || bright[i * 3 + 1] > 0 || bright[i * 3 + 2] > 0)) continue;
    im.getMatrixAt(i, m);
    m.decompose(p, q, s);
    maxLen = Math.max(maxLen, s.x);
  }
  return maxLen;
}

/** Sum of per-instance link brightness (luminance proxy for the frozen frame). */
function linkEnergy(target: ReturnType<typeof makeTarget>): number {
  const arr = linkBrightness(target);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum;
}

/** Sum of star instanced-color channels (luminance proxy). */
function starEnergy(target: ReturnType<typeof makeTarget>): number {
  const geo = starSprite(target).geometry as BufferGeometry;
  const arr = (geo.attributes.instanceColor as InstancedBufferAttribute).array as Float32Array;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum;
}

describe('constellation-net primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(constellationNetPrimitive).dispose();
  });

  it('is a time-driven looping empty-subject particles primitive', () => {
    expect(constellationNetPrimitive.category).toBe('particles');
    expect(constellationNetPrimitive.subject).toBe('empty');
    expect(constellationNetPrimitive.defaultDriver).toBe('time');
    const target = makeTarget(constellationNetPrimitive);
    const inst = constellationNetPrimitive.create(target);
    expect(inst.duration()).toBe(Infinity);
    inst.dispose();
  });

  // ── Rendering shape: instanced sprites + instanced link quads, TSL nodes ──
  it('builds an instanced star Sprite and a link InstancedMesh with TSL node materials (no maps)', () => {
    const target = makeTarget(constellationNetPrimitive);
    const inst = constellationNetPrimitive.create(target);

    const sprite = starSprite(target);
    const smat = sprite.material as PointsNodeMaterial;
    expect(smat.isPointsNodeMaterial, 'stars are a PointsNodeMaterial').toBe(true);
    expect(smat.colorNode, 'star colorNode carries radial falloff').toBeTruthy();
    expect(smat.positionNode, 'star positionNode places instances').toBeTruthy();
    expect(smat.map, 'no baked sprite texture — TSL falloff').toBeFalsy();
    expect(smat.depthWrite, 'translucent motes do not write depth').toBe(false);

    const im = linkMesh(target);
    const lmat = im.material as MeshBasicNodeMaterial;
    expect(lmat.colorNode, 'link colorNode carries the soft line falloff').toBeTruthy();
    expect(lmat.map, 'no baked link texture').toBeFalsy();
    expect(lmat.depthWrite, 'links do not write depth').toBe(false);

    inst.dispose();
  });

  it('keeps the whole system inside the tile frame at default params', () => {
    const target = makeTarget(constellationNetPrimitive);
    const inst = constellationNetPrimitive.create(target);
    inst.seek(1.0);
    const pos = starPositions(target);
    const count = inst.getParams().starCount as number;
    let maxAbs = 0;
    for (let i = 0; i < count; i++) {
      maxAbs = Math.max(maxAbs, Math.abs(pos[i * 3]), Math.abs(pos[i * 3 + 1]), Math.abs(pos[i * 3 + 2]));
    }
    // Tasteful empty-subject span (~1.6–2.2 half-extent budget).
    expect(maxAbs).toBeLessThan(2.2);
    inst.dispose();
  });

  // ── Behavior: the net lives — motes drift and the link set reforms ────────
  it('plays: star positions drift across distinct seeks (motes wander)', () => {
    const target = makeTarget(constellationNetPrimitive);
    const inst = constellationNetPrimitive.create(target);

    inst.seek(0.2);
    const a = Float32Array.from(starPositions(target));

    inst.seek(3.7);
    const b = starPositions(target);

    // At least one mote moved meaningfully (drift paths).
    let moved = 0;
    for (let i = 0; i < a.length; i++) moved += Math.abs(a[i] - b[i]);
    expect(moved).toBeGreaterThan(0.1);
    inst.dispose();
  });

  it('proximity links: at least some links are live and brightness falls off with distance', () => {
    const target = makeTarget(constellationNetPrimitive);
    const inst = constellationNetPrimitive.create(target);
    inst.seek(1.0);

    // Default params should connect a connected net (some live links).
    expect(liveLinkCount(target)).toBeGreaterThan(0);
    // Brightness is non-negative and at least one link carries energy.
    const arr = linkBrightness(target);
    let maxB = 0;
    for (let i = 0; i < arr.length; i++) {
      expect(arr[i]).toBeGreaterThanOrEqual(0);
      maxB = Math.max(maxB, arr[i]);
    }
    expect(maxB).toBeGreaterThan(0);
    // Live links are stretched between endpoints: length ≫ hairline thickness.
    expect(maxLinkLength(target)).toBeGreaterThan(0.1);
    inst.dispose();
  });

  it('the net reforms as motes drift: live link set differs across distinct seeks', () => {
    const target = makeTarget(constellationNetPrimitive);
    const inst = constellationNetPrimitive.create(target);

    inst.seek(0.5);
    const e0 = linkEnergy(target);

    inst.seek(6.3);
    const e1 = linkEnergy(target);

    // The breathing net: total link energy changes as proximity relationships
    // change with drift (would be byte-identical for a fixed topology).
    expect(Math.abs(e1 - e0)).toBeGreaterThan(1e-3);
    inst.dispose();
  });

  // ── CONTROL LIVENESS at the pinned engaged frame (t = 1, repeated seeks) ──
  // The advocate sweeps each control low/mid/high at ONE frozen pinned frame
  // and pixel-diffs. Every control must BOLDLY reshape that standing frame.
  const PIN = 1.0;

  it('control liveness — starCount changes the live star population at the pin', () => {
    const target = makeTarget(constellationNetPrimitive);
    const inst = constellationNetPrimitive.create(target);

    inst.setControl('starCount', 30);
    inst.seek(PIN);
    inst.seek(PIN); // repeated (dt≈0) seek — the real advocate measure
    const sparse = starSprite(target).count;
    const sparseE = starEnergy(target);

    inst.setControl('starCount', 80);
    inst.seek(PIN);
    inst.seek(PIN);
    const dense = starSprite(target).count;
    const denseE = starEnergy(target);

    expect(dense).toBeGreaterThan(sparse + 20); // unmistakable population delta
    // More live stars → more lit instanced-color energy in the frozen frame.
    expect(denseE).toBeGreaterThan(sparseE * 1.3);
    inst.dispose();
  });

  it('control liveness — linkDistance reshapes the link set at the pin (BOLD delta)', () => {
    const target = makeTarget(constellationNetPrimitive);
    const inst = constellationNetPrimitive.create(target);

    inst.setControl('linkDistance', 0.35);
    inst.seek(PIN);
    inst.seek(PIN);
    const fewLive = liveLinkCount(target);
    const fewEnergy = linkEnergy(target);

    inst.setControl('linkDistance', 0.85);
    inst.seek(PIN);
    inst.seek(PIN);
    const manyLive = liveLinkCount(target);
    const manyEnergy = linkEnergy(target);

    // A larger link distance connects strictly more pairs at the SAME frozen
    // positions — the net densifies visibly.
    expect(manyLive).toBeGreaterThan(fewLive);
    expect(manyEnergy).toBeGreaterThan(fewEnergy + 0.5); // bold energy delta
    inst.dispose();
  });

  it('control liveness — driftSpeed evolves the standing layout differently at the pin', () => {
    const target = makeTarget(constellationNetPrimitive);
    const inst = constellationNetPrimitive.create(target);

    inst.setControl('driftSpeed', 0.05);
    inst.seek(PIN);
    inst.seek(PIN);
    const slow = Float32Array.from(starPositions(target));

    inst.setControl('driftSpeed', 1.4);
    inst.seek(PIN);
    inst.seek(PIN);
    const fast = starPositions(target);

    // At the SAME pinned t, a faster drift has carried the motes to a visibly
    // different standing layout (positions are a function of speed × t), so the
    // frozen frame is not byte-identical — a rate control made visible statically.
    const count = inst.getParams().starCount as number;
    let delta = 0;
    for (let i = 0; i < count * 3; i++) delta += Math.abs(slow[i] - fast[i]);
    const meanAbs = delta / (count * 3);
    expect(meanAbs).toBeGreaterThan(0.05); // well above sub-noise
    inst.dispose();
  });

  it('control liveness — linkBrightness scales link energy at the pin (BOLD delta)', () => {
    const target = makeTarget(constellationNetPrimitive);
    const inst = constellationNetPrimitive.create(target);

    inst.setControl('linkBrightness', 0.2);
    inst.seek(PIN);
    inst.seek(PIN);
    const dim = linkEnergy(target);

    inst.setControl('linkBrightness', 2.4);
    inst.seek(PIN);
    inst.seek(PIN);
    const bright = linkEnergy(target);

    // Same positions / same live pairs, only brightness scaled — frozen frame
    // is unmistakably brighter.
    expect(bright).toBeGreaterThan(dim * 3);
    inst.dispose();
  });

  // ── Determinism ───────────────────────────────────────────────────────────
  it('determinism: two instances seeked identically produce identical state', () => {
    const ta = makeTarget(constellationNetPrimitive);
    const tb = makeTarget(constellationNetPrimitive);
    const ia = constellationNetPrimitive.create(ta);
    const ib = constellationNetPrimitive.create(tb);

    ia.seek(2.4);
    ib.seek(2.4);

    expect(starPositions(ta)).toEqual(starPositions(tb));
    expect(linkBrightness(ta)).toEqual(linkBrightness(tb));

    ia.dispose();
    ib.dispose();
  });

  it('determinism: re-seeking the same t reproduces the identical frame', () => {
    const target = makeTarget(constellationNetPrimitive);
    const inst = constellationNetPrimitive.create(target);

    inst.seek(1.9);
    const pA = Float32Array.from(starPositions(target));
    const lA = Float32Array.from(linkBrightness(target));

    inst.seek(0.3); // scrub away
    inst.seek(1.9); // and back
    expect(starPositions(target)).toEqual(pA);
    expect(linkBrightness(target)).toEqual(lA);

    inst.dispose();
  });

  // ── Idle rest state — not empty black at t=0 ──────────────────────────────
  it('idle (t=0) shows a sensible rest state: stars lit and some links present', () => {
    const target = makeTarget(constellationNetPrimitive);
    const inst = constellationNetPrimitive.create(target);
    inst.seek(0);
    expect(starEnergy(target)).toBeGreaterThan(0.5); // motes visible at rest
    expect(liveLinkCount(target)).toBeGreaterThan(0); // a net already present
    inst.dispose();
  });

  // ── Dispose restores everything ───────────────────────────────────────────
  it('dispose frees the geometries/materials it created and detaches from target', () => {
    const target = makeTarget(constellationNetPrimitive);
    const inst = constellationNetPrimitive.create(target);

    const sprite = starSprite(target);
    const im = linkMesh(target);
    const sgeo = sprite.geometry as BufferGeometry;
    const smat = sprite.material as PointsNodeMaterial;
    const lgeo = im.geometry as BufferGeometry;
    const lmat = im.material as MeshBasicNodeMaterial;

    let sgeoD = false,
      smatD = false,
      lgeoD = false,
      lmatD = false;
    sgeo.addEventListener('dispose', () => (sgeoD = true));
    smat.addEventListener('dispose', () => (smatD = true));
    lgeo.addEventListener('dispose', () => (lgeoD = true));
    lmat.addEventListener('dispose', () => (lmatD = true));

    const before = target.object.children.length;
    inst.dispose();

    expect(sgeoD && smatD && lgeoD && lmatD, 'all created resources disposed').toBe(true);
    expect(target.object.children.includes(sprite), 'star sprite detached').toBe(false);
    expect(target.object.children.includes(im), 'link mesh detached').toBe(false);
    expect(target.object.children.length).toBeLessThan(before);
  });
});
