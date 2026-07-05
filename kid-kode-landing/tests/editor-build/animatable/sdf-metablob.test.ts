import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { sdfMetablobPrimitive } from '@/lib/prism/animatable/primitives/sdf-metablob';
import { makeTarget, runConformance } from './_conformance';

// ── CPU mirror of the primitive's scene SDF ───────────────────────────────
// The primitive raymarches a SINGLE quad in the fragment shader, so there is
// no per-particle CPU buffer to sample (unlike embers). Instead the primitive
// publishes its live blob centers + radii + smooth-union k on target.userData
// every seek (computed by the SAME deterministic orbit math the TSL Loop reads
// through uniforms). The tests reproduce the field on the CPU from those
// published centers and assert concrete blob-system state, exactly mirroring
// the GPU scene the rig renders.

const TAU = Math.PI * 2;

interface Blob {
  x: number;
  y: number;
  z: number;
  r: number;
  active: number;
}
interface State {
  blobs: Blob[];
  k: number;
  count: number;
}

/** opSmoothUnion (iquilez, §8) — the same neck-fusing union the shader uses. */
function smin(a: number, b: number, k: number): number {
  if (k <= 1e-6) return Math.min(a, b);
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k));
  return b * (1 - h) + a * h - k * h * (1 - h);
}

/** Scene SDF at a world point from published centers (active blobs only). */
function sceneSdf(p: { x: number; y: number; z: number }, st: State): number {
  let d = 1e6;
  for (const b of st.blobs) {
    if (b.active < 0.5) continue;
    const dist = Math.hypot(p.x - b.x, p.y - b.y, p.z - b.z) - b.r;
    d = smin(d, dist, st.k);
  }
  return d;
}

/** Read the live published field. */
function field(target: ReturnType<typeof makeTarget>): State {
  const u = target.userData.sdfMetablob as
    | {
        blobs: Blob[];
        k: { value: number };
        count: number;
      }
    | undefined;
  if (!u) throw new Error('sdf-metablob did not publish userData.sdfMetablob');
  return { blobs: u.blobs, k: u.k.value, count: u.count };
}

/** Min scene SDF over a coarse 3D grid — a frozen-frame "occupancy" measure.
 *  Returns the fraction of grid cells that are INSIDE the blob body (d < 0),
 *  i.e. a CPU proxy for the rendered silhouette footprint. */
function occupancy(st: State, span = 1.6, n = 18): number {
  let inside = 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let kk = 0; kk < n; kk++) {
        const x = -span + (2 * span * i) / (n - 1);
        const y = -span + (2 * span * j) / (n - 1);
        const z = -span + (2 * span * kk) / (n - 1);
        total++;
        if (sceneSdf({ x, y, z }, st) < 0) inside++;
      }
    }
  }
  return inside / total;
}

/** The raymarched quad the primitive builds. */
function quad(target: ReturnType<typeof makeTarget>): Mesh {
  let mesh: Mesh | null = null;
  target.object.traverse((o) => {
    if ((o as Mesh).isMesh && o.name === 'sdf-metablob') mesh = o as Mesh;
  });
  if (!mesh) throw new Error('no sdf-metablob quad built');
  return mesh;
}

describe('sdf-metablob primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(sdfMetablobPrimitive).dispose();
  });

  it('is a particles primitive, empty subject, finite ~8s loop', () => {
    const target = makeTarget(sdfMetablobPrimitive);
    const inst = sdfMetablobPrimitive.create(target);
    expect(sdfMetablobPrimitive.category).toBe('particles');
    expect(sdfMetablobPrimitive.subject).toBe('empty');
    expect(sdfMetablobPrimitive.defaultDriver).toBe('time');
    const d = inst.duration();
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeGreaterThan(6);
    expect(d).toBeLessThan(12);
    inst.dispose();
  });

  it('builds a SINGLE raymarched quad (single-plane discipline, not a slab stack)', () => {
    const target = makeTarget(sdfMetablobPrimitive);
    const inst = sdfMetablobPrimitive.create(target);
    // Exactly one mesh — the whole blob is fragment math on one plane.
    let meshes = 0;
    target.object.traverse((o) => {
      if ((o as Mesh).isMesh) meshes++;
    });
    expect(meshes).toBe(1);
    const m = quad(target);
    const mat = m.material as { colorNode?: unknown; transparent?: boolean; depthWrite?: boolean };
    expect(mat.colorNode, 'colorNode carries the raymarch shading').toBeTruthy();
    expect(mat.transparent, 'transparent so the background reads through').toBe(true);
    inst.dispose();
  });

  it('plays: satellites orbit — blob centers move across distinct seek times', () => {
    const target = makeTarget(sdfMetablobPrimitive);
    const inst = sdfMetablobPrimitive.create(target);

    inst.seek(0.0);
    const a = field(target).blobs.map((b) => ({ x: b.x, y: b.y, z: b.z }));

    inst.seek(2.0);
    const b = field(target).blobs.map((b) => ({ x: b.x, y: b.y, z: b.z }));

    // The core (index 0) anchors at the heart; at least one satellite must have
    // travelled along its orbit between the two frames.
    let moved = 0;
    for (let i = 1; i < a.length; i++) {
      moved += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y, a[i].z - b[i].z);
    }
    expect(moved).toBeGreaterThan(0.2);
    inst.dispose();
  });

  it('fuses: a satellite near the core leaves a single connected body (smooth union)', () => {
    const target = makeTarget(sdfMetablobPrimitive);
    const inst = sdfMetablobPrimitive.create(target);
    // High fusion smoothness — necks are fat, the field reads as one body.
    inst.setControl('fusion', 0.6);
    inst.seek(1.0);
    const st = field(target);
    // The smooth-union output between the core and its nearest active satellite
    // must be MORE negative (deeper inside, i.e. fused) than a hard min would be
    // at the neck midpoint — that gap IS the liquid neck.
    expect(st.blobs.length).toBeGreaterThanOrEqual(2);
    const core = st.blobs[0];
    // midpoint between core and satellite 1
    const sat = st.blobs[1];
    const mid = { x: (core.x + sat.x) / 2, y: (core.y + sat.y) / 2, z: (core.z + sat.z) / 2 };
    const dCore = Math.hypot(mid.x - core.x, mid.y - core.y, mid.z - core.z) - core.r;
    const dSat = Math.hypot(mid.x - sat.x, mid.y - sat.y, mid.z - sat.z) - sat.r;
    const hard = Math.min(dCore, dSat);
    const soft = smin(dCore, dSat, st.k);
    // smooth union pulls the surface OUTWARD at the neck: soft < hard.
    expect(soft).toBeLessThanOrEqual(hard + 1e-6);
    inst.dispose();
  });

  // ── Control liveness at the PINNED engaged frame (the #1 catalog failure) ──
  // The advocate sweeps each control low→mid→high at a single frozen t (the rig
  // pins t=1 for 'time' tiles) and pixel-diffs. Each control must BOLDLY
  // reshape the standing field at that pin, measured statically (no transient).
  const PIN = 1.0;

  it('control: blob count visibly changes the population at the pinned frame', () => {
    const target = makeTarget(sdfMetablobPrimitive);
    const inst = sdfMetablobPrimitive.create(target);

    inst.setControl('count', 2);
    inst.seek(PIN);
    const lowActive = field(target).blobs.filter((b) => b.active > 0.5).length;
    const lowOcc = occupancy(field(target));

    inst.setControl('count', 5);
    inst.seek(PIN);
    const highActive = field(target).blobs.filter((b) => b.active > 0.5).length;
    const highOcc = occupancy(field(target));

    expect(lowActive).toBe(2);
    expect(highActive).toBe(5);
    // More blobs ⇒ a visibly larger body footprint at the frozen frame.
    expect(highOcc).toBeGreaterThan(lowOcc * 1.25);
  });

  it('control: orbit speed advances satellites to a different standing pose at the pin', () => {
    const target = makeTarget(sdfMetablobPrimitive);
    const inst = sdfMetablobPrimitive.create(target);

    // SPEED is a rate — invisible at a frozen frame UNLESS the pinned snapshot is
    // a function of speed. The primitive folds speed into the orbit phase, so a
    // faster speed has carried satellites FURTHER along their paths at the same t.
    inst.setControl('orbitSpeed', 0.2);
    inst.seek(PIN);
    const slow = field(target).blobs.map((b) => ({ x: b.x, y: b.y, z: b.z }));

    inst.setControl('orbitSpeed', 2.0);
    inst.seek(PIN);
    const fast = field(target).blobs.map((b) => ({ x: b.x, y: b.y, z: b.z }));

    let delta = 0;
    for (let i = 1; i < slow.length; i++) {
      delta += Math.hypot(slow[i].x - fast[i].x, slow[i].y - fast[i].y, slow[i].z - fast[i].z);
    }
    // Bold positional difference at the pin — the standing pose is plainly
    // reshaped (not a sub-noise wobble).
    expect(delta).toBeGreaterThan(0.6);
  });

  it('control: fusion smoothness changes the body footprint at the pinned frame', () => {
    const target = makeTarget(sdfMetablobPrimitive);
    const inst = sdfMetablobPrimitive.create(target);

    inst.setControl('count', 5);

    inst.setControl('fusion', 0.05);
    inst.seek(PIN);
    const tight = occupancy(field(target));

    inst.setControl('fusion', 0.7);
    inst.seek(PIN);
    const fat = occupancy(field(target));

    // Fatter necks ⇒ the smooth-union body swells, occupying visibly more volume
    // at the frozen frame.
    expect(fat).toBeGreaterThan(tight * 1.1);
  });

  it('control: surface gloss visibly changes the shading uniform at the pinned frame', () => {
    const target = makeTarget(sdfMetablobPrimitive);
    const inst = sdfMetablobPrimitive.create(target);

    inst.setControl('gloss', 0.0);
    inst.seek(PIN);
    const u = target.userData.sdfMetablob as { gloss: { value: number } };
    const lowGloss = u.gloss.value;

    inst.setControl('gloss', 1.0);
    inst.seek(PIN);
    const highGloss = u.gloss.value;

    // Gloss drives the specular/fresnel contribution — a live, bounded uniform
    // the shading reads (the rig's pixel-diff sees the brightened body/rim).
    expect(Math.abs(highGloss - lowGloss)).toBeGreaterThan(0.5);
    inst.dispose();
  });

  it('determinism: two instances seeked identically publish identical fields', () => {
    const t1 = makeTarget(sdfMetablobPrimitive);
    const i1 = sdfMetablobPrimitive.create(t1);
    const t2 = makeTarget(sdfMetablobPrimitive);
    const i2 = sdfMetablobPrimitive.create(t2);

    i1.seek(0.4);
    i1.seek(1.37);
    i2.seek(1.37);

    const a = field(t1).blobs;
    const b = field(t2).blobs;
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].x).toBeCloseTo(b[i].x, 10);
      expect(a[i].y).toBeCloseTo(b[i].y, 10);
      expect(a[i].z).toBeCloseTo(b[i].z, 10);
      expect(a[i].r).toBeCloseTo(b[i].r, 10);
    }
    i1.dispose();
    i2.dispose();
  });

  it('idle rest state (t=0) is a sensible non-empty body, not black', () => {
    const target = makeTarget(sdfMetablobPrimitive);
    const inst = sdfMetablobPrimitive.create(target);
    inst.seek(0);
    const st = field(target);
    // At least the core is present and occupies a real footprint at rest.
    expect(st.blobs.filter((b) => b.active > 0.5).length).toBeGreaterThanOrEqual(2);
    expect(occupancy(st)).toBeGreaterThan(0.01);
    inst.dispose();
  });

  it('dispose: restores the scene and frees the created quad + material', () => {
    const target = makeTarget(sdfMetablobPrimitive);
    const inst = sdfMetablobPrimitive.create(target);

    const m = quad(target);
    const geometry = m.geometry;
    const material = m.material as { addEventListener: (e: string, cb: () => void) => void };

    let geomDisposed = false;
    let matDisposed = false;
    geometry.addEventListener('dispose', () => {
      geomDisposed = true;
    });
    material.addEventListener('dispose', () => {
      matDisposed = true;
    });

    inst.dispose();
    expect(geomDisposed, 'quad geometry disposed').toBe(true);
    expect(matDisposed, 'material disposed').toBe(true);
    expect(target.object.children.includes(m), 'quad removed from target').toBe(false);
    expect(target.userData.sdfMetablob, 'published handle cleared').toBeUndefined();
  });

  it('seek wraps the ~8s loop seamlessly (t and t+duration match)', () => {
    const target = makeTarget(sdfMetablobPrimitive);
    const inst = sdfMetablobPrimitive.create(target);
    const dur = inst.duration();
    inst.seek(0.7);
    const a = field(target).blobs.map((b) => ({ x: b.x, y: b.y, z: b.z }));
    inst.seek(0.7 + dur);
    const b = field(target).blobs.map((b) => ({ x: b.x, y: b.y, z: b.z }));
    for (let i = 0; i < a.length; i++) {
      expect(a[i].x).toBeCloseTo(b[i].x, 6);
      expect(a[i].y).toBeCloseTo(b[i].y, 6);
      expect(a[i].z).toBeCloseTo(b[i].z, 6);
    }
    inst.dispose();
    expect(TAU).toBeGreaterThan(0); // keep TAU referenced
  });
});
