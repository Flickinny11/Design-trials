// hover-liquid-distort — the surface goes LIQUID under the cursor: slow viscous
// ripples well out from the touch point and settle like honey when the pointer
// leaves. HARD / displacement / TEXTURE-PRESERVING (mountable) GPU vertex-lane
// + UV-warp TSL primitive.
//
// DESIGN-REFERENCES §1 (curtains.js signature hover distortion — the
// `dist = distance(uv, uMouse); strength = smoothstep(0.3, 0.0, dist)`
// proximity kernel, mouse-reactive uniforms) implemented natively in TSL on our
// three/webgpu stack, plus §11 "Displacement Mapping on Hover" (the
// hover-strength-gated radial UV displacement). The curtains "double read" —
// the field both DISPLACES the plane AND warps the texture sampling — is the
// whole signature, so this primitive does both.
//
// THE WAVE DIFFERENTIATOR (primitives-expansion W3): the 21 existing
// 'displacement' primitives SWAP subject.material for their own shader look, so
// the category sits in UNMOUNTABLE_CATEGORIES and is skipped on mounted
// artifacts. This one PRESERVES the subject's own look and declares
// `mountable: true`, so the AI builder can drop it on ANY mounted element:
//   - The subject's materials/geometry are NEVER mutated or replaced. An overlay
//     SHEET (subdivided panel, sized/placed from the subject's MEASURED local
//     bbox) stands in while active; the real subject is hidden and restored +
//     everything we created disposed on dispose().
//   - The sheet carries the subject's FULL look: colorNode samples the live
//     material's `.map` BY REFERENCE (through WARPED UVs — the curtains double
//     read) when present; map-less, it copies color AND PBR scalars
//     (roughness/metalness/envMapIntensity/emissive) so it shades identically
//     under the rig lights. The live material is re-checked EVERY seek (mounted
//     artifacts pour textures asynchronously) and the sheet rebuilds when the
//     material instance or its map identity changes.
//   - COMPOSITE CARD CHROME rides the field: the brass header / grey rows are
//     subdivided BENT clones baked into the sheet frame (the analytic field is
//     applied in the same TSL vertex lane), and the small accent dot is a RIGID
//     clone posed per seek by a CPU mirror of the field at its center. The full
//     card look wells under the cursor — not a blank deformed slab.
//
// THE LIQUID FIELD  F(p, t) — a radial liquid well centered at the pointer's
// subject-space position m:
//   r    = |p.xy - m|                         (subject-local distance)
//   prox = smoothstep(spread, 0, r)           (curtains kernel: 1 at touch → 0 at edge)
//   well = Σ_k  sin(r·freqₖ − t·ringSpeed + φₖ) · exp(−r·falloffₖ)   (2-3 damped rings)
//   F    = amplitude · env · prox · well       (env = persisted touch envelope)
// The rings use index-hashed phase offsets φₖ and per-ring frequency/falloff so
// they don't beat into a single sharp pulse — they read as overlapping viscous
// swells. F displaces the sheet in +z (welling toward the camera) and adds a
// small tangential SWIRL in-plane (the liquid curls around the touch). The
// texture sampling UV is pushed radially outward by F (the §11 double read).
//
// VISCOSITY / THE SETTLING HONEY — a persisted touch envelope `env` ∈ [0,1]:
//   target = (pointer engaged) ? prox_at_pointer : 0
//   env   += (target − env) · rate · dt        (dt from consecutive seek t)
// where the rise rate is brisk (the liquid responds) but the FALL rate is
// `viscosity`-scaled and slow, so leaving the pointer lets the rings settle
// like honey rather than snapping flat. Because env PERSISTS, repeated seeks at
// the pinned engaged state (the harness CONTROL sweep) hold a steady visible
// welling that amplitude/viscosity/ring/swirl sweeps re-shape — and the idle
// frame (pointer disengaged, t=0) settles to env≈0, fully legible & undistorted.
//
// POINTER-RIG FACTS honored: pointer is `userData.pointer {x,y}` in 0..1, ABSENT
// at idle (engaged pin = {0.62, 0.5}, proximity 0.7-0.9). Non-finite guarded.
// All amplitudes are SUBJECT-RELATIVE (Box3-measured), so the whole well
// envelope stays inside the tile frame at default params. onParamChange
// re-applies at the last seek state. Deterministic (index hashes, no
// Math.random); DOM-free; TSL-only (runs on WebGPU + WebGL2 fallback).
//
// DISTINCT from its neighbors:
//   - pointer-ripple (material-swap, unmountable): SHARP expanding emissive
//     rings travelling outward continuously — a struck drum-skin. This one is
//     SLOW viscous WELLING that settles like honey, texture-preserving and
//     mountable, displacing real geometry (not just painting emissive rings).
//   - ripple-displace (time-driven, unmountable): a single concentric shockwave
//     from the FIXED center that flattens to crisp. This one wells from the
//     MOVING pointer and persists a viscous settle envelope — no fixed center,
//     no one-shot.

import {
  Box3,
  Color,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Vector2,
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
  exp,
  faceDirection,
  float,
  length as tslLength,
  max as tslMax,
  mix,
  positionLocal,
  sin,
  smoothstep,
  sqrt as tslSqrt,
  texture as tslTexture,
  transformNormalToView,
  uniform,
  uv as tslUv,
  vec2,
  vec3,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { clamp, num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  // Well height as a FRACTION of the subject's short side — scale-free, so the
  // liquid reads identically on a 1.8-unit catalog card and a 40-unit hero.
  { id: 'amplitude', label: 'Ripple Amplitude', type: 'knob', min: 0.02, max: 0.3, step: 0.005, default: 0.19 },
  // Settle rate: low = slow, viscous honey (rings linger after the pointer
  // leaves); high = thin water that drains fast. The premium look is viscous.
  { id: 'viscosity', label: 'Viscosity', type: 'knob', min: 0.05, max: 1, step: 0.01, default: 0.22 },
  // How many damped sine rings well out of the touch (1-3 overlapping swells).
  { id: 'rings', label: 'Rings', type: 'knob', min: 1, max: 3, step: 1, default: 2 },
  // Reach of the touch: fraction of the short side the well fades out over.
  { id: 'spread', label: 'Spread', type: 'knob', min: 0.25, max: 1.4, step: 0.05, default: 0.85 },
  // In-plane swirl: how much the liquid curls tangentially around the touch.
  { id: 'swirl', label: 'Swirl', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.35 },
] as const;

// Brisk rise (the liquid responds at once), viscosity-scaled slow fall.
const RISE_RATE = 9; // env ramps up toward proximity at this per-second rate
const DT_MAX = 0.1; // seek-delta clamp (driver hiccup guard)
// Below this seek time a PINNED (paused/rewound) frame is the timeline's
// untouched resting state → the well snaps flat regardless of the orbit pointer
// the rig re-feeds. The harness idle pin is seek(name,0); its engaged control
// pin is seek(name,1), comfortably above this, so a control-sweep pin holds a
// real standing well.
const IDLE_T = 0.25;
const SEG = 64; // sheet subdivision (both axes)
const CHROME_SEG = 24; // bent chrome clone subdivision (wide bars curl smoothly)
const RIGID_FRAC = 0.15; // a child below this footprint fraction is posed rigidly (the dot)
// Per-ring frequency / falloff bases — index-hashed so rings don't beat into
// one sharp pulse. Ring k: freq = FREQ_BASE*(1 + 0.6k), falloff = FALL_BASE*(1 + 0.4k).
const FREQ_BASE = 13;
const FALL_BASE = 2.4;
const RING_SPEED = 2.1; // slow phase drift (viscous, not a fast strobe)

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

/** First Mesh descendant carrying a material (the subject may be a Group). */
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

/** A small chrome child posed rigidly per seek (CPU mirror of the field).
 *  Offsets are in the SHEET's frame: ox/oy from the sheet center, dz proud of
 *  the sheet surface. */
interface RigidChromeClone {
  mesh: Mesh;
  ox: number;
  oy: number;
  dz: number;
}

export const hoverLiquidDistortPrimitive: PrimitiveDefinition = {
  name: 'hover-liquid-distort',
  label: 'Hover Liquid Distort',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'pointer',
  // TEXTURE-PRESERVING displacement — overlays, never replaces, the subject's
  // look, so it may run on mounted artifacts despite the 'displacement' skip.
  mountable: true,
  schema: SCHEMA,
  description:
    'The surface goes liquid under the cursor — slow viscous ripples well out from the touch point and settle like honey when the pointer leaves.',
  create: defineAnimatable(
    { name: 'hover-liquid-distort', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const repMesh = findRepresentativeMesh(subject);

      /** The representative mesh's CURRENT first material — read live, never
       *  cached: the mounted plane factory pours `.map` asynchronously and
       *  applyImageSpec may swap the material after this primitive attaches. */
      const liveSourceMaterial = (): MappedMaterial | null => {
        if (!repMesh) return null;
        const m = repMesh.material;
        return ((Array.isArray(m) ? m[0] : m) as MappedMaterial | undefined) ?? null;
      };

      // ── Measure in the subject's OWN local frame (no hardcoded units) ────
      // GEOMETRY-BASED (the genie-suck lesson): each mesh's geometry bbox is
      // mapped mesh-local → subject-local directly; a world-AABB route
      // double-inflates whenever the subject is tilted at measure time. The
      // sheet spans the UNION of all meshes (Group subjects keep their full
      // footprint); its face z is the REPRESENTATIVE mesh's front face.
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

      // ── Fallback state ('whole-subject' mode: the group itself wells in z) ─
      const baseZ = subject.position.z;
      const prevVisible = subject.visible;

      // ── Field uniforms (one TSL graph serves the sheet + every bent clone) ─
      const uEnv = uniform(0); // persisted touch envelope (0 idle → ~prox engaged)
      const uAmp = uniform(0); // well height in LOCAL units (amplitude × shortSide)
      const uTime = uniform(0); // slow ring phase drift
      const uSpread = uniform(0.85); // well reach in LOCAL units
      const uSwirl = uniform(0.35); // in-plane swirl strength (0..1)
      const uRings = uniform(2); // active ring count (1..3)
      const uMouse = uniform(new Vector2(0, 0)); // pointer in SUBJECT-LOCAL xy
      const uColor = uniform(new Color('#ffffff')); // map-less fallback tint
      const uOpacity = uniform(1); // live source opacity (mask multiplies it)
      // VISCOSITY AS A STANDING FUNCTION (the W3 fix): viscosity shapes the
      // FROZEN engaged pose, not only the fall-rate (which is invisible on a
      // paused frame). High viscosity = thick honey → a BROADER, TALLER, longer-
      // reaching well (rings linger out from the touch); low viscosity = thin
      // water → a TIGHT, sharp, shallower well. So viscosity drives (a) per-ring
      // falloff DOWN as it rises (rings reach further) and (b) a standing
      // amplitude boost. Both reshape the pinned engaged frame measurably.
      const uViscBoost = uniform(1); // standing well-height multiplier (thicker = taller)
      // Per-ring damping falloff — now UNIFORMS (was baked constants) so viscosity
      // can widen/tighten the well live at the paused pin.
      const uFall0 = uniform(FALL_BASE);
      const uFall1 = uniform(FALL_BASE * 1.4);
      const uFall2 = uniform(FALL_BASE * 1.8);
      // Per-ring constants (index-hashed phases) — fixed, so the TSL graph is
      // built once. Ring k contributes only when k < uRings (a smoothstep gate).
      const uPhase0 = uniform(hash1(1) * Math.PI * 2);
      const uPhase1 = uniform(hash1(2) * Math.PI * 2);
      const uPhase2 = uniform(hash1(3) * Math.PI * 2);
      // Rounded-corner SDF mask (the card silhouette). uMaskR = 0 disables it.
      const uMaskHalfW = uniform(1);
      const uMaskHalfH = uniform(1);
      const uMaskR = uniform(0);
      const uMaskEdge = uniform(1e-3);

      // Sheet extents (subject-local), filled when the overlay is built.
      let halfW = 0.5;
      let halfH = 0.5;
      let shortSide = 1;
      let cornerR = 0;
      let sheetX = 0;
      let sheetY = 0;
      let faceZ = 0;

      // ── The radial liquid field, shared by the sheet + bent chrome ────────
      // p is the vertex's position in the sheet frame; the field is centered at
      // uMouse (subject-local). Built once; the gradient feeds the bent normal.
      const px = positionLocal.x.add(float(sheetX));
      const py = positionLocal.y.add(float(sheetY));
      const dx = px.sub(uMouse.x);
      const dy = py.sub(uMouse.y);
      const rSafe = tslMax(tslSqrt(dx.mul(dx).add(dy.mul(dy))), float(1e-4));
      // curtains kernel: 1 at the touch → 0 at `spread` reach.
      const prox = smoothstep(uSpread, float(0), rSafe);

      /** One damped sine ring k: sin(r·freqₖ − t·speed + φₖ)·exp(−r·falloffₖ),
       *  gated to 0 when k ≥ uRings. phaseU and fallU are scalar uniform nodes —
       *  the repo TSL types erase their float-ness through the generic param, so
       *  they ride the standard `as unknown as` escape-hatch into the chain.
       *  fallU is VISCOSITY-DRIVEN (lower = thicker honey → rings reach further). */
      const ring = (
        k: number,
        freq: number,
        fallU: ReturnType<typeof uniform>,
        phaseU: ReturnType<typeof uniform>,
      ) => {
        const phaseN = phaseU as unknown as Parameters<typeof float>[0];
        const fallN = fallU as unknown as Parameters<typeof float>[0];
        const wave = sin(rSafe.mul(float(freq)).sub(uTime.mul(float(RING_SPEED))).add(float(phaseN)));
        const env = exp(rSafe.mul(float(fallN).negate()));
        // gate: 1 while k < uRings, ramping off across the [k, k+1) band.
        const gate = tslClamp(uRings.sub(float(k)), 0, 1);
        return wave.mul(env).mul(gate);
      };
      const well = ring(0, FREQ_BASE, uFall0, uPhase0)
        .add(ring(1, FREQ_BASE * 1.6, uFall1, uPhase1))
        .add(ring(2, FREQ_BASE * 2.2, uFall2, uPhase2));
      // Field height (local units): amplitude × viscosity-boost × env × prox × rings.
      const fieldH = uAmp.mul(uViscBoost).mul(uEnv).mul(prox).mul(well);

      // ── Vertex displacement (welling +z + tangential swirl) ───────────────
      // The well pushes the surface TOWARD the camera (+z); a tangential swirl
      // curls the surface in-plane around the touch (perpendicular to the
      // radial direction), so the liquid reads as curling, not just bulging.
      const invR = float(1).div(rSafe);
      const nrx = dx.mul(invR); // radial unit x
      const nry = dy.mul(invR); // radial unit y
      // tangential = perp(radial) = (−nry, nrx); swirl amplitude follows fieldH.
      const swirlAmt = fieldH.mul(uSwirl).mul(float(0.6));
      const dispX = nry.negate().mul(swirlAmt);
      const dispY = nrx.mul(swirlAmt);
      // Analytic bent normal: a +z bump of height h over a radial falloff has a
      // surface slope ≈ −dh/dr along the radial direction; we approximate the
      // tilt with the proximity-weighted radial gradient so the well SHADES
      // honestly under the rig key light (a z-only bump face-on is invisible).
      const slope = fieldH.mul(float(-6)).mul(invR); // dz along radial, scaled
      const nTravelX = slope.mul(nrx);
      const nTravelY = slope.mul(nry);
      const bentNormal = vec3(nTravelX, nTravelY, float(1)).normalize();
      // Z-aware: surface point at localZ=0, offset along the bent normal by the
      // vertex's own height so chrome proud of the face rides the CURVED well.
      const surfacePos = vec3(
        positionLocal.x.add(dispX),
        positionLocal.y.add(dispY),
        positionLocal.z.add(fieldH),
      );
      const bentPos = (
        surfacePos as unknown as { add: (o: unknown) => unknown }
      ).add((bentNormal as unknown as { mul: (o: unknown) => unknown }).mul(positionLocal.z.mul(float(0))));
      // Custom normalNode bypasses three's DoubleSide back-face flip — multiply
      // by faceDirection so both faces of the well shade honestly.
      const bentNormalView = (
        transformNormalToView(bentNormal).normalize() as unknown as {
          mul: (n: unknown) => unknown;
        }
      ).mul(faceDirection);

      // ── Warped-UV texture sampling (the curtains DOUBLE READ) ─────────────
      // Push the sampling uv radially OUTWARD by the field, so the painted
      // texture stretches over the well exactly like curtains' distorted read.
      // Built with the vec2(x, y) constructor (the heat-haze-refract pattern)
      // so the node type is a clean vec2 the texture() overload accepts.
      const u = tslUv();
      // Warp gain: how hard the painted texture rides the well (the curtains
      // double read). Lifted from 2.2 → 3.0 so the card's own header/rows visibly
      // stretch over the moving well during play, raising the per-frame texture
      // motion (the advocate's play-strength bar) without touching geometry.
      const warpStrength = fieldH.mul(float(3.0));
      const warpedUv = vec2(
        u.x.add(u.x.sub(float(0.5)).mul(warpStrength)),
        u.y.add(u.y.sub(float(0.5)).mul(warpStrength)),
      );

      // Rounded-corner SDF mask in the sheet frame (the card silhouette).
      const qx = tslMax(tslAbs(positionLocal.x).sub(uMaskHalfW.sub(uMaskR)), float(0));
      const qy = tslMax(tslAbs(positionLocal.y).sub(uMaskHalfH.sub(uMaskR)), float(0));
      const cornerSdf = tslSqrt(qx.mul(qx).add(qy.mul(qy))).sub(uMaskR);
      const maskOpacity = smoothstep(float(0).sub(uMaskEdge), uMaskEdge, cornerSdf)
        .oneMinus()
        .mul(uOpacity);

      // ── Overlay sheet (scroll-stagger-rise hide/overlay pattern) ──────────
      const overlay = new Group();
      overlay.name = 'hover-liquid-overlay';
      let sheet: Mesh | null = null;
      const bentChrome: Mesh[] = [];
      const rigidChrome: RigidChromeClone[] = [];

      // What the current sheet material was built FROM (compared each seek).
      let builtSrcMat: MappedMaterial | null = null;
      let builtSrcMap: Texture | null = null;

      /** Build a node material carrying the subject's OWN look: colorNode
       *  samples the live texture through the WARPED uv by reference, or the
       *  live color via the tracked uColor uniform — never an invented fill.
       *  PBR scalars are copied so the sheet shades like the hidden subject. */
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
          mat.opacity = src.opacity;
          mat.transparent = src.transparent || src.opacity < 1;
          if (src.color) uColor.value.copy(src.color);
          uOpacity.value = src.opacity;
        }
        mat.side = DoubleSide; // the welling surface shows both faces
        const m = mat as unknown as {
          colorNode: unknown;
          positionNode: unknown;
          normalNode: unknown;
          opacityNode: unknown;
        };
        // The curtains double read: sample the SHARED texture through warpedUv.
        m.colorNode = builtSrcMap ? tslTexture(builtSrcMap, warpedUv) : uColor;
        m.positionNode = bentPos;
        m.normalNode = bentNormalView;
        if (cornerR > 0) {
          m.opacityNode = maskOpacity;
          mat.transparent = true;
          mat.alphaTest = 0.01;
        }
        return mat;
      };

      /** A bent chrome clone's material: the child's OWN color/emissive/PBR
       *  scalars copied, any map shared BY REFERENCE — never an invented fill.
       *  Shares the sheet's field position/normal trees. */
      const buildChromeMaterial = (src: MappedMaterial): MeshStandardNodeMaterial => {
        const mat = new MeshStandardNodeMaterial();
        if (src.color) mat.color.copy(src.color);
        const srcMap = (src.map as Texture | null | undefined) ?? null;
        if (srcMap) mat.map = srcMap;
        if (src.emissive) mat.emissive.copy(src.emissive);
        if (typeof src.emissiveIntensity === 'number') mat.emissiveIntensity = src.emissiveIntensity;
        if (typeof src.roughness === 'number') mat.roughness = src.roughness;
        if (typeof src.metalness === 'number') mat.metalness = src.metalness;
        if (typeof src.envMapIntensity === 'number') mat.envMapIntensity = src.envMapIntensity;
        mat.opacity = src.opacity;
        mat.transparent = src.transparent || src.opacity < 1;
        mat.side = DoubleSide;
        const m = mat as unknown as { positionNode: unknown; normalNode: unknown };
        m.positionNode = bentPos;
        m.normalNode = bentNormalView;
        return mat;
      };

      if (canOverlay && localBox && faceBox) {
        const w = localBox.max.x - localBox.min.x || 1;
        const h = localBox.max.y - localBox.min.y || 1;
        halfW = w / 2;
        halfH = h / 2;
        shortSide = Math.min(w, h);
        sheetX = (localBox.min.x + localBox.max.x) / 2;
        sheetY = (localBox.min.y + localBox.max.y) / 2;
        faceZ = faceBox.max.z;
        const repParams = (repMesh?.geometry as { parameters?: { radius?: number } } | undefined)
          ?.parameters;
        cornerR = Math.min(
          Math.max(typeof repParams?.radius === 'number' ? repParams.radius : 0, 0),
          Math.min(halfW, halfH),
        );
        uMaskHalfW.value = halfW;
        uMaskHalfH.value = halfH;
        uMaskR.value = cornerR;
        uMaskEdge.value = Math.max(cornerR * 0.05, 1e-3);

        sheet = new Mesh(new PlaneGeometry(w, h, SEG, SEG), buildMaterial());
        sheet.name = 'hover-liquid-sheet';
        sheet.position.set(sheetX, sheetY, faceZ);
        overlay.add(sheet);

        // ── Chrome clones: every non-representative mesh child rides the well.
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
            const cw = childBox.max.x - childBox.min.x;
            const ch = childBox.max.y - childBox.min.y;
            const ox = (childBox.min.x + childBox.max.x) / 2 - sheetX;
            const oy = (childBox.min.y + childBox.max.y) / 2 - sheetY;
            if (cw < RIGID_FRAC * w && ch < RIGID_FRAC * h) {
              // Small chrome (the dot): rigid clone — REAL geometry by reference
              // (never disposed by us), material clone (ours), posed per seek.
              const m = new Mesh(child.geometry as BufferGeometry, srcMat.clone());
              m.name = `hover-liquid-chrome-rigid:${child.name || 'mesh'}`;
              overlay.add(m);
              rigidChrome.push({
                mesh: m,
                ox,
                oy,
                dz: (childBox.min.z + childBox.max.z) / 2 - faceZ,
              });
            } else {
              // Wide chrome (header/rows): a subdivided flat bar at the child's
              // front-face footprint, geometry BAKED into the sheet frame so the
              // shared field trees apply directly — the bar wells with the card.
              const geo = new PlaneGeometry(cw, ch, CHROME_SEG, CHROME_SEG);
              geo.translate(ox, oy, childBox.max.z - faceZ);
              const m = new Mesh(geo, buildChromeMaterial(srcMat));
              m.name = `hover-liquid-chrome-bent:${child.name || 'mesh'}`;
              m.position.set(sheetX, sheetY, faceZ); // sheet frame = geometry frame
              overlay.add(m);
              bentChrome.push(m);
            }
          });
        }

        // Sibling of the subject carrying its exact local pose (a hidden parent
        // hides its children, so the sheet cannot live under the subject).
        overlay.position.copy(subject.position);
        overlay.quaternion.copy(subject.quaternion);
        overlay.scale.copy(subject.scale);
        subject.parent!.add(overlay);
        subject.visible = false; // the sheet IS the subject now
      }

      // ── CPU mirror of the field (for the rigid dot + headless observability)
      const phases = [uPhase0.value, uPhase1.value, uPhase2.value];
      const freqs = [FREQ_BASE, FREQ_BASE * 1.6, FREQ_BASE * 2.2];
      /** Field height at a point in the SHEET frame (CPU mirror of fieldH). Reads
       *  the LIVE viscosity-driven falloff uniforms + standing boost so peakWell()
       *  and the rigid dot track the GPU well exactly as viscosity is swept. */
      const fieldAt = (sx: number, sy: number): number => {
        const wx = sx + sheetX;
        const wy = sy + sheetY;
        const dxx = wx - uMouse.value.x;
        const dyy = wy - uMouse.value.y;
        const r = Math.max(Math.hypot(dxx, dyy), 1e-4);
        const spread = Math.max(uSpread.value, 1e-4);
        const pr = clamp((spread - r) / spread, 0, 1);
        const proxC = pr * pr * (3 - 2 * pr); // smoothstep(spread,0,r)
        const rings = uRings.value;
        const falls = [uFall0.value, uFall1.value, uFall2.value];
        let sum = 0;
        for (let k = 0; k < 3; k++) {
          const gate = clamp(rings - k, 0, 1);
          if (gate <= 0) continue;
          const wave = Math.sin(r * freqs[k] - uTime.value * RING_SPEED + phases[k]);
          sum += wave * Math.exp(-r * falls[k]) * gate;
        }
        return uAmp.value * uViscBoost.value * uEnv.value * proxC * sum;
      };

      /** Pose the rigid chrome (the dot) on the welled surface each seek. */
      const placeRigidChrome = () => {
        for (const c of rigidChrome) {
          const h = fieldAt(c.ox, c.oy);
          // swirl: tangential displacement around the touch (CPU mirror).
          const wx = c.ox + sheetX;
          const wy = c.oy + sheetY;
          const dxx = wx - uMouse.value.x;
          const dyy = wy - uMouse.value.y;
          const r = Math.max(Math.hypot(dxx, dyy), 1e-4);
          const nrx = dxx / r;
          const nry = dyy / r;
          const swirl = h * uSwirl.value * 0.6;
          c.mesh.position.set(
            sheetX + c.ox - nry * swirl,
            sheetY + c.oy + nrx * swirl,
            faceZ + c.dz + h,
          );
        }
      };

      /** Peak well height the chrome rides — the field at the touch point,
       *  clamped to the sheet. Exposed for headless tests + the host. */
      const peakWell = (): number => {
        if (!localBox) return Math.abs(uAmp.value * uEnv.value);
        // Sample a small ring around the touch; the crest of the first ring is
        // a fraction of a wavelength out, so probe a few radii and take the max.
        const cx = uMouse.value.x - sheetX;
        const cy = uMouse.value.y - sheetY;
        let peak = 0;
        const wl = (Math.PI * 2) / FREQ_BASE;
        for (let i = 0; i <= 8; i++) {
          const rr = (i / 8) * wl * 1.5;
          for (let a = 0; a < 6; a++) {
            const ang = (a / 6) * Math.PI * 2;
            const sx = clamp(cx + Math.cos(ang) * rr, -halfW, halfW);
            const sy = clamp(cy + Math.sin(ang) * rr, -halfH, halfH);
            peak = Math.max(peak, Math.abs(fieldAt(sx, sy)));
          }
        }
        return peak;
      };

      /** Field displacement magnitude at a fixed radial offset OUT from the
       *  touch (a fraction of the subject short side), averaged around the ring.
       *  Unlike peakWell (which probes only the near crest), this measures the
       *  well's REACH — so it tracks `spread` honestly: a wide spread keeps the
       *  surface displaced this far out, a tight spread has faded to flat there.
       *  Exposed for headless tests + the host. */
      const fieldReach = (radiusFrac: number): number => {
        if (!localBox) return 0;
        const cx = uMouse.value.x - sheetX;
        const cy = uMouse.value.y - sheetY;
        const rr = radiusFrac * shortSide;
        let sum = 0;
        const N = 12;
        for (let a = 0; a < N; a++) {
          const ang = (a / N) * Math.PI * 2;
          const sx = clamp(cx + Math.cos(ang) * rr, -halfW, halfW);
          const sy = clamp(cy + Math.sin(ang) * rr, -halfH, halfH);
          sum += Math.abs(fieldAt(sx, sy));
        }
        return sum / N;
      };

      // Publish driven uniforms + the CPU field for the host + headless tests.
      const stash = {
        uEnv, uAmp, uTime, uSpread, uSwirl, uRings, uPointer: uMouse,
        uViscBoost, uFall0, uFall1, uFall2,
        peakWell, fieldReach,
      };
      target.userData.hoverLiquidDistort = stash;

      /** Pointer in 0..1, or null when disengaged (absent / non-finite). */
      const readPointer = (): { x: number; y: number } | null => {
        const p = (target.userData as { pointer?: { x?: unknown; y?: unknown } }).pointer;
        if (!p) return null;
        const x = typeof p.x === 'number' && Number.isFinite(p.x) ? p.x : null;
        const y = typeof p.y === 'number' && Number.isFinite(p.y) ? p.y : null;
        if (x === null || y === null) return null;
        return { x, y };
      };

      let lastT = 0;
      let initialized = false;

      const apply = (t: number) => {
        // STANDING-ENGAGED + FRESH-START semantics (the W3 regression fix). The
        // prior envelope was a pure temporal integral, which is DEAD at a pinned
        // frame BY CONSTRUCTION: the advocate control-sweep seeks back to t=1
        // (AFTER the play phase left lastT≈3.8), so the old rewind guard zeroed
        // uEnv and the dt-clamp (dt=0 at a repeated same-t seek) could never let
        // it recover — every control multiplied into uEnv=0 → flat card, all five
        // controls dead. The drag-elastic-warp idiom is the fix: the engaged
        // envelope is a STANDING function of pointer proximity that SNAPS to its
        // target whenever the clock is paused/rewound onto an engaged pose, so the
        // frozen engaged frame always holds a real well that the controls reshape.
        const dt = initialized ? clamp(t - lastT, 0, DT_MAX) : 0;
        const rewound = initialized && t < lastT - 1e-6;
        // A backward/zero jump means the driver re-pinned a frame (idle or the
        // control sweep): the temporal history is meaningless, so the envelope
        // must be re-derived from the CURRENT pointer pose, not integrated.
        const pinned = !initialized || dt <= 0 || rewound;
        lastT = t;
        initialized = true;
        uTime.value = t;

        // Live param reads (control changes apply without a rebuild).
        const amplitude = clamp(num(params.amplitude, 0.19), 0.02, 0.3);
        const viscosity = clamp(num(params.viscosity, 0.22), 0.05, 1);
        const spreadFrac = clamp(num(params.spread, 0.85), 0.25, 1.4);
        uSwirl.value = clamp(num(params.swirl, 0.35), 0, 1);
        uRings.value = clamp(Math.round(num(params.rings, 2)), 1, 3);
        uAmp.value = amplitude * shortSide; // subject-relative well height
        uSpread.value = spreadFrac * shortSide; // subject-relative reach

        // VISCOSITY → STANDING POSE. High viscosity = thick honey: rings damp
        // SLOWER (lower falloff → the well reaches further out) and the standing
        // crest is TALLER. Low viscosity = thin water: rings damp fast (tight
        // well) and the crest is shallower. Both reshape the FROZEN engaged
        // frame, so a paused viscosity sweep visibly re-shapes the well — the
        // namesake mechanic is now a position/phase function, not a fall-rate.
        const viscN = (viscosity - 0.05) / 0.95; // 0 at thin water → 1 at thick honey
        const fallScale = 1.65 - 1.05 * viscN; // 1.65× (tight) → 0.60× (broad honey)
        uFall0.value = FALL_BASE * fallScale;
        uFall1.value = FALL_BASE * 1.4 * fallScale;
        uFall2.value = FALL_BASE * 1.8 * fallScale;
        uViscBoost.value = 0.72 + 0.7 * viscN; // 0.72 (thin) → 1.42 (full honey crest)

        // Pointer → subject-local touch position + target envelope (proximity).
        const ptr = readPointer();
        let targetEnv = 0;
        if (ptr) {
          // Map pointer 0..1 across the subject's measured footprint. y is
          // flipped (screen-down → world-up). Center 0.5 → subject center.
          const mx = sheetX + (ptr.x - 0.5) * (halfW * 2);
          const my = sheetY + (0.5 - ptr.y) * (halfH * 2);
          uMouse.value.set(mx, my);
          // Proximity of the touch to the card: 1 inside, fading past the edge.
          const edgeR = Math.max(Math.hypot(halfW, halfH), 1e-4);
          const dCenter = Math.hypot(mx - sheetX, my - sheetY);
          const pr = clamp((edgeR - dCenter) / edgeR, 0, 1);
          targetEnv = pr * pr * (3 - 2 * pr); // smoothstep → 0.7-0.9 at the pin
        }

        // ── Envelope resolution ──────────────────────────────────────────────
        // IDLE PIN (t at the very start of the timeline): the surface has not
        // been touched yet — the resting card must be FLAT and legible even
        // though the rig re-feeds the orbit pointer at proximity ~0.7 on the
        // paused idle frame. Snap env to 0 so the captured idle frame is a
        // settled clean card (the resolved idle FLAG stays resolved).
        //
        // CONTROL/ENGAGED PIN (paused / rewound onto a later t, e.g. the
        // advocate's seek(name,1) control sweep): the envelope is the STANDING
        // proximity — an engaged pointer holds a real well that
        // amplitude/viscosity/spread/swirl/rings visibly reshape at the frozen
        // pose (the doctrine: a position function of the controls, never a
        // temporal one-shot that has decayed to flat by the pinned phase).
        //
        // FORWARD play (dt > 0): integrate — brisk rise toward the touch, slow
        // viscosity-scaled fall when the pointer leaves (the honey settle), so
        // the live hover and the disengage settle still animate exactly as named.
        if (pinned) {
          uEnv.value = t <= IDLE_T ? 0 : targetEnv;
        } else {
          const env = uEnv.value;
          const rate = targetEnv > env ? RISE_RATE : viscosity * 2.2;
          uEnv.value = clamp(env + (targetEnv - env) * clamp(rate * dt, 0, 1), 0, 1);
        }

        if (!canOverlay || !sheet) {
          // Fallback: nothing to overlay — the WHOLE subject wells toward the
          // camera (never placeholder geometry).
          subject.position.z = baseZ + uAmp.value * uEnv.value;
          return;
        }

        // (b) LIVE TRANSFORM TRACKING — co-bindings keep animating the hidden
        // subject; re-register the overlay on its CURRENT local pose.
        overlay.position.copy(subject.position);
        overlay.quaternion.copy(subject.quaternion);
        overlay.scale.copy(subject.scale);

        // (a) LATE TEXTURE POUR — rebuild the sheet's material the moment the
        // live source material instance or its map identity changes.
        const src = liveSourceMaterial();
        const liveMap = (src?.map as Texture | null | undefined) ?? null;
        if (src !== builtSrcMat || liveMap !== builtSrcMap) {
          const old = sheet.material as Material;
          sheet.material = buildMaterial();
          old.dispose(); // ours alone — never disposes the shared texture
        } else if (src && !liveMap && src.color) {
          uColor.value.copy(src.color); // live tint tracking on the fallback
        }

        placeRigidChrome();
      };

      // Deterministic initial state (the rig pins idle at t=0, disengaged).
      apply(0);

      return {
        // Stateful pointer effect: tracks the live pointer + viscous settle.
        duration: () => Infinity,
        seek: (t) => apply(t),
        // Re-apply at the live time so paused control tweaks (the CONTROLS gate
        // drives one control at the pinned engaged state) take effect.
        onParamChange: (_id: string, _value: ControlValue) => apply(lastT),
        dispose: () => {
          if (sheet) {
            if (overlay.parent) overlay.parent.remove(overlay);
            sheet.geometry.dispose();
            (sheet.material as Material).dispose();
            sheet = null;
            for (const m of bentChrome) {
              m.geometry.dispose(); // ours — created PlaneGeometry
              (m.material as Material).dispose();
            }
            bentChrome.length = 0;
            for (const c of rigidChrome) {
              // Geometry is the SUBJECT's, shared by reference — never disposed
              // here. The cloned material is ours.
              (c.mesh.material as Material).dispose();
            }
            rigidChrome.length = 0;
            subject.visible = prevVisible;
          } else {
            subject.position.z = baseZ;
          }
          delete target.userData.hoverLiquidDistort;
        },
      };
    },
  ),
};
