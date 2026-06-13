// pointer-glitch-split — the cursor slices the surface into glitch bands:
// RGB-split slivers shear out of alignment around the pointer and snap clean
// when it leaves. HARD / displacement primitive, TEXTURE-PRESERVING +
// mountable: true (W3 differentiator) so the AI builder can drop it on ANY
// mounted element.
//
// DESIGN-REFERENCES §11 "RGB Shift / Chromatic Aberration" + the VFX-JS
// 'rgbGlitch' preset class (§1, @vfx-js/core) — implemented NATIVELY in TSL on
// our three/webgpu stack (no curtains.js / VFX-JS DOM dependency). The classic
// rgbShift samples r/g/b at ±offset along a direction; the glitch class shears
// horizontal slice bands by per-band offsets. This primitive fuses both,
// LOCALIZED to a pointer-proximity zone and tinted to the Observatory-Brass
// world (warm brass + ice, NEVER purple fringe).
//
// ── CHROMATIC ABERRATION REWRITE (2026-06-13, W3 advocate re-review) ────────
// The prior shader's "split" offset the SAMPLE ROW vertically (uv.y ± uChroma)
// and tinted two near-identical LUM taps warm/ice — which produced ZERO
// horizontal colour fringing (advocate: magentaFrac=0 everywhere, chroma knob
// dead with changedFrac=0). REAL chromatic aberration offsets each channel
// HORIZONTALLY along a per-band split direction:
//     R  = field(uv.x + chroma·splitDir(band))   ← warm-leaning channel
//     G  = field(uv.x)                            ← centre
//     B  = field(uv.x − chroma·splitDir(band))   ← ice-leaning channel
//     colorNode = vec3(sampR.r, sampG.g, sampB.b)
// so where the field has a horizontal edge (a band's sheared sliver boundary)
// the three channels land at different x → a magenta sliver on one side and a
// cyan sliver on the other. The "field" the channels split is, per pixel, the
// subject's own look MODULATED by a band-local horizontal sliver intensity that
// VARIES with x (a smooth ramp across each band), so a horizontal offset
// genuinely changes the sampled value even on a FLAT colour panel (no internal
// texture). chroma → 0 collapses the three taps → the clean artwork; chroma
// high → a wide, unmistakable warm/ice fringe at every engaged band edge. The
// split direction flips per band (sign of the band shear) so the slivers read
// as glitch RGB-split rather than a uniform smear.
//
// THE WAVE DIFFERENTIATOR — the 21 existing 'displacement' primitives SWAP
// subject.material for their own look (so 'displacement' sits in
// UNMOUNTABLE_CATEGORIES). This one PRESERVES the subject's own look and
// declares mountable:true:
//   - A subdivided SHEET overlay stands in for the subject (the
//     scroll-stagger-rise / cylinder-unroll hide-overlay-restore discipline):
//     the real subject is hidden while active, restored on dispose(), and the
//     sheet carries the subject's OWN look — when the live material has .map,
//     the texture is shared BY REFERENCE and sampled with band-sheared UVs;
//     when map-less, the subject color + PBR scalars are copied onto a node
//     material so it shades identically under the rig lights. NEVER an invented
//     flat fill.
//   - The chroma split is THREE taps of the SAME shared map at the sheared UV
//     offset by ±uChroma horizontally: the +tap tinted toward warm brass, the
//     −tap toward ice, the center tap full luma — recombined max-style so
//     off-glitch (chroma→0, all taps coincide) the sheet reads as the clean
//     artwork and only the engaged bands fringe.
//
// HOW THE BANDS SHEAR (CPU-driven, GPU-applied — deterministic, no Math.random):
//   - The sheet's local height is carved into N bands. Each seek a CPU pass
//     computes a signed per-band shear into a Float32Array `uShear` (published
//     for headless tests) AND bakes it into a 1×N DataTexture LUT the TSL
//     material reads, so one material shears every band without an array
//     uniform. Band b's shear = hash(b, flickerFrame) * shearAmt * proximity(b),
//     where proximity(b) is the engaged-zone strength at the BAND's center,
//     so only bands the pointer is near tear; flickerFrame = floor(t * flicker)
//     gives a deterministic jitter while engaged (a hash of band index +
//     quantized time). proximity = smoothstep over distance from the pointer in
//     subject-relative units, so the deformation envelope is SUBJECT-RELATIVE
//     (Box3-measured), never hardcoded world units.
//   - CHROME CHILDREN (the catalog card's brass header / grey rows / violet
//     dot) are cloned onto the overlay and posed CPU-side: each clone shears in
//     x by the shear of the band its center falls in, so the full card look
//     rides the glitch (a blank deformed slab = task failure). Clones share the
//     child geometry BY REFERENCE + a material clone (ours); the subject's own
//     chrome is never mutated.
//
// POINTER RIG: reads userData.pointer {x,y} in 0..1 (guarded non-finite). The
// harness pins the engaged point {x:0.62,y:0.5} for control sweeps — every
// control (bands / shear / chroma / flicker) visibly reshapes the frame there,
// and onParamChange re-applies at the last seek state. Idle = pointer
// disengaged (off-tile) ⇒ proximity 0 ⇒ zero shear, zero chroma: the subject is
// FULLY LEGIBLE and undistorted at rest. Stateful ⇒ duration() = Infinity.
//
// DISTINCT FROM NEIGHBORS: glitch-displace is a TIME-driven whole-surface CPU
// vertex tear that swaps nothing's look but IS unmountable (material-swap era);
// this is POINTER-LOCAL (only bands near the cursor move), TEXTURE-PRESERVING,
// and CHROMATIC (RGB-split fringes). datamosh is a time-driven block-smear that
// swaps the material for a procedural grid; this never replaces the look. No
// other displacement tile shears bands keyed to pointer proximity with a warm/
// ice chromatic split.

import {
  Box3,
  Color,
  DataTexture,
  Group,
  Matrix4,
  Mesh,
  NearestFilter,
  PlaneGeometry,
  RGBAFormat,
  Vector2,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  float,
  mix,
  uniform,
  uv,
  vec2,
  vec3,
  texture as tslTexture,
} from 'three/tsl';
// NOTE: all per-channel chroma math below is expressed through the repo's
// `as unknown as Node` escape-hatch (`n(...)`) using node METHODS
// (.add/.sub/.mul/.abs/.clamp/.fract/.floor), so no extra TSL free-function
// imports are needed — keeps the dependency-allowlist surface unchanged.
import { defineAnimatable } from '../base';
import { clamp, num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  // How many horizontal slice bands the surface tears into.
  { id: 'bands', label: 'Bands', type: 'knob', min: 4, max: 20, step: 1, default: 12 },
  // Max horizontal shear of a fully-engaged band, as a FRACTION of width.
  { id: 'shear', label: 'Shear', type: 'fader', min: 0, max: 0.4, step: 0.01, default: 0.16 },
  // Chromatic split distance — the per-channel R/G/B horizontal offset, as a
  // FRACTION of width. Drives the width of the warm/ice colour fringes; wide
  // enough at max that the RGB slivers are unmistakable at DPR-2.
  { id: 'chroma', label: 'Chroma Split', type: 'knob', min: 0, max: 0.12, step: 0.002, default: 0.05 },
  // Flicker rate — quantized time steps per second the band offsets re-roll.
  { id: 'flicker', label: 'Flicker', type: 'knob', min: 0, max: 30, step: 1, default: 16, unit: '/s' },
] as const;

// Engaged-zone radius as a fraction of the subject's half-diagonal — scale-free
// so the proximity falloff reads the same on a catalog card and a mounted hero.
const ZONE_FRAC = 0.62;
// Warm brass + ice split tints (Observatory-Brass world — no purple). Applied
// to the +offset / −offset chroma taps respectively.
const WARM = new Color('#e9c98a'); // brass-200-ish
const COOL = new Color('#bfe0ef'); // ice-200-ish
// Fixed LUT width = schema max bands. The 1×LUT_W shear texture keeps its
// identity across `bands` tweaks (only `bandCount` active texels are written),
// so the material's texture sample never needs rebuilding when band count
// changes — only the LUT contents + the uBands divisor update.
const LUT_W = 20;
// Map-less sliver field: how many vertical sliver stripes span the sheet width.
// Higher → finer slivers, so a given horizontal chroma offset crosses more of a
// stripe → more per-channel separation. ~9 reads as crisp glitch slivers at
// DPR-2 without aliasing into noise.
const SLIVER_FREQ = 9;
// Chroma → side-tap tint strength. The warm/ice tints lerp white→warm/ice by
// clamp(uChroma·GAIN), so chroma 0 keeps the side taps NEUTRAL (the three
// channels coincide → zero fringe, no baseline tint difference) and the fringe
// strengthens monotonically with the knob. uChroma is proximity-gated and tops
// out near 0.12, so ~12 reaches full warm/ice tint at max chroma.
const CHROMA_TINT_GAIN = 12;
// Additive chromatic-fringe brightness per unit uChroma. The panel albedo is
// near-black, so the warm/ice slivers are EMISSIVE; this gain makes them clearly
// visible at default chroma (uChroma~0.05 → ~0.4 peak warm/ice glow) and stronger
// at max, while staying ≤1 so the slivers never blow out to white.
const CHROMA_FRINGE_GAIN = 8;
// How hard the per-band luminance KEY (LUT.g) modulates the map-less sliver
// field contrast: contrast = (lum−0.5)·GAIN, so a disengaged band (lum≈0.5)
// has ~flat field (no fringe at rest) and a fully-engaged band carries a strong
// across-x ramp for the chroma offset to split. Bounded so content stays legible.
const SLIVER_GAIN = 1.4;

/** First Mesh descendant carrying a material (the subject may be a Group —
 *  MSDF text-objects — so traverse rather than assume Mesh). */
function findRepresentativeMesh(subject: Object3D): Mesh | null {
  let found: Mesh | null = null;
  subject.traverse((o) => {
    if (found) return;
    const mesh = o as Mesh;
    if (mesh.isMesh && mesh.material) found = mesh;
  });
  return found;
}

type MappedMaterial = Material & {
  map?: Texture | null;
  color?: Color;
  emissive?: Color;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
  opacity: number;
};

/** Deterministic [0,1) hash from two integer keys — no Math.random. */
const hash2 = (a: number, b: number): number => {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** A chrome child posed per seek (CPU mirror of the band shear). Offsets are in
 *  the SHEET's frame: cx/cy from the sheet center, dz proud of the face. */
interface ChromeClone {
  mesh: Mesh;
  cx: number;
  cy: number;
  dz: number;
}

export const pointerGlitchSplitPrimitive: PrimitiveDefinition = {
  name: 'pointer-glitch-split',
  label: 'Pointer Glitch Split',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'pointer',
  mountable: true,
  schema: SCHEMA,
  description:
    'The cursor slices the surface into glitch bands — RGB-split slivers shearing out of alignment around the pointer, snapping clean when it leaves.',
  create: defineAnimatable(
    { name: 'pointer-glitch-split', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;

      const repMesh = findRepresentativeMesh(subject);
      /** The representative mesh's CURRENT first material — read live, never
       *  cached: the mounted factory pours `.map` asynchronously and
       *  applyImageSpec may swap the material after this primitive attaches. */
      const liveSourceMaterial = (): MappedMaterial | null => {
        if (!repMesh) return null;
        const m = repMesh.material;
        return ((Array.isArray(m) ? m[0] : m) as MappedMaterial | undefined) ?? null;
      };

      // ── Measure in the subject's OWN local frame (no hardcoded units) ────
      // Geometry-based (the genie-suck lesson): each mesh's geometry bbox is
      // mapped mesh-local → subject-local directly — a world-AABB double-
      // inflates under tilt. The sheet covers the union of all meshes; its
      // face z is the REPRESENTATIVE mesh (chrome proud of the face must not
      // push the sheet forward).
      subject.updateWorldMatrix(true, true);
      const invSubject = new Matrix4().copy(subject.matrixWorld).invert();
      const unionBox = new Box3();
      const repBox = new Box3();
      {
        const rel = new Matrix4();
        const tmp = new Box3();
        subject.traverse((o) => {
          const mesh = o as Mesh;
          if (!mesh.isMesh || !mesh.geometry) return;
          if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
          const bb = mesh.geometry.boundingBox;
          if (!bb || bb.isEmpty()) return;
          rel.multiplyMatrices(invSubject, mesh.matrixWorld);
          tmp.copy(bb).applyMatrix4(rel);
          unionBox.union(tmp);
          if (mesh === repMesh) repBox.copy(tmp);
        });
      }
      const localBox = unionBox.isEmpty() ? null : unionBox;
      const faceBox = repBox.isEmpty() ? localBox : repBox;
      const canOverlay = Boolean(localBox && liveSourceMaterial() && subject.parent);

      const prevVisible = subject.visible;

      // Sheet extents (subject-local), filled when the overlay is built.
      let halfW = 0.5;
      let halfH = 0.5;
      let sheetX = 0;
      let sheetY = 0;
      let faceZ = 0;

      // ── Live uniforms ────────────────────────────────────────────────────
      const uChroma = uniform(0); // chromatic split distance (uv units)
      const uWidth = uniform(1); // sheet width (chrome shear → local units)
      const uColor = uniform(new Color('#ffffff')); // map-less fallback tint
      const uWarm = uniform(WARM.clone());
      const uCool = uniform(COOL.clone());

      // Published CPU-side observability (the water-droplet pattern).
      let bandCount = Math.max(1, Math.round(num(params.bands, 12)));
      let shearArr = new Float32Array(bandCount); // signed per-band x-shear
      const uProx = uniform(0); // max engaged-zone strength (for tests)
      const uPointer = uniform(new Vector2(0.5, 0.5));
      const uBands = uniform(bandCount);

      // Fixed-width shear LUT (1×LUT_W). Identity-stable across `bands` tweaks
      // so the material's texture sample is never rebuilt for band count — only
      // the active-texel contents + uBands change.
      const lutData = new Uint8Array(LUT_W * 4);
      const lutTex = new DataTexture(lutData, LUT_W, 1, RGBAFormat);
      // NEAREST so each band is a crisp slice (no smeared boundary between
      // adjacent band shears) — the hard-edged glitch look.
      lutTex.minFilter = NearestFilter;
      lutTex.magFilter = NearestFilter;
      lutTex.needsUpdate = true;

      // ── TSL: band-sheared, HORIZONTALLY chromatically-split own look ─────
      // The fixed-width LUT carries, per band, in its texels: R = signed shear
      // (encoded 0.5±, |1| span) and G = a per-band luminance KEY (jittered,
      // engagement-scaled) so adjacent engaged bands differ in brightness. uv.y
      // → band row → texel (band+0.5)/LUT_W (NEAREST → crisp band slices).
      //
      // THE RGB SPLIT (real chromatic aberration — the heart of the claim):
      // each channel offsets its sample HORIZONTALLY along the band's split
      // direction:
      //     uvR.x = shearedX + uChroma·dir      (warm / red leads)
      //     uvG.x = shearedX                    (centre / green)
      //     uvB.x = shearedX − uChroma·dir      (ice / blue trails)
      // where dir = sign(band shear) so the split flips per band (RGB-split
      // slivers, not a uniform smear). Recompose colorNode = vec3(R.r,G.g,B.b).
      // Off-glitch (uChroma→0) the three taps coincide → the clean look; engaged
      // they fan out → a warm sliver on one edge and an ice sliver on the other.
      const baseUv = uv();
      const lutW = float(LUT_W);
      type Nn = {
        mul: (o: unknown) => Nn;
        sub: (o: unknown) => Nn;
        add: (o: unknown) => Nn;
        div: (o: unknown) => Nn;
        rgb: Nn;
        r: Nn;
        g: Nn;
        b: Nn;
        x: Nn;
        y: Nn;
        abs: () => Nn;
        floor: () => Nn;
        fract: () => Nn;
        sign: () => Nn;
        clamp: (lo: unknown, hi: unknown) => Nn;
        oneMinus: () => Nn;
      };
      const n = (x: unknown): Nn => x as unknown as Nn;
      // Which band a uv-row falls in (bands are horizontal → function of v only).
      const bandIndexAt = (rowY: unknown) => n(n(rowY).mul(uBands)).floor();
      // The LUT texel center for a given (integer) band index.
      const lutAtBand = (bandIdx: Nn) =>
        n(tslTexture(lutTex as Texture, vec2(n(n(bandIdx).add(0.5)).div(lutW) as unknown as number, float(0.5))));
      // Signed shear in [-1,1] from LUT.r (encoded 0.5 + signed/2).
      const shearOfBand = (lut: Nn) => n(n(lut.r).sub(0.5)).mul(2);
      // Per-band horizontal "sliver" intensity field — a smooth across-band ramp
      // (triangle of fract(x·SLIVERS + band·φ)) so a flat colour panel gains REAL
      // horizontal structure that a horizontal chroma offset samples differently.
      // |frac·2−1| → a 0..1 saw the chroma offset shifts the phase of, so R and B
      // read different values → genuine per-channel separation (magenta/cyan
      // fringe) that scales with uChroma. lum keys it so the field only has
      // contrast where the band is engaged.
      const sliverField = (xPos: Nn, bandIdx: Nn, lum: Nn) => {
        const phase = n(xPos).mul(SLIVER_FREQ).add(n(bandIdx).mul(0.5));
        const saw = n(n(phase).fract().sub(0.5)).abs().mul(2); // 0..1 triangle
        // Centre on 1.0 and let the band-lum scale the contrast so a disengaged
        // (lum≈0.5) band stays ~flat; engaged bands carry visible sliver rows.
        const contrast = n(n(lum).sub(0.5)).mul(SLIVER_GAIN);
        return n(n(saw).sub(0.5)).mul(contrast).add(1);
      };
      // Band-edge SLIVER MASK in [0,1]: peaks at the sliver stripe crests, zero in
      // the troughs. The additive chromatic fringe rides this so the glow lands as
      // crisp slivers (not a flat wash). Engagement-keyed by lum so a disengaged
      // band's mask is ~0 → no fringe at rest.
      const sliverMask = (xPos: Nn, bandIdx: Nn, lum: Nn) => {
        const phase = n(xPos).mul(SLIVER_FREQ).add(n(bandIdx).mul(0.5));
        const saw = n(n(phase).fract().sub(0.5)).abs().mul(2); // 0..1 triangle
        const eng = n(n(lum).sub(0.5)).abs().mul(2).clamp(0, 1); // 0 rest → 1 engaged
        return n(saw).mul(eng);
      };

      const buildMaterial = (): MeshStandardNodeMaterial => {
        const src = liveSourceMaterial();
        builtSrcMat = src;
        builtSrcMap = (src?.map as Texture | null | undefined) ?? null;
        const mat = new MeshStandardNodeMaterial({ transparent: true });
        if (src) {
          if (typeof src.roughness === 'number') mat.roughness = src.roughness;
          if (typeof src.metalness === 'number') mat.metalness = src.metalness;
          if (typeof src.envMapIntensity === 'number') mat.envMapIntensity = src.envMapIntensity;
          if (src.emissive) mat.emissive.copy(src.emissive);
          if (typeof src.emissiveIntensity === 'number') {
            mat.emissiveIntensity = src.emissiveIntensity;
          }
          mat.opacity = src.opacity;
          mat.transparent = src.transparent || src.opacity < 1;
          if (src.color) uColor.value.copy(src.color);
        }
        // Band the CURRENT pixel falls in + its shear/lum (one tap, shared by all
        // three channels — the colour split is HORIZONTAL within the band).
        const band = bandIndexAt(baseUv.y);
        const lut = lutAtBand(band);
        const shear = shearOfBand(lut);
        const lum = n(lut.g);
        const shearedX = n(baseUv.x).add(shear); // band's sheared sample column
        // Split direction = sign of this band's shear (flips per band). |shear|
        // tiny → fall back to +1 so a near-zero-shear engaged band still fringes.
        const dir = n(n(shear).sign()).add(n(shear).abs().mul(1000).clamp(0, 1).oneMinus());
        const off = n(uChroma); // proximity-gated split distance (uv units)
        // Per-channel HORIZONTAL sample columns — the real chromatic aberration.
        const xR = n(shearedX).add(n(off).mul(dir)); // warm channel leads +dir
        const xG = shearedX; // centre
        const xB = n(shearedX).sub(n(off).mul(dir)); // ice channel trails −dir
        // Chroma-gated tint strength: 0 → the side taps are NEUTRAL white (so the
        // three channels coincide exactly → no fringe, no baseline tint
        // difference); → 1 as chroma grows so the side taps swing fully to
        // warm/ice. This is what makes |R−B| zero at chroma 0 and rise
        // MONOTONICALLY with the knob (the dead-control fix's measurable signal).
        const tintAmt = n(off).mul(CHROMA_TINT_GAIN).clamp(0, 1);
        const warmTint = mix(
          vec3(1, 1, 1) as unknown as Parameters<typeof mix>[0],
          uWarm as unknown as Parameters<typeof mix>[1],
          tintAmt as unknown as Parameters<typeof mix>[2],
        );
        const coolTint = mix(
          vec3(1, 1, 1) as unknown as Parameters<typeof mix>[0],
          uCool as unknown as Parameters<typeof mix>[1],
          tintAmt as unknown as Parameters<typeof mix>[2],
        );

        // ── ADDITIVE chromatic fringe (the on-screen RGB-split slivers) ───────
        // The catalog panel is DARK (albedo ~0.015), so a purely multiplicative
        // tint of the colour is invisible. The fringe is therefore EMISSIVE: a
        // warm sliver added at the +offset band edge (boosts R+G) and an ice
        // sliver at the −offset edge (boosts G+B). Their R-vs-B imbalance is the
        // chromatic-aberration signature the advocate measures (net R−B shift +
        // magenta where the warm sliver's red overlaps the panel), and the glow
        // is bright enough to read on a near-black surface. Amplitude =
        // uChroma · CHROMA_FRINGE_GAIN, so it is ZERO at chroma 0 and grows
        // MONOTONICALLY with the knob; the per-edge sliver MASK is engagement-
        // keyed (lum) so a disengaged band emits nothing → clean at rest.
        const fringeAmt = n(off).mul(CHROMA_FRINGE_GAIN);
        const maskWarm = sliverMask(n(xR), band, lum); // warm sliver at +edge
        const maskCool = sliverMask(n(xB), band, lum); // ice sliver at −edge
        const warmGlow = n(n(uWarm).mul(maskWarm)).mul(fringeAmt);
        const coolGlow = n(n(uCool).mul(maskCool)).mul(fringeAmt);
        const fringeEmissive = n(warmGlow).add(coolGlow);
        (mat as unknown as { emissiveNode: unknown }).emissiveNode = fringeEmissive;

        if (builtSrcMap) {
          // Texture-preserving RGB split: tap the SHARED map THREE times — each
          // channel at its own HORIZONTAL chroma-offset column on the sheared
          // band row. R takes the red of the +offset tap (warm-biased), G the
          // green of the centre tap, B the blue of the −offset tap (ice-biased):
          // classic chromatic aberration of the band shear. off→0 the taps
          // coincide AND the tints collapse to white → the clean artwork; the
          // warm/ice bias grows with chroma into the brass/ice world (no purple).
          mat.map = builtSrcMap; // by reference; carried for any mount inspector
          const tapR = n(n(tslTexture(builtSrcMap, vec2(xR as unknown as number, baseUv.y as unknown as number))).rgb).mul(warmTint);
          const tapG = n(tslTexture(builtSrcMap, vec2(xG as unknown as number, baseUv.y as unknown as number))).rgb;
          const tapB = n(n(tslTexture(builtSrcMap, vec2(xB as unknown as number, baseUv.y as unknown as number))).rgb).mul(coolTint);
          const split = vec3(
            tapR.r as unknown as number,
            tapG.g as unknown as number,
            tapB.b as unknown as number,
          );
          (mat as unknown as { colorNode: unknown }).colorNode = mix(
            tapG as unknown as Parameters<typeof mix>[0],
            split as unknown as Parameters<typeof mix>[1],
            n(off).mul(60).clamp(0, 1) as unknown as Parameters<typeof mix>[2],
          );
        } else {
          // Map-less (the catalog card panel): no internal texture to triple-tap,
          // so each channel reads the per-band SLIVER FIELD at its own HORIZONTAL
          // chroma-offset column. Because the field varies across x within the
          // band, R (sampled at xR) and B (sampled at xB) land on DIFFERENT field
          // values, AND the warm/ice tints strengthen with chroma → a magenta
          // sliver on one side of each glitch row and a cyan sliver on the other.
          // |R−B| = 0 at chroma 0 (tints white, offset 0) and grows MONOTONICALLY
          // with the knob. off-engagement (lum≈0.5 → flat field, off 0) all three
          // coincide → the clean panel colour.
          const base = n(uColor);
          const fR = sliverField(n(xR), band, lum);
          const fG = sliverField(n(xG), band, lum);
          const fB = sliverField(n(xB), band, lum);
          const chR = n(n(base).mul(warmTint)).mul(fR); // warm channel
          const chG = n(base).mul(fG); // neutral centre
          const chB = n(n(base).mul(coolTint)).mul(fB); // ice channel
          const split = vec3(
            n(chR).r as unknown as number,
            n(chG).g as unknown as number,
            n(chB).b as unknown as number,
          );
          (mat as unknown as { colorNode: unknown }).colorNode = mix(
            chG as unknown as Parameters<typeof mix>[0],
            split as unknown as Parameters<typeof mix>[1],
            n(off).mul(60).clamp(0, 1) as unknown as Parameters<typeof mix>[2],
          );
        }
        // The sheared uv drives the sample; the geometry itself is undistorted
        // (so the silhouette stays the card's). No positionNode change.
        return mat;
      };

      let builtSrcMat: MappedMaterial | null = null;
      let builtSrcMap: Texture | null = null;

      // ── Overlay sheet + chrome clones ────────────────────────────────────
      const overlay = new Group();
      overlay.name = 'pointer-glitch-split-overlay';
      let sheet: Mesh | null = null;
      const chrome: ChromeClone[] = [];

      if (canOverlay && localBox && faceBox) {
        const w = localBox.max.x - localBox.min.x || 1;
        const h = localBox.max.y - localBox.min.y || 1;
        halfW = w / 2;
        halfH = h / 2;
        sheetX = (localBox.min.x + localBox.max.x) / 2;
        sheetY = (localBox.min.y + localBox.max.y) / 2;
        faceZ = faceBox.max.z;
        uWidth.value = w;

        sheet = new Mesh(new PlaneGeometry(w, h, 1, 1), buildMaterial());
        sheet.name = 'pointer-glitch-split-sheet';
        sheet.position.set(sheetX, sheetY, faceZ);
        overlay.add(sheet);

        // Chrome clones: every non-representative mesh child rides the glitch,
        // posed CPU-side by the shear of the band its center falls in.
        const rel = new Matrix4();
        const childBox = new Box3();
        subject.traverse((o) => {
          const child = o as Mesh;
          if (!child.isMesh || child === repMesh || !child.material || !child.geometry) return;
          if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
          const bb = child.geometry.boundingBox;
          if (!bb || bb.isEmpty()) return;
          const srcMat = (
            Array.isArray(child.material) ? child.material[0] : child.material
          ) as MappedMaterial;
          rel.multiplyMatrices(invSubject, child.matrixWorld);
          childBox.copy(bb).applyMatrix4(rel);
          const ccx = (childBox.min.x + childBox.max.x) / 2;
          const ccy = (childBox.min.y + childBox.max.y) / 2;
          const ccz = (childBox.min.z + childBox.max.z) / 2;
          // Real geometry by reference (never disposed by us) + material clone.
          const m = new Mesh(child.geometry as BufferGeometry, srcMat.clone());
          m.name = `pointer-glitch-split-chrome:${child.name || 'mesh'}`;
          overlay.add(m);
          chrome.push({ mesh: m, cx: ccx - sheetX, cy: ccy - sheetY, dz: ccz - faceZ });
        });

        // Sibling of the subject carrying its exact local pose (a hidden parent
        // hides its children, so the sheet cannot live under it).
        overlay.position.copy(subject.position);
        overlay.quaternion.copy(subject.quaternion);
        overlay.scale.copy(subject.scale);
        subject.parent!.add(overlay);
        subject.visible = false; // the sheet IS the subject now
      }

      // Publish handles for the host + headless tests.
      target.userData.pointerGlitchSplit = {
        uShear: { value: shearArr },
        uChroma,
        uProx,
        uPointer,
        uBands,
        uColor,
        get bandCount() {
          return bandCount;
        },
        // The per-band LUMINANCE keys (decoded LUT.g for active bands) — the
        // structure the map-less RGB split reads. Engaged → non-trivial
        // band-to-band variance; disengaged → all ~0.5 (neutral, no fringe).
        get lumKeys(): number[] {
          const out: number[] = [];
          for (let b = 0; b < bandCount; b++) out.push(lutData[b * 4 + 1] / 255);
          return out;
        },
        // The live shear/lum LUT DataTexture (by reference) — never disposed by
        // tests; lets a headless test confirm the colorNode samples THIS texture.
        lutTex,
        // CPU MIRROR of the map-less per-channel split (the water-droplet pattern
        // — the split runs in TSL on the GPU, so a headless test reads this
        // exact-same arithmetic). Given a uv it returns the FINAL rendered R/G/B
        // the shader emits (base colour × warm/ice tint × the horizontally-offset
        // sliver field at xR/xG/xB), so a test can assert REAL chromatic
        // aberration: chroma 0 → the three channels coincide (no fringe); chroma
        // high → |R−B| grows (a magenta/cyan sliver). Mirrors buildMaterial's
        // map-less branch byte-for-byte (sliverField + horizontal chroma offset +
        // the warm/ice channel tint + the engagement mix). Returns the SPLIT
        // composite (the engaged look), matching mix(...,clamp(off·60)) at off>0.
        channelSplitAt(u: number, v: number): { r: number; g: number; b: number } {
          const off = uChroma.value; // proximity-gated split distance (uv units)
          const bandIdx = Math.floor(v * bandCount);
          const bi = Math.min(Math.max(bandIdx, 0), Math.max(bandCount - 1, 0));
          const shear = (lutData[bi * 4] / 255) * 2 - 1; // decode LUT.r → signed
          const lum = lutData[bi * 4 + 1] / 255;
          const shearedX = u + shear;
          // dir = sign(shear) with a +1 fallback when shear≈0 (matches the TSL).
          const dir = Math.sign(shear) + (1 - clamp(Math.abs(shear) * 1000, 0, 1));
          const xR = shearedX + off * dir;
          const xG = shearedX;
          const xB = shearedX - off * dir;
          const field = (x: number): number => {
            const phase = x * SLIVER_FREQ + bandIdx * 0.5;
            const saw = Math.abs(phase - Math.floor(phase) - 0.5) * 2; // triangle
            const contrast = (lum - 0.5) * SLIVER_GAIN;
            return (saw - 0.5) * contrast + 1;
          };
          const maskAt = (x: number): number => {
            const phase = x * SLIVER_FREQ + bandIdx * 0.5;
            const saw = Math.abs(phase - Math.floor(phase) - 0.5) * 2; // triangle
            const eng = clamp(Math.abs(lum - 0.5) * 2, 0, 1); // 0 rest → 1 engaged
            return saw * eng;
          };
          const c = uColor.value;
          // Chroma-gated tint (white→warm/ice) — mirrors the TSL tintAmt exactly.
          const tintAmt = clamp(off * CHROMA_TINT_GAIN, 0, 1);
          const warmR = 1 + (WARM.r - 1) * tintAmt; // lerp(1, WARM.r, tintAmt)
          const coolB = 1 + (COOL.b - 1) * tintAmt; // lerp(1, COOL.b, tintAmt)
          // Multiplicative albedo term: base·tint·field (the lit panel colour).
          const albR = c.r * warmR * field(xR);
          const albG = c.g * field(xG);
          const albB = c.b * coolB * field(xB);
          // ADDITIVE emissive fringe — mirrors emissiveNode = warm·maskR·amt +
          // cool·maskB·amt. This is the dominant on-screen signal on a dark panel
          // (the magenta/cyan slivers the advocate measures).
          const fringeAmt = off * CHROMA_FRINGE_GAIN;
          const mW = maskAt(xR) * fringeAmt;
          const mC = maskAt(xB) * fringeAmt;
          const emR = WARM.r * mW + COOL.r * mC;
          const emG = WARM.g * mW + COOL.g * mC;
          const emB = WARM.b * mW + COOL.b * mC;
          // Final per-channel rendered value = lit albedo + additive emissive,
          // exactly the composite the advocate's pixel metrics see.
          return { r: albR + emR, g: albG + emG, b: albB + emB };
        },
      };

      const readPointer = (): { x: number; y: number } => {
        const p = (target.userData as { pointer?: { x?: number; y?: number } }).pointer;
        const px = typeof p?.x === 'number' && Number.isFinite(p.x) ? p.x : 0.5;
        const py = typeof p?.y === 'number' && Number.isFinite(p.y) ? p.y : 0.5;
        return { x: px, y: py };
      };

      let lastT = 0;

      /** Recompute the per-band shear array + LUT for the current pointer/time/
       *  params, and re-pose the chrome clones. The single source of truth for
       *  the frame — onParamChange re-runs it at the last seek state. */
      const apply = (t: number) => {
        lastT = t;
        const { x: px, y: py } = readPointer();
        uPointer.value.set(px, py);

        const shearAmt = clamp(num(params.shear, 0.16), 0, 0.4);
        const chroma = clamp(num(params.chroma, 0.05), 0, 0.12);
        const flicker = clamp(num(params.flicker, 16), 0, 30);
        const frame = Math.floor(t * flicker); // quantized flicker step

        // Engaged-zone radius (fraction of the 0..1 uv span). The pointer is in
        // 0..1 over the tile; a band engages by how near the pointer is to it —
        // a 2D distance combining the pointer's HORIZONTAL offset from the card
        // center (so a cursor drifting off the side disengages every band) and
        // its VERTICAL offset from THIS band's center (so the slice nearest the
        // cursor tears hardest). The card may be non-square, so the horizontal
        // term is aspect-weighted to keep the falloff round in uv space.
        const zone = ZONE_FRAC;
        const aspect = halfH > 1e-6 ? halfW / halfH : 1;
        const dxAbs = (px - 0.5) * aspect; // horizontal offset from card center
        let maxProx = 0;

        uBands.value = bandCount;
        if (shearArr.length !== bandCount) shearArr = new Float32Array(bandCount);
        for (let b = 0; b < bandCount; b++) {
          // Band center in v (0 bottom → 1 top); texel b in the fixed LUT.
          const vC = (b + 0.5) / bandCount;
          const dy = py - vC; // vertical offset from this band
          const d = Math.hypot(dxAbs, dy);
          const prox = clamp(1 - d / Math.max(zone, 1e-3), 0, 1);
          const proxE = prox * prox * (3 - 2 * prox); // smoothstep
          if (proxE > maxProx) maxProx = proxE;
          // Deterministic signed per-band offset, jittered by the flicker frame.
          const r = hash2(b * 7.31 + 1.7, frame * 1.31 + 0.5);
          const signed = (r * 2 - 1) * shearAmt * proxE;
          shearArr[b] = signed;
          // Per-band LUMINANCE KEY (LUT.g) — a second deterministic hash so
          // adjacent engaged bands carry DIFFERENT brightness. The map-less
          // RGB-split reads this field at chroma-offset rows; a flat panel has
          // no other structure to split, so this is what makes the warm/ice
          // slivers visible. Centred on 0.5 (neutral) and proximity-scaled so a
          // disengaged band reads exactly 0.5 → no tint at rest. ±0.5·proxE
          // gives a full 0..1 swing on a fully-engaged band.
          const lr = hash2(b * 3.71 + 9.2, frame * 2.13 + 4.6);
          const lumKey = clamp(0.5 + (lr - 0.5) * proxE, 0, 1);
          // Encode into the LUT: R = 0.5 + signed/2 (matches the TSL decode), G =
          // the luminance key. The TSL maps uv.y → band b → texel (b+0.5)/LUT_W,
          // so texel b carries band b's shear + lum; inactive texels (b >=
          // bandCount) are never sampled.
          const e = Math.round(clamp(0.5 + signed / 2, 0, 1) * 255);
          lutData[b * 4] = e;
          lutData[b * 4 + 1] = Math.round(lumKey * 255);
          lutData[b * 4 + 2] = 0;
          lutData[b * 4 + 3] = 255;
        }
        lutTex.needsUpdate = true;
        uChroma.value = chroma * maxProx; // split only while engaged
        uProx.value = maxProx;
        // Keep the published handle pointing at the live array.
        (target.userData.pointerGlitchSplit as { uShear: { value: Float32Array } }).uShear.value =
          shearArr;

        if (!canOverlay || !sheet) return;

        // (b) LIVE TRANSFORM TRACKING — co-bindings keep animating the hidden
        // subject; re-register the overlay on its CURRENT local pose.
        overlay.position.copy(subject.position);
        overlay.quaternion.copy(subject.quaternion);
        overlay.scale.copy(subject.scale);

        // (a) LATE TEXTURE POUR — rebuild the sheet material the moment the live
        // source material instance or its map identity changes.
        const src = liveSourceMaterial();
        const liveMap = (src?.map as Texture | null | undefined) ?? null;
        if (src !== builtSrcMat || liveMap !== builtSrcMap) {
          const old = sheet.material as Material;
          sheet.material = buildMaterial();
          old.dispose(); // ours alone — never disposes the shared texture
        } else if (src && !liveMap && src.color) {
          uColor.value.copy(src.color); // live tint tracking on the fallback
        }

        // Pose the chrome clones: each shears in x by the shear of the band its
        // vertical center falls in, so the brass header / grey rows / accent dot
        // ride the same glitch as the sheet bands beneath them.
        for (const c of chrome) {
          const v = clamp((c.cy + halfH) / (halfH * 2 || 1), 0, 0.999999);
          const b = Math.min(bandCount - 1, Math.floor(v * bandCount));
          const sh = shearArr[b] * (uWidth.value || 1); // fraction → local units
          c.mesh.position.set(sheetX + c.cx + sh, sheetY + c.cy, faceZ + c.dz);
        }
      };

      apply(0);

      return {
        // Stateful, pointer-driven: tracks the live pointer, never "ends".
        duration: () => Infinity,
        seek: (t) => apply(t),
        // Re-apply at the live time so paused control tweaks (the CONTROLS gate
        // drives one control at the pinned engaged state) take effect.
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'bands') {
            // The fixed-width LUT keeps its texture identity — only the band
            // divisor + the active-texel writes change, so no material rebuild.
            bandCount = clamp(Math.round(num(value, 12)), 1, LUT_W);
            uBands.value = bandCount;
            shearArr = new Float32Array(bandCount);
            (target.userData.pointerGlitchSplit as { uShear: { value: Float32Array } }).uShear.value =
              shearArr;
          }
          apply(lastT);
        },
        dispose: () => {
          if (sheet) {
            if (overlay.parent) overlay.parent.remove(overlay);
            sheet.geometry.dispose();
            (sheet.material as Material).dispose();
            sheet = null;
            for (const c of chrome) {
              // Geometry is the SUBJECT's, shared by reference — never disposed.
              (c.mesh.material as Material).dispose();
            }
            chrome.length = 0;
            subject.visible = prevVisible;
          }
          lutTex.dispose(); // ours — created DataTexture
        },
      };
    },
  ),
};
