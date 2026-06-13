import { describe, it, expect } from 'vitest';
import {
  DataTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  Vector3,
  type Material,
  type Object3D,
} from 'three';
import { crtWarpPrimitive } from '@/lib/prism/animatable/primitives/crt-warp';
import type { AnimatableTarget } from '@/lib/prism/animatable/contract';
import { makeTarget, runConformance } from './_conformance';

/** Uniform handles the primitive publishes for headless observability (TSL
 *  barrel/scanline work happens on the GPU, so tests observe the driven
 *  uniforms, the scene graph, and material identity — the cylinder-unroll
 *  water-droplet pattern). */
interface CrtHandles {
  uTime: { value: number };
  uCurvature: { value: number };
  uLineCount: { value: number };
  uScanStrength: { value: number };
  uRollSpeed: { value: number };
  uRoll: { value: number };
  uColor: { value: { getHexString(): string } };
}
const handlesOf = (t: AnimatableTarget): CrtHandles => t.userData.crtWarp as CrtHandles;

/** The barrel overlay sheet anywhere under the root (sibling of the hidden
 *  subject — a hidden parent hides its children, so it can't live under it). */
function sheetOf(root: Object3D): Mesh {
  let found: Mesh | null = null;
  root.traverse((o) => {
    if (o.name === 'crt-warp-sheet') found = o as Mesh;
  });
  if (!found) throw new Error('crt sheet not found');
  return found;
}

function overlayNodesIn(root: Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (o.name.startsWith('crt-warp')) n++;
  });
  return n;
}

/** A mounted-artifact-like target: a single textured Mesh subject — mirrors how
 *  bindings resolve the mounted subject in the real app (not the catalog rig). */
function makeTexturedTarget(width: number, height: number) {
  const scene = new Scene();
  const object = new Group();
  scene.add(object);
  const texture = new DataTexture(new Uint8Array([200, 160, 90, 255]), 1, 1, RGBAFormat);
  texture.needsUpdate = true;
  const subject = new Mesh(new PlaneGeometry(width, height), new MeshBasicMaterial({ map: texture }));
  subject.name = 'artifact-mesh';
  object.add(subject);
  const target: AnimatableTarget = {
    object,
    subject,
    scene,
    userData: { pointer: { x: 0.5, y: 0.5 }, scroll: 0.5 },
  };
  return { target, subject, texture };
}

describe('crt-warp primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(crtWarpPrimitive).dispose();
  });

  it('is a mountable, texture-preserving displacement primitive', () => {
    // The whole point of W3: category sits in UNMOUNTABLE_CATEGORIES, but this
    // one preserves the subject's look and opts back in with mountable:true.
    expect(crtWarpPrimitive.category).toBe('displacement');
    expect(crtWarpPrimitive.mountable).toBe(true);
    expect(crtWarpPrimitive.subject).toBe('card');
    expect(crtWarpPrimitive.defaultDriver).toBe('time');
  });

  it('builds a barrel overlay sized from the MEASURED subject bbox and hides the real subject', () => {
    // Catalog CARD subject: 1.74 x 1.12 panel + chrome children. The panel is
    // the representative mesh — the sheet carries ITS footprint.
    const target = makeTarget(crtWarpPrimitive);
    const inst = crtWarpPrimitive.create(target);

    const sheet = sheetOf(target.scene);
    sheet.geometry.computeBoundingBox();
    const bb = sheet.geometry.boundingBox!;
    expect(bb.max.x - bb.min.x).toBeCloseTo(1.74, 2);
    expect(bb.max.y - bb.min.y).toBeCloseTo(1.12, 2);
    expect((target.subject as Mesh).visible).toBe(false);

    inst.dispose();
  });

  it('plays: the roll band traverses 0 -> 1 each loop and wraps, while the idle frame is undistorted', () => {
    const target = makeTarget(crtWarpPrimitive);
    const inst = crtWarpPrimitive.create(target);
    const ud = handlesOf(target);
    const dur = inst.duration();
    // Looping time tile.
    expect(dur).toBe(Infinity);

    // Idle frame (t=0): roll band parked at the top of its travel, time zero —
    // the surface reads as the clean content (scanlines are low-amplitude and
    // the roll is a faint brightening, so legibility is preserved by design).
    inst.seek(0);
    expect(ud.uRoll.value).toBeCloseTo(0, 5);
    expect(ud.uTime.value).toBeCloseTo(0, 5);

    // The roll band advances across a loop and is monotone within it. At the
    // default rollSpeed=0.5 the loop period is LOOP_BASE/0.5 = 8s.
    const loop = 4 / 0.5;
    inst.seek(0.5);
    const r1 = ud.uRoll.value;
    inst.seek(1.5);
    const r2 = ud.uRoll.value;
    expect(r1).toBeGreaterThan(0.05);
    expect(r2).toBeGreaterThan(r1);
    expect(r2).toBeLessThanOrEqual(1);

    // It wraps: crossing a loop boundary the phase resets (deterministic loop).
    inst.seek(loop + 0.5);
    const rWrap = ud.uRoll.value;
    expect(rWrap).toBeCloseTo(r1, 4);

    inst.dispose();
  });

  it('distortion response: curvature pushes the barrel dome harder at concrete values (CPU mirror)', () => {
    // The barrel field is also evaluated CPU-side to co-pose the chrome; the
    // primitive publishes a probe `domeAt(nx,ny)` so the geometric response is
    // testable headless without a GPU.
    const target = makeTarget(crtWarpPrimitive);
    const inst = crtWarpPrimitive.create(target);
    const probe = target.userData.crtWarpProbe as {
      domeAt(nx: number, ny: number): number;
    };
    inst.seek(0.2);

    // Low curvature.
    inst.setControl('curvature', 0.05);
    inst.seek(0.2);
    const centerLow = probe.domeAt(0, 0);
    const cornerLow = probe.domeAt(1, 1);

    // High curvature: the centre domes MORE toward the camera and the corner
    // pinches MORE (relative dome center-vs-corner grows).
    inst.setControl('curvature', 0.6);
    inst.seek(0.2);
    const centerHigh = probe.domeAt(0, 0);
    const cornerHigh = probe.domeAt(1, 1);

    // Concrete monotonic response at two stimulus values.
    expect(centerHigh).toBeGreaterThan(centerLow + 0.02);
    // The dome relief (center minus corner) grows with curvature — a flatter
    // surface at low curvature, a pronounced barrel at high curvature.
    const reliefLow = centerLow - cornerLow;
    const reliefHigh = centerHigh - cornerHigh;
    expect(reliefHigh).toBeGreaterThan(reliefLow + 0.02);

    inst.dispose();
  });

  it('controls change output at the pinned engaged (looping) state: every knob reshapes the live frame', () => {
    const target = makeTarget(crtWarpPrimitive);
    const inst = crtWarpPrimitive.create(target);
    const ud = handlesOf(target);

    // Establish a live mid-loop time (the rig sweeps controls paused at a frame).
    inst.seek(1);

    // curvature → uCurvature.
    inst.setControl('curvature', 0.1);
    expect(ud.uCurvature.value).toBeCloseTo(0.1, 6);
    inst.setControl('curvature', 0.6);
    expect(ud.uCurvature.value).toBeCloseTo(0.6, 6);

    // scanline density → uLineCount (range re-scoped to 8..48 so each line is
    // individually resolvable at DPR-2 — see SCHEMA comment).
    inst.setControl('scanlines', 8);
    expect(ud.uLineCount.value).toBeCloseTo(8, 6);
    inst.setControl('scanlines', 48);
    expect(ud.uLineCount.value).toBeCloseTo(48, 6);

    // scanline strength → uScanStrength.
    inst.setControl('scanStrength', 0.05);
    expect(ud.uScanStrength.value).toBeCloseTo(0.05, 6);
    inst.setControl('scanStrength', 0.5);
    expect(ud.uScanStrength.value).toBeCloseTo(0.5, 6);

    // roll speed → uRollSpeed, and it changes how far the band has travelled at
    // a FIXED wall-clock t (visible reshape at the pinned frame).
    inst.setControl('rollSpeed', 0.2);
    inst.seek(1);
    const slowRoll = ud.uRoll.value;
    inst.setControl('rollSpeed', 1.5);
    inst.seek(1);
    const fastRoll = ud.uRoll.value;
    expect(slowRoll).not.toBeCloseTo(fastRoll, 3);

    inst.dispose();
  });

  it('scanline grille is SUBSTANTIAL at the engaged frame and the line-COUNT knob reshapes it (CPU mirror of the GPU mask)', () => {
    // The advocate BLOCK: the 'scanlines' knob (line frequency) moved the
    // uniform but produced ZERO visible change — the old 40→220 range packed
    // sub-pixel lines that aliased to a uniform tone at every frequency. The fix
    // re-scopes to a resolvable 8→48 grille and sharpens each line into a crisp
    // ridge. `scanAt(uvY)` is the EXACT CPU mirror of the colorNode's scanline
    // multiplier, so this proves the wiring deterministically without a GPU.
    const target = makeTarget(crtWarpPrimitive);
    const inst = crtWarpPrimitive.create(target);
    const probe = target.userData.crtWarpProbe as { scanAt(uvY: number): number };

    // Pin the ENGAGED frame (the rig sweeps controls paused at t=1).
    inst.seek(1);

    // Sample the grille densely across the surface and characterise it:
    //  - amplitude = max - min of the multiplier (how deep the ridges cut)
    //  - ridgeCount = number of local minima (the dark phosphor lines)
    const SAMPLES = 600;
    const profileOf = (): { amplitude: number; ridges: number } => {
      const vals: number[] = [];
      for (let i = 0; i < SAMPLES; i++) vals.push(probe.scanAt(i / (SAMPLES - 1)));
      let min = Infinity;
      let max = -Infinity;
      let ridges = 0;
      for (let i = 0; i < vals.length; i++) {
        if (vals[i] < min) min = vals[i];
        if (vals[i] > max) max = vals[i];
        if (i > 0 && i < vals.length - 1 && vals[i] < vals[i - 1] && vals[i] <= vals[i + 1]) {
          ridges++;
        }
      }
      return { amplitude: max - min, ridges };
    };

    // (a) The engaged grille is SUBSTANTIAL — the multiplier swings a real,
    // sampled amount between the bright gaps and the dark ridges (not a flat ~1
    // tone). At the default scanStrength=0.16 the ridge cuts ~16% below 1.
    inst.setControl('scanlines', 24); // default density
    inst.seek(1);
    const mid = profileOf();
    expect(mid.amplitude, 'engaged grille modulates the surface substantially').toBeGreaterThan(0.1);

    // (b) The COUNT knob is LIVE: min vs max changes the number of phosphor
    // ridges across the surface by a large, monotone amount — the dead-control
    // root cause is fixed. At 8 lines ≈ 8 ridges; at 48 lines ≈ 48 ridges.
    inst.setControl('scanlines', 8);
    inst.seek(1);
    const low = profileOf();
    inst.setControl('scanlines', 48);
    inst.seek(1);
    const high = profileOf();

    expect(low.ridges, 'min density yields the expected ~8 ridges').toBeGreaterThanOrEqual(7);
    expect(low.ridges, 'min density is genuinely sparse').toBeLessThanOrEqual(10);
    expect(high.ridges, 'max density yields the expected ~48 ridges').toBeGreaterThanOrEqual(44);
    // The grille gets MUCH denser low→high (the visible "more lines" the user
    // dragging the knob expects). A large, unambiguous count delta.
    expect(high.ridges - low.ridges, 'line count grows substantially low→high').toBeGreaterThan(30);
    // Both extremes still cut a substantial ridge (the sharpened grille reads at
    // either density — high frequency does NOT wash out to a flat tone).
    expect(high.amplitude, 'dense grille still has resolvable ridges').toBeGreaterThan(0.1);

    inst.dispose();
  });

  it('the scanline grille EMITS light (additive emissive wire) and the line-COUNT knob reshapes that emitted grille at the engaged pose', () => {
    // THE ADVOCATE BLOCK, root-caused: the scanline grille was only ever a
    // MULTIPLY that DIMMED the colorNode. On the near-black card panel
    // (#1d212b, luma ~16) a 16% dimming is a sub-noise pixel change, so the
    // grille was invisible and the line-COUNT knob moved nothing measurable in
    // the render (control-scanlines low/mid/high were pixel-identical,
    // meanAbsDiff=0.138). THE WIRE FIX: the phosphor lines now EMIT warm light
    // via emissiveNode — bright ridges read on a dark tube regardless of base
    // luminance, so a denser grille = visibly more glowing lines.
    const { target } = makeTexturedTarget(2, 1);
    const inst = crtWarpPrimitive.create(target);
    const sheet = sheetOf(target.scene);

    // (1) The WIRE exists: the sheet material carries an additive emissive node
    // (the glowing grille rides on emissiveNode, not only the colorNode dim),
    // and emissiveIntensity is driven so the node sets the glow amplitude.
    const matNode = sheet.material as Material & {
      emissiveNode?: unknown;
      emissiveIntensity?: number;
    };
    expect(matNode.emissiveNode, 'sheet material emits the phosphor glow').toBeDefined();
    expect(matNode.emissiveNode, 'emissive glow is a real node').not.toBeNull();
    expect(matNode.emissiveIntensity, 'emissive intensity drives the glow').toBe(1);

    // (2) The EMITTED grille (the term that actually reads on the dark tube) is
    // SUBSTANTIAL at the engaged pose, and the line-COUNT knob reshapes it.
    const probe = target.userData.crtWarpProbe as {
      scanGlowAt(uvY: number): number;
    };
    inst.seek(1);

    const SAMPLES = 600;
    // Characterise the emitted-light profile: peak glow (do the lines actually
    // light up?), number of glowing ridges (the line count), and the contrast
    // proxy (peak-to-mean — a banding/contrast surrogate the pixel-diff sees).
    const glowProfileOf = (): { peak: number; mean: number; ridges: number } => {
      const vals: number[] = [];
      for (let i = 0; i < SAMPLES; i++) vals.push(probe.scanGlowAt(i / (SAMPLES - 1)));
      let peak = -Infinity;
      let sum = 0;
      let ridges = 0;
      for (let i = 0; i < vals.length; i++) {
        if (vals[i] > peak) peak = vals[i];
        sum += vals[i];
        // Count local MAXIMA — each glowing phosphor line is a bright peak.
        if (i > 0 && i < vals.length - 1 && vals[i] > vals[i - 1] && vals[i] >= vals[i + 1]) {
          ridges++;
        }
      }
      return { peak, mean: sum / vals.length, ridges };
    };

    // (a) The engaged grille EMITS real light (not a sub-noise term): at the
    // default scanStrength=0.16 the brightest line lifts emitted light well
    // above zero — this is the warmth a user sees glowing on the dark tube.
    inst.setControl('scanlines', 24);
    inst.seek(1);
    const mid = glowProfileOf();
    expect(mid.peak, 'phosphor lines emit substantial warm light at the engaged pose').toBeGreaterThan(0.1);

    // (b) The COUNT knob is LIVE in the EMITTED grille: min vs max changes the
    // number of glowing ridges by a large, monotone amount — the dead-control
    // root cause is fixed in the term that actually renders. ~8 lines at min,
    // ~48 at max.
    inst.setControl('scanlines', 8);
    inst.seek(1);
    const low = glowProfileOf();
    inst.setControl('scanlines', 48);
    inst.seek(1);
    const high = glowProfileOf();

    expect(low.ridges, 'min density yields ~8 glowing lines').toBeGreaterThanOrEqual(7);
    expect(low.ridges, 'min density is genuinely sparse').toBeLessThanOrEqual(10);
    expect(high.ridges, 'max density yields ~48 glowing lines').toBeGreaterThanOrEqual(44);
    expect(high.ridges - low.ridges, 'glowing line count grows substantially low→high').toBeGreaterThan(30);
    // The peak glow per line survives at BOTH densities (the sharpened ridge
    // does not wash out to a flat tone at high frequency) — so the denser grille
    // is denser AND still visible, not aliased away (the original failure mode).
    expect(low.peak, 'sparse grille glows').toBeGreaterThan(0.1);
    expect(high.peak, 'dense grille still glows distinctly').toBeGreaterThan(0.1);

    // (c) A contrast/banding proxy the advocate pixel-diff sees: peak-above-mean
    // emitted light. It must be a real, sampled swing at every density — the
    // frozen-frame compare cannot read DEAD if this is nonzero and the ridge
    // count differs. Both extremes carry substantial peak-over-mean contrast.
    const contrast = (p: { peak: number; mean: number }) => p.peak - p.mean;
    expect(contrast(low), 'sparse grille has emitted-light contrast').toBeGreaterThan(0.05);
    expect(contrast(high), 'dense grille has emitted-light contrast').toBeGreaterThan(0.05);

    // (d) scanStrength scales the EMITTED glow (the depth knob is live in the
    // glow path too): more strength = brighter lines at a fixed density.
    inst.setControl('scanlines', 24);
    inst.setControl('scanStrength', 0.05);
    inst.seek(1);
    const dim = glowProfileOf();
    inst.setControl('scanStrength', 0.5);
    inst.seek(1);
    const bright = glowProfileOf();
    expect(bright.peak, 'higher scanStrength emits a brighter grille').toBeGreaterThan(dim.peak + 0.1);

    inst.dispose();
  });

  it('texture preservation: the sheet colorNode samples the subject OWN texture by reference (never an invented fill)', () => {
    const { target, subject, texture } = makeTexturedTarget(2, 1);
    const inst = crtWarpPrimitive.create(target);
    const sheet = sheetOf(target.scene);

    const colorNode = (sheet.material as Material & { colorNode?: unknown }).colorNode;
    // The texture is reachable somewhere inside the composite colorNode tree —
    // walk it for a node whose .value is our shared texture.
    expect(treeReferencesTexture(colorNode, texture), 'colorNode samples the shared texture').toBe(
      true,
    );
    expect(sheet.material, 'sheet material is its own instance').not.toBe(subject.material);

    // The subject's own material was never mutated.
    expect((subject.material as MeshBasicMaterial).map).toBe(texture);
    expect((subject.material as MeshBasicMaterial).opacity).toBe(1);

    // Sheet geometry derives from the measured bbox (2 x 1, not the catalog 1.74).
    sheet.geometry.computeBoundingBox();
    const bb = sheet.geometry.boundingBox!;
    expect(bb.max.x - bb.min.x).toBeCloseTo(2, 2);
    expect(bb.max.y - bb.min.y).toBeCloseTo(1, 2);

    inst.dispose();
  });

  it('texture preservation: a map-less subject copies color AND PBR scalars (shades identically, no flat fill)', () => {
    const scene = new Scene();
    const object = new Group();
    scene.add(object);
    const subject = new Mesh(
      new PlaneGeometry(2, 1),
      new MeshStandardMaterial({
        color: '#88aa66',
        roughness: 0.21,
        metalness: 0.66,
        emissiveIntensity: 0.4,
      }),
    );
    (subject.material as MeshStandardMaterial).emissive.set('#221100');
    (subject.material as MeshStandardMaterial).envMapIntensity = 1.7;
    object.add(subject);
    const target: AnimatableTarget = {
      object,
      subject,
      scene,
      userData: { pointer: { x: 0.5, y: 0.5 }, scroll: 0.5 },
    };

    const inst = crtWarpPrimitive.create(target);
    const ud = handlesOf(target);
    const sheet = sheetOf(scene);
    const mat = sheet.material as MeshStandardMaterial;

    // Color tracked into the published fallback uniform.
    expect(ud.uColor.value.getHexString()).toBe('88aa66');
    // PBR scalars copied so it shades identically under the rig lights.
    expect(mat.roughness).toBeCloseTo(0.21, 5);
    expect(mat.metalness).toBeCloseTo(0.66, 5);
    expect(mat.envMapIntensity).toBeCloseTo(1.7, 5);
    expect(mat.emissive.getHexString()).toBe('221100');

    // Live tint tracking: recolor the source, seek, fallback follows.
    (subject.material as MeshStandardMaterial).color.set('#cd9f55');
    inst.seek(0.2);
    expect(ud.uColor.value.getHexString()).toBe('cd9f55');

    inst.dispose();
  });

  it('chrome co-treatment: the card header/rows/dot are cloned onto the barrel and ride the dome — subject chrome never mutated', () => {
    const target = makeTarget(crtWarpPrimitive);
    const inst = crtWarpPrimitive.create(target);

    const clones: Mesh[] = [];
    target.scene.traverse((o) => {
      if (o.name.startsWith('crt-warp-chrome:')) clones.push(o as Mesh);
    });
    // Header + accent dot + 3 content rows = 5 chrome children.
    expect(clones.length, 'every chrome child is cloned onto the barrel').toBe(5);

    // Clones share each child's geometry BY REFERENCE but own a material clone.
    const subjectPanel = target.subject as Mesh;
    const srcChildren: Mesh[] = [];
    subjectPanel.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh && m !== subjectPanel) srcChildren.push(m);
    });
    for (const clone of clones) {
      const match = srcChildren.find((s) => s.geometry === clone.geometry);
      expect(match, 'clone geometry shared by reference from a real child').toBeDefined();
      expect(clone.material).not.toBe(match!.material);
    }

    // The clones RIDE the dome: a clone whose center is near the panel center
    // domes toward the camera (z grows with curvature). Compare low vs high.
    const centerClone = clones.reduce((best, c) =>
      Math.hypot(c.position.x, c.position.y) < Math.hypot(best.position.x, best.position.y)
        ? c
        : best,
    );
    inst.setControl('curvature', 0.05);
    inst.seek(0.3);
    const zLow = centerClone.position.z;
    inst.setControl('curvature', 0.6);
    inst.seek(0.3);
    const zHigh = centerClone.position.z;
    expect(zHigh, 'center chrome domes further toward the camera at high curvature').toBeGreaterThan(
      zLow + 0.02,
    );

    // Subject chrome materials are NEVER mutated.
    subjectPanel.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh || m === subjectPanel) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        expect(
          (mat as Material & { positionNode?: unknown }).positionNode,
          'subject chrome material untouched',
        ).toBeUndefined();
        expect((mat as Material & { opacity: number }).opacity).toBe(1);
      }
    });

    inst.dispose();
  });

  it('regression: a texture poured AFTER create reaches the sheet (async map pour -> rebuild)', () => {
    const scene = new Scene();
    const object = new Group();
    scene.add(object);
    const subject = new Mesh(new PlaneGeometry(2, 1), new MeshBasicMaterial({ transparent: true }));
    object.add(subject);
    const target: AnimatableTarget = {
      object,
      subject,
      scene,
      userData: { pointer: { x: 0.5, y: 0.5 }, scroll: 0.5 },
    };

    const inst = crtWarpPrimitive.create(target);
    const sheet = sheetOf(scene);
    const matBefore = sheet.material as Material;

    // The pour lands on the subject's material (what default-factory does).
    const texture = new DataTexture(new Uint8Array([200, 160, 90, 255]), 1, 1, RGBAFormat);
    texture.needsUpdate = true;
    (subject.material as MeshBasicMaterial).map = texture;
    (subject.material as MeshBasicMaterial).needsUpdate = true;

    inst.seek(0.4);
    expect(sheet.material, 'material rebuilt for the poured texture').not.toBe(matBefore);
    expect(
      treeReferencesTexture((sheet.material as Material & { colorNode?: unknown }).colorNode, texture),
      'rebuilt colorNode samples the poured texture',
    ).toBe(true);

    // Stability: with no further source change, seeks do NOT rebuild.
    const stable = sheet.material;
    inst.seek(0.6);
    expect(sheet.material).toBe(stable);

    inst.dispose();
  });

  it('regression: the overlay tracks the subject LIVE local pose each seek', () => {
    const { target, subject } = makeTexturedTarget(2, 1);
    const inst = crtWarpPrimitive.create(target);
    let overlay: Object3D | null = null;
    target.scene.traverse((o) => {
      if (o.name === 'crt-warp-overlay') overlay = o;
    });
    expect(overlay).not.toBeNull();
    const grp = overlay as unknown as Group;

    subject.position.set(0.4, -0.2, 0.64);
    subject.quaternion.setFromAxisAngle(new Vector3(1, 0, 0), -0.122);
    subject.scale.set(1.1, 1.1, 1);
    inst.seek(0.3);

    expect(grp.position.x).toBeCloseTo(0.4, 6);
    expect(grp.position.y).toBeCloseTo(-0.2, 6);
    expect(grp.position.z).toBeCloseTo(0.64, 6);
    expect(grp.quaternion.x).toBeCloseTo(subject.quaternion.x, 6);
    expect(grp.scale.x).toBeCloseTo(1.1, 6);

    inst.dispose();
  });

  it('dispose restores the subject and releases everything created (never subject resources)', () => {
    const { target, subject, texture } = makeTexturedTarget(2, 1);
    expect(subject.visible).toBe(true);

    const inst = crtWarpPrimitive.create(target);
    const sheet = sheetOf(target.scene);
    expect(subject.visible, 'subject hidden while the sheet stands in').toBe(false);

    let createdDisposed = 0;
    sheet.geometry.addEventListener('dispose', () => createdDisposed++);
    (sheet.material as Material).addEventListener('dispose', () => createdDisposed++);
    let subjectDisposed = 0;
    (subject.material as Material).addEventListener('dispose', () => subjectDisposed++);
    texture.addEventListener('dispose', () => subjectDisposed++);

    inst.seek(0.7);
    inst.dispose();

    expect(subject.visible, 'subject restored after dispose').toBe(true);
    expect(createdDisposed, 'sheet geometry + material both disposed').toBe(2);
    expect(subjectDisposed, 'subject material/texture never disposed').toBe(0);
    expect(overlayNodesIn(target.scene), 'nothing of ours left in the tree').toBe(0);
  });

  it('fallback: with no usable geometry/material it gently breathes the WHOLE subject — nothing spawned, restored on dispose', () => {
    const scene = new Scene();
    const object = new Group();
    scene.add(object);
    const subject = new Group(); // no meshes, no materials — nothing to overlay
    subject.name = 'empty-artifact';
    object.add(subject);
    const target: AnimatableTarget = {
      object,
      subject,
      scene,
      userData: { pointer: { x: 0.5, y: 0.5 }, scroll: 0.5 },
    };

    const inst = crtWarpPrimitive.create(target);
    expect(overlayNodesIn(scene), 'no overlay spawned for an empty subject').toBe(0);
    expect(subject.visible, 'fallback never hides the subject it animates').toBe(true);

    // The whole subject does SOMETHING across the loop (a faint CRT breathe),
    // and lands at its base scale on dispose. Sample at a phase peak so the
    // breathe is unambiguously off its rest value.
    inst.seek(0);
    const s0 = subject.scale.x;
    inst.seek(1); // sin(2π·1/4) = sin(π/2) = 1 → peak breathe
    const s1 = subject.scale.x;
    expect(Math.abs(s1 - s0)).toBeGreaterThan(1e-4);

    inst.dispose();
    expect(subject.scale.x, 'scale restored after dispose').toBeCloseTo(1, 6);
  });
});

/** Walk a TSL node tree shallowly looking for a node whose `.value` is the
 *  given texture (textures are shared by reference through the composite tree).
 *  Bounded depth so a cyclic graph can't hang the test. */
function treeReferencesTexture(node: unknown, texture: unknown, depth = 0): boolean {
  if (!node || typeof node !== 'object' || depth > 6) return false;
  const n = node as Record<string, unknown>;
  if (n.value === texture) return true;
  for (const k of Object.keys(n)) {
    const v = n[k];
    if (v && typeof v === 'object') {
      if (Array.isArray(v)) {
        for (const item of v) if (treeReferencesTexture(item, texture, depth + 1)) return true;
      } else if (treeReferencesTexture(v, texture, depth + 1)) {
        return true;
      }
    }
  }
  return false;
}
