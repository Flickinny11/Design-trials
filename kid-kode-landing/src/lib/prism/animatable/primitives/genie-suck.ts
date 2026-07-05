// genie-suck — the surface is drawn into a corner point through a curving
// funnel taper — the classic macOS genie minimize — holds a beat, then springs
// back out. transform / card / time / HARD.
//
// TECHNIQUE (DESIGN-REFERENCES §3 "Three.js Shading Language (TSL) & WebGPU"
// — vertex displacement via `material.positionNode`, the curtains.js-style
// DOM-plane warp of §1 brought into the TSL vertex lane): every vertex is
// decomposed in the funnel's frame — `along` = axial distance from the corner,
// `lat` = signed offset from the centerline through the corner. A staggered
// collapse window (rows nearer the corner converge FIRST) compresses `along`
// toward 0 while the lateral extent pinches by pow(x, k) of the vertex's
// CURRENT axial position — the curved funnel throat. The whole field is driven
// by ONE CPU-eased uniform (uSuck), so the cycle is:
//
//   out-beat (flat) → suck-in (easeInOut) → beat (held in the point)
//                   → spring-out (selectable ease, backOut default —
//                     its overshoot pushes uSuck slightly NEGATIVE, which the
//                     vertex lane renders as an outward bulge past flat).
//
// OVERLAY DISCIPLINE (the scroll-stagger-rise pattern — same hardening the
// cylinder-unroll sibling uses): the warp lives on a subdivided plane OVERLAY,
// a sibling of the subject sized/placed from boxes measured in the subject's
// LOCAL frame (never hardcoded world units). The overlay's material mirrors
// the subject's own look — color copied, texture map shared BY REFERENCE
// through the node material's default .map sampling, PBR params carried for
// lit sources — NEVER an invented fill. Every seek (a) re-syncs the overlay to
// the subject's live local pose (co-bindings keep tilting the hidden subject)
// and (b) re-reads the live source material: when the material instance OR its
// .map identity changed (mounted artifacts pour textures ASYNCHRONOUSLY after
// attach), the overlay rebuilds from the live source. The subject is hidden
// while active and dispose() restores everything and frees every resource we
// created (shared textures and shared chrome geometry untouched).
//
// CHROME CO-TREATMENT (advocate must-fix r3, 2026-06-12 — the tile read as a
// featureless tan slab because the declared subject was a chrome-less 'plane';
// the subject is now the catalog CARD and its full composite look rides the
// funnel — the cylinder-unroll pattern adapted to a positional XY warp):
//   - The SHEET carries the PANEL: sized/placed from the measured union box,
//     face z from the REPRESENTATIVE (panel) mesh's own box (chrome proud of
//     the face must not float the sheet off the panel), color/map/PBR poured
//     from the live panel material, plus a rounded-corner SDF opacity mask
//     (radius read from RoundedBoxGeometry.parameters — 0 for plain rects, so
//     mounted rectangular artifacts are untouched): the silhouette IS the
//     card's, at rest and through the funnel (the mask rides positionLocal,
//     the PRE-warp attribute).
//   - WIDE CHROME (header bar + content rows) becomes BENT CLONES: per child,
//     a subdivided flat plane at its front-face footprint, geometry BAKED into
//     the sheet's frame so it shares the SAME positionNode warp tree — a bar
//     crossing the collapse window visibly stretches into the funnel exactly
//     with the panel under it. The genie warp is XY-only (z passes through),
//     so chrome proud of the face stays proud through the whole cycle — no
//     normal co-bending needed (nothing leaves the sheet plane). Materials
//     copy the child's own color/emissive/PBR scalars and share any map BY
//     REFERENCE — never an invented fill.
//   - SMALL CHROME (the accent dot) becomes a RIGID CLONE: the child's real
//     geometry shared by reference + a material clone, POSED per seek by a CPU
//     mirror of the funnel (same stagger/throat math) and SCALED by the local
//     compression (min of axial squash and lateral pinch) — the dot visibly
//     drifts into the throat and is swallowed as its row converges. Bending a
//     sphere through the warp would smear it; rigid pose + honest shrink is
//     visually exact at its footprint.
//   - Chrome clones are created once from the subject's children (catalog card
//     chrome is static); the late-pour rebuild path covers the panel sheet and
//     dock glow only. At uSuck = 0 every clone is an exact identity — the idle
//     frame IS the card.
//
// Runs on BOTH backends: TSL node materials compile to WGSL (WebGPU) and GLSL
// (WebGL2 fallback). Meshes only — no THREE.Points. Deterministic — no
// Math.random anywhere.
//
// DISTINCT from swirl-warp (rotational twist about the center — genie-suck is
// a symmetric axial funnel, zero rotation), melt (gravity drips sliding DOWN —
// genie-suck converges into one corner POINT through a taper), voxelize
// (discrete cube decimation — genie-suck is one smooth continuous surface),
// and genie-column (smoke category: generates a coiling smoke column — it
// never moves the surface; genie-suck warps the surface itself).
//
// ADVOCATE MUST-FIX HARDENING (W1 verdict, 2026-06-12):
// (1) REST IDENTITY — the collapse window's lower clamp used a CONSTANT −0.18
//     floor meant only for the spring-out's overshoot bulge. At rest (uSuck=0)
//     w_pre = −1.5·aN is negative across the whole sheet, so the constant
//     floor engaged AT REST: every row beyond aN≈0.12 was stretched 18% AWAY
//     from the corner — the skewed, frame-top-clipped idle the advocate
//     blocked. The floor now FOLLOWS uSuck (clamp(uSuck, −0.18, 0)): exactly 0
//     at rest (perfect identity — the overlay is pixel-true to the subject
//     panel), and only as negative as the live overshoot during spring-out.
// (2) NO EMPTY PHASE — at full suck the surface converges to a literal point
//     (zero area → empty tile through the held beat; play-3 read as broken).
//     A corner DOCK GLOW now carries the held beat: a soft radial disc at the
//     convergence point, color derived from the SUBJECT's own materials (the
//     first sufficiently-luminous emissive in the subtree — the card's brass
//     header chrome — else the representative albedo; never an invented hue),
//     swelling in as the sheet is swallowed (ramp above suck≈0.55) and pulsing
//     deterministically (cos of the cycle clock) through the hold so no
//     sampled frame is empty OR frozen. It fades to nothing by suck≈0.55 on
//     the way out and is invisible at rest.

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
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import {
  uniform,
  positionLocal,
  uv,
  vec2,
  vec3,
  float,
  length,
  mix,
  step,
  pow,
  smoothstep,
  abs as tslAbs,
  sqrt as tslSqrt,
  clamp as tslClamp,
  max as tslMax,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import {
  clamp,
  num,
  phase,
  str,
  type ControlValue,
  type EaseName,
  type PrimitiveDefinition,
} from '../contract';

const SCHEMA = [
  // First so the CONTROLS gate's min→max drive reshapes the funnel mid-suck.
  { id: 'curvature', label: 'Funnel Curve', type: 'knob', min: 0.6, max: 3, step: 0.05, default: 1.7 },
  {
    id: 'corner',
    label: 'Corner',
    type: 'dropdown',
    options: [
      { value: 'br', label: 'Bottom Right' },
      { value: 'bl', label: 'Bottom Left' },
      { value: 'tr', label: 'Top Right' },
      { value: 'tl', label: 'Top Left' },
    ],
    default: 'br',
  },
  { id: 'duration', label: 'Duration', type: 'fader', min: 1.2, max: 6, step: 0.1, default: 3.2, unit: 's' },
  {
    id: 'spring',
    label: 'Spring',
    type: 'curve',
    default: 'backOut',
    options: ['backOut', 'elasticOut', 'bounceOut', 'expoOut'],
  },
] as const;

// Cycle phase layout over normalized p = t/duration. suck(0)=suck(1)=0 so the
// loop is seam-free. Default duration 3.2s puts the harness CONTROLS pause
// (t=1s → p≈0.31) mid suck-in, where the funnel silhouette is fully visible.
const OUT_BEAT_END = 0.1;
const SUCK_END = 0.48;
const HOLD_END = 0.6;

// Funnel stagger: how strongly rows nearer the corner lead the collapse.
// Internal — the visible shape knob is `curvature`.
const STAGGER = 0.6;
// Overlay subdivision — enough resolution for a smooth curved throat.
const SEGMENTS = 48;
// Bent chrome clone subdivision — bars crossing the throat warp smoothly.
const CHROME_SEG_X = 48;
const CHROME_SEG_Y = 12;
// A chrome child whose footprint is below this fraction of the sheet in BOTH
// axes is treated as rigid (the dot) — posed per seek instead of vertex-bent.
const RIGID_FRAC = 0.15;
// Dock glow: suck level where the corner glow starts swelling in (the sheet is
// mostly swallowed by then), and the deterministic pulse rate (Hz on the
// primitive's own clock) that keeps the held beat visibly alive.
const GLOW_START = 0.55;
const GLOW_PULSE_HZ = 1.6;
// Luminosity score (emissiveIntensity × max emissive channel) above which a
// subtree material's emissive is bright enough to color the dock glow.
const GLOW_EMISSIVE_SCORE = 0.22;

// The three/tsl chain types are loose and fight strict tsc (the genie-column /
// caustics dodge): treat every node as an opaque `N` and funnel chaining
// through `n()` so tsc never tries to unify the narrow generic variants.
type N = {
  add: (o: unknown) => N;
  sub: (o: unknown) => N;
  mul: (o: unknown) => N;
  div: (o: unknown) => N;
  x: N;
  y: N;
  z: N;
};
const n = (node: unknown): N => node as N;

/** The appearance source: the first Mesh descendant carrying a material (the
 *  subject may be a Group — MSDF 'text-object' — so traverse, never assume
 *  Mesh). */
function findRepresentativeMesh(subject: Object3D): Mesh | null {
  let found: Mesh | null = null;
  subject.traverse((o) => {
    if (found) return;
    const mesh = o as Mesh;
    if (mesh.isMesh && mesh.material) found = mesh;
  });
  return found;
}

type SrcProps = Material & {
  map?: Texture | null;
  color?: Color;
  emissive?: Color;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
  opacity: number;
};

/** A small chrome child posed rigidly per seek (CPU mirror of the funnel).
 *  Offsets are in the SHEET's frame: ox/oy from the sheet center; z is the
 *  child's own subject-local center (the genie warp never moves z). */
interface RigidChromeClone {
  mesh: Mesh;
  ox: number;
  oy: number;
  z: number;
}

export const genieSuckPrimitive: PrimitiveDefinition = {
  name: 'genie-suck',
  label: 'Genie Suck',
  category: 'transform',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'The surface is drawn into a corner through a curving genie funnel, holds a beat, then springs back out.',
  create: defineAnimatable(
    { name: 'genie-suck', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;

      const repMesh = findRepresentativeMesh(subject);
      /** The representative mesh's CURRENT first material — read live, never
       *  cached: the mounted plane factory pours `.map` asynchronously and
       *  applyImageSpec may swap the material after this primitive attaches. */
      const liveSourceMaterial = (): SrcProps | null => {
        if (!repMesh) return null;
        const m = repMesh.material;
        return ((Array.isArray(m) ? m[0] : m) as SrcProps | undefined) ?? null;
      };

      // ── Measure the subject in ITS OWN local frame ──────────────────────
      // Overlay size/placement and the corner point all derive from these
      // boxes (NEVER hardcoded world units — mounted artifacts vary wildly).
      // GEOMETRY-BASED on purpose: each mesh's geometry bounding box is mapped
      // mesh-local → subject-local directly. The old route (world AABB →
      // inverse subject matrix) double-inflates whenever the subject is tilted
      // at measure time — and seek() re-measures DURING the animation when the
      // async texture pour lands, when co-bindings may have the hidden subject
      // mid-tilt. An inflated box = oversized overlay = frame-clipped sheet.
      // The sheet's w/h covers the UNION of all meshes (Group subjects keep
      // their full footprint); its face z comes from the REPRESENTATIVE mesh
      // (the panel) — chrome proud of the face must not float the sheet off
      // the panel (cylinder-unroll's faceBox lesson).
      const measureBoxes = (): { union: Box3; face: Box3 } | null => {
        subject.updateWorldMatrix(true, true);
        const inv = new Matrix4().copy(subject.matrixWorld).invert();
        const union = new Box3();
        const face = new Box3();
        const rel = new Matrix4();
        const sub = new Box3();
        subject.traverse((o) => {
          const mesh = o as Mesh;
          if (!mesh.isMesh || !mesh.geometry) return;
          if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
          const bb = mesh.geometry.boundingBox;
          if (!bb || bb.isEmpty()) return;
          rel.multiplyMatrices(inv, mesh.matrixWorld);
          sub.copy(bb).applyMatrix4(rel);
          union.union(sub);
          if (mesh === repMesh) face.copy(sub);
        });
        if (union.isEmpty()) return null;
        return { union, face: face.isEmpty() ? union.clone() : face };
      };
      let boxes = measureBoxes();
      let localBox = boxes?.union ?? null;

      const canOverlay = Boolean(localBox && repMesh && liveSourceMaterial() && subject.parent);

      // ── Uniforms (shared across material rebuilds) ──────────────────────
      const uSuck = uniform(0); // -ve = spring overshoot bulge, 1 = in the point
      const uK = uniform(clamp(num(params.curvature, 1.7), 0.2, 4));
      const uCornerX = uniform(0);
      const uCornerY = uniform(0);
      // Dock-glow drive (0 = invisible, 1 = full held-beat glow) + its
      // subject-derived color (copied from the subject's own materials — never
      // an invented hue; black until buildOverlay reads the source).
      const uGlow = uniform(0);
      const uGlowColor = uniform(new Color(0, 0, 0));
      // Live source opacity — the rounded-corner mask multiplies it.
      const uOpacity = uniform(1);
      // Rounded-corner SDF mask (the card silhouette). uMaskR = 0 disables it.
      const uMaskHalfW = uniform(1);
      const uMaskHalfH = uniform(1);
      const uMaskR = uniform(0);
      const uMaskEdge = uniform(1e-3); // anti-alias half-width
      // Publish handles so the host (and CPU tests) can observe the motion.
      target.userData.genieSuck = { uSuck, uK, uCornerX, uCornerY, uGlow, uGlowColor };

      // ── Vertex-lane warp (TSL, built once, shared sheet + bent chrome) ──
      const buildPositionTree = (): unknown => {
        const C = n(vec2(uCornerX as never, uCornerY as never));
        const lenC = n(tslMax(length(C as never) as never, float(1e-4) as never));
        const ux = C.x.div(lenC); // suck axis: center → corner
        const uy = C.y.div(lenC);
        const p = n(positionLocal);
        const relX = C.x.sub(p.x);
        const relY = C.y.sub(p.y);
        // Funnel frame: along = dot(C−P, axis) ∈ [0, 2|C|] (0 AT the corner);
        // lat = dot(P−C, rot90(axis)) — signed offset from the centerline.
        const along = relX.mul(ux).add(relY.mul(uy));
        const lat = relX.mul(uy).sub(relY.mul(ux));
        const alongMax = lenC.mul(2);
        const aN = along.div(alongMax);
        // Staggered collapse window — rows nearer the corner converge FIRST.
        // w < 0 is the spring-out overshoot (uSuck dips negative under
        // backOut/elasticOut): the surface bulges slightly past flat.
        //
        // REST-IDENTITY FIX (advocate must-fix): the lower clamp FOLLOWS uSuck
        // instead of sitting at a constant −0.18. The pre-clamp window
        // (uSuck − aN·STAGGER)/(1 − STAGGER) is NEGATIVE across most of the
        // sheet whenever uSuck < aN·STAGGER — including the entire rest pose
        // (uSuck = 0 → −1.5·aN) — so a constant floor stretched the sheet 18%
        // away from the corner AT REST: the skewed, frame-clipped idle. With
        // clamp(uSuck, −0.18, 0) the floor is exactly 0 at rest and during the
        // whole suck-in (w ≥ 0, perfect identity where the window hasn't
        // arrived), and during spring-out it admits a uniform outward bulge
        // exactly as deep as the live overshoot (capped at 18% for elasticOut).
        const wFloor = n(tslClamp(uSuck as never, float(-0.18) as never, float(0) as never));
        const w = n(
          tslClamp(
            n(uSuck).sub(aN.mul(STAGGER)).div(1 - STAGGER) as never,
            wFloor as never,
            float(1) as never,
          ),
        );
        // Smooth profile while converging; linear when overshooting outward
        // (the smoothstep polynomial flips positive for w<0 and would kill
        // the spring bulge).
        const sm = w.mul(w).mul(n(float(3)).sub(w.mul(2)));
        const e = n(mix(w as never, sm as never, step(float(0) as never, w as never) as never));
        const along2 = along.mul(n(float(1)).sub(e));
        // Curved throat: lateral pinch follows pow(x, k) of the vertex's
        // CURRENT axial position — near the corner the surface necks to a
        // point, far rows stay wide; k bends the silhouette between a fat
        // convex taper (k<1) and a thin concave throat (k>1).
        const xN = n(
          tslClamp(along2.div(alongMax) as never, float(0) as never, float(1) as never),
        );
        const funnel = n(pow(xN as never, uK as never));
        const gate = n(tslClamp(n(uSuck).mul(2) as never, float(0) as never, float(1) as never));
        const lat2 = lat.mul(n(mix(float(1) as never, funnel as never, gate as never)));
        // Reassemble: P' = C − axis·along' + rot90(axis)·lat'. At uSuck=0 this
        // is the exact identity (the overlay sits flat on the subject's face).
        const nx = C.x.sub(ux.mul(along2)).sub(uy.mul(lat2));
        const ny = C.y.sub(uy.mul(along2)).add(ux.mul(lat2));
        return vec3(nx as never, ny as never, p.z as never);
      };
      const positionNodeTree = buildPositionTree();

      // ── Rounded-corner SDF mask tree (built once) ────────────────────────
      // Evaluated on the PRE-warp positionLocal attribute, so the card
      // silhouette rides the funnel with the surface. Standard rounded-rect
      // SDF: outside ⇒ transparent (the cylinder-unroll mask, same uniforms).
      const pl = n(positionLocal);
      const qx = n(
        tslMax(
          n(tslAbs(pl.x as never)).sub(n(uMaskHalfW as never).sub(uMaskR)) as never,
          float(0) as never,
        ),
      );
      const qy = n(
        tslMax(
          n(tslAbs(pl.y as never)).sub(n(uMaskHalfH as never).sub(uMaskR)) as never,
          float(0) as never,
        ),
      );
      const cornerSdf = n(tslSqrt(qx.mul(qx).add(qy.mul(qy)) as never)).sub(uMaskR);
      const maskOpacityTree = n(float(1))
        .sub(
          smoothstep(
            n(float(0)).sub(uMaskEdge) as never,
            uMaskEdge as never,
            cornerSdf as never,
          ),
        )
        .mul(uOpacity);

      // ── Dock-glow node trees (built once, reused across rebuilds) ───────
      // Soft radial disc: falloff = max(1 − 2·|uv−0.5|, 0)^2.2. Color is the
      // subject-derived uGlowColor with a hotter core; opacity rides uGlow.
      const glowD = n(length(n(uv()).sub(vec2(0.5, 0.5) as never) as never));
      const glowFalloff = n(
        pow(
          tslMax(n(float(1)).sub(glowD.mul(2)) as never, float(0) as never) as never,
          float(2.2) as never,
        ),
      );
      const glowColorTree = n(uGlowColor as never).mul(glowFalloff.mul(0.9).add(0.6));
      const glowOpacityTree = glowFalloff.mul(uGlow as never);

      /** The glow's hue comes from the SUBJECT's own materials: the first
       *  sufficiently-luminous emissive in the subtree (the card's brass
       *  header chrome — the panel's near-black emissive scores out), else
       *  the source emissive / albedo. Never an invented color. */
      const pickGlowColor = (src: SrcProps): Color => {
        let found: Color | null = null;
        subject.traverse((o) => {
          if (found) return;
          const mesh = o as Mesh;
          if (!mesh.isMesh || !mesh.material) return;
          const m = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as
            | SrcProps
            | undefined;
          const em = m?.emissive;
          if (!em) return;
          const intensity = typeof m?.emissiveIntensity === 'number' ? m.emissiveIntensity : 1;
          if (intensity * Math.max(em.r, em.g, em.b) > GLOW_EMISSIVE_SCORE) {
            found = new Color().copy(em);
          }
        });
        if (found) return found;
        const em = src.emissive;
        const emMax = em ? Math.max(em.r, em.g, em.b) : 0;
        if (em && emMax > GLOW_EMISSIVE_SCORE) return new Color().copy(em);
        if (src.color) return new Color().copy(src.color);
        return new Color(0, 0, 0); // unreachable for catalog subjects
      };

      const makeGlowMaterial = (src: SrcProps): Material => {
        uGlowColor.value.copy(pickGlowColor(src));
        const mat = new MeshBasicNodeMaterial();
        const m = mat as unknown as { colorNode: unknown; opacityNode: unknown };
        m.colorNode = glowColorTree;
        m.opacityNode = glowOpacityTree;
        mat.transparent = true;
        mat.depthWrite = false;
        mat.side = DoubleSide; // stays visible if co-bindings tilt the subject
        return mat;
      };

      // ── Overlay (sibling of the subject; scroll-stagger-rise discipline) ─
      const overlayGroup = new Group();
      overlayGroup.name = 'genie-suck-overlay';
      let overlayMesh: Mesh | null = null;
      let glowMesh: Mesh | null = null;
      const bentChrome: Mesh[] = [];
      const rigidChrome: RigidChromeClone[] = [];
      let halfW = 1;
      let halfH = 1;
      // Face-plate placement (overlay-group space) — the warp corner lives at
      // (faceCx + uCornerX, faceCy + uCornerY, faceZ0); the glow docks proud
      // of the union top (chrome included).
      let faceCx = 0;
      let faceCy = 0;
      let faceZ0 = 0;
      let topZ0 = 0;
      // Representative RoundedBox corner radius (0 = plain rect, mask off).
      let cornerR = 0;
      // What the overlay was built FROM — material instance + map identity.
      // seek() compares these against the live source and rebuilds when the
      // async texture pour / material swap lands AFTER create.
      let builtSrcMat: SrcProps | null = null;
      let builtSrcMap: Texture | null = null;

      const applyCorner = (cornerId: string) => {
        uCornerX.value = cornerId.includes('r') ? halfW : -halfW;
        uCornerY.value = cornerId.includes('t') ? halfH : -halfH;
        if (glowMesh) {
          // Dock the glow AT the convergence point, a hair proud of the union
          // top — above the chrome clones too (epsilon is measured-relative —
          // never a hardcoded world unit).
          glowMesh.position.set(
            faceCx + uCornerX.value,
            faceCy + uCornerY.value,
            topZ0 + 0.02 * Math.min(halfW, halfH),
          );
        }
      };

      /** Mirror the subject's own surface — color + map shared by reference
       *  (the node material's default colorNode pipeline samples `.map`), PBR
       *  params carried when the source is lit. NEVER an invented fill. */
      const makeOverlayMaterial = (src: SrcProps): Material => {
        const isBasic =
          (src as { isMeshBasicMaterial?: boolean }).isMeshBasicMaterial === true;
        const mat = isBasic ? new MeshBasicNodeMaterial() : new MeshStandardNodeMaterial();
        const m = mat as unknown as SrcProps & { positionNode: unknown; opacityNode: unknown };
        if (src.color && m.color) m.color.copy(src.color);
        m.map = (src.map as Texture | null | undefined) ?? null;
        if (!isBasic) {
          const std = mat as MeshStandardNodeMaterial;
          if (src.emissive) std.emissive.copy(src.emissive);
          if (typeof src.emissiveIntensity === 'number')
            std.emissiveIntensity = src.emissiveIntensity;
          if (typeof src.roughness === 'number') std.roughness = src.roughness;
          if (typeof src.metalness === 'number') std.metalness = src.metalness;
          if (typeof src.envMapIntensity === 'number')
            std.envMapIntensity = src.envMapIntensity;
        }
        mat.transparent = true;
        mat.side = src.side;
        mat.opacity = src.opacity > 0.01 ? src.opacity : 1;
        uOpacity.value = mat.opacity;
        // The warped surface can momentarily overlap itself mid-funnel.
        mat.depthWrite = false;
        m.positionNode = positionNodeTree;
        // Card silhouette: only when the source is a RoundedBox (cornerR > 0)
        // — plain rectangular artifacts keep their exact footprint.
        if (cornerR > 0) {
          m.opacityNode = maskOpacityTree;
          mat.alphaTest = 0.01; // discard the masked corners (incl. depth)
        }
        return mat;
      };

      /** A bent chrome clone's material: the child's OWN color/emissive/PBR
       *  scalars copied, any map shared BY REFERENCE — never an invented
       *  fill. Shares the sheet's funnel position tree (the same uniforms
       *  drive everything). */
      const makeChromeMaterial = (src: SrcProps): Material => {
        const mat = new MeshStandardNodeMaterial();
        if (src.color) mat.color.copy(src.color);
        const srcMap = (src.map as Texture | null | undefined) ?? null;
        if (srcMap) mat.map = srcMap;
        if (src.emissive) mat.emissive.copy(src.emissive);
        if (typeof src.emissiveIntensity === 'number')
          mat.emissiveIntensity = src.emissiveIntensity;
        if (typeof src.roughness === 'number') mat.roughness = src.roughness;
        if (typeof src.metalness === 'number') mat.metalness = src.metalness;
        if (typeof src.envMapIntensity === 'number')
          mat.envMapIntensity = src.envMapIntensity;
        mat.opacity = src.opacity > 0.01 ? src.opacity : 1;
        mat.transparent = true;
        mat.side = DoubleSide;
        const m = mat as unknown as { positionNode: unknown };
        m.positionNode = positionNodeTree;
        return mat;
      };

      const buildOverlay = () => {
        // Re-measure: by rebuild time (texture pour) any mount-time pose skew
        // has settled, so the overlay lands on the artifact's real face.
        const remeasured = measureBoxes();
        if (remeasured) {
          boxes = remeasured;
          localBox = remeasured.union;
        }
        const src = liveSourceMaterial();
        builtSrcMat = src;
        builtSrcMap = (src?.map as Texture | null | undefined) ?? null;
        if (!src || !boxes || !localBox) return;

        halfW = Math.max((localBox.max.x - localBox.min.x) / 2, 1e-3);
        halfH = Math.max((localBox.max.y - localBox.min.y) / 2, 1e-3);
        faceCx = (localBox.min.x + localBox.max.x) / 2;
        faceCy = (localBox.min.y + localBox.max.y) / 2;
        faceZ0 = boxes.face.max.z;
        topZ0 = localBox.max.z;

        // Card silhouette radius — straight off the representative geometry's
        // own constructor parameters (0 / absent = plain rect, no mask).
        const repParams = (
          repMesh?.geometry as { parameters?: { radius?: number } } | undefined
        )?.parameters;
        cornerR = Math.min(
          Math.max(typeof repParams?.radius === 'number' ? repParams.radius : 0, 0),
          Math.min(halfW, halfH),
        );
        uMaskHalfW.value = halfW;
        uMaskHalfH.value = halfH;
        uMaskR.value = cornerR;
        uMaskEdge.value = Math.max(cornerR * 0.05, 1e-3);

        const geometry = new PlaneGeometry(halfW * 2, halfH * 2, SEGMENTS, SEGMENTS);
        const material = makeOverlayMaterial(src);
        if (overlayMesh) {
          overlayMesh.geometry.dispose();
          (overlayMesh.material as Material).dispose();
          overlayMesh.geometry = geometry;
          overlayMesh.material = material;
        } else {
          overlayMesh = new Mesh(geometry, material);
          overlayMesh.name = 'genie-suck-surface';
          overlayGroup.add(overlayMesh);
        }
        overlayMesh.position.set(faceCx, faceCy, faceZ0);

        // Dock glow — sized from the measured face (never hardcoded units).
        const glowHalf = 0.5 * Math.min(halfW, halfH);
        const glowGeometry = new PlaneGeometry(glowHalf * 2, glowHalf * 2);
        const glowMaterial = makeGlowMaterial(src);
        if (glowMesh) {
          glowMesh.geometry.dispose();
          (glowMesh.material as Material).dispose();
          glowMesh.geometry = glowGeometry;
          glowMesh.material = glowMaterial;
        } else {
          glowMesh = new Mesh(glowGeometry, glowMaterial);
          glowMesh.name = 'genie-suck-dock-glow';
          glowMesh.visible = false; // seek() drives visibility from uGlow
          glowMesh.renderOrder = 3; // above sheet + chrome clones
          overlayGroup.add(glowMesh);
        }
        applyCorner(str(params.corner, 'br'));
      };

      // ── CPU mirror of the funnel warp (rigid chrome pose + scale) ───────
      // EXACTLY the vertex-lane math, evaluated at one sheet-frame point.
      // Returns the warped point plus the local squash factors (axial 1−e,
      // lateral funnel pinch) the rigid dot scales by.
      const warpPoint = (
        px: number,
        py: number,
      ): { x: number; y: number; axial: number; lateral: number } => {
        const Cx = uCornerX.value;
        const Cy = uCornerY.value;
        const lenC = Math.max(Math.hypot(Cx, Cy), 1e-4);
        const ux = Cx / lenC;
        const uy = Cy / lenC;
        const relX = Cx - px;
        const relY = Cy - py;
        const along = relX * ux + relY * uy;
        const lat = relX * uy - relY * ux;
        const alongMax = lenC * 2;
        const aN = along / alongMax;
        const suck = uSuck.value;
        const wFloor = clamp(suck, -0.18, 0);
        const w = clamp((suck - aN * STAGGER) / (1 - STAGGER), wFloor, 1);
        const sm = w * w * (3 - 2 * w);
        const e = w >= 0 ? sm : w;
        const along2 = along * (1 - e);
        const xN = clamp(along2 / alongMax, 0, 1);
        const funnel = Math.pow(xN, uK.value);
        const gate = clamp(suck * 2, 0, 1);
        const lateral = 1 + (funnel - 1) * gate; // mix(1, funnel, gate)
        const lat2 = lat * lateral;
        return {
          x: Cx - ux * along2 - uy * lat2,
          y: Cy - uy * along2 + ux * lat2,
          axial: 1 - e,
          lateral,
        };
      };

      /** Pose every rigid chrome clone on the warped surface: position from
       *  the CPU funnel mirror, uniform scale from the local compression
       *  (min of axial squash and lateral pinch — the dot is swallowed as
       *  its row converges; identity at rest). */
      const placeRigidChrome = () => {
        for (const c of rigidChrome) {
          const wp = warpPoint(c.ox, c.oy);
          c.mesh.position.set(faceCx + wp.x, faceCy + wp.y, c.z);
          c.mesh.scale.setScalar(clamp(Math.min(wp.axial, wp.lateral), 0.02, 1.2));
        }
      };

      const prevVisible = subject.visible;
      // Fallback (no measurable box / material / parent — never the catalog
      // card): snapshot the transforms we will drive directly.
      const basePos = subject.position.clone();
      const baseScale = subject.scale.clone();

      if (canOverlay) {
        // Sibling of the subject, carrying its exact local transform, so the
        // overlay occupies the subject's spot and co-moves under outer
        // transforms. The overlay IS the surface now — hide the original.
        overlayGroup.position.copy(subject.position);
        overlayGroup.quaternion.copy(subject.quaternion);
        overlayGroup.scale.copy(subject.scale);
        subject.parent!.add(overlayGroup);
        buildOverlay();

        // ── Chrome clones (created once — catalog card chrome is static;
        // the late-pour rebuild path covers the panel sheet + glow only).
        // Footprints are measured in the subject's local frame, then offsets
        // are taken from the SHEET center so the shared warp tree (and its
        // CPU mirror) see real sheet coordinates.
        {
          subject.updateWorldMatrix(true, true);
          const inv = new Matrix4().copy(subject.matrixWorld).invert();
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
            ) as SrcProps;
            rel.multiplyMatrices(inv, child.matrixWorld);
            childBox.copy(bb).applyMatrix4(rel);
            const cw = childBox.max.x - childBox.min.x;
            const ch = childBox.max.y - childBox.min.y;
            const ox = (childBox.min.x + childBox.max.x) / 2 - faceCx;
            const oy = (childBox.min.y + childBox.max.y) / 2 - faceCy;
            if (cw < RIGID_FRAC * halfW * 2 && ch < RIGID_FRAC * halfH * 2) {
              // Small chrome (the dot): rigid clone — REAL geometry by
              // reference (never disposed by us), material clone (ours).
              const m = new Mesh(child.geometry as BufferGeometry, (srcMat as Material).clone());
              m.name = `genie-suck-chrome-rigid:${child.name || 'mesh'}`;
              m.renderOrder = 2;
              const z = (childBox.min.z + childBox.max.z) / 2;
              m.position.set(faceCx + ox, faceCy + oy, z); // rest identity
              overlayGroup.add(m);
              rigidChrome.push({ mesh: m, ox, oy, z });
            } else {
              // Wide chrome (header/rows): a subdivided flat plane at the
              // child's front-face footprint, geometry BAKED into the sheet
              // frame so the shared warp tree applies directly. Kept a
              // measured-relative hair proud of the sheet even when the
              // child face is coplanar (no z-fighting).
              const proud = Math.max(
                childBox.max.z - faceZ0,
                0.006 * Math.min(halfW, halfH),
              );
              const geo = new PlaneGeometry(cw, ch, CHROME_SEG_X, CHROME_SEG_Y);
              geo.translate(ox, oy, proud);
              const m = new Mesh(geo, makeChromeMaterial(srcMat));
              m.name = `genie-suck-chrome-bent:${child.name || 'mesh'}`;
              m.renderOrder = 1;
              m.position.set(faceCx, faceCy, faceZ0); // sheet frame = geometry frame
              overlayGroup.add(m);
              bentChrome.push(m);
            }
          });
        }
        subject.visible = false;
      }

      // ── CPU phase → eased suck value (deterministic, loop-seamless) ─────
      const suckAt = (t: number): number => {
        const dur = Math.max(0.1, num(params.duration, 3.2));
        const p = phase(t, dur);
        if (p < OUT_BEAT_END) return 0;
        if (p < SUCK_END)
          return ease('easeInOut', (p - OUT_BEAT_END) / (SUCK_END - OUT_BEAT_END));
        if (p < HOLD_END) return 1;
        const spring = str(params.spring, 'backOut') as EaseName;
        return clamp(1 - ease(spring, (p - HOLD_END) / (1 - HOLD_END)), -0.5, 1);
      };

      const applyFallback = (suck: number) => {
        // Degraded-but-honest genie: scale toward nothing while drifting
        // toward the chosen corner; travel scales with the measured height
        // (or unit when unmeasurable). Restored exactly by dispose().
        const s = clamp(1 - suck, 0.02, 1.4);
        subject.scale.set(baseScale.x * s, baseScale.y * s, baseScale.z * s);
        const h = localBox ? localBox.max.y - localBox.min.y : 0;
        const ref = h > 1e-6 ? h : 1;
        const cornerId = str(params.corner, 'br');
        const drift = 0.5 * ref * clamp(suck, 0, 1);
        subject.position.set(
          basePos.x + (cornerId.includes('r') ? drift : -drift),
          basePos.y + (cornerId.includes('t') ? drift : -drift),
          basePos.z,
        );
      };

      let lastT = 0;

      const applySeek = (t: number) => {
        lastT = t;
        // Read params live so control changes apply without a rebuild.
        uK.value = clamp(num(params.curvature, 1.7), 0.2, 4);
        uSuck.value = suckAt(t);
        if (canOverlay) {
          applyCorner(str(params.corner, 'br'));
          // LIVE TRANSFORM TRACKING — co-bindings keep animating the hidden
          // subject; re-register the overlay on its CURRENT local pose.
          overlayGroup.position.copy(subject.position);
          overlayGroup.quaternion.copy(subject.quaternion);
          overlayGroup.scale.copy(subject.scale);
          // LATE TEXTURE POUR — rebuild from the live source the moment the
          // material instance or its map identity changes (a clone taken at
          // create would render map-less white in the real app forever).
          const src = liveSourceMaterial();
          const liveMap = (src?.map as Texture | null | undefined) ?? null;
          if (src !== builtSrcMat || liveMap !== builtSrcMap) buildOverlay();
          // DOCK GLOW (no-empty-phase must-fix): swell in as the sheet is
          // swallowed, pulse deterministically through the held beat (cos of
          // the cycle clock — no Math.random), gone below GLOW_START. The
          // held-in-the-point frames now read as a living glowing dock
          // point, never an empty tile.
          const s = clamp(uSuck.value, 0, 1);
          const env =
            s <= GLOW_START ? 0 : Math.pow((s - GLOW_START) / (1 - GLOW_START), 1.5);
          const pulse = 0.82 + 0.18 * Math.cos(t * Math.PI * 2 * GLOW_PULSE_HZ);
          uGlow.value = env * pulse;
          if (glowMesh) {
            glowMesh.visible = uGlow.value > 0.004;
            glowMesh.scale.setScalar(0.55 + 0.45 * env);
          }
          // Rigid chrome (the dot) re-poses on the warped surface.
          placeRigidChrome();
        } else {
          applyFallback(uSuck.value);
        }
      };

      return {
        duration: () => Math.max(0.1, num(params.duration, 3.2)),
        seek: (t) => applySeek(t),
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'curvature') uK.value = clamp(num(value, 1.7), 0.2, 4);
          else if (id === 'corner' && typeof value === 'string' && canOverlay)
            applyCorner(value);
          // Paused control tweaks (the CONTROLS gate drives one control at a
          // pinned t) must land on the CPU-posed chrome + glow immediately —
          // re-apply the full frame state at the live time.
          applySeek(lastT);
        },
        dispose: () => {
          if (canOverlay) {
            if (overlayMesh) {
              // Ours alone — the shared texture rides the SUBJECT's material
              // and is never disposed here.
              overlayMesh.geometry.dispose();
              (overlayMesh.material as Material).dispose();
              overlayGroup.remove(overlayMesh);
              overlayMesh = null;
            }
            if (glowMesh) {
              glowMesh.geometry.dispose();
              (glowMesh.material as Material).dispose();
              overlayGroup.remove(glowMesh);
              glowMesh = null;
            }
            for (const m of bentChrome) {
              m.geometry.dispose(); // ours — created PlaneGeometry
              (m.material as Material).dispose();
              overlayGroup.remove(m);
            }
            bentChrome.length = 0;
            for (const c of rigidChrome) {
              // Geometry is the SUBJECT's, shared by reference — never
              // disposed here. The cloned material is ours.
              (c.mesh.material as Material).dispose();
              overlayGroup.remove(c.mesh);
            }
            rigidChrome.length = 0;
            if (overlayGroup.parent) overlayGroup.parent.remove(overlayGroup);
            subject.visible = prevVisible;
          } else {
            subject.position.copy(basePos);
            subject.scale.copy(baseScale);
          }
          delete target.userData.genieSuck;
        },
      };
    },
  ),
};
