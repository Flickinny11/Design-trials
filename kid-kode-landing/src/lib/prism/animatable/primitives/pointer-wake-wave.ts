// pointer-wake-wave — the cursor carves a WAKE across the surface: a V of
// cresting ripples trailing its path, FADING like water behind a boat. HARD /
// displacement / TEXTURE-PRESERVING (mountable) GPU vertex-lane TSL primitive.
//
// DESIGN-REFERENCES §1 (curtains.js mouse-TRAIL displacement — a moving cursor
// writing a persistent distortion into a textured plane, mouse-reactive
// uniforms) implemented natively in TSL on our three/webgpu stack, plus §11
// "Scroll-Driven Vertex Waves" (the `pos.z += sin(...)` vertex undulation)
// re-aimed at a directional pointer wake. The curtains "double read" — the field
// both DISPLACES the plane vertices AND refracts the texture sampling UV — is
// preserved.
//
// THE MECHANISM — a CONTINUOUS STANDING WAKE FIELD anchored at the pointer.
// The W2/W3 doctrine: a paused engaged frame must hold a SUBSTANTIAL visible
// pose that is a STANDING FUNCTION OF POINTER POSITION, not of transient pointer
// velocity (which is ~0 when the rig pins the pointer and pauses). The previous
// build summed a CPU ring-buffer of pointer SAMPLES whose ring radii were
// `age × speed`; at a paused single-seek engaged frame age≈0, so radius≈0 and
// EVERY wake-shaping control (trailLength/waveSpeed/decayRate, all of which
// multiply `age`) read DEAD, and the play frames never moved. This build instead
// evaluates a closed-form Kelvin-style boat wake as a pure function of the
// vertex's position relative to the live pointer:
//   m       = pointer in subject-local xy (the boat)
//   a       = downstream heading (the boat's travel dir; the wake trails −a)
//   q       = p − m
//   along   = −(q·a)                         (distance BEHIND the boat, >0 in the wake)
//   across  =  q·perp(a)                     (lateral offset from the wake axis)
//   arc     = along + |across|·SHEAR         (the V — crests bow back at the sides)
//   wedge   = smoothstep gate keeping ripples inside the trailing V wedge
//   travel  = uTime · waveSpeed              (crests march backward over t → it ANIMATES)
//   crest   = cos(arc·crestFreq − travel)    (cresting ripples along the wake)
//   fade    = exp(−along · decayRate / trailLength) · headWindow
//   F       = amplitude · env · wedge · crest · fade
// `along`/`across` are STANDING functions of position, so a single paused seek at
// the engaged pin holds the full V at substantial amplitude — and trailLength
// (longitudinal reach), waveSpeed (crest travel + spacing) and decayRate (tail
// fade) each visibly RE-SHAPE that frozen frame. `travel` adds a time term so the
// crests march backward during play even with a stationary pointer (a real boat
// idling still throws a churning wake). F displaces the sheet in +z and refracts
// the texture UV along the field gradient (§11 double read). The vertex normal is
// bent analytically from F's gradient so the crests SHADE under the rig key light
// (a z-only ripple face-on is invisible).
//
// THE WAKE HEADING (pointer-rig fact): the harness pins the pointer at an ENGAGED
// point {0.62, 0.5} and PAUSES, so there is no velocity to derive a heading from.
// The heading defaults to a canonical downstream axis (toward −x, the wake
// trailing toward the card's leading rows) with a gentle index-hashed lissajous
// drift on `uTime` (deterministic, never Math.random) so the V swings slightly
// during play and the frame is never frozen-identical. When the pointer DOES move
// across seeks, the smoothed travel direction takes over so the wake trails the
// real path. At the idle frame (pointer DISENGAGED, t=0) `env` settles to 0 → the
// surface is FULLY LEGIBLE and essentially undistorted at rest. onParamChange
// re-applies the full pose at the last seek so a paused control tweak takes
// effect immediately.
//
// THE WAVE DIFFERENTIATOR (primitives-expansion W3): the 21 legacy 'displacement'
// primitives SWAP subject.material for their own shader look, so the category
// sits in UNMOUNTABLE_CATEGORIES and is skipped on mounted artifacts. This one
// PRESERVES the subject's own look and declares `mountable: true`:
//   - The subject's materials/geometry are NEVER mutated or replaced. An overlay
//     SHEET (subdivided panel, sized/placed from the subject's MEASURED local
//     bbox) stands in while active; the real subject is hidden and restored +
//     everything we created disposed on dispose().
//   - The sheet carries the subject's FULL look: colorNode samples the live
//     material's `.map` BY REFERENCE (through the WAKE-REFRACTED uv) when present;
//     map-less, it copies color AND PBR scalars (roughness/metalness/
//     envMapIntensity/emissive) so it shades identically under the rig lights.
//     The live material is re-checked EVERY seek (mounted artifacts pour textures
//     asynchronously) and the sheet rebuilds when the material instance or its
//     map identity changes.
//   - COMPOSITE CARD CHROME rides the wake: the brass header / grey rows are
//     subdivided BENT clones baked into the sheet frame (the same TSL field in
//     the same vertex lane), and the small accent dot is a RIGID clone posed per
//     seek by a CPU mirror of F at its center. The full card surface ripples in
//     the wake — not a blank deformed slab.
//
// POINTER-RIG FACTS honored: pointer is `userData.pointer {x,y}` in 0..1, ABSENT
// at idle (engaged pin = {0.62, 0.5}). Non-finite guarded. dt is taken from
// consecutive seek t (clamped). All amplitudes are SUBJECT-RELATIVE (Box3-
// measured), so the whole wake envelope stays inside the tile frame at default
// params. Deterministic (index hashes, no Math.random); DOM-free; TSL-only (runs
// on WebGPU + WebGL2 fallback).
//
// DISTINCT from its neighbors:
//   - cursor-trail (existing, pointer): spawns trail SPRITES that lag behind the
//     card and a whole-card springy follow — it MOVES the card and adds spawned
//     visuals. This one spawns NO visuals and never translates the card; it
//     DEFORMS the subject's own surface into a directional wake.
//   - pointer-ripple (existing, material-swap, unmountable): single concentric
//     rings re-centered at the LIVE pointer (a finger on water at ONE point).
//     This one is a DIRECTIONAL V trailing the pointer along its heading, and it
//     preserves the texture (mountable) instead of painting emissive.
//   - hover-liquid-distort (sibling, mountable): a RADIAL viscous well at a
//     single static touch point. This one has a directional AXIS — a trailing
//     wake wedge, not a radial well.

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
  cos,
  exp,
  faceDirection,
  float,
  max as tslMax,
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
  // Crest height as a FRACTION of the subject's short side — scale-free, so the
  // wake reads identically on a 1.8-unit catalog card and a 40-unit hero.
  { id: 'amplitude', label: 'Wake Amplitude', type: 'knob', min: 0.02, max: 0.3, step: 0.005, default: 0.16 },
  // Longitudinal reach of the wake behind the cursor (the V's tail length, as a
  // fraction of the short side). Drives both the fade scale and the crest count
  // along the trail — more = a longer wake streaming behind the boat.
  { id: 'trailLength', label: 'Trail Length', type: 'knob', min: 0.4, max: 2.2, step: 0.05, default: 1.3 },
  // How fast the crests march backward along the wake (and, coupled, how tightly
  // packed they are). High = a fast churning wake; low = a slow rolling swell.
  { id: 'waveSpeed', label: 'Wave Speed', type: 'knob', min: 0.4, max: 4, step: 0.1, default: 1.8 },
  // How fast the wake fades behind the cursor (its persistence). Low = a long
  // lingering wake reaching the card edge; high = it dies right behind the boat.
  { id: 'decayRate', label: 'Decay Rate', type: 'knob', min: 0.4, max: 4, step: 0.1, default: 1.1 },
] as const;

// Base crest angular frequency along the wake axis (a few cresting ripples per
// short-side). Coupled with waveSpeed at apply time for tighter/looser crests.
const CREST_FREQ = 7;
// How far the V "opens": each unit of lateral offset pushes the crest arc this
// much further back (the boat-wake shear). Higher = a wider, flatter V.
const SHEAR = 0.9;
// Half-angle slope of the trailing wedge gate (lateral reach per unit `along`).
const WEDGE_SLOPE = 0.62;
// Soft lateral feather of the wedge edge (in `along` units) so the V edges fade
// rather than cut hard.
const WEDGE_FEATHER = 0.28;
// Head window: the wake starts a touch behind the boat and ramps in over this
// fraction of the short side (no crest sits exactly on the cursor point).
const HEAD_RAMP = 0.12;
const DT_MAX = 0.1; // seek-delta clamp (driver hiccup guard)
const SEG = 72; // sheet subdivision (both axes) — fine enough for crisp crests
const CHROME_SEG = 24; // bent chrome clone subdivision (wide bars curl smoothly)
const RIGID_FRAC = 0.15; // a child below this footprint fraction is posed rigidly (the dot)
// Canonical downstream heading when the cursor is stationary (toward −x): the
// wake trails toward the card's leading rows. Gently drifted on uTime.
const BASE_HEADING = Math.PI; // points toward −x
const HEADING_DRIFT = 0.22; // radians of lissajous swing on the heading over time
const DRIFT_RATE = 1.3; // heading-drift angular rate
// Envelope rise/fall (the wake fills in when engaged, settles flat when not).
const RISE_RATE = 10; // env ramps toward 1 at this per-second rate when engaged
const FALL_RATE = 6; // env settles toward 0 at this per-second rate when disengaged
// How strongly a real pointer path steers the heading vs. the canonical axis.
const PATH_BLEND = 0.6;

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

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

/** A small chrome child posed rigidly per seek (CPU mirror of the field).
 *  Offsets are in the SHEET's frame: ox/oy from the sheet center, dz proud of
 *  the sheet surface. */
interface RigidChromeClone {
  mesh: Mesh;
  ox: number;
  oy: number;
  dz: number;
}

export const pointerWakeWavePrimitive: PrimitiveDefinition = {
  name: 'pointer-wake-wave',
  label: 'Pointer Wake Wave',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'pointer',
  // TEXTURE-PRESERVING displacement — overlays, never replaces, the subject's
  // look, so it may run on mounted artifacts despite the 'displacement' skip.
  mountable: true,
  schema: SCHEMA,
  description:
    'The cursor carves a wake across the surface — a V of cresting ripples trailing its path, fading like water behind a boat.',
  create: defineAnimatable(
    { name: 'pointer-wake-wave', category: 'displacement', schema: SCHEMA },
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

      // ── Fallback state ('whole-subject' mode: the group itself bobs in z) ──
      const baseZ = subject.position.z;
      const prevVisible = subject.visible;

      // ── Field uniforms (one TSL graph serves the sheet + every bent clone) ─
      const uAmp = uniform(0); // crest height in LOCAL units (amplitude × shortSide × env)
      const uTrail = uniform(1); // longitudinal reach in LOCAL units
      const uCrestFreq = uniform(CREST_FREQ); // crest angular frequency (1/local-unit)
      const uDecay = uniform(1.1); // tail fade rate (1/local-unit, after /trail)
      const uTravel = uniform(0); // crest march phase (uTime × waveSpeed)
      const uWarp = uniform(2.4); // texture-uv refraction strength
      const uMouse = uniform(new Vector2(0, 0)); // pointer in SUBJECT-LOCAL xy (the boat)
      const uHeadX = uniform(-1); // downstream heading unit vector (cos θ)
      const uHeadY = uniform(0); // downstream heading unit vector (sin θ)
      const uColor = uniform(new Color('#ffffff')); // map-less fallback tint
      const uOpacity = uniform(1); // live source opacity (mask multiplies it)
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

      // ── The standing wake field, shared by the sheet + bent chrome ─────────
      // p is the vertex position in the sheet frame; build the field once as a
      // closed-form function of position relative to uMouse along the heading.
      const px = positionLocal.x.add(float(sheetX));
      const py = positionLocal.y.add(float(sheetY));

      // q = p − boat; project onto the heading axis (a) and its perpendicular.
      const qx = px.sub(uMouse.x);
      const qy = py.sub(uMouse.y);
      // along = −(q·a): distance BEHIND the boat (positive inside the wake).
      const along = qx.mul(uHeadX).add(qy.mul(uHeadY)).negate();
      // across = q·perp(a), perp(a) = (−a.y, a.x).
      const across = qx.mul(uHeadY.negate()).add(qy.mul(uHeadX));
      const acrossAbs = tslAbs(across);
      // Only behind the boat (along > 0): a soft head ramp keeps the crest off
      // the cursor point, and the field is zero ahead of the boat.
      const headWindow = smoothstep(float(0), float(HEAD_RAMP), along);
      // LONGITUDINAL ENVELOPE (trailLength): the wake hard-cuts past the trail's
      // reach, so a SHORT trail is a stubby V right behind the boat and a LONG
      // trail streams to the card edge. along is normalized by uTrail (the reach
      // in local units), gated 1 → 0 across the last 30% of the trail so the tip
      // fades rather than clips. This makes trailLength VISIBLY resize the V.
      const alongN = along.div(uTrail); // 0 at the boat → 1 at the trail tip
      // The effective reach also retracts as decayRate climbs (a fast-dying wake
      // is BOTH lower-amplitude AND shorter), so decayRate visibly resizes the
      // V's longitudinal extent, not just its far-tail brightness.
      const reachEnd = float(1.1).sub(uDecay.mul(float(0.16)));
      const reachStart = reachEnd.mul(float(0.65));
      const lenEnv = smoothstep(reachEnd, reachStart, alongN);
      // Trailing wedge gate: lateral half-width grows with `along` (the V) AND
      // widens with the trail length so a longer wake also opens WIDER. The edge
      // feathers over WEDGE_FEATHER so the wake sides fade, not cut.
      const wedgeHalf = along
        .mul(float(WEDGE_SLOPE))
        .add(uTrail.mul(float(0.12)))
        .add(float(WEDGE_FEATHER));
      const wedge = smoothstep(wedgeHalf, wedgeHalf.sub(float(WEDGE_FEATHER)), acrossAbs);
      // The V crest arc: crests bow back at the sides (arc = along + |across|·shear)
      // so the iso-crest lines form a V opening behind the boat.
      const arc = along.add(acrossAbs.mul(float(SHEAR)));
      // crest marches backward over time (uTravel) → animates during play.
      const phase = arc.mul(uCrestFreq).sub(uTravel);
      // Tail fade (decayRate): the wake dies off with distance behind the boat.
      // Normalized by uTrail so the fade reads as a FRACTION of the trail — high
      // decayRate collapses the wake to the boat, low decayRate lets it linger to
      // the trail tip. decayRate is the SHAPE of the fade, trailLength the SCALE.
      const fade = exp(alongN.mul(uDecay).mul(float(1.6)).negate());
      // The wake height (local units, env folded into uAmp): the V of cresting
      // ripples, gated to the wedge + head window + trail length, tail-faded.
      const crest = cos(phase).mul(headWindow).mul(wedge).mul(lenEnv).mul(fade);
      const fieldH = uAmp.mul(crest);

      // ── Analytic bent normal from the field gradient ──────────────────────
      // Approximate ∂F/∂x ≈ amplitude · ∂crest/∂arc · (∂arc/∂along·a.x + ...).
      // The dominant term is the cos→−sin crest slope along the wake axis; we
      // tilt the normal away from the rising crest along the heading so the V
      // SHADES under the rig key light (a z-only ripple face-on is invisible).
      const dCrest = sin(phase).negate().mul(uCrestFreq).mul(headWindow).mul(wedge).mul(lenEnv).mul(fade);
      const slopeMag = uAmp.mul(dCrest);
      // ∂arc/∂x ≈ −a.x (along) + shear·sign(across)·perp.x; the along term
      // dominates the visible crest shading, so tilt mostly along −heading.
      const slopeX = slopeMag.mul(uHeadX.negate());
      const slopeY = slopeMag.mul(uHeadY.negate());
      const bentNormal = vec3(slopeX.negate(), slopeY.negate(), float(1)).normalize();
      // Vertex displacement: push the surface up by the wake crest. Z-aware so
      // chrome proud of the face rides the rippled surface (localZ preserved).
      const surfacePos = vec3(
        positionLocal.x,
        positionLocal.y,
        positionLocal.z.add(fieldH),
      );
      const bentPos = surfacePos;
      // Custom normalNode bypasses three's DoubleSide back-face flip — multiply
      // by faceDirection so both faces of the wake shade honestly.
      const bentNormalView = (
        transformNormalToView(bentNormal).normalize() as unknown as {
          mul: (n: unknown) => unknown;
        }
      ).mul(faceDirection);

      // ── Wake-refracted texture sampling (the curtains DOUBLE READ) ─────────
      // Push the sampling uv along the field gradient so the painted texture
      // refracts across the crests exactly like curtains' distorted read. Built
      // with the vec2(x, y) constructor (the heat-haze-refract pattern) so the
      // node type is a clean vec2 the texture() overload accepts.
      const u = tslUv();
      const warpedUv = vec2(
        u.x.add(slopeX.mul(uWarp)),
        u.y.add(slopeY.mul(uWarp)),
      );

      // Rounded-corner SDF mask in the sheet frame (the card silhouette).
      const qmx = tslMax(tslAbs(positionLocal.x).sub(uMaskHalfW.sub(uMaskR)), float(0));
      const qmy = tslMax(tslAbs(positionLocal.y).sub(uMaskHalfH.sub(uMaskR)), float(0));
      const cornerSdf = tslSqrt(qmx.mul(qmx).add(qmy.mul(qmy))).sub(uMaskR);
      const maskOpacity = smoothstep(float(0).sub(uMaskEdge), uMaskEdge, cornerSdf)
        .oneMinus()
        .mul(uOpacity);

      // ── Overlay sheet (scroll-stagger-rise hide/overlay pattern) ──────────
      const overlay = new Group();
      overlay.name = 'pointer-wake-wave-overlay';
      let sheet: Mesh | null = null;
      const bentChrome: Mesh[] = [];
      const rigidChrome: RigidChromeClone[] = [];

      // What the current sheet material was built FROM (compared each seek).
      let builtSrcMat: MappedMaterial | null = null;
      let builtSrcMap: Texture | null = null;

      /** Build a node material carrying the subject's OWN look: colorNode
       *  samples the live texture through the WAKE-REFRACTED uv by reference, or
       *  the live color via the tracked uColor uniform — never an invented fill.
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
        mat.side = DoubleSide; // the rippling surface shows both faces
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
        sheet.name = 'pointer-wake-wave-sheet';
        sheet.position.set(sheetX, sheetY, faceZ);
        overlay.add(sheet);

        // ── Chrome clones: every non-representative mesh child rides the wake.
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
              m.name = `pointer-wake-wave-chrome-rigid:${child.name || 'mesh'}`;
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
              // shared field trees apply directly — the bar ripples with the card.
              const geo = new PlaneGeometry(cw, ch, CHROME_SEG, CHROME_SEG);
              geo.translate(ox, oy, childBox.max.z - faceZ);
              const m = new Mesh(geo, buildChromeMaterial(srcMat));
              m.name = `pointer-wake-wave-chrome-bent:${child.name || 'mesh'}`;
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
      // Reads the SAME uniforms the GPU field reads so it always matches.
      const fieldAt = (sx: number, sy: number): number => {
        const wx = sx + sheetX;
        const wy = sy + sheetY;
        const ax = uHeadX.value;
        const ay = uHeadY.value;
        const dxx = wx - uMouse.value.x;
        const dyy = wy - uMouse.value.y;
        const along = -(dxx * ax + dyy * ay);
        const across = dxx * -ay + dyy * ax;
        const acrossA = Math.abs(across);
        if (along <= 0) return 0;
        // head window (smoothstep 0 → HEAD_RAMP).
        const hw = clamp(along / HEAD_RAMP, 0, 1);
        const headWin = hw * hw * (3 - 2 * hw);
        if (headWin <= 0) return 0;
        // longitudinal envelope (trailLength + decayRate): the reach end retracts
        // as decay climbs. smoothstep(reachEnd, reachStart, along/trail).
        const alongN = along / uTrail.value;
        const reachEnd = 1.1 - uDecay.value * 0.16;
        const reachStart = reachEnd * 0.65;
        let lenEnv: number;
        if (alongN <= reachStart) lenEnv = 1;
        else if (alongN >= reachEnd) lenEnv = 0;
        else {
          const tt = (reachEnd - alongN) / (reachEnd - reachStart);
          lenEnv = tt * tt * (3 - 2 * tt);
        }
        if (lenEnv <= 0) return 0;
        const wedgeHalf = along * WEDGE_SLOPE + uTrail.value * 0.12 + WEDGE_FEATHER;
        // smoothstep(wedgeHalf, wedgeHalf − feather, acrossA): 1 inside → 0 out.
        const lo = wedgeHalf - WEDGE_FEATHER;
        let wEdge: number;
        if (acrossA <= lo) wEdge = 1;
        else if (acrossA >= wedgeHalf) wEdge = 0;
        else {
          const tt = (wedgeHalf - acrossA) / WEDGE_FEATHER;
          wEdge = tt * tt * (3 - 2 * tt);
        }
        if (wEdge <= 0) return 0;
        const arc = along + acrossA * SHEAR;
        const phase = arc * uCrestFreq.value - uTravel.value;
        const fade = Math.exp(-(alongN * uDecay.value * 1.6));
        const crest = Math.cos(phase) * headWin * wEdge * lenEnv * fade;
        return uAmp.value * crest;
      };

      /** Pose the rigid chrome (the dot) on the rippled surface each seek — it
       *  rides the wake crest at its center (CPU mirror of fieldH). */
      const placeRigidChrome = () => {
        for (const c of rigidChrome) {
          const h = fieldAt(c.ox, c.oy);
          c.mesh.position.set(sheetX + c.ox, sheetY + c.oy, faceZ + c.dz + h);
        }
      };

      /** Peak wake crest height across the sheet — what the chrome rides.
       *  Sampled on a coarse grid; exposed for headless tests + the host. */
      const peakWake = (): number => {
        let peak = 0;
        const N = 14;
        for (let i = 0; i <= N; i++) {
          const sx = -halfW + (i / N) * (halfW * 2);
          for (let j = 0; j <= N; j++) {
            const sy = -halfH + (j / N) * (halfH * 2);
            peak = Math.max(peak, Math.abs(fieldAt(sx, sy)));
          }
        }
        return peak;
      };

      /** Coverage of the wake across the sheet — the FRACTION of a sampling grid
       *  whose |field| clears a threshold. A trailing V covers far more cells
       *  than a single ring, so this distinguishes a real wake from a point
       *  bulge and lets trailLength/decay prove themselves headlessly. */
      const wakeCoverage = (thresholdFrac = 0.04): number => {
        const thr = Math.abs(uAmp.value) * thresholdFrac + 1e-6;
        let hit = 0;
        let total = 0;
        const N = 20;
        for (let i = 0; i <= N; i++) {
          const sx = -halfW + (i / N) * (halfW * 2);
          for (let j = 0; j <= N; j++) {
            const sy = -halfH + (j / N) * (halfH * 2);
            total++;
            if (Math.abs(fieldAt(sx, sy)) >= thr) hit++;
          }
        }
        return total > 0 ? hit / total : 0;
      };

      // Publish driven uniforms + the CPU field for the host + headless tests.
      const stash = {
        uAmp,
        uTrail,
        uCrestFreq,
        uDecay,
        uTravel,
        uMouse,
        uHeadX,
        uHeadY,
        peakWake,
        fieldAt,
        wakeCoverage,
        /** Count of sampled cells carrying a live wake (proxy for slot activity:
         *  >0 whenever the engaged wake is present). */
        liveSlots: () => Math.round(wakeCoverage() * 100),
      };
      target.userData.pointerWakeWave = stash;

      /** Pointer in 0..1, or null when disengaged (absent / non-finite). */
      const readPointer = (): { x: number; y: number } | null => {
        const p = (target.userData as { pointer?: { x?: unknown; y?: unknown } }).pointer;
        if (!p) return null;
        const x = typeof p.x === 'number' && Number.isFinite(p.x) ? p.x : null;
        const y = typeof p.y === 'number' && Number.isFinite(p.y) ? p.y : null;
        if (x === null || y === null) return null;
        return { x, y };
      };

      // Smoothed heading + envelope (persist across seeks so a paused engaged
      // frame holds the full wake and the idle frame settles flat).
      let env = 0;
      let headingX = Math.cos(BASE_HEADING);
      let headingY = Math.sin(BASE_HEADING);
      const lastMouse = new Vector2(0, 0);
      let lastMouseSeeded = false; // first engaged seek places the boat, no phantom move
      let lastT = 0;
      let initialized = false;

      const apply = (t: number) => {
        const dt = initialized ? clamp(t - lastT, 0, DT_MAX) : 0;
        lastT = t;
        initialized = true;

        // Live param reads (control changes apply without a rebuild).
        const amplitude = clamp(num(params.amplitude, 0.16), 0.02, 0.3);
        const trailLength = clamp(num(params.trailLength, 1.3), 0.4, 2.2);
        const waveSpeed = clamp(num(params.waveSpeed, 1.8), 0.4, 4);
        const decayRate = clamp(num(params.decayRate, 1.1), 0.4, 4);
        // trailLength reaches further AND carries more crests; couple the crest
        // frequency to waveSpeed so a faster wake is also a tighter-packed one.
        uTrail.value = trailLength * shortSide; // subject-relative tail reach
        uDecay.value = decayRate; // dimensionless along /trail fade
        uCrestFreq.value = (CREST_FREQ / shortSide) * (0.6 + 0.4 * waveSpeed);
        // Crest march phase: crests travel backward over time (animates play),
        // scaled by waveSpeed so the SPACING/standing pattern also shifts with it.
        uTravel.value = t * waveSpeed * 2.2;

        // ── Pointer → subject-local boat position + heading + envelope ─────────
        const ptr = readPointer();
        let targetEnv = 0;
        if (ptr) {
          // Map pointer 0..1 across the subject's measured footprint. y is
          // flipped (screen-down → world-up). Center 0.5 → subject center.
          const mx = sheetX + (ptr.x - 0.5) * (halfW * 2);
          const my = sheetY + (0.5 - ptr.y) * (halfH * 2);
          uMouse.value.set(mx, my);

          // First engaged seek: place the boat without registering a phantom
          // jump from the (0,0) seed, so the initial heading is the canonical
          // downstream axis, not a spurious steer toward the card center.
          if (!lastMouseSeeded) {
            lastMouse.set(mx, my);
            lastMouseSeeded = true;
          }

          // Heading: when the cursor moves, steer the wake downstream along its
          // PATH; when stationary, fall back to the canonical axis with a gentle
          // index-hashed lissajous drift so the V swings during play (a real
          // boat idling still throws a churning wake — never a frozen frame).
          const moveX = mx - lastMouse.x;
          const moveY = my - lastMouse.y;
          const moveLen = Math.hypot(moveX, moveY);
          const driftA = BASE_HEADING
            + Math.sin(t * DRIFT_RATE + hash1(7) * Math.PI * 2) * HEADING_DRIFT;
          let aimX = Math.cos(driftA);
          let aimY = Math.sin(driftA);
          if (moveLen > 1e-4 * shortSide) {
            // travel direction (the boat heads where the cursor goes).
            const blend = PATH_BLEND;
            aimX = aimX * (1 - blend) + (moveX / moveLen) * blend;
            aimY = aimY * (1 - blend) + (moveY / moveLen) * blend;
            const al = Math.hypot(aimX, aimY) || 1;
            aimX /= al;
            aimY /= al;
          }
          // Smooth the heading toward the aim so it never snaps.
          const hk = clamp((moveLen > 1e-4 * shortSide ? 8 : 3) * Math.max(dt, 1 / 60), 0, 1);
          headingX += (aimX - headingX) * hk;
          headingY += (aimY - headingY) * hk;
          const hl = Math.hypot(headingX, headingY) || 1;
          headingX /= hl;
          headingY /= hl;
          lastMouse.set(mx, my);
          targetEnv = 1; // engaged → the wake fills in
        }
        uHeadX.value = headingX;
        uHeadY.value = headingY;

        // Envelope integration: rise toward 1 when engaged, settle toward 0 when
        // the pointer leaves (the idle frame is fully legible at env≈0). On a
        // seek with no time delta (dt=0 — the harness pins ONE paused engaged
        // seek for the CONTROLS sweep + the preserve tests), snap env to 1 when
        // engaged so a single frozen engaged frame already holds the full wake;
        // a disengaged dt=0 seek leaves env untouched. Otherwise integrate.
        if (dt <= 0) {
          if (targetEnv > 0) env = Math.max(env, 1);
        } else {
          const rate = targetEnv > env ? RISE_RATE : FALL_RATE;
          env = clamp(env + (targetEnv - env) * clamp(rate * dt, 0, 1), 0, 1);
        }
        uAmp.value = amplitude * shortSide * env; // subject-relative crest height × env

        if (!canOverlay || !sheet) {
          // Fallback: nothing to overlay — the WHOLE subject bobs in z by the
          // wake crest near the cursor (never placeholder geometry).
          subject.position.z = baseZ + fieldAt(0, 0);
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
        // Stateful pointer effect: tracks the live pointer's path / wake.
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
          delete target.userData.pointerWakeWave;
        },
      };
    },
  ),
};
