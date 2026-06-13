import { describe, it, expect } from 'vitest';
import {
  DataTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  Vector3,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { pointerGlitchSplitPrimitive } from '@/lib/prism/animatable/primitives/pointer-glitch-split';
import type { AnimatableTarget } from '@/lib/prism/animatable/contract';
import { makeTarget, runConformance } from './_conformance';

/** Uniform handles the primitive publishes for headless observability (the
 *  water-droplet pattern — the band shear / chroma split run in TSL on the
 *  GPU, so tests read the driven uniforms, the scene graph, and material
 *  identity). uShear is a per-band Float32Array (one signed x-offset per band);
 *  uChroma is the chromatic split distance, uProx the engaged-zone strength. */
interface GlitchHandles {
  uShear: { value: Float32Array };
  uChroma: { value: number };
  uProx: { value: number };
  uPointer: { value: { x: number; y: number } };
  uBands: { value: number };
  bandCount: number;
  lumKeys: number[];
  lutTex: Texture;
  /** CPU mirror of the rendered per-channel split (water-droplet pattern): the
   *  final R/G/B the shader emits for the map-less branch at a given uv (base ×
   *  warm/ice tint × the horizontally chroma-offset sliver field). Proves real
   *  chromatic aberration headlessly — no GPU. */
  channelSplitAt(u: number, v: number): { r: number; g: number; b: number };
}
const handlesOf = (t: AnimatableTarget): GlitchHandles =>
  t.userData.pointerGlitchSplit as GlitchHandles;

/** Walk a TSL node graph from `root` and return true if `target` is reachable.
 *  Proves a control's uniform actually FEEDS the rendered colour (the dead-
 *  control fix is exactly "the knob moves a uniform that the colorNode reads"),
 *  without a GPU — the band split runs in TSL so we can't render headlessly. */
function nodeReaches(root: unknown, target: unknown): boolean {
  const seen = new Set<unknown>();
  const visit = (nd: unknown, depth: number): boolean => {
    if (!nd || typeof nd !== 'object' || seen.has(nd) || depth > 24) return false;
    seen.add(nd);
    // The target may be the node itself (a uniform node) OR a resource a leaf
    // node wraps in `.value` (a TextureNode holds its DataTexture there).
    if (nd === target) return true;
    if ((nd as { value?: unknown }).value === target) return true;
    const getChildren = (nd as { getChildren?: () => Iterable<unknown> }).getChildren;
    if (typeof getChildren === 'function') {
      for (const child of getChildren.call(nd)) if (visit(child, depth + 1)) return true;
    }
    return false;
  };
  return visit(root, 0);
}

/** Variance of a numeric array — the band-luminance field's structure. */
const variance = (a: number[]): number => {
  if (a.length === 0) return 0;
  const mean = a.reduce((s, v) => s + v, 0) / a.length;
  return a.reduce((s, v) => s + (v - mean) * (v - mean), 0) / a.length;
};

/** The overlay sheet mesh anywhere under the root (sibling of the hidden
 *  subject — a hidden parent hides its children, so it can't live under it). */
function sheetOf(root: Object3D): Mesh {
  let found: Mesh | null = null;
  root.traverse((o) => {
    if (o.name === 'pointer-glitch-split-sheet') found = o as Mesh;
  });
  if (!found) throw new Error('glitch-split sheet not found');
  return found;
}

function overlayNodesIn(root: Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (o.name.startsWith('pointer-glitch-split')) n++;
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
  const subject = new Mesh(
    new PlaneGeometry(width, height),
    new MeshBasicMaterial({ map: texture }),
  );
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

/** Max |shear| across all bands — the on-screen distortion magnitude. */
const maxShear = (h: GlitchHandles): number => {
  let m = 0;
  const a = h.uShear.value;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]));
  return m;
};

describe('pointer-glitch-split primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(pointerGlitchSplitPrimitive).dispose();
  });

  it('is a mountable, texture-preserving displacement primitive', () => {
    // The whole point of W3: this displacement carries the subject's own look,
    // so it overrides the category skip and runs on mounted artifacts.
    expect(pointerGlitchSplitPrimitive.category).toBe('displacement');
    expect(pointerGlitchSplitPrimitive.mountable).toBe(true);
    expect(pointerGlitchSplitPrimitive.subject).toBe('card');
    expect(pointerGlitchSplitPrimitive.defaultDriver).toBe('pointer');
    // Stateful pointer effect → Infinity duration (checked on the live instance).
    const target = makeTarget(pointerGlitchSplitPrimitive);
    const inst = pointerGlitchSplitPrimitive.create(target);
    expect(inst.duration()).toBe(Infinity);
    inst.dispose();
  });

  it('idle: with the pointer disengaged (centered, far from the zone) the surface is perfectly clean', () => {
    const target = makeTarget(pointerGlitchSplitPrimitive);
    const inst = pointerGlitchSplitPrimitive.create(target);
    const ud = handlesOf(target);

    // The catalog card subject is hidden; the sheet stands in.
    expect((target.subject as Mesh).visible).toBe(false);
    const sheet = sheetOf(target.scene);
    expect(sheet).toBeDefined();

    // Pinned idle frame: pointer disengaged (the rig's rest state).
    target.userData.pointer = { x: 0.5, y: 0.5 };
    // Default control sweep parks the proximity zone tightly; center pointer is
    // engaged at x=0.5, so to test the truly-disengaged rest move the pointer
    // out of the tile entirely.
    target.userData.pointer = { x: -1, y: -1 };
    inst.seek(0);
    expect(ud.uProx.value, 'no engagement off-tile').toBeCloseTo(0, 5);
    expect(maxShear(ud), 'no band shears when disengaged').toBeCloseTo(0, 6);
    expect(ud.uChroma.value, 'no chromatic split when disengaged').toBeCloseTo(0, 6);

    inst.dispose();
  });

  it('distortion response: the engaged pinned pointer slices bands and splits chroma; magnitude grows with proximity', () => {
    const target = makeTarget(pointerGlitchSplitPrimitive);
    const inst = pointerGlitchSplitPrimitive.create(target);
    const ud = handlesOf(target);

    // The harness pins the rig pointer at the ENGAGED point for control sweeps.
    target.userData.pointer = { x: 0.62, y: 0.5 };
    inst.seek(0.5);
    const proxEngaged = ud.uProx.value;
    const shearEngaged = maxShear(ud);
    const chromaEngaged = ud.uChroma.value;
    expect(proxEngaged, 'engaged pointer drives proximity > 0').toBeGreaterThan(0.2);
    expect(shearEngaged, 'bands shear at the engaged pointer').toBeGreaterThan(0.01);
    expect(chromaEngaged, 'chroma splits at the engaged pointer').toBeGreaterThan(0.001);

    // Stimulus 2: pointer dead-center of the card — maximum proximity.
    target.userData.pointer = { x: 0.5, y: 0.5 };
    inst.seek(0.5);
    const proxCenter = ud.uProx.value;
    expect(proxCenter, 'dead-center is fully engaged').toBeGreaterThan(proxEngaged);
    expect(maxShear(ud), 'center shears at least as hard').toBeGreaterThan(shearEngaged * 0.5);

    // Stimulus 3: pointer drifting toward the far edge — proximity falls off.
    target.userData.pointer = { x: 0.95, y: 0.5 };
    inst.seek(0.5);
    expect(ud.uProx.value, 'far pointer is less engaged than the pinned point').toBeLessThan(
      proxEngaged + 1e-6,
    );

    inst.dispose();
  });

  it('flicker: at the engaged pointer the band shears change across quantized time (deterministic jitter)', () => {
    const target = makeTarget(pointerGlitchSplitPrimitive);
    const inst = pointerGlitchSplitPrimitive.create(target);
    const ud = handlesOf(target);
    target.userData.pointer = { x: 0.62, y: 0.5 };

    inst.seek(0.0);
    const a = Float32Array.from(ud.uShear.value);
    // Step well past one flicker quantum at the default rate.
    inst.seek(1.0);
    const b = Float32Array.from(ud.uShear.value);

    let changed = 0;
    for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-6) changed++;
    expect(changed, 'some bands jitter to a new offset across time').toBeGreaterThan(0);

    // Determinism: the same (pointer, t) reproduces the same pattern exactly.
    inst.seek(0.0);
    const a2 = Float32Array.from(ud.uShear.value);
    for (let i = 0; i < a.length; i++) expect(a2[i]).toBeCloseTo(a[i], 6);

    inst.dispose();
  });

  it('controls change output at the pinned engaged state: bands, shear amount, chroma split, flicker rate', () => {
    const target = makeTarget(pointerGlitchSplitPrimitive);
    const inst = pointerGlitchSplitPrimitive.create(target);
    const ud = handlesOf(target);
    // Pin the engaged pointer and a fixed seek — every control must reshape the
    // frame at this exact frozen state (the rig sweeps controls paused here).
    target.userData.pointer = { x: 0.62, y: 0.5 };
    inst.seek(0.5);

    // bands → structural rebuild of the band count (onParamChange).
    inst.setControl('bands', 6);
    inst.seek(0.5);
    expect(ud.bandCount, 'band count rebuilt to 6').toBe(6);
    inst.setControl('bands', 12);
    inst.seek(0.5);
    expect(ud.bandCount, 'band count rebuilt to 12').toBe(12);

    // shear → larger amount means larger on-screen band offset at the same state.
    inst.setControl('shear', 0.04);
    inst.seek(0.5);
    const shearSmall = maxShear(ud);
    inst.setControl('shear', 0.3);
    inst.seek(0.5);
    const shearLarge = maxShear(ud);
    expect(shearLarge, 'more shear → more offset').toBeGreaterThan(shearSmall + 0.02);

    // chroma → larger split distance at the same engaged state. Sweep the FULL
    // schema range (min 0 → max 0.12) the rig sweeps; the engaged-frame split
    // distance (uChroma, already proximity-gated) must widen substantially.
    inst.setControl('chroma', 0);
    inst.seek(0.5);
    const chromaMin = ud.uChroma.value;
    expect(chromaMin, 'chroma 0 → no split at all').toBeCloseTo(0, 6);
    inst.setControl('chroma', 0.12);
    inst.seek(0.5);
    const chromaMax = ud.uChroma.value;
    // The pinned engaged pointer drives prox well above the discoverability
    // floor, so the max-chroma split distance is a substantial uv fraction.
    expect(chromaMax, 'max chroma → substantial split at the engaged frame').toBeGreaterThan(0.03);
    expect(chromaMax - chromaMin, 'min→max chroma widens the split').toBeGreaterThan(0.03);

    // flicker rate → the quantized time index advances differently, so the
    // shear pattern at a fixed t differs between two rates (deterministic).
    inst.setControl('shear', 0.2);
    inst.setControl('flicker', 2);
    inst.seek(0.7);
    const slow = Float32Array.from(ud.uShear.value);
    inst.setControl('flicker', 24);
    inst.seek(0.7);
    const fast = Float32Array.from(ud.uShear.value);
    let diff = 0;
    for (let i = 0; i < slow.length; i++) if (Math.abs(slow[i] - fast[i]) > 1e-6) diff++;
    expect(diff, 'flicker rate changes the quantized pattern').toBeGreaterThan(0);

    inst.dispose();
  });

  it('chroma is WIRED INTO the rendered colour: the sheet colorNode reaches the live uChroma uniform and the LUT (the dead-control fix)', () => {
    // The W3 dead-control defect was: the chroma knob moved a uniform that the
    // colorNode never read, so the rendered frame was identical low→high. This
    // asserts the structural fix — the engaged-frame colour graph literally
    // consumes uChroma — so a future regression that unwires it FAILS here, not
    // only under the GPU-vision rig.
    const { target } = makeTexturedTarget(2, 1);
    const inst = pointerGlitchSplitPrimitive.create(target);
    const ud = handlesOf(target);
    target.userData.pointer = { x: 0.62, y: 0.5 };
    inst.seek(0.5);

    const sheet = sheetOf(target.scene);
    const colorNode = (sheet.material as Material & { colorNode?: unknown }).colorNode;
    expect(colorNode, 'a colorNode is wired').toBeDefined();
    // The chroma uniform that the knob drives MUST be reachable from the colour
    // graph — this is exactly what was broken (uChroma set but never sampled).
    expect(
      nodeReaches(colorNode, ud.uChroma),
      'the chroma uniform feeds the rendered colour (per-channel RGB split)',
    ).toBe(true);
    // The split also samples the shear/lum LUT — the band structure it splits.
    expect(
      nodeReaches(colorNode, ud.lutTex),
      'the colorNode samples the band shear/lum LUT',
    ).toBe(true);

    inst.dispose();
  });

  it('chroma drives REAL chromatic aberration: at the engaged frozen frame the per-channel R−B fringe is ZERO at chroma 0 and grows MONOTONICALLY with the knob (the dead-control fix, measured)', () => {
    // THE CORE FIX. The W3 advocate measured the chroma control DEAD
    // (meanAbsDiff~0, changedFrac=0) and magentaFrac=0 in every frame: the
    // shader sheared bands but never produced per-channel RGB-split. This test
    // freezes the ENGAGED pose (pinned pointer, fixed seek — exactly how the
    // rig sweeps controls) and reads the CPU mirror of the final rendered R/G/B
    // (base·tint·field + the additive warm/ice emissive fringe). It asserts the
    // chromatic-aberration signal — the per-pixel R-vs-B separation that the
    // magenta/cyan slivers ARE — is null at chroma 0 and rises with the knob.
    // A future regression that unwires chroma (the original defect) FAILS here,
    // not only under the GPU-vision rig.
    const target = makeTarget(pointerGlitchSplitPrimitive); // map-less card
    const inst = pointerGlitchSplitPrimitive.create(target);
    const ud = handlesOf(target);
    // Pin the engaged pointer + a fixed seek (the rig's controls-pin state).
    target.userData.pointer = { x: 0.62, y: 0.5 };
    inst.seek(0.5);

    /** Per-pixel R−B at the chroma-0 baseline (base-colour asymmetry only) — the
     *  CHROMATIC signal is how far |R−B| MOVES from this baseline as chroma opens
     *  (so a constant base-colour tint never counts as a "split"). Also report
     *  the absolute per-pixel max |R−B| and whether any pixel reads magenta-ish
     *  (R and B both clearly above G — the chromatic-aberration colour). */
    const sampleGrid = (): Array<{ u: number; v: number }> => {
      const pts: Array<{ u: number; v: number }> = [];
      for (let vi = 0; vi < 16; vi++) {
        for (let xi = 0; xi < 96; xi++) {
          pts.push({ u: (xi + 0.5) / 96, v: (vi + 0.5) / 16 });
        }
      }
      return pts;
    };
    const grid = sampleGrid();

    // Baseline R−B per pixel at chroma 0.
    inst.setControl('chroma', 0);
    inst.seek(0.5);
    const base0 = grid.map(({ u, v }) => {
      const c = ud.channelSplitAt(u, v);
      return c.r - c.b;
    });

    const measure = (chroma: number) => {
      inst.setControl('chroma', chroma);
      inst.seek(0.5);
      let maxFringe = 0;
      let sumFringe = 0;
      let splitPixels = 0;
      grid.forEach(({ u, v }, i) => {
        const c = ud.channelSplitAt(u, v);
        const fringe = Math.abs(c.r - c.b - base0[i]); // chromatic delta from rest
        maxFringe = Math.max(maxFringe, fringe);
        sumFringe += fringe;
        // RGB-split sliver signature: a pixel that reads with a clear WARM bias
        // (R the dominant channel — the brass sliver) OR a clear COOL bias (B
        // dominant — the ice sliver). Both are the per-channel separation
        // chromatic aberration produces; either side counts. 0.015 is well above
        // the dark panel's base channel spread (~0.01) so it only fires on a real
        // chromatic sliver, not base-colour noise.
        const warmBias = c.r > c.g + 0.015 && c.r > c.b + 0.015;
        const coolBias = c.b > c.g + 0.015 && c.b > c.r + 0.015;
        if (warmBias || coolBias) splitPixels++;
      });
      return { maxFringe, meanFringe: sumFringe / grid.length, splitPixels };
    };

    const at0 = measure(0);
    const atMid = measure(0.05);
    const atMax = measure(0.12);

    // (1) chroma 0 → exactly the clean panel: no fringe at all.
    expect(at0.maxFringe, 'chroma 0 → zero chromatic fringe (clean)').toBeCloseTo(0, 6);
    expect(at0.splitPixels, 'chroma 0 → no warm/ice slivers').toBe(0);

    // (2) the fringe GROWS monotonically with the knob (the live control).
    expect(atMid.meanFringe, 'mid chroma opens a real fringe').toBeGreaterThan(0.01);
    expect(atMax.meanFringe, 'max chroma fringe exceeds mid (monotonic)').toBeGreaterThan(
      atMid.meanFringe + 0.01,
    );
    expect(atMax.maxFringe, 'max chroma peak fringe is substantial').toBeGreaterThan(0.15);

    // (3) the split reads as ITS NAME — visible warm/ice RGB-split slivers are
    // present at the engaged frame at both mid and max chroma (none at rest).
    // (Raw sliver COUNT is not monotonic — the per-edge mask phase shifts as the
    // offset crosses stripe boundaries — so growth is asserted on the fringe
    // MAGNITUDE above, which is monotonic; here we only require the slivers
    // EXIST when engaged and vanish at chroma 0.)
    expect(atMid.splitPixels, 'mid chroma shows RGB-split slivers').toBeGreaterThan(0);
    expect(atMax.splitPixels, 'max chroma shows RGB-split slivers').toBeGreaterThan(0);

    inst.dispose();
  });

  it('map-less RGB split: the band-luminance field gains real per-band structure when engaged and is flat (neutral) at rest', () => {
    // A flat colour panel (the catalog card) has no internal texture to triple-
    // tap, so the map-less split reads the per-band LUMINANCE key. That field
    // must carry genuine band-to-band variance when the pointer engages (so the
    // warm/ice slivers have something to separate) and collapse to neutral 0.5
    // when disengaged (so the rest frame is the clean panel — no fringe).
    const target = makeTarget(pointerGlitchSplitPrimitive); // map-less card
    const inst = pointerGlitchSplitPrimitive.create(target);
    const ud = handlesOf(target);

    // Disengaged (pointer off-tile) → every band-lum key ~0.5, ~zero variance.
    target.userData.pointer = { x: -1, y: -1 };
    inst.seek(0.5);
    const restKeys = ud.lumKeys;
    expect(restKeys.length, 'one lum key per active band').toBe(ud.bandCount);
    for (const k of restKeys) expect(k, 'rest band-lum is neutral 0.5').toBeCloseTo(0.5, 1);
    expect(variance(restKeys), 'rest band-lum field is flat (no fringe at rest)').toBeLessThan(1e-3);

    // Engaged (pinned engaged pointer) → the band-lum field has real structure.
    target.userData.pointer = { x: 0.62, y: 0.5 };
    inst.seek(0.5);
    const engagedKeys = ud.lumKeys;
    expect(
      variance(engagedKeys),
      'engaged band-lum carries substantial band-to-band variance to split',
    ).toBeGreaterThan(0.005);

    inst.dispose();
  });

  it('engaged amplitude: at the pinned engaged frame the split distance AND band shear are well above the discoverability floor', () => {
    // The premium bar: the effect must READ AS ITS NAME at full strength, not a
    // faint accidental wobble. At the pinned engaged frame with default controls
    // the proximity-gated chroma split and band shear are both substantial.
    const target = makeTarget(pointerGlitchSplitPrimitive);
    const inst = pointerGlitchSplitPrimitive.create(target);
    const ud = handlesOf(target);
    target.userData.pointer = { x: 0.62, y: 0.5 };
    inst.seek(0.5);

    // Default chroma 0.05 × engaged prox → a clearly-visible split distance.
    expect(ud.uChroma.value, 'engaged split distance well above floor').toBeGreaterThan(0.012);
    // Default shear 0.16 × engaged prox → a clearly-visible band offset.
    let maxAbs = 0;
    for (const s of ud.uShear.value) maxAbs = Math.max(maxAbs, Math.abs(s));
    expect(maxAbs, 'engaged band shear well above floor').toBeGreaterThan(0.04);

    inst.dispose();
  });

  it('texture preservation: the sheet samples the subject OWN texture by reference; chroma derives warm/ice tints, never an invented fill', () => {
    const { target, subject, texture } = makeTexturedTarget(2, 1);
    const inst = pointerGlitchSplitPrimitive.create(target);
    const sheet = sheetOf(target.scene);

    // colorNode is wired off the shared texture (by reference) — the split
    // reads three offset taps of the SAME map.
    const mat = sheet.material as Material & {
      colorNode?: unknown;
      map?: Texture | null;
    };
    expect(mat.map ?? null, 'shared map carried by reference').toBe(texture);
    expect(mat.colorNode, 'a chromatic-split colorNode is wired').toBeDefined();
    expect(sheet.material, 'sheet material is its own instance').not.toBe(subject.material);

    // The subject's own material/texture are never mutated.
    expect((subject.material as MeshBasicMaterial).map).toBe(texture);
    expect((subject.material as MeshBasicMaterial).opacity).toBe(1);

    // Sheet geometry derives from the measured bbox (2 x 1, not the catalog).
    sheet.geometry.computeBoundingBox();
    const bb = sheet.geometry.boundingBox!;
    expect(bb.max.x - bb.min.x).toBeCloseTo(2, 2);
    expect(bb.max.y - bb.min.y).toBeCloseTo(1, 2);

    inst.dispose();
    // Dispose never disposes the shared texture.
    expect((subject.material as MeshBasicMaterial).map).toBe(texture);
  });

  it('texture preservation: a map-less subject copies the subject color + PBR scalars onto the sheet (never an invented flat fill)', () => {
    const scene = new Scene();
    const object = new Group();
    scene.add(object);
    const subject = new Mesh(
      new PlaneGeometry(2, 1),
      new MeshBasicMaterial({ color: '#88aa66' }), // no map
    );
    object.add(subject);
    const target: AnimatableTarget = {
      object,
      subject,
      scene,
      userData: { pointer: { x: 0.5, y: 0.5 }, scroll: 0.5 },
    };

    const inst = pointerGlitchSplitPrimitive.create(target);
    const ud = handlesOf(target);
    const uColor = (
      target.userData.pointerGlitchSplit as { uColor?: { value: { getHexString(): string } } }
    ).uColor;
    expect(uColor?.value.getHexString(), 'sheet tint copied from the subject').toBe('88aa66');

    // Live tint tracking: recolor the source, seek, fallback follows.
    (subject.material as MeshBasicMaterial).color.set('#cd9f55');
    inst.seek(0.2);
    expect(uColor?.value.getHexString()).toBe('cd9f55');
    expect(ud).toBeDefined();

    inst.dispose();
  });

  it('regression: a texture poured AFTER create reaches the sheet (async map pour → material rebuild)', () => {
    const scene = new Scene();
    const object = new Group();
    scene.add(object);
    const subject = new Mesh(
      new PlaneGeometry(2, 1),
      new MeshBasicMaterial({ transparent: true }), // map-less at attach
    );
    object.add(subject);
    const target: AnimatableTarget = {
      object,
      subject,
      scene,
      userData: { pointer: { x: 0.5, y: 0.5 }, scroll: 0.5 },
    };

    const inst = pointerGlitchSplitPrimitive.create(target);
    const sheet = sheetOf(scene);
    const matBefore = sheet.material as Material;

    // The pour lands on the subject's material (what the default factory does).
    const texture = new DataTexture(new Uint8Array([200, 160, 90, 255]), 1, 1, RGBAFormat);
    texture.needsUpdate = true;
    (subject.material as MeshBasicMaterial).map = texture;
    (subject.material as MeshBasicMaterial).needsUpdate = true;

    inst.seek(0.4);
    expect(sheet.material, 'material rebuilt for the poured texture').not.toBe(matBefore);
    expect(
      (sheet.material as Material & { map?: Texture | null }).map,
      'rebuilt sheet samples the poured texture',
    ).toBe(texture);

    // Stability: with no further source change, seeks do NOT rebuild.
    const stable = sheet.material;
    inst.seek(0.6);
    expect(sheet.material).toBe(stable);

    // Dispose never touches the subject's shared texture.
    let texDisposed = 0;
    texture.addEventListener('dispose', () => texDisposed++);
    inst.dispose();
    expect(texDisposed).toBe(0);
  });

  it('chrome co-treatment: the card header/rows/dot become clones that shear with their band; subject chrome never mutated', () => {
    const target = makeTarget(pointerGlitchSplitPrimitive);
    const inst = pointerGlitchSplitPrimitive.create(target);

    const clones: Mesh[] = [];
    target.scene.traverse((o) => {
      if (o.name.startsWith('pointer-glitch-split-chrome:')) clones.push(o as Mesh);
    });
    // header + 3 content rows + accent dot = 5 chrome children cloned.
    expect(clones.length, 'all chrome children are cloned onto the overlay').toBe(5);

    // Subject chrome materials are NEVER mutated.
    const subjectPanel = target.subject as Mesh;
    subjectPanel.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh || m === subjectPanel) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        expect((mat as Material & { opacity: number }).opacity, 'chrome opacity untouched').toBe(1);
      }
    });

    // A chrome clone in the engaged zone shears in x as the pointer engages it.
    target.userData.pointer = { x: 0.5, y: 0.5 };
    inst.seek(0.5);
    const engagedX = clones.map((c) => c.position.x);
    // Disengage entirely → every clone returns to its rest x.
    target.userData.pointer = { x: -1, y: -1 };
    inst.seek(0.5);
    const restX = clones.map((c) => c.position.x);
    let moved = 0;
    for (let i = 0; i < clones.length; i++) {
      if (Math.abs(engagedX[i] - restX[i]) > 1e-6) moved++;
    }
    expect(moved, 'at least one chrome clone shears under engagement').toBeGreaterThan(0);

    inst.dispose();
  });

  it('regression: the overlay tracks the subject LIVE local pose each seek (co-bindings tilt the hidden subject)', () => {
    const { target, subject } = makeTexturedTarget(2, 1);
    const inst = pointerGlitchSplitPrimitive.create(target);
    let overlay: Object3D | null = null;
    target.scene.traverse((o) => {
      if (o.name === 'pointer-glitch-split-overlay') overlay = o;
    });
    expect(overlay).not.toBeNull();
    const grp = overlay as unknown as Group;

    subject.position.set(0.4, -0.2, 0.64);
    subject.quaternion.setFromAxisAngle(new Vector3(1, 0, 0), -0.122);
    subject.scale.set(1.1, 1.1, 1);
    inst.seek(0.3);

    expect(grp.position.x).toBeCloseTo(0.4, 6);
    expect(grp.position.z).toBeCloseTo(0.64, 6);
    expect(grp.quaternion.x).toBeCloseTo(subject.quaternion.x, 6);
    expect(grp.scale.x).toBeCloseTo(1.1, 6);

    inst.dispose();
  });

  it('dispose restores the subject and releases everything created (never subject resources)', () => {
    const { target, subject, texture } = makeTexturedTarget(2, 1);
    expect(subject.visible).toBe(true);

    const inst = pointerGlitchSplitPrimitive.create(target);
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

  it('fallback: with no usable geometry/material it leaves the subject visible and does not crash', () => {
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

    const inst = pointerGlitchSplitPrimitive.create(target);
    expect(overlayNodesIn(scene), 'no overlay spawned for an empty subject').toBe(0);
    expect(subject.visible, 'fallback never hides the subject it animates').toBe(true);

    // Seeks across an engaged pointer must not throw.
    target.userData.pointer = { x: 0.62, y: 0.5 };
    inst.seek(0.5);
    inst.seek(1.0);
    inst.dispose();
    expect(subject.visible).toBe(true);
  });
});
