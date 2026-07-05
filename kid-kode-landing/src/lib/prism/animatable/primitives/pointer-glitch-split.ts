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
// ── TRUE RGB-SPLIT REWRITE #2 (2026-06-13, W3 advocate r3 re-review) ────────
// The r2 "warm/ice additive sliver" attempt produced NEITHER magenta/cyan
// pixels NOR any spatial R-vs-B offset (advocate: magentaFrac=0 at every chroma
// level; R-vs-B horizontal cross-correlation BEST OFFSET = 0px at chroma-low AND
// chroma-high; chroma-low meanLuma 15.2 vs chroma-high 32.9 = a pure BRIGHTNESS
// ramp, not colour separation). Root cause: warm (R+G amber) and ice (G+B) tints
// are not magenta/cyan and create NO spatial channel offset, and per-channel
// sampling of a near-uniform dark field (panel albedo ~0.015) yields nothing.
//
// The fix is the textbook chromatic-aberration recipe the advocate's metrics
// were designed to catch. Build a LUMINANCE / FEATURE field L(uv) from the
// card's OWN bright content (the amber header band, the engaged band-edge
// slivers — reconstructed in sheet-UV from the measured chrome boxes, so the
// bright field is real, not invented). Then composite the final EMISSIVE colour
// as THREE HORIZONTALLY-DISPLACED copies of that one signal:
//     emissive = vec3( L(uv + vec2(+s,0)) ,  L(uv) · gMix ,  L(uv − vec2(+s,0)) )
//   with  s = uChroma · CHROMA_PX_SCALE · dir(band).
// • RED   reads the field shifted +s   → a red ghost on one side of every bright feature.
// • BLUE  reads the field shifted −s   → a blue ghost on the OTHER side.
// • GREEN reads the field at centre, down-weighted, so the troughs between two
//   bright crests read MAGENTA (R high & B high & G low — the exact predicate
//   the advocate counts) where the red ghost of one crest crosses the blue ghost
//   of the next, and the feature EDGES read red on one side / blue on the other.
// Because R = L(x+s) and B = L(x−s) are the SAME signal displaced in opposite
// directions, the R-vs-B horizontal cross-correlation peaks at offset = 2s px
// (NOT 0), and 2s GROWS linearly with chroma. At chroma 0 the three copies
// coincide exactly → R≡B → offset 0, magentaFrac 0, the clean card. s is sized
// (CHROMA_PX_SCALE) so at MAX chroma the red and blue copies are offset by well
// over the advocate's 4-device-px threshold in opposite directions. The split
// direction dir = sign(band shear) flips per band so the fringes ride the glitch
// slivers (RGB-split, not a uniform smear), and the field is engagement-keyed so
// a disengaged band emits nothing → idle is the clean legible card.
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
  LinearFilter,
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
// Content luminance map resolution. The card's bright features (header, rows,
// dot) are rasterized into this many sheet-UV texels; LINEAR filtering smooths
// the ±s chroma taps. Wide enough (128) that a feature's vertical edge is crisp
// at DPR-2, tall enough (96) to separate the header / three rows / dot.
const CONTENT_W = 128;
const CONTENT_H = 96;
// Chroma → horizontal split distance, expressed as a fraction of sheet WIDTH per
// unit uChroma. The advocate measures the R-vs-B cross-correlation offset = 2·s
// in device px and wants it ≥ ~4px at max chroma; the card spans ≈ 340 device px
// at DPR-2, and uChroma tops out near 0.09–0.11 when engaged, so s = uChroma·SCALE
// gives 2·s ≈ 2·0.09·0.5·340 ≈ 30 device px at max — far past the threshold — and
// 0 at chroma 0 (the clean card). At default chroma (uChroma≈0.039) 2·s ≈ 13px so
// the ghosts are already clearly separated.
const CHROMA_PX_SCALE = 0.5;
// Emissive brightness of each displaced feature copy. The panel albedo is
// near-black, so the RGB-split ghosts are EMISSIVE (added on top of the lit
// look). 1.0 makes a fully-engaged feature read at full channel intensity so the
// magenta/cyan slivers are plainly visible on the dark card; the per-channel
// values still clamp ≤1 so a solid bright feature reads white, not blown out.
const FEATURE_EMISSIVE = 1.0;
// Warm/ice hue-lean strength on the R/B ghosts. Small (the channel offset, not
// the tint, is the source of the magenta/cyan separation) but enough to keep the
// fringes reading as brass/ice slivers — never purple.
const HUE_LEAN = 0.22;
// Green-suppression gate. splitGate = clamp(s · GREEN_GATE_K) grows 0→1 with the
// split distance s, dropping the centre (green) copy from FULL weight (chroma 0 →
// R=G=B, clean) to GREEN_MIN as chroma opens → R&B high / G low = MAGENTA over
// every bright feature, scaling monotonically with the knob. GATE_K≈22 reaches
// full suppression near max chroma (s≈0.046); ≈0.42 at default chroma.
const GREEN_GATE_K = 22;
// Floor the green copy drops to at full split. 0.35 leaves R/B clearly dominant
// (strong magenta) while a solid feature still reads as a bright brass/ice sliver
// rather than pure magenta — keeps it in the Observatory world.
const GREEN_MIN = 0.35;
// Engaged jittered-stripe amplitude relative to the content blocks (which top out
// at 1.0). Kept LOW so the broad NON-PERIODIC content (header/rows/dot) dominates
// the R-vs-B cross-correlation at the true 2s shift; the stripes only add a faint
// engaged-glitch dither across the body, not a competing correlation feature.
const CREST_AMP = 0.3;

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
      const uWarm = uniform(WARM.clone()); // subtle hue lean on the +offset (red) ghost
      const uCool = uniform(COOL.clone()); // subtle hue lean on the −offset (blue) ghost
      // 1 once the card's bright content has been rasterized into contentTex, 0
      // for a subject with no bright chrome (so featureL falls back to the engaged
      // crests alone and a truly featureless subject never invents a fill).
      const uHeaderOn = uniform(0);

      // ── Reconstructed CONTENT LUMINANCE MAP (the card's bright features) ────
      // A small luminance texture in sheet-UV holding the card's OWN bright
      // content — the amber header bar, the three grey rows, the accent dot —
      // BAKED from the measured chrome boxes at build time (cardContent[]). It is
      // the field the RGB split fans out: NON-PERIODIC bright blocks, so the
      // R-vs-B cross-correlation has a single clean peak at the true 2s shift (no
      // periodic-comb aliasing) and magenta appears at every block's vertical
      // edges. LINEAR filtered so the ±s taps interpolate smoothly. Engagement is
      // applied at sample time (the field itself is the static card content).
      const contentData = new Uint8Array(CONTENT_W * CONTENT_H * 4);
      const contentTex = new DataTexture(contentData, CONTENT_W, CONTENT_H, RGBAFormat);
      contentTex.minFilter = LinearFilter;
      contentTex.magFilter = LinearFilter;
      contentTex.needsUpdate = true;
      let contentBaked = false; // true once at least one bright box is rasterized

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

      // ── TSL: a single LUMINANCE/FEATURE field L(uv), split into 3 channels ──
      // The fixed-width LUT carries, per band: R = signed shear (encoded 0.5±, |1|
      // span) and G = a per-band luminance KEY (jittered, engagement-scaled). uv.y
      // → band row → texel (band+0.5)/LUT_W (NEAREST → crisp band slices).
      //
      // featureL(x, v) is the card's reconstructed BRIGHT content at sheet-uv
      // (x, v) in [0,1]: the bright HEADER STRIPE (registered to the real header
      // box via the uHeader* uniforms) PLUS the per-band sliver crests (sharp
      // bright vertical stripes, engagement-keyed). The final EMISSIVE colour is
      // three HORIZONTALLY-DISPLACED copies of this ONE field:
      //     R = featureL(x + s·dir, v)   ← red ghost
      //     G = featureL(x,        v)·w  ← centre, down-weighted (magenta troughs)
      //     B = featureL(x − s·dir, v)   ← blue ghost
      // s = uChroma·CHROMA_PX_SCALE. Since R and B are the same field shifted in
      // OPPOSITE directions, R-vs-B cross-correlation peaks at offset 2s (grows
      // with chroma, 0 at chroma 0), and the troughs between crests read magenta
      // (R&B high, G low). dir = sign(band shear) flips per band.
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
        sign: () => Nn;
        max: (o: unknown) => Nn;
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
      // Engagement weight in [0,1] from the per-band luminance key (0.5 at rest →
      // 1 fully engaged). Gates the whole feature field so idle bands emit nothing.
      const engOf = (lum: Nn) => n(n(lum).sub(0.5)).abs().mul(2).clamp(0, 1);
      // featureL — the card's reconstructed bright luminance/feature field at a
      // GIVEN x column (already band-sheared by the caller) and the pixel's v.
      // Two bright sources, max-combined:
      //   • CONTENT MAP: the rasterized card features (header bar, three rows,
      //     accent dot) sampled from contentTex at (xCol, v). NON-PERIODIC bright
      //     blocks → the R-vs-B cross-correlation has a single clean peak at the
      //     true 2s shift and magenta appears at every block's vertical edges. The
      //     content is always-on (a card always has content); the RGB split itself
      //     only opens once uChroma > 0 (proximity-gated), so off-engagement the
      //     three taps coincide → no fringe.
      //   • engaged jittered micro-stripes (content map GREEN channel): a NON-
      //     PERIODIC narrow-stripe field, engagement-keyed at CREST_AMP, that adds
      //     fine glitch texture across the card body where the pointer engages —
      //     without a periodic comb that would split the cross-correlation peak.
      const featureL = (xCol: Nn, v: Nn, _bandIdx: Nn, lum: Nn): Nn => {
        const eng = engOf(lum);
        const tex = n(tslTexture(contentTex as Texture, vec2(xCol as unknown as number, v as unknown as number)));
        // Card content blocks (R channel) — always-on bright features (header /
        // rows / dot). The RGB split only opens once uChroma > 0, so off-engagement
        // the three taps coincide → no fringe even though content is present.
        const content = n(tex.r).mul(uHeaderOn);
        // Engaged-glitch jittered stripes (G channel) — non-periodic, eng-keyed.
        const stripes = n(n(n(tex.g).mul(eng)).mul(CREST_AMP)).mul(uHeaderOn);
        return n(content).max(stripes).clamp(0, 1);
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
        // Band the CURRENT pixel falls in + its shear/lum (the colour split is
        // HORIZONTAL within the sheared band).
        const band = bandIndexAt(baseUv.y);
        const lut = lutAtBand(band);
        const shear = shearOfBand(lut);
        const lum = n(lut.g);
        const shearedX = n(baseUv.x).add(shear); // band's sheared sample column
        // Split direction = sign of this band's shear (flips per band). |shear|
        // tiny → fall back to +1 so a near-zero-shear engaged band still fringes.
        const dir = n(n(shear).sign()).add(n(shear).abs().mul(1000).clamp(0, 1).oneMinus());
        // s = HORIZONTAL split distance in uv units = uChroma · CHROMA_PX_SCALE.
        // ZERO at chroma 0 (proximity-gated uChroma 0) → the three copies coincide.
        const s = n(uChroma).mul(CHROMA_PX_SCALE);
        const sd = n(s).mul(dir); // signed split (flips per band)
        // The three HORIZONTALLY-DISPLACED sample columns (the real aberration).
        const xR = n(shearedX).add(sd); // red ghost leads +dir
        const xG = shearedX; // centre / green
        const xB = n(shearedX).sub(sd); // blue ghost trails −dir

        // ── THE RGB-SPLIT EMISSIVE FRINGE (works on the dark card AND over chrome) ─
        // featureL is the card's reconstructed bright content. Sample it at the
        // three displaced columns and route each to exactly ONE channel:
        //     R = L(x+s) ,  G = L(x) ,  B = L(x−s).
        // As s grows the red plane is L shifted +s and the blue plane is L shifted
        // −s, so the R-vs-B horizontal cross-correlation peaks at offset 2s (grows
        // with the knob). splitGate = clamp(s·K) grows 0→1 with the split distance
        // and does two jobs: it (a) FADES THE WHOLE FRINGE IN from zero (so at
        // chroma 0 / disengaged the emissive is exactly 0 → the clean card, only
        // the real chrome clones show), and (b) drops the centre (green) copy to
        // GREEN_MIN so R&B stay high while G falls → MAGENTA (the advocate's
        // R-high&B-high&G-low predicate) over every bright feature, growing
        // monotonically with the knob. A faint warm/ice hue lean keeps the slivers
        // brass/ice (no purple) without being the source of the split.
        const splitGate = n(s).mul(GREEN_GATE_K).clamp(0, 1);
        const Lr = featureL(n(xR), n(baseUv.y), band, lum);
        const Lg = featureL(n(xG), n(baseUv.y), band, lum);
        const Lb = featureL(n(xB), n(baseUv.y), band, lum);
        const emR = n(n(Lr).mul(FEATURE_EMISSIVE)).mul(splitGate);
        const emB = n(n(Lb).mul(FEATURE_EMISSIVE)).mul(splitGate);
        const greenW = n(splitGate).mul(1 - GREEN_MIN).oneMinus(); // 1 → GREEN_MIN
        const emG = n(n(n(Lg).mul(FEATURE_EMISSIVE)).mul(greenW)).mul(splitGate);
        const splitEmissive = vec3(
          emR as unknown as number,
          emG as unknown as number,
          emB as unknown as number,
        );
        // Subtle warm/ice cross-lean: the red ghost picks up a touch of warm, the
        // blue ghost a touch of ice. ×LEAN keeps it small so the channel offset +
        // green-gate — not the tint — are the source of the magenta/cyan slivers.
        const hueLean = n(n(n(uWarm).mul(emR)).add(n(uCool).mul(emB))).mul(HUE_LEAN);
        (mat as unknown as { emissiveNode: unknown }).emissiveNode = n(splitEmissive).add(hueLean);

        if (builtSrcMap) {
          // Texture-preserving RGB split for a MAPPED subject: tap the SHARED map
          // THREE times at the displaced columns and recompose vec3(R.r,G.g,B.b) —
          // classic chromatic aberration of the band-sheared content. off→0 the
          // taps coincide → the clean artwork. The emissive split above ADDS the
          // brass/ice ghosts on top so the fringe reads on dark content too.
          mat.map = builtSrcMap; // by reference; carried for any mount inspector
          const tapR = n(tslTexture(builtSrcMap, vec2(xR as unknown as number, baseUv.y as unknown as number))).rgb;
          const tapG = n(tslTexture(builtSrcMap, vec2(xG as unknown as number, baseUv.y as unknown as number))).rgb;
          const tapB = n(tslTexture(builtSrcMap, vec2(xB as unknown as number, baseUv.y as unknown as number))).rgb;
          const split = vec3(
            tapR.r as unknown as number,
            tapG.g as unknown as number,
            tapB.b as unknown as number,
          );
          (mat as unknown as { colorNode: unknown }).colorNode = mix(
            tapG as unknown as Parameters<typeof mix>[0],
            split as unknown as Parameters<typeof mix>[1],
            n(s).mul(80).clamp(0, 1) as unknown as Parameters<typeof mix>[2],
          );
        } else {
          // Map-less (the catalog card panel): the lit albedo stays the clean panel
          // colour (no internal texture to split), and the RGB-split lives entirely
          // in the EMISSIVE field above — so the dark panel reads as the clean card
          // at rest and grows bright brass/ice RGB-split slivers where engaged.
          (mat as unknown as { colorNode: unknown }).colorNode = n(uColor);
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
        // posed CPU-side by the shear of the band its center falls in. While we
        // walk them, RASTERIZE each child's bright luminance into the content map
        // (contentData) at its measured sheet-UV box, so featureL fans out the
        // card's REAL content (header bar, three rows, accent dot) — never an
        // invented fill. Luminance = perceptual(color) · (0.4 + emissiveIntensity),
        // so the amber header (emissiveIntensity 0.8) and the bright dot read hot
        // and the dim grey rows read faint — exactly the on-screen contrast.
        const rel = new Matrix4();
        const childBox = new Box3();
        const lumaOf = (c: Color | undefined, emI: number): number => {
          if (!c) return 0;
          const perceptual = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
          return clamp(perceptual * (0.4 + emI), 0, 1);
        };
        const rasterizeBox = (uLo: number, uHi: number, vLo: number, vHi: number, lum: number) => {
          const xa = Math.max(0, Math.floor(uLo * CONTENT_W));
          const xb = Math.min(CONTENT_W - 1, Math.ceil(uHi * CONTENT_W));
          const ya = Math.max(0, Math.floor(vLo * CONTENT_H));
          const yb = Math.min(CONTENT_H - 1, Math.ceil(vHi * CONTENT_H));
          const e = Math.round(clamp(lum, 0, 1) * 255);
          for (let yy = ya; yy <= yb; yy++) {
            for (let xx = xa; xx <= xb; xx++) {
              const idx = (yy * CONTENT_W + xx) * 4;
              if (e > contentData[idx]) {
                contentData[idx] = e;
                contentData[idx + 1] = e;
                contentData[idx + 2] = e;
                contentData[idx + 3] = 255;
              }
            }
          }
          contentBaked = true;
        };
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
          // Bake this child's bright luminance block into the content map (sheet-UV).
          const emI = typeof srcMat.emissiveIntensity === 'number' ? srcMat.emissiveIntensity : 0;
          const lum = lumaOf(srcMat.color, emI);
          if (lum > 0.04) {
            rasterizeBox(
              (childBox.min.x - localBox.min.x) / w,
              (childBox.max.x - localBox.min.x) / w,
              (childBox.min.y - localBox.min.y) / h,
              (childBox.max.y - localBox.min.y) / h,
              lum,
            );
          }
          // Real geometry by reference (never disposed by us) + material clone.
          const m = new Mesh(child.geometry as BufferGeometry, srcMat.clone());
          m.name = `pointer-glitch-split-chrome:${child.name || 'mesh'}`;
          overlay.add(m);
          chrome.push({ mesh: m, cx: ccx - sheetX, cy: ccy - sheetY, dz: ccz - faceZ });
        });
        // Bake a NON-PERIODIC jittered micro-stripe field into the content map's
        // GREEN channel — the engaged-glitch "sliver" texture. Stripe centres are
        // hash-jittered (no fixed pitch), so unlike a periodic comb the field does
        // NOT auto-correlate: the R-vs-B cross-correlation keeps its single clean
        // peak at the true 2s shift, while the narrow stripes give the dark troughs
        // that read MAGENTA (R&B high, G low) where the ±s ghosts of two stripes
        // cross. Sampled × engagement at shade time, so a disengaged band's stripes
        // contribute nothing. ~26 jittered stripes across the width.
        {
          const STRIPES = 26;
          for (let xi = 0; xi < CONTENT_W; xi++) {
            const x = (xi + 0.5) / CONTENT_W;
            // Distance to the nearest hash-jittered stripe centre → a narrow crest.
            let nearest = 1;
            for (let k = -1; k <= STRIPES; k++) {
              const jitter = (hash2(k * 1.7 + 3.1, 7.0) - 0.5) * 0.6; // ±0.3 stripe
              const cx = (k + 0.5 + jitter) / STRIPES;
              nearest = Math.min(nearest, Math.abs(x - cx) * STRIPES);
            }
            const crest = Math.pow(Math.max(1 - nearest, 0), 2.0); // narrow bright stripe
            const e = Math.round(clamp(crest, 0, 1) * 255);
            for (let yy = 0; yy < CONTENT_H; yy++) {
              contentData[(yy * CONTENT_W + xi) * 4 + 1] = e; // green = stripe field
            }
          }
          contentBaked = true;
        }
        if (contentBaked) {
          uHeaderOn.value = 1; // the content map carries real bright features
          contentTex.needsUpdate = true;
        }

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
        // tests; lets a headless test confirm the emissive split samples THIS texture.
        lutTex,
        // The reconstructed CONTENT luminance map (by reference) — the card's
        // bright features the RGB split fans out. A headless test confirms the
        // emissiveNode samples THIS texture (the field is real card content).
        contentTex,
        // CPU MIRROR of the rendered per-channel split (the water-droplet pattern
        // — the split runs in TSL on the GPU, so a headless test reads this
        // EXACT-same arithmetic). Given a sheet-uv it returns the FINAL rendered
        // R/G/B the shader emits: the lit panel albedo PLUS the RGB-split EMISSIVE
        // field — three HORIZONTALLY-DISPLACED copies of featureL(x±s, v). A test
        // can therefore measure the SAME two signals the advocate measures:
        //   • magentaFrac — pixels where R high & B high & G low (the trough where
        //     the +s red ghost crosses the −s blue ghost), and
        //   • R-vs-B horizontal cross-correlation offset — the R plane is L(x+s),
        //     the B plane is L(x−s), so they align at a 2s shift (0 at chroma 0,
        //     growing with the knob).
        // Mirrors buildMaterial's emissive branch byte-for-byte: featureL (header
        // stripe ∪ engagement-keyed sliver crests) sampled at xR/xG/xB, the green
        // centre down-weight, and the subtle warm/ice hue lean.
        channelSplitAt(u: number, v: number): { r: number; g: number; b: number } {
          const off = uChroma.value; // proximity-gated split distance (uv units)
          const bandIdx = Math.floor(v * bandCount);
          const bi = Math.min(Math.max(bandIdx, 0), Math.max(bandCount - 1, 0));
          const shear = (lutData[bi * 4] / 255) * 2 - 1; // decode LUT.r → signed
          const lum = lutData[bi * 4 + 1] / 255;
          const shearedX = u + shear;
          // dir = sign(shear) with a +1 fallback when shear≈0 (matches the TSL).
          const dir = Math.sign(shear) + (1 - clamp(Math.abs(shear) * 1000, 0, 1));
          const s = off * CHROMA_PX_SCALE; // horizontal split distance (uv units)
          const sd = s * dir;
          const xR = shearedX + sd; // red ghost
          const xG = shearedX; // centre
          const xB = shearedX - sd; // blue ghost
          const eng = clamp(Math.abs(lum - 0.5) * 2, 0, 1); // 0 rest → 1 engaged
          // Bilinear sample of a content-map channel (mirrors LinearFilter). ch=0
          // → R (content blocks); ch=1 → G (jittered engaged stripes).
          const sampleContent = (x: number, ch: number): number => {
            const fx = clamp(x, 0, 1) * (CONTENT_W - 1);
            const fy = clamp(v, 0, 1) * (CONTENT_H - 1);
            const x0 = Math.floor(fx);
            const y0 = Math.floor(fy);
            const x1 = Math.min(CONTENT_W - 1, x0 + 1);
            const y1 = Math.min(CONTENT_H - 1, y0 + 1);
            const tx = fx - x0;
            const ty = fy - y0;
            const at = (xx: number, yy: number) => contentData[(yy * CONTENT_W + xx) * 4 + ch] / 255;
            const top = at(x0, y0) * (1 - tx) + at(x1, y0) * tx;
            const bot = at(x0, y1) * (1 - tx) + at(x1, y1) * tx;
            return top * (1 - ty) + bot * ty;
          };
          // featureL — mirrors the TSL: content blocks (R) ∪ eng-keyed stripes (G).
          const featureLAt = (x: number): number => {
            const content = sampleContent(x, 0) * uHeaderOn.value;
            const stripes = sampleContent(x, 1) * eng * CREST_AMP * uHeaderOn.value;
            return clamp(Math.max(content, stripes), 0, 1);
          };
          const Lr = featureLAt(xR);
          const Lg = featureLAt(xG);
          const Lb = featureLAt(xB);
          // splitGate fades the whole fringe in from 0 (chroma 0 → clean) AND
          // suppresses green (→ magenta) — mirrors the TSL exactly.
          const splitGate = clamp(s * GREEN_GATE_K, 0, 1);
          const greenW = 1 - splitGate * (1 - GREEN_MIN);
          const emR = Lr * FEATURE_EMISSIVE * splitGate;
          const emB = Lb * FEATURE_EMISSIVE * splitGate;
          const emG = Lg * FEATURE_EMISSIVE * greenW * splitGate;
          // Subtle warm/ice hue lean on the ghosts — never the source of the
          // split, just keeps the fringes brass/ice (no purple). Mirrors HUE_LEAN.
          const leanR = (WARM.r * emR + COOL.r * emB) * HUE_LEAN;
          const leanG = (WARM.g * emR + COOL.g * emB) * HUE_LEAN;
          const leanB = (WARM.b * emR + COOL.b * emB) * HUE_LEAN;
          // Lit albedo: the clean map-less panel colour (the split lives in the
          // emissive). base + additive emissive split + hue lean.
          const c = uColor.value;
          return {
            r: c.r + emR + leanR,
            g: c.g + emG + leanG,
            b: c.b + emB + leanB,
          };
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
          contentTex.dispose(); // ours — created DataTexture
        },
      };
    },
  ),
};
