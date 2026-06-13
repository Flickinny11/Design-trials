// crt-warp — the surface becomes an old CRT: the glass barrel-curves gently
// (centre domes toward the camera, corners pinch back), fine scanlines drift
// across it, a slow brighter band rolls down the tube each loop, and the curved
// corners fall into a faint vignette — retro phosphor warmth riding OVER the
// real content. MEDIUM / displacement / GPU vertex-lane + composite TSL.
//
// TECHNIQUE: DESIGN-REFERENCES §11 "Fisheye / Lens Distortion" (barrel/fisheye
// family) fused with the §11 scanline composite class (the VFX-JS 'halftone' /
// retro preset, §1 @vfx-js/core) — implemented NATIVELY in TSL on our
// three/webgpu stack (no curtains.js / VFX-JS DOM dependency). The barrel
// curve is the geometric half (vertex dome + matching UV warp); the scanline
// roll / rolling band / vignette are the phosphor composite half, ALL of which
// MULTIPLY the subject's own colours (warm-biased, never grey-out, no purple).
//
// THE WAVE DIFFERENTIATOR — the 21 existing 'displacement' primitives SWAP
// subject.material for their own look (so 'displacement' sits in
// UNMOUNTABLE_CATEGORIES). crt-warp PRESERVES the subject's own look and
// declares mountable:true, so the AI builder can drop a CRT treatment on ANY
// mounted element:
//   - A subdivided SHEET overlay stands in for the subject (the
//     scroll-stagger-rise / cylinder-unroll hide-overlay-restore discipline):
//     the real subject is hidden while active and restored on dispose(). The
//     sheet carries the subject's OWN look — when the live material has .map,
//     the texture is SHARED BY REFERENCE and sampled with BARREL-WARPED UVs
//     (the curtains-class move); when map-less, the subject's color AND PBR
//     scalars (roughness/metalness/envMapIntensity/emissive) are copied onto a
//     node material so it shades identically under the rig lights. NEVER an
//     invented flat fill.
//   - The phosphor composite (scanlines × rolling band × vignette) is a SINGLE
//     warm-biased multiplier on the sampled colour: off-band it sits near 1, so
//     the content stays primary and fully legible; the band only brightens.
//
// HOW THE BARREL BENDS (analytic field F shared sheet + chrome, vertex lane +
// CPU mirror):
//   - Normalize each vertex to nx,ny in [-1..1] across the sheet. The dome
//     lift = curvature * (1 - (nx² + ny²)) pushes the centre toward the camera
//     (+z) and pinches the corners back (negative at the corners). The UVs
//     contract toward centre by the same radial factor so the sampled artwork
//     stretches over the curved glass exactly like a real tube. The analytic
//     bent normal (slope of the dome in x and y) feeds normalNode so the curve
//     SHADES honestly under the rig key light (a z-only bump face-on is nearly
//     invisible — the shading is what reads).
//   - CHROME CHILDREN (the catalog card's brass header / grey rows / violet
//     dot) are CLONED onto the overlay and posed CPU-side: each clone's centre
//     is evaluated through the SAME F (dome lift + radial UV-style contraction
//     for placement), so the full card look rides the barrel (a blank deformed
//     slab = task failure). Clones share the child geometry BY REFERENCE + a
//     material clone (ours); the subject's own chrome is never mutated. Chrome
//     footprints are small relative to the curve, so a rigid co-pose at the
//     centre is visually exact (subdividing the dot through the bend would
//     distort it — the cylinder-unroll rigid-clone lesson).
//
// TIME RIG: defaultDriver 'time', duration Infinity (a continuous loop). The
// rolling band's phase uRoll loops 0→1 every `rollSpeed` loop-period; uTime
// drives the scanline drift. The idle frame (t=0) parks the band at the top and
// scanlines at their rest phase, and because every composite term sits near 1
// off-band the subject is FULLY LEGIBLE and essentially undistorted at rest.
//
// DISTINCT FROM NEIGHBORS: chromatic-aberration is a STATIC physical-glass RGB
// fringe that SWAPS the material (unmountable, no geometry change); crt-warp is
// a GEOMETRIC barrel curve + an ANIMATED scanline roll that PRESERVES the
// subject texture (mountable). The pointer-glitch-split sibling shears
// pointer-LOCAL bands keyed to cursor proximity; crt-warp is an ALLOVER,
// ambient, time-driven retro treatment with no pointer dependency — the whole
// tube curves and rolls regardless of where the cursor is.

import {
  Box3,
  Color,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  PlaneGeometry,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  abs as tslAbs,
  clamp as tslClamp,
  cos,
  faceDirection,
  float,
  max as tslMax,
  mix,
  pow,
  positionLocal,
  sin,
  transformNormalToView,
  uniform,
  uv,
  vec2,
  vec3,
  texture as tslTexture,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { clamp, num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  // Barrel curvature: how strongly the glass domes toward the camera at centre
  // and pinches the corners back. A FRACTION of the sheet's half-span (scale-
  // free), so it reads the same on a catalog card and a mounted hero.
  { id: 'curvature', label: 'Barrel Curve', type: 'knob', min: 0, max: 0.6, step: 0.01, default: 0.22 },
  // Scanline density — number of horizontal phosphor lines across the surface.
  // Scoped to a range where every line is INDIVIDUALLY RESOLVABLE on a card-
  // sized panel at DPR-2 (~290px tall = ~36px..~6px line period across 8→48
  // lines). The old 40→220 range packed 1–7px lines that aliased to a uniform
  // grey below the sample resolution — both extremes rendered identically, so
  // the count knob read DEAD. A countable grille that visibly thickens low→high
  // is also the premium CRT read (distinct phosphor ridges, not a flat haze).
  { id: 'scanlines', label: 'Scanlines', type: 'knob', min: 8, max: 48, step: 1, default: 24 },
  // Scanline strength — luminance modulation depth. LOW by design so the
  // content stays primary (a faint phosphor grille, not a blackout grid).
  { id: 'scanStrength', label: 'Scan Strength', type: 'fader', min: 0, max: 0.5, step: 0.01, default: 0.16 },
  // Roll speed — loops of the rolling brighter band per LOOP_BASE seconds.
  { id: 'rollSpeed', label: 'Roll Speed', type: 'fader', min: 0.1, max: 1.5, step: 0.05, default: 0.5 },
] as const;

// Base loop period (seconds) for one full roll-band traversal at rollSpeed = 1.
const LOOP_BASE = 4;
// Sheet subdivision — fine enough that the barrel dome reads as a smooth curve.
const SEG = 48;
// Scanline drift speed (rows/sec scroll of the line phase) — slow, retro.
const SCAN_DRIFT = 0.6;
// Scanline ridge sharpness (pow gamma on the raised sine). >1 narrows the dark
// trough into a crisp phosphor ridge with a wide bright gap, so each line stays
// resolvable at DPR-2 and the line COUNT is a visible difference (a soft sine,
// gamma=1, averages to the same grey at every frequency → a dead count knob).
const SCAN_GAMMA = 3;
// Additive phosphor-glow gain: how brightly each scanline EMITS at full
// scanStrength. The glow is what makes the grille (and therefore the line-COUNT
// knob) read on the near-black card panel — a pure dimming multiply on a
// luma-16 surface is sub-noise. Tuned so the lines glow distinctly without
// washing out the content between them.
const SCAN_GLOW_GAIN = 1.5;
// Rolling band half-width as a fraction of the surface height, and its peak
// brightening gain. Kept gentle so the band reads as a soft brighter sweep.
const BAND_HALF = 0.09;
const BAND_GAIN = 0.32;
// Vignette: how far in from the curved corners the darkening reaches, and depth.
const VIGNETTE_RADIUS = 1.18;
const VIGNETTE_DEPTH = 0.22;
// Warm phosphor tint multiplied into the scanline+band composite (Observatory-
// Brass world — warm bone/brass, NEVER purple, never a flat grey-out).
const PHOSPHOR = new Color('#ffe7c4');
// Fallback whole-subject CRT "breathe" amplitude (no overlay possible).
const BREATHE_AMP = 0.02;

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

/** A chrome child cloned onto the barrel, rigidly co-posed per seek by a CPU
 *  mirror of the dome. Offsets are in the SHEET's frame: ox/oy from the sheet
 *  centre, dz proud of the sheet surface. */
interface ChromeClone {
  mesh: Mesh;
  ox: number;
  oy: number;
  dz: number;
}

export const crtWarpPrimitive: PrimitiveDefinition = {
  name: 'crt-warp',
  label: 'CRT Warp',
  category: 'displacement',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  mountable: true,
  schema: SCHEMA,
  description:
    'The surface becomes an old CRT — barrel-curved glass, drifting scanlines, and a slow rolling flicker band — retro phosphor warmth over the real content.',
  create: defineAnimatable(
    { name: 'crt-warp', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;

      const repMesh = findRepresentativeMesh(subject);
      /** The representative mesh's CURRENT first material — read live, never
       *  cached: the mounted plane factory pours `.map` ASYNCHRONOUSLY and
       *  applyImageSpec may swap the material after this primitive attaches. */
      const liveSourceMaterial = (): MappedMaterial | null => {
        if (!repMesh) return null;
        const m = repMesh.material;
        return ((Array.isArray(m) ? m[0] : m) as MappedMaterial | undefined) ?? null;
      };

      // ── Measure in the subject's OWN local frame (no hardcoded units) ────
      // GEOMETRY-BASED (the cylinder-unroll genie-suck lesson): each mesh's
      // geometry bbox is mapped mesh-local → subject-local directly — a
      // world-AABB route double-inflates whenever the subject is tilted at
      // measure time. The sheet's w/h covers the UNION of all meshes; its face
      // z comes from the REPRESENTATIVE mesh (chrome proud of the face must not
      // push the sheet forward off the panel).
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

      // ── Fallback state (whole subject "breathes" — never placeholder geo) ─
      const baseScale = subject.scale.clone();
      const prevVisible = subject.visible;

      // ── Barrel uniforms (one graph serves the sheet + every chrome clone) ─
      const uTime = uniform(0);
      const uCurvature = uniform(num(params.curvature, 0.22)); // fraction of half-span
      const uLineCount = uniform(num(params.scanlines, 24));
      const uScanStrength = uniform(num(params.scanStrength, 0.16));
      const uRollSpeed = uniform(num(params.rollSpeed, 0.5));
      const uRoll = uniform(0); // rolling-band phase 0..1 (published for tests)
      const uHalfW = uniform(0.5); // sheet half-extents in subject-local units
      const uHalfH = uniform(0.5);
      const uColor = uniform(new Color('#ffffff')); // map-less fallback tint
      const uPhosphor = uniform(PHOSPHOR.clone());
      // The subject's OWN emissive (color × intensity), tracked so the additive
      // glow ADDS to it rather than replacing it — emissiveNode overrides the
      // material's emissive×emissiveIntensity product entirely, so we fold the
      // source's emissive back in here to preserve the subject's own phosphor.
      const uBaseEmissive = uniform(new Color('#000000'));

      // Sheet extents (subject-local), filled when the overlay is built.
      let halfW = 0.5;
      let halfH = 0.5;
      let sheetX = 0;
      let sheetY = 0;
      let faceZ = 0;

      // ── The TSL barrel field (built ONCE, shared sheet + chrome) ─────────
      // Normalize the vertex to [-1..1] across the sheet. r2 = nx² + ny².
      const nx = positionLocal.x.div(tslMax(uHalfW, float(1e-3)));
      const ny = positionLocal.y.div(tslMax(uHalfH, float(1e-3)));
      const r2 = nx.mul(nx).add(ny.mul(ny));
      // Dome lift: centre (r2=0) lifts by +curvature*halfSpan toward camera,
      // corners (r2≈2) pinch back. Expressed in subject-local z units via the
      // mean half-span so the relief scales with the artifact.
      const halfSpan = tslMax(uHalfW, uHalfH);
      const domeRel = float(1).sub(r2); // +1 centre → −1 corner
      const lift = uCurvature.mul(halfSpan).mul(domeRel);
      // Analytic bent normal: the dome's slope. ∂lift/∂x ∝ -2*nx*curvature etc.
      // (sign carried so the curve shades; magnitude is a readable approximation
      // — the curve only needs to catch the key light, not be metrologically
      // exact). normalize via vec3(...).normalize().
      const slopeK = uCurvature.mul(float(2));
      const bentNormal = vec3(
        nx.mul(slopeK),
        ny.mul(slopeK),
        float(1),
      ).normalize();
      // Z-aware bend (chrome co-treatment): surface point at localZ = 0 plus the
      // vertex's own proud height along the bent normal — geometry proud of the
      // face (chrome bars) stays proud of the CURVED glass. For the sheet
      // (localZ = 0) this is the identity of the dome.
      const surfacePos = vec3(positionLocal.x, positionLocal.y, lift);
      const bentPos = (
        surfacePos as unknown as { add: (o: unknown) => unknown }
      ).add((bentNormal as unknown as { mul: (o: unknown) => unknown }).mul(positionLocal.z));
      // Custom normalNode bypasses three's automatic DoubleSide back-face flip —
      // multiply by faceDirection so both sides shade honestly.
      const bentNormalView = (
        transformNormalToView(bentNormal).normalize() as unknown as {
          mul: (n: unknown) => unknown;
        }
      ).mul(faceDirection);

      // ── Barrel-warped UV sampling (curtains-class move) ──────────────────
      // Contract the UVs toward centre by the same radial factor, so the
      // sampled artwork stretches over the curved glass like a real tube.
      const u0 = uv();
      const cuv = u0.sub(vec2(0.5, 0.5));
      const ruv2 = cuv.x.mul(cuv.x).add(cuv.y.mul(cuv.y));
      // distort = 1 - curvature * r²  (centre ~1, edges contract inward).
      const distort = float(1).sub(uCurvature.mul(ruv2).mul(float(2.2)));
      const warpedUv = vec2(0.5, 0.5).add(cuv.mul(distort));

      // ── The phosphor composite — a warm MULTIPLIER plus an ADDITIVE glow ──
      // scanlines: a CRISP phosphor grille of uLineCount horizontal ridges.
      // Phase = uv.y * lineCount * 2π + drift → one cycle per line. We SHARPEN
      // the raised sine into a defined ridge with a pow() gamma — a soft sine
      // packs no resolvable edge and averages to the same grey at every
      // frequency (the original DEAD-knob root cause); a sharpened ridge keeps
      // each line distinct.
      //
      // WHY THE KNOB STAYED DEAD AFTER the range retune (r1): the grille was
      // only ever a MULTIPLY that DIMMED the base colour. The card panel is
      // near-black (#1d212b, luma ~16), so dimming it 16% is a sub-noise pixel
      // change — invisible at DPR-2 — and a denser-but-invisible grille is
      // still invisible, so changing the line COUNT moved nothing measurable.
      // THE WIRE FIX: the phosphor lines now EMIT light (an additive emissive
      // glow on emissiveNode) instead of only subtracting it. Bright warm
      // ridges READ on a dark tube regardless of base luminance, and a denser
      // grille = visibly more glowing lines. The COUNT knob therefore changes
      // the rendered surface at the engaged pose by construction.
      const TWO_PI = float(Math.PI * 2);
      const scanPhase = warpedUv.y.mul(uLineCount).mul(TWO_PI).add(uTime.mul(float(SCAN_DRIFT * Math.PI * 2)));
      // sin → [-1..1]; raise to [0..1] (1 between lines, 0 on the dark ridge).
      const scanRaw = sin(scanPhase).mul(0.5).add(0.5); // 0..1
      // Gamma > 1 narrows the dark line into a crisp ridge and widens the bright
      // gap — a phosphor grille rather than a faint sinusoidal haze. The ridge
      // edges survive DPR-2 sampling, so a denser grille reads as visibly more
      // (and thinner) lines instead of aliasing to a uniform tone.
      const scanDip = pow(scanRaw, float(SCAN_GAMMA)); // 0..1, sharpened
      const scan = float(1).sub(uScanStrength.mul(float(1).sub(scanDip)));
      // The glowing phosphor line: the COMPLEMENT of the dip (bright ON the
      // ridge, dark in the gap), so emissive light is concentrated into the
      // narrow line. pow with a slightly tighter gamma sharpens the emitted
      // ridge so each line is a crisp glowing stripe, not a soft haze.
      const scanLine = pow(scanRaw.oneMinus(), float(SCAN_GAMMA)); // 0..1, bright on the line
      // rolling band: a soft brighter sweep at vertical position uRoll, gaussian-
      // ish falloff over BAND_HALF. uRoll travels top(0)→bottom(1) each loop.
      const bandDist = tslAbs(warpedUv.y.oneMinus().sub(uRoll)); // 0 at the band centre
      const bandFall = tslClamp(float(1).sub(bandDist.div(float(BAND_HALF))), 0, 1);
      const band = float(1).add(bandFall.mul(bandFall).mul(float(BAND_GAIN)));
      // vignette: darken toward the curved corners (radial in warped uv).
      const vig = float(1).sub(
        tslClamp(ruv2.mul(float(2)).div(float(VIGNETTE_RADIUS)), 0, 1).mul(float(VIGNETTE_DEPTH)),
      );
      // Composite multiplier, warm-biased: lerp white→phosphor by how much the
      // scanline/vignette pull below 1, so the dimmed lines read warm rather
      // than grey. The band is a clean brightening on top.
      const dim = scan.mul(vig); // ≤ 1
      const tint = mix(vec3(1, 1, 1), uPhosphor, float(1).sub(dim).mul(float(2.2)).clamp(0, 1));
      const phosphorMul = vec3(dim, dim, dim).mul(tint).mul(band);
      // ── Additive emissive phosphor glow (the WIRE that makes the grille READ
      // on a dark tube). The glowing lines emit warm phosphor light, scaled by
      // scanStrength (depth knob) × the rolling band (brighter under the sweep)
      // × the vignette (corners fall dark). SCAN_GLOW_GAIN tops out the lift so
      // the lines glow distinctly without blowing out legibility of the content.
      const scanGlow = scanLine
        .mul(uScanStrength)
        .mul(float(SCAN_GLOW_GAIN))
        .mul(band)
        .mul(vig);
      // ADD the glowing grille ON TOP of the subject's own emissive (folded into
      // uBaseEmissive), so the subject's phosphor lift survives the emissiveNode
      // override and the scanlines glow over it. (Cast convention as elsewhere in
      // this file: vec3-on-vec3 node arithmetic that the TSL .d.ts narrows too
      // tightly to AnyNumber.)
      const phosphorEmissive = (
        uBaseEmissive as unknown as { add: (o: unknown) => unknown }
      ).add(uPhosphor.mul(scanGlow));

      // ── Overlay sheet (scroll-stagger-rise hide/overlay pattern) ─────────
      const overlay = new Group();
      overlay.name = 'crt-warp-overlay';
      let sheet: Mesh | null = null;
      const chrome: ChromeClone[] = [];

      // What the current sheet material was built FROM — compared against the
      // live source each seek (async texture pour / material swap → rebuild).
      let builtSrcMat: MappedMaterial | null = null;
      let builtSrcMap: Texture | null = null;

      /** Build a node material carrying the subject's OWN look: colorNode
       *  samples the live texture (through the barrel-warped UV) by reference,
       *  or the live color via the tracked uColor uniform — never an invented
       *  fill. The phosphor composite multiplies that base. PBR scalars are
       *  copied so the sheet shades identically under the rig lights. */
      const buildMaterial = (): MeshStandardNodeMaterial => {
        const src = liveSourceMaterial();
        builtSrcMat = src;
        builtSrcMap = (src?.map as Texture | null | undefined) ?? null;
        const mat = new MeshStandardNodeMaterial();
        if (src) {
          if (typeof src.roughness === 'number') mat.roughness = src.roughness;
          if (typeof src.metalness === 'number') mat.metalness = src.metalness;
          if (typeof src.envMapIntensity === 'number') mat.envMapIntensity = src.envMapIntensity;
          if (src.emissive) mat.emissive.copy(src.emissive);
          if (typeof src.emissiveIntensity === 'number') {
            mat.emissiveIntensity = src.emissiveIntensity;
          }
          // Fold the subject's own emissive (color × intensity) into the base
          // term of the additive glow node — emissiveNode below overrides the
          // material's emissive product, so this preserves the subject's lift.
          const srcEmInt = typeof src.emissiveIntensity === 'number' ? src.emissiveIntensity : 1;
          if (src.emissive) {
            uBaseEmissive.value.copy(src.emissive).multiplyScalar(srcEmInt);
          } else {
            uBaseEmissive.value.setRGB(0, 0, 0);
          }
          mat.opacity = src.opacity;
          mat.transparent = src.transparent || src.opacity < 1;
          if (src.color) uColor.value.copy(src.color);
        }
        mat.side = DoubleSide; // the curved glass shows its back near the corners
        const base = builtSrcMap
          ? (tslTexture(builtSrcMap, warpedUv) as unknown as { rgb: unknown }).rgb
          : uColor;
        const m = mat as unknown as {
          colorNode: unknown;
          emissiveNode: unknown;
          positionNode: unknown;
          normalNode: unknown;
        };
        // The phosphor multiplier rides OVER the subject's own colour.
        m.colorNode = (base as unknown as { mul: (o: unknown) => unknown }).mul(phosphorMul);
        // The glowing scanline grille EMITS warm phosphor light on top — this is
        // what makes the lines (and the line-COUNT knob) read on the near-black
        // tube. emissiveIntensity is forced to 1 so the node drives the glow
        // amplitude directly (the source's own emissive lift, if any, was already
        // folded into emissive/emissiveIntensity above and shows through the
        // ADD-on glow as a constant base).
        mat.emissiveIntensity = 1;
        m.emissiveNode = phosphorEmissive;
        m.positionNode = bentPos;
        m.normalNode = bentNormalView;
        return mat;
      };

      if (canOverlay && localBox && faceBox) {
        const w = localBox.max.x - localBox.min.x || 1;
        const h = localBox.max.y - localBox.min.y || 1;
        halfW = w / 2;
        halfH = h / 2;
        sheetX = (localBox.min.x + localBox.max.x) / 2;
        sheetY = (localBox.min.y + localBox.max.y) / 2;
        faceZ = faceBox.max.z;
        uHalfW.value = halfW;
        uHalfH.value = halfH;

        sheet = new Mesh(new PlaneGeometry(w, h, SEG, SEG), buildMaterial());
        sheet.name = 'crt-warp-sheet';
        sheet.position.set(sheetX, sheetY, faceZ);
        overlay.add(sheet);

        // ── Chrome clones: every non-representative mesh child rides the dome,
        // rigidly co-posed per seek (CPU mirror). The chrome is created ONCE
        // (catalog card chrome is static); the late-pour rebuild path covers
        // the sheet only.
        {
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
            const ox = (childBox.min.x + childBox.max.x) / 2 - sheetX;
            const oy = (childBox.min.y + childBox.max.y) / 2 - sheetY;
            const dz = (childBox.min.z + childBox.max.z) / 2 - faceZ;
            // Real geometry shared BY REFERENCE (never disposed by us), material
            // clone (ours) so the chrome's own look rides the barrel.
            const m = new Mesh(child.geometry as BufferGeometry, srcMat.clone());
            m.name = `crt-warp-chrome:${child.name || 'mesh'}`;
            // Keep the child's intrinsic local orientation so a rounded bar
            // still faces the camera; only its CENTRE is re-posed on the dome.
            m.quaternion.copy(child.quaternion);
            m.scale.copy(child.scale);
            overlay.add(m);
            chrome.push({ mesh: m, ox, oy, dz });
          });
        }

        // Sibling of the subject carrying its exact local pose (a hidden parent
        // hides its children, so the sheet cannot live under it).
        overlay.position.copy(subject.position);
        overlay.quaternion.copy(subject.quaternion);
        overlay.scale.copy(subject.scale);
        subject.parent!.add(overlay);
        subject.visible = false;
      }

      /** CPU mirror of the barrel dome for the chrome clones: evaluate F at each
       *  child's centre (same curvature/half-span math), lifting it toward the
       *  camera and offsetting its proud height along the bent surface normal. */
      const domeLiftAt = (ox: number, oy: number): { dz: number; nx: number; ny: number } => {
        const curv = uCurvature.value;
        const hW = Math.max(halfW, 1e-3);
        const hH = Math.max(halfH, 1e-3);
        const span = Math.max(hW, hH);
        const nxv = ox / hW;
        const nyv = oy / hH;
        const rel = 1 - (nxv * nxv + nyv * nyv);
        return { dz: curv * span * rel, nx: nxv * curv * 2, ny: nyv * curv * 2 };
      };

      const placeChrome = () => {
        for (const c of chrome) {
          const f = domeLiftAt(c.ox, c.oy);
          // Bent surface normal (CPU) to push the proud chrome out along it.
          const len = Math.hypot(f.nx, f.ny, 1) || 1;
          c.mesh.position.set(
            sheetX + c.ox + (f.nx / len) * c.dz,
            sheetY + c.oy + (f.ny / len) * c.dz,
            faceZ + f.dz + (1 / len) * c.dz,
          );
        }
      };

      // Publish the driven uniforms + a CPU dome probe for the host + headless
      // tests (the cylinder-unroll water-droplet pattern: no GPU to read pixels
      // from in node).
      target.userData.crtWarp = {
        uTime, uCurvature, uLineCount, uScanStrength, uRollSpeed, uRoll, uColor,
      };
      target.userData.crtWarpProbe = {
        /** Dome lift at a NORMALIZED sheet coordinate (nx,ny in [-1..1]). */
        domeAt: (qx: number, qy: number): number => {
          const curv = uCurvature.value;
          const span = Math.max(Math.max(halfW, halfH), 1e-3);
          return curv * span * (1 - (qx * qx + qy * qy));
        },
        /** CPU mirror of the GPU scanline multiplier at a uv.y in [0..1] — the
         *  EXACT sharpened-grille math the colorNode runs, reading the live
         *  uLineCount / uScanStrength / uTime uniforms. Lets headless tests
         *  prove the line-count knob reshapes the sampled grille (no GPU). */
        scanAt: (uvY: number): number => {
          const phase = uvY * uLineCount.value * (Math.PI * 2) + uTime.value * (SCAN_DRIFT * Math.PI * 2);
          const raw = Math.sin(phase) * 0.5 + 0.5; // 0..1
          const dip = Math.pow(raw, SCAN_GAMMA); // sharpened ridge
          return 1 - uScanStrength.value * (1 - dip); // ≤ 1
        },
        /** CPU mirror of the ADDITIVE emissive phosphor glow at a uv.y in
         *  [0..1] — the EXACT scalar the emissiveNode emits (before the warm
         *  uPhosphor tint), reading the live uLineCount / uScanStrength / uTime.
         *  This is the term that actually READS on the dark tube, so the test
         *  characterises THIS to prove the line-COUNT knob changes the visible
         *  rendered grille (not merely a sub-noise multiply). The rolling band
         *  and vignette factors are omitted (they are position-of-band /
         *  radial gains independent of line frequency), leaving the pure
         *  per-line emitted-light profile. */
        scanGlowAt: (uvY: number): number => {
          const phase = uvY * uLineCount.value * (Math.PI * 2) + uTime.value * (SCAN_DRIFT * Math.PI * 2);
          const raw = Math.sin(phase) * 0.5 + 0.5; // 0..1
          const line = Math.pow(1 - raw, SCAN_GAMMA); // bright ON the line
          return line * uScanStrength.value * SCAN_GLOW_GAIN; // emitted light ≥ 0
        },
      };

      let lastT = 0;

      const apply = (t: number) => {
        lastT = t;
        uTime.value = t;
        // Live reads so control changes apply without a rebuild.
        uCurvature.value = clamp(num(params.curvature, 0.22), 0, 0.6);
        uLineCount.value = clamp(num(params.scanlines, 24), 8, 48);
        uScanStrength.value = clamp(num(params.scanStrength, 0.16), 0, 0.5);
        const rollSpeed = clamp(num(params.rollSpeed, 0.5), 0.1, 1.5);
        uRollSpeed.value = rollSpeed;
        // Rolling band phase: loops 0→1 every LOOP_BASE / rollSpeed seconds.
        const loop = LOOP_BASE / Math.max(rollSpeed, 1e-3);
        uRoll.value = ((t % loop) + loop) % loop / loop;

        if (!canOverlay || !sheet) {
          // Fallback: nothing to overlay — the WHOLE subject gives a faint CRT
          // breathe (a horizontal-scan stretch), never placeholder geometry.
          const breathe = 1 + BREATHE_AMP * Math.sin(t * (Math.PI * 2) / LOOP_BASE);
          subject.scale.set(baseScale.x * breathe, baseScale.y, baseScale.z);
          return;
        }

        // LIVE TRANSFORM TRACKING — co-bindings keep animating the hidden
        // subject; re-register the overlay on its CURRENT local pose.
        overlay.position.copy(subject.position);
        overlay.quaternion.copy(subject.quaternion);
        overlay.scale.copy(subject.scale);

        // LATE TEXTURE POUR — rebuild the sheet's material the moment the live
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

        // Chrome rides the dome every frame.
        placeChrome();
      };

      // Deterministic initial state (the rig pins idle at t=0).
      apply(0);

      return {
        // Continuous CRT loop → Infinity (purely stateful, per contract).
        duration: () => Infinity,
        seek: (t) => apply(t),
        // Re-apply at the live time so paused control tweaks (the controls gate
        // drives one control at a frozen frame) take effect without a new seek.
        onParamChange: (_id: string, _value: ControlValue) => apply(lastT),
        dispose: () => {
          if (sheet) {
            if (overlay.parent) overlay.parent.remove(overlay);
            sheet.geometry.dispose();
            (sheet.material as Material).dispose();
            sheet = null;
            for (const c of chrome) {
              // Geometry is the SUBJECT's, shared by reference — never disposed
              // here. The cloned material is ours.
              (c.mesh.material as Material).dispose();
            }
            chrome.length = 0;
            subject.visible = prevVisible;
          } else {
            subject.scale.copy(baseScale);
          }
        },
      };
    },
  ),
};
