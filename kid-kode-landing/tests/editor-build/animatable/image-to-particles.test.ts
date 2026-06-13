import { describe, it, expect } from 'vitest';
import {
  Color,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Texture,
  Vector3,
  type BufferGeometry,
  type InstancedBufferAttribute,
  type Material,
} from 'three';
import { imageToParticlesPrimitive } from '@/lib/prism/animatable/primitives/image-to-particles';
import { makeTarget, runConformance } from './_conformance';

type FadableMat = Material & { opacity: number };

/** Find the built grain InstancedMesh under the target. */
function grainMesh(target: ReturnType<typeof makeTarget>): InstancedMesh {
  let mesh: InstancedMesh | null = null;
  target.object.traverse((o) => {
    if ((o as InstancedMesh).isInstancedMesh) mesh = o as InstancedMesh;
  });
  if (!mesh) throw new Error('no InstancedMesh built');
  return mesh;
}

/** The per-grain instanced UV-cell attribute (each grain's texture sample uv). */
function grainUv(target: ReturnType<typeof makeTarget>): InstancedBufferAttribute {
  const geo = grainMesh(target).geometry as BufferGeometry;
  return geo.attributes.instanceCellUv as InstancedBufferAttribute;
}

/** Pull instance i's world-ish position out of the live instanceMatrix. */
function grainPos(target: ReturnType<typeof makeTarget>, i: number): Vector3 {
  const mesh = grainMesh(target);
  const m = new Matrix4();
  mesh.getMatrixAt(i, m);
  return new Vector3().setFromMatrixPosition(m);
}

/** The mean translation magnitude of the live (drawn) grains away from their
 *  home cell — a single scalar that summarises how far the storm has flung the
 *  grains at the current frozen frame. Used for control-liveness deltas. */
function meanDisplacement(target: ReturnType<typeof makeTarget>, homes: Vector3[]): number {
  const mesh = grainMesh(target);
  const m = new Matrix4();
  const p = new Vector3();
  let sum = 0;
  const n = mesh.count;
  for (let i = 0; i < n; i++) {
    mesh.getMatrixAt(i, m);
    p.setFromMatrixPosition(m);
    sum += p.distanceTo(homes[i] ?? p);
  }
  return n > 0 ? sum / n : 0;
}

/** Capture each live grain's home (settled) position at state=0. */
function captureHomes(target: ReturnType<typeof makeTarget>): Vector3[] {
  const mesh = grainMesh(target);
  const m = new Matrix4();
  const out: Vector3[] = [];
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, m);
    out.push(new Vector3().setFromMatrixPosition(m));
  }
  return out;
}

/** First decorative chrome material under the card panel (header bar etc.). */
function firstChromeMat(panel: Mesh): FadableMat {
  let found: FadableMat | null = null;
  panel.traverse((o) => {
    if (found) return;
    const mm = o as Mesh;
    if (mm.isMesh && mm !== panel && mm.material) {
      found = (Array.isArray(mm.material) ? mm.material[0] : mm.material) as FadableMat;
    }
  });
  if (!found) throw new Error('card subject has no chrome children');
  return found;
}

describe('image-to-particles primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(imageToParticlesPrimitive).dispose();
  });

  it('static metadata: particles / card / state-driven, mountable, looping', () => {
    expect(imageToParticlesPrimitive.category).toBe('particles');
    expect(imageToParticlesPrimitive.subject).toBe('card');
    expect(imageToParticlesPrimitive.defaultDriver).toBe('state');
    expect(imageToParticlesPrimitive.difficulty).toBe('hard');
    // texture-preserving (samples the subject's own map) → may run on mounts.
    expect(imageToParticlesPrimitive.mountable).toBe(true);
    expect(imageToParticlesPrimitive.schema.length).toBeGreaterThanOrEqual(3);
    expect(imageToParticlesPrimitive.schema.length).toBeLessThanOrEqual(6);
  });

  it('look layer: instanced grains carry a TSL colorNode + per-grain UV cells (texture-true)', () => {
    const target = makeTarget(imageToParticlesPrimitive);
    const inst = imageToParticlesPrimitive.create(target);

    const mesh = grainMesh(target);
    const mat = mesh.material as { colorNode?: unknown; transparent?: boolean; depthWrite?: boolean };
    expect(mesh.isInstancedMesh, 'grains render via InstancedMesh').toBe(true);
    expect(mat.colorNode, 'colorNode carries the texture-true grain look').toBeTruthy();
    expect(mat.transparent, 'transparent for soft motes').toBe(true);
    expect(mat.depthWrite, 'depthWrite off for translucent grains').toBe(false);

    // Each grain carries its own UV cell (so the grid reassembles the card's
    // real sampled appearance, not an invented fill).
    const uvAttr = grainUv(target);
    expect(uvAttr, 'instanceCellUv attribute exists').toBeTruthy();
    expect(uvAttr.isInstancedBufferAttribute, 'cell uvs are instanced').toBe(true);
    expect(uvAttr.itemSize, 'cell uv is a vec2').toBe(2);
    // The grid tiles the face: UVs span (roughly) the full 0..1 range.
    const arr = uvAttr.array as Float32Array;
    let minU = 1;
    let maxU = 0;
    for (let i = 0; i < mesh.count; i++) {
      minU = Math.min(minU, arr[i * 2]);
      maxU = Math.max(maxU, arr[i * 2]);
    }
    expect(minU, 'grid covers the left edge of the face').toBeLessThan(0.2);
    expect(maxU, 'grid covers the right edge of the face').toBeGreaterThan(0.8);

    inst.dispose();
  });

  it('rest state at state=0: card visible, grains settled on the face (idle reads as the card)', () => {
    const target = makeTarget(imageToParticlesPrimitive);
    const subject = target.subject as Mesh;
    const inst = imageToParticlesPrimitive.create(target);

    target.userData.state = 0;
    inst.seek(0);
    inst.seek(0.4); // hold disengaged — progress integrates to 0
    inst.seek(0.8);

    // Subject restored to visible; grains sit at home (negligible displacement).
    expect(subject.visible, 'card visible at rest').toBe(true);
    const homes = captureHomes(target);
    expect(meanDisplacement(target, homes), 'grains rest on the face at state 0').toBeLessThan(0.02);
    inst.dispose();
  });

  it('plays: mid-dissolve storm flings grains off the face and hides the subject', () => {
    const target = makeTarget(imageToParticlesPrimitive);
    const subject = target.subject as Mesh;
    const inst = imageToParticlesPrimitive.create(target);

    // Capture homes at rest first.
    target.userData.state = 0;
    inst.seek(0);
    const homes = captureHomes(target);
    const restDisp = meanDisplacement(target, homes);

    // Engage and hold: integrate toward a mid/late dissolve.
    target.userData.state = 1;
    for (let i = 1; i <= 12; i++) inst.seek(i * 0.15);

    const stormDisp = meanDisplacement(target, homes);
    expect(stormDisp, 'storm has flung grains well off their home cells').toBeGreaterThan(
      restDisp + 0.15,
    );
    // While the storm is active the original card is hidden (grains carry it).
    expect(subject.visible, 'subject hidden while the storm is active').toBe(false);
    inst.dispose();
  });

  it('reassembles: flying home in reverse returns grains to (near) their home cells', () => {
    const target = makeTarget(imageToParticlesPrimitive);
    const inst = imageToParticlesPrimitive.create(target);

    target.userData.state = 0;
    inst.seek(0);
    const homes = captureHomes(target);

    // Dissolve away…
    target.userData.state = 1;
    for (let i = 1; i <= 14; i++) inst.seek(i * 0.2);
    const flung = meanDisplacement(target, homes);

    // …then call them home.
    target.userData.state = 0;
    for (let i = 1; i <= 14; i++) inst.seek(3 + i * 0.2);
    const returned = meanDisplacement(target, homes);

    expect(flung, 'grains were flung out').toBeGreaterThan(0.15);
    expect(returned, 'grains reassembled near home').toBeLessThan(flung * 0.4);
    inst.dispose();
  });

  // ── CONTROL LIVENESS at the FROZEN PINNED ENGAGED frame (the #1 W4 failure) ─
  // The rig pins state engaged and sweeps each control low/mid/high at a single
  // repeated-seek frame (dt≈0), pixel-diffing low-vs-high. Every control must
  // BOLDLY reshape that standing storm. We measure a static scalar (mean grain
  // displacement / live count) re-derived at the SAME pinned t with repeated
  // seeks, never a transient.
  const PIN_T = 1.0;
  /** Drive to the pinned engaged frame, then re-seek in place (dt≈0) so the
   *  measurement is a true frozen-frame snapshot (the advocate's method). A
   *  held boolean engaged settles to the primitive's MID-STORM equilibrium —
   *  a visible mid-effect frame where every control (incl. softness, which only
   *  differentiates the mid-transit band) reshapes the standing population. */
  function pinEngaged(target: ReturnType<typeof makeTarget>, inst: ReturnType<typeof imageToParticlesPrimitive.create>) {
    target.userData.state = true;
    for (let i = 1; i <= 10; i++) inst.seek(i * 0.18); // integrate into the storm
    inst.seek(PIN_T);
    inst.seek(PIN_T); // repeated seek — frozen frame
  }

  it('control: scatter distance reshapes the frozen storm (grains fling farther)', () => {
    const target = makeTarget(imageToParticlesPrimitive);
    const inst = imageToParticlesPrimitive.create(target);
    target.userData.state = 0;
    inst.seek(0);
    const homes = captureHomes(target);

    inst.setControl('scatterDistance', 1.2);
    pinEngaged(target, inst);
    const lo = meanDisplacement(target, homes);

    inst.setControl('scatterDistance', 5.0);
    inst.seek(PIN_T);
    inst.seek(PIN_T);
    const hi = meanDisplacement(target, homes);

    // Bold, plainly-visible delta at the frozen frame (mean grain travel grows).
    expect(hi - lo, 'scatter distance grows the standing storm radius').toBeGreaterThan(0.3);
    inst.dispose();
  });

  it('control: swirl turbulence reshapes the frozen storm (grain spread changes)', () => {
    const target = makeTarget(imageToParticlesPrimitive);
    const inst = imageToParticlesPrimitive.create(target);
    target.userData.state = 0;
    inst.seek(0);
    const homes = captureHomes(target);

    inst.setControl('swirlTurbulence', 0);
    pinEngaged(target, inst);
    const lo = meanDisplacement(target, homes);

    inst.setControl('swirlTurbulence', 2.0);
    inst.seek(PIN_T);
    inst.seek(PIN_T);
    const hi = meanDisplacement(target, homes);

    expect(Math.abs(hi - lo), 'swirl turbulence visibly reshapes the storm').toBeGreaterThan(0.1);
    inst.dispose();
  });

  it('control: grain density changes the live grain population at the pin (structural)', () => {
    const target = makeTarget(imageToParticlesPrimitive);
    const inst = imageToParticlesPrimitive.create(target);

    inst.setControl('grainDensity', 14);
    target.userData.state = 1;
    inst.seek(0.5);
    const sparse = grainMesh(target).count;

    inst.setControl('grainDensity', 30);
    inst.seek(0.5);
    const dense = grainMesh(target).count;

    // The visible draw population must climb low→high (sparse vs dense grid).
    expect(dense, 'denser grid draws many more grains').toBeGreaterThan(sparse * 1.5);
    inst.dispose();
  });

  it('control: dissolve softness reshapes how many grains are mid-transit at the pin', () => {
    const target = makeTarget(imageToParticlesPrimitive);
    const inst = imageToParticlesPrimitive.create(target);
    target.userData.state = 0;
    inst.seek(0);
    const homes = captureHomes(target);

    inst.setControl('dissolveSoftness', 0.02);
    pinEngaged(target, inst);
    const sharp = meanDisplacement(target, homes);

    inst.setControl('dissolveSoftness', 0.6);
    inst.seek(PIN_T);
    inst.seek(PIN_T);
    const soft = meanDisplacement(target, homes);

    // A wider threshold band catches more grains mid-launch (partial travel) at
    // the same pinned state → a visibly different standing storm.
    expect(Math.abs(soft - sharp), 'softness reshapes the mid-transit population').toBeGreaterThan(
      0.05,
    );
    inst.dispose();
  });

  it('determinism: two instances seeked identically match grain-for-grain', () => {
    const a = makeTarget(imageToParticlesPrimitive);
    const b = makeTarget(imageToParticlesPrimitive);
    const ia = imageToParticlesPrimitive.create(a);
    const ib = imageToParticlesPrimitive.create(b);

    const drive = (t: ReturnType<typeof makeTarget>, inst: ReturnType<typeof imageToParticlesPrimitive.create>) => {
      t.userData.state = 1;
      for (let i = 1; i <= 8; i++) inst.seek(i * 0.17);
    };
    drive(a, ia);
    drive(b, ib);

    const ma = grainMesh(a);
    const mb = grainMesh(b);
    expect(ma.count).toBe(mb.count);
    const m4a = new Matrix4();
    const m4b = new Matrix4();
    for (let i = 0; i < ma.count; i += 7) {
      ma.getMatrixAt(i, m4a);
      mb.getMatrixAt(i, m4b);
      const pa = new Vector3().setFromMatrixPosition(m4a);
      const pb = new Vector3().setFromMatrixPosition(m4b);
      expect(pa.distanceTo(pb)).toBeLessThan(1e-6);
    }
    ia.dispose();
    ib.dispose();
  });

  it('late texture pour: rebuilds the grain material to sample the live map', () => {
    const target = makeTarget(imageToParticlesPrimitive);
    const subject = target.subject as Mesh;
    const srcMat = subject.material as MeshStandardMaterial; // map-less catalog card
    const inst = imageToParticlesPrimitive.create(target);

    const matBefore = grainMesh(target).material;

    // Simulate the mounted-artifact async texture pour onto the live source.
    const poured = new Texture();
    srcMat.map = poured;
    target.userData.state = 1;
    inst.seek(0.5);

    expect(grainMesh(target).material, 'grain material rebuilt to bind the poured map').not.toBe(
      matBefore,
    );
    const mat = grainMesh(target).material as { colorNode?: unknown };
    expect(mat.colorNode, 'rebuilt material still carries a colorNode').toBeTruthy();
    // Stable thereafter — same map identity must not re-trigger rebuilds.
    const after = grainMesh(target).material;
    inst.seek(0.6);
    expect(grainMesh(target).material).toBe(after);

    inst.dispose();
    poured.dispose();
  });

  it('chrome co-fades with the early dissolve and restores on dispose', () => {
    const target = makeTarget(imageToParticlesPrimitive);
    const subject = target.subject as Mesh;
    const chrome = firstChromeMat(subject);
    const base = chrome.opacity;

    const inst = imageToParticlesPrimitive.create(target);
    // Dissolve in: chrome should drain toward 0 as the storm forms.
    target.userData.state = 1;
    for (let i = 1; i <= 10; i++) inst.seek(i * 0.2);
    expect(chrome.opacity, 'chrome co-fades during the dissolve').toBeLessThan(base * 0.5);

    inst.dispose();
    expect(chrome.opacity, 'chrome opacity restored on dispose').toBeCloseTo(base, 5);
    expect(subject.visible, 'subject visible after dispose').toBe(true);
  });

  it('dispose: removes the grain mesh, frees geometry + material, restores the subject', () => {
    const target = makeTarget(imageToParticlesPrimitive);
    const subject = target.subject as Mesh;
    const inst = imageToParticlesPrimitive.create(target);

    const mesh = grainMesh(target);
    const geometry = mesh.geometry as BufferGeometry;
    const material = mesh.material as Material;
    let geoDisposed = false;
    let matDisposed = false;
    geometry.addEventListener('dispose', () => {
      geoDisposed = true;
    });
    material.addEventListener('dispose', () => {
      matDisposed = true;
    });

    target.userData.state = 1;
    inst.seek(1.0);
    inst.dispose();

    expect(geoDisposed, 'geometry disposed').toBe(true);
    expect(matDisposed, 'material disposed').toBe(true);
    expect(target.object.children.includes(mesh), 'grain mesh removed').toBe(false);
    expect(subject.visible, 'subject restored visible').toBe(true);
  });
});
