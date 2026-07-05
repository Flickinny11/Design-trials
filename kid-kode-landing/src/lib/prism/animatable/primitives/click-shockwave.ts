// click-shockwave — engage and a shockwave detonates from the center: ONE crisp
// pressure ring races outward across the surface, kicking it as it passes, with
// a trailing refraction wobble in the UV lane and a tiny decaying camera-shake
// at detonation. Re-engage re-fires. TEXTURE-PRESERVING / displacement /
// state-driven / mountable. (DESIGN-REFERENCES §11 "Advanced Shader Techniques
// Cookbook" — the displacement-on-hover + scroll-driven-vertex-wave ripple
// classes, recast as a STATE-fired single-ring pressure impulse rather than a
// hover-positioned standing distortion; the §1 curtains/VFX-JS hover-distortion
// class supplies the warped-UV refraction move.)
//
// THE WAVE DIFFERENTIATOR — TEXTURE-PRESERVING, MOUNTABLE (W3, 2026-06-12):
// the 21 legacy 'displacement' primitives SWAP subject.material for their own
// shader look, which is why the whole category sits in UNMOUNTABLE_CATEGORIES
// (bindings.ts) and is skipped on mounted artifacts. This one NEVER touches the
// subject's materials or geometry. It hides the real subject behind a SIBLING
// overlay carrying the subject's EXACT look — the live panel material's map
// (shared BY REFERENCE) sampled with WARPED UVs, or its color + PBR scalars
// when map-less — and declares `mountable: true` so the AI builder can drop the
// shockwave on ANY mounted element. dispose() restores + frees everything it
// created (never the subject's shared resources / by-reference map).
//
// THE FIELD — one dominant expanding ring (scroll-stagger-rise overlay
// discipline + cylinder-unroll TSL-vertex-lane + CPU-mirror chrome discipline):
//   radius   = speed * (tNow - tFire)         (in SUBJECT-RELATIVE units)
//   gauss(d) = exp(-(d/width)^2),  d = |r_uv - radius|       (ring cross-section)
//   z(p)     = +kick * gauss(d) * envelope(age)              (surface kicked out)
//   uvWarp   = aftershock * gauss(d) * radial_dir            (curtains refraction)
// where envelope(age) decays the pulse to nothing so the surface settles flat,
// and the SHEET vertices are displaced in the TSL vertex lane (honest bent
// normals where the ring slope would shade), while CHROME children kick rigidly
// along the same field — each child delayed by its distance from center, so the
// brass header / grey rows / violet dot visibly ride the ring outward then
// settle as it crosses them. A blank deformed slab = failure: the full card
// look rides the pressure wave.
//
// CAMERA-SHAKE (deterministic, no Math.random): at each crest's birth the WHOLE
// overlay gets a 1-2% subject-relative kick on a fixed phase (index/time hash),
// decaying as a SHARP transient over the first SHAKE_PHASE of the cycle — gone
// by the time the ring reaches mid-card, so the pinned/plateau frame carries no
// standing offset. A subtle "the room shook" read, never a random jitter.
//
// STATE / DRIVING (standing-ring doctrine, W3 fix): each seek reads
// `target.userData.state`. When ENGAGED (state truthy) OR with no state input
// (catalog tile / conformance harness — the tile always plays), the card
// carries a REPEATING traveling ring: the ring's phase is a DETERMINISTIC
// function of the seek time, phase = frac(t / CYCLE_PERIOD), so a fresh crest is
// born at the center, races off-card, and recycles — ONE clean ring alive at any
// instant. This is the whole point of the fix: at ANY pinned engaged phase
// (seek(t=1) for the control sweeps) a crisp mid-travel ring is on the card at
// SUBSTANTIAL amplitude, so width / kick / wobble / speed each visibly reshape
// the LIVE ring — never an empty after-state. The PLAY sequence then shows the
// ring racing outward as the clock advances. When state is EXPLICITLY DISENGAGED
// (state === false / 'off'), no ring runs and the card is clean. Idle (t=0) is
// always clean: phase 0 sits at the recycle seam where the envelope is 0, so no
// kick / no wobble / no warp — the card is fully legible and undistorted at rest.
//
// DISTINCT from its neighbors: pointer-ripple emits CONTINUOUS concentric rings
// centered wherever the POINTER is, forever — this is a SINGLE center-fired
// PRESSURE event (one ring, one detonation) with a real chrome kick and a
// camera-shake, fired by STATE not tracked by pointer; pulse is a whole-subject
// scale beat (no travelling front, no per-child delay). click-shockwave is the
// only one where a lone crisp ring detonates from the center and races out,
// kicking the surface and its chrome as it passes.

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
  length,
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
  // Ring travel speed — how fast the pressure front races out (fractions of the
  // subject half-span per second). Default = a crisp, snappy detonation.
  { id: 'speed', label: 'Ring Speed', type: 'knob', min: 0.4, max: 4, step: 0.05, default: 1.6, unit: '/s' },
  // Ring cross-section width as a FRACTION of the half-span — a tight crisp
  // pressure band by default.
  { id: 'width', label: 'Ring Width', type: 'knob', min: 0.04, max: 0.4, step: 0.005, default: 0.12 },
  // How hard the front kicks the surface out (fraction of the half-span).
  { id: 'kick', label: 'Kick Amplitude', type: 'fader', min: 0, max: 0.5, step: 0.01, default: 0.2 },
  // Trailing refraction wobble in the UV lane (curtains-class) — the surface's
  // own look shears as the ring passes.
  { id: 'wobble', label: 'Aftershock Wobble', type: 'knob', min: 0, max: 0.12, step: 0.005, default: 0.04 },
] as const;

// Sheet subdivision (a crisp ring crossing it needs fine tessellation).
const SEG = 96;
// Bent chrome clone subdivision — wide bars need enough verts to show the ring
// kink as it crosses them.
const CHROME_SEG = 24;
// A chrome child below this fraction of the sheet in BOTH axes is rigid (the
// dot) — posed per seek by a CPU mirror; wide bars are vertex-bent.
const RIGID_FRAC = 0.16;
// The ring's TRAVEL span: how many half-span-radii it crosses on its way out.
// A ring born at the center reaches the far corner at radius ~ sqrt(aspect^2+1);
// TRAVEL_RADII a touch past that carries the crest fully off the card before
// the cycle recycles a fresh ring from the center.
const TRAVEL_RADII = 1.55;
// Detonation camera-shake: peak whole-overlay kick as a fraction of half-span
// (1-2% read). A transient at each crest's birth, gone by mid-travel.
const SHAKE_FRAC = 0.018;
// The fraction of a cycle over which the detonation shake decays to 0 — a brief
// impulse at the crest's birth, NOT a standing offset across the plateau.
const SHAKE_PHASE = 0.18;
// THE STANDING-RING DOCTRINE (W3 fix, 2026-06-12): while ENGAGED, the surface
// is not a single one-shot front that races off and settles — by the time the
// rig pins the controls at seek(t=1) such a ring has already decayed and the
// frame reads DEAD. Instead, while engaged the card carries a REPEATING
// traveling pressure ring: a deterministic phase = frac(t / period + offset)
// maps to a ring that grows from center → off-card, then a fresh one is born —
// so at ANY pinned phase a crisp ring is somewhere on the card kicking the
// surface. One clean ring at a time (not a busy field): the cycle holds exactly
// one dominant crest because the envelope dips to ~0 across the recycle seam.
const CYCLE_PERIOD = 1.7;
// CRITICAL anti-aliasing offset: the rig pins the control sweeps at seek(t=1).
// With NO offset, a period that divides 1 evenly (the default speed lands here)
// parks the phase exactly on the recycle seam, where the envelope is 0 and the
// kick/wobble controls read DEAD — the original W3 defect. The offset shifts the
// pinned phase into the middle of the envelope PLATEAU so the default pin (and
// the width/kick/wobble sweeps, which do not change the period) always lands a
// SUBSTANTIAL live crest. 0.45 sits dead-center of the [ATTACK_FRAC, 1-RELEASE]
// plateau.
const PHASE_OFFSET = 0.45;
// The crest is held at SUBSTANTIAL amplitude across the bulk of its travel (a
// plateau with smooth edges) rather than a sharp one-shot spike, so EVERY
// pinned phase lands a visibly-kicked surface that each control re-shapes. The
// envelope ramps up over the first ATTACK_FRAC of the cycle and fades over the
// last RELEASE_FRAC, holding full amplitude between.
const ATTACK_FRAC = 0.16;
const RELEASE_FRAC = 0.24;
// STANDING wobble corrugation (W3 r3 fix, 2026-06-13). The wobble control adds a
// concentric radial ripple sin(distC * freq) riding the ring band. WOBBLE_RIPPLES
// sets how many corrugations span one half-span (the field scale) — enough that a
// high wobble reads as a clearly grooved ring at the pinned pose, not a single
// soft bump. WOBBLE_Z_GAIN scales the corrugation's z-amplitude relative to the
// raw wobble fraction so full wobble (0.12) rides the crest at a visible relief
// (~comparable order to the default kick) WITHOUT altering the mean kick.
const WOBBLE_RIPPLES = 8;
const WOBBLE_Z_GAIN = 2.4;
// Standing-ring envelope: 0 at the recycle seam, smooth ramp to 1 across the
// attack, flat 1 through the body, smooth fade to 0 across the release. Keeps
// exactly one crisp ring alive at a time and guarantees a SUBSTANTIAL crest at
// any mid-cycle pin (the discoverability floor is cleared with headroom).
const standingEnvelope = (phase: number): number => {
  if (phase <= 0 || phase >= 1) return 0;
  if (phase < ATTACK_FRAC) {
    const a = phase / ATTACK_FRAC;
    return a * a * (3 - 2 * a); // smoothstep up
  }
  if (phase > 1 - RELEASE_FRAC) {
    const r = (1 - phase) / RELEASE_FRAC;
    return r * r * (3 - 2 * r); // smoothstep down
  }
  return 1;
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
 *  Offsets are in the SHEET's frame, normalized by half-span for the field. */
interface RigidChromeClone {
  mesh: Mesh;
  ox: number; // sheet-frame x offset from center
  oy: number; // sheet-frame y offset from center
  dz: number; // proud height above the sheet face
}

/** Read host `state` as a 0..1 engage level (morph-into-card convention). */
function readState(userData: Record<string, unknown>): number | null {
  const s = userData.state;
  if (typeof s === 'boolean') return s ? 1 : 0;
  if (typeof s === 'number' && Number.isFinite(s)) return clamp(s, 0, 1);
  if (typeof s === 'string') {
    return s === 'hover' || s === 'active' || s === 'on' || s === 'engaged' ? 1 : 0;
  }
  return null;
}

export const clickShockwavePrimitive: PrimitiveDefinition = {
  name: 'click-shockwave',
  label: 'Click Shockwave',
  category: 'displacement',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'state',
  mountable: true, // TEXTURE-PRESERVING: overlay carries the subject's own look
  schema: SCHEMA,
  description:
    'Engage and a shockwave detonates from the center — one crisp pressure ring racing outward, kicking the surface and its chrome as it passes.',
  create: defineAnimatable(
    { name: 'click-shockwave', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const repMesh = findRepresentativeMesh(subject);

      /** The representative mesh's CURRENT first material — read live, never
       *  cached: mounted artifacts pour `.map` asynchronously after attach. */
      const liveSourceMaterial = (): MappedMaterial | null => {
        if (!repMesh) return null;
        const m = repMesh.material;
        return ((Array.isArray(m) ? m[0] : m) as MappedMaterial | undefined) ?? null;
      };

      // ── Measure in the subject's OWN local frame (no hardcoded units) ────
      // GEOMETRY-BASED (the genie-suck lesson, cylinder-unroll): each mesh's
      // geometry bbox is mapped mesh-local -> subject-local; a world-AABB route
      // double-inflates under tilt. Sheet w/h covers the UNION of all meshes;
      // its face z is the REPRESENTATIVE mesh's front face (chrome sits proud).
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

      // ── Fallback state ('beat' mode: whole subject pulses on detonation) ──
      const baseScale = subject.scale.clone();
      const basePos = subject.position.clone();
      const prevVisible = subject.visible;

      // ── Field uniforms (one graph serves the sheet + all bent chrome) ────
      // The field is centered at the sheet's geometry center (uv 0.5, 0.5 /
      // positionLocal 0,0). radius/width/kick/wobble drive the ring; uShakeX/Y
      // carry the whole-overlay detonation kick.
      const halfSpanU = uniform(1); // half-span (max of halfW/halfH) — field scale
      const uRadius = uniform(-1); // ring radius in subject-relative units (<0 = no live ring)
      const uWidth = uniform(0.12); // ring cross-section width (units)
      const uKick = uniform(0); // surface kick amplitude (units), already enveloped
      const uWobble = uniform(0); // STANDING corrugation amplitude (0..max), already enveloped
      // STANDING radial-ripple corrugation (W3 r3 fix, 2026-06-13): wobble is a
      // POSITION/PHASE function of radius — sin(distC * uWobbleFreq) riding the
      // ring band — so at the pinned engaged pose (seek t=1) a HIGHER wobble reads
      // as a visibly CORRUGATED ring (extra radial ripples catching the key
      // light), a LOWER wobble as a smooth ring. A purely temporal/decayed
      // aftershock was DEAD at the frozen control-sweep frame (the r2 defect:
      // control-wobble low/mid/high byte-identical); this standing modulation
      // re-renders the moment the slider moves.
      const uWobbleZ = uniform(0); // standing z-ripple amplitude (units), enveloped
      const uWobbleFreq = uniform(1); // radial corrugation spatial frequency (rad/unit)
      const uAspect = uniform(new Vector2(1, 1)); // (halfW, halfH) for centered field coords
      const uColor = uniform(new Color('#ffffff')); // map-less fallback tint
      const uOpacity = uniform(1); // live source opacity (mask multiplies)
      // Rounded-corner SDF mask (the card silhouette). uMaskR = 0 disables it.
      const uMaskHalfW = uniform(1);
      const uMaskHalfH = uniform(1);
      const uMaskR = uniform(0);
      const uMaskEdge = uniform(1e-3);

      // Sheet extents (subject-local), filled when the overlay is built.
      let halfW = 0.5;
      let halfH = 0.5;
      let halfSpan = 0.5;
      let cornerR = 0;
      let sheetX = 0;
      let sheetY = 0;
      let faceZ = 0;

      // ── The TSL field (built ONCE, shared by sheet + bent chrome) ────────
      // Centered field coords in subject-local units: the ring is a circle
      // around the geometry center. d = |dist - radius| is the signed distance
      // to the ring crest; gauss(d) is the pressure cross-section.
      const pc = vec2(positionLocal.x, positionLocal.y);
      const distC = length(pc);
      const wSafe = tslMax(uWidth, float(1e-4));
      const ringD = tslAbs(distC.sub(uRadius)).div(wSafe);
      const gauss = exp(ringD.mul(ringD).negate());
      // Surface kicked OUT (+z) as the ring passes; off when uRadius < 0 (no
      // live ring) via a smooth gate on uRadius >= 0.
      const liveGate = smoothstep(float(-1e-4), float(0), uRadius);
      const zKick = uKick.mul(gauss).mul(liveGate);
      // STANDING radial-ripple corrugation (the wobble control): a sin(distC*freq)
      // corrugation RIDING the gaussian ring band, amplitude = uWobbleZ. This is a
      // pure position/phase function — at the frozen control-sweep pose a higher
      // wobble adds visible concentric ripples to the crest (a corrugated ring),
      // a lower wobble leaves the ring smooth. Additive on top of zKick so it
      // never alters the mean kick amplitude (kick stays uncoupled).
      const corrPhase = distC.mul(uWobbleFreq);
      const corr = sin(corrPhase);
      const zWobble = uWobbleZ.mul(corr).mul(gauss).mul(liveGate);
      const zTotal = zKick.add(zWobble);
      // Camera-shake: a uniform whole-sheet translation (handled on the overlay
      // group CPU-side — see applyShake — so it is genuinely whole-frame).
      const bentPos = vec3(positionLocal.x, positionLocal.y, positionLocal.z.add(zTotal));
      // Analytic bent normal: the ring crest is a radial ridge whose slope is the
      // sum of the smooth-kick ridge AND the corrugation ripples. The corrugation
      // term dominates the high-frequency shading, so a corrugated ring catches
      // the key light very differently from a smooth one (the visible wobble read
      // at a frozen frame). d/dr of the gaussian envelope is approximated by the
      // smooth-kick term; d/dr of the corrugation is uWobbleZ*cos(distC*freq)*freq.
      const radialSign = smoothstep(float(-1e-4), float(1e-4), distC.sub(uRadius)).mul(2).sub(1);
      const dzdrKick = uKick
        .mul(gauss)
        .mul(ringD.mul(-2).div(wSafe))
        .mul(radialSign)
        .mul(liveGate);
      // Corrugation slope: derivative of uWobbleZ*sin(distC*freq)*gauss. The
      // sin' = cos*freq term dominates (high spatial frequency), so the ripple
      // crests/troughs tilt the normal back and forth radially — visible relief.
      const dzdrWobble = uWobbleZ.mul(cos(corrPhase)).mul(uWobbleFreq).mul(gauss).mul(liveGate);
      const dzdr = dzdrKick.add(dzdrWobble);
      const dirN = tslMax(distC, float(1e-4));
      const nx = pc.x.div(dirN).mul(dzdr).negate();
      const ny = pc.y.div(dirN).mul(dzdr).negate();
      const bentNormal = vec3(nx, ny, float(1)).normalize();
      const bentNormalView = (
        transformNormalToView(bentNormal).normalize() as unknown as {
          mul: (n: unknown) => unknown;
        }
      ).mul(faceDirection);
      // Refraction wobble in the UV lane (curtains §1 move): shear the sampled
      // UV radially by the gaussian band so the subject's OWN look smears as the
      // ring passes, PLUS a standing corrugation ripple (the same sin(distC*freq))
      // so the sampled texture visibly ripples radially at high wobble — a second
      // standing channel that re-renders the frozen control-sweep frame even where
      // the lighting on the bent normal is subtle. uv -> uv + corrugatedShear*dir.
      const uvC = tslUv().sub(vec2(0.5, 0.5));
      const uvLen = tslMax(length(uvC), float(1e-4));
      const uvWobbleShear = uWobble.mul(gauss).mul(liveGate).mul(corr.mul(0.5).add(1));
      const warpedUv = tslUv().add(
        vec2(uvC.x.div(uvLen), uvC.y.div(uvLen)).mul(uvWobbleShear),
      );
      // Rounded-corner SDF mask in the sheet's frame (the card silhouette).
      const qx = tslMax(tslAbs(positionLocal.x).sub(uMaskHalfW.sub(uMaskR)), float(0));
      const qy = tslMax(tslAbs(positionLocal.y).sub(uMaskHalfH.sub(uMaskR)), float(0));
      const cornerSdf = tslSqrt(qx.mul(qx).add(qy.mul(qy))).sub(uMaskR);
      const maskOpacity = smoothstep(float(0).sub(uMaskEdge), uMaskEdge, cornerSdf)
        .oneMinus()
        .mul(uOpacity);

      // ── Overlay sheet (scroll-stagger-rise hide/overlay pattern) ─────────
      const overlay = new Group();
      overlay.name = 'click-shockwave-overlay';
      let sheet: Mesh | null = null;
      const bentChrome: Mesh[] = [];
      const rigidChrome: RigidChromeClone[] = [];

      let builtSrcMat: MappedMaterial | null = null;
      let builtSrcMap: Texture | null = null;

      /** Build the sheet's node material carrying the subject's OWN look:
       *  colorNode samples the live texture (warped UVs) by reference, or the
       *  live color via uColor — never an invented fill. PBR scalars copied so
       *  the sheet shades identically under the rig lights. */
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
        mat.side = DoubleSide;
        const m = mat as unknown as {
          colorNode: unknown;
          positionNode: unknown;
          normalNode: unknown;
          opacityNode: unknown;
        };
        // The subject's own map, sampled with WARPED UVs (curtains refraction),
        // or its color via the tracked uniform — never invented.
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
       *  scalars copied, any map shared BY REFERENCE — never invented. Shares
       *  the sheet's bend position/normal trees. */
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
        halfSpan = Math.max(halfW, halfH);
        sheetX = (localBox.min.x + localBox.max.x) / 2;
        sheetY = (localBox.min.y + localBox.max.y) / 2;
        faceZ = faceBox.max.z;
        halfSpanU.value = halfSpan;
        // Corrugation spatial frequency: WOBBLE_RIPPLES ripples per half-span, so
        // the standing wobble groove count is fixed regardless of card size.
        uWobbleFreq.value = (WOBBLE_RIPPLES * 2 * Math.PI) / Math.max(halfSpan, 1e-4);
        uAspect.value.set(halfW, halfH);
        // Card silhouette radius — off the representative geometry's own params.
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

        // The sheet geometry is centered at the sheet center, so positionLocal
        // IS the centered field coordinate the TSL trees expect.
        const geo = new PlaneGeometry(w, h, SEG, SEG);
        sheet = new Mesh(geo, buildMaterial());
        sheet.name = 'click-shockwave-sheet';
        sheet.position.set(sheetX, sheetY, faceZ);
        overlay.add(sheet);

        // ── Chrome clones: every non-representative mesh rides the field.
        // Wide bars bend in the vertex lane; the tiny dot is posed rigidly.
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
              // Small chrome (the dot): rigid clone — REAL geometry by
              // reference (never disposed by us), material clone (ours).
              const m = new Mesh(child.geometry as BufferGeometry, srcMat.clone());
              m.name = `click-shockwave-chrome-rigid:${child.name || 'mesh'}`;
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
              // shared centered field trees apply directly (the bar's verts are
              // already in sheet-centered coords).
              const cgeo = new PlaneGeometry(cw, ch, CHROME_SEG, CHROME_SEG);
              cgeo.translate(ox, oy, childBox.max.z - faceZ);
              const m = new Mesh(cgeo, buildChromeMaterial(srcMat));
              m.name = `click-shockwave-chrome-bent:${child.name || 'mesh'}`;
              m.position.set(sheetX, sheetY, faceZ);
              overlay.add(m);
              bentChrome.push(m);
            }
          });
        }

        overlay.position.copy(subject.position);
        overlay.quaternion.copy(subject.quaternion);
        overlay.scale.copy(subject.scale);
        subject.parent!.add(overlay);
        subject.visible = false;
      }

      // ── Ring bookkeeping (standing-ring doctrine) ────────────────────────
      // No one-shot stamp: while engaged, the ring phase is read directly off
      // the seek time. `engaged` is true when state is truthy OR absent (the
      // catalog tile / harness has no state and always plays); false only when
      // state is EXPLICITLY disengaged. cycleStart tracks the birth time of the
      // crest currently on screen (for getFireTime + the deterministic shake).
      let lastT = 0;
      let cycleStart: number | null = null;

      /** Deterministic per-cycle shake phase (index/time hash — NO Math.random):
       *  a fixed 2D direction derived from the crest's birth time so each ring's
       *  detonation shakes consistently for a given clock. */
      const shakePhase = (ft: number): { sx: number; sy: number } => {
        const h = Math.sin(ft * 12.9898 + 4.1414) * 43758.5453;
        const a = (h - Math.floor(h)) * Math.PI * 2;
        return { sx: Math.cos(a), sy: Math.sin(a) };
      };

      // Publish the driven uniforms for the host + headless tests. uWobbleZ /
      // uWobbleFreq expose the STANDING corrugation lane so a headless test can
      // prove the wobble control re-shapes the engaged pose (the r2 dead-control
      // defect), not just the UV-shear amplitude.
      target.userData.clickShockwave = {
        uRadius,
        uWidth,
        uKick,
        uWobble,
        uWobbleZ,
        uWobbleFreq,
        getFireTime: () => cycleStart,
      };

      const apply = (t: number) => {
        lastT = t;
        const speed = clamp(num(params.speed, 1.6), 0.4, 4);
        const widthFrac = clamp(num(params.width, 0.12), 0.04, 0.4);
        const kickFrac = clamp(num(params.kick, 0.2), 0, 0.5);
        const wobble = clamp(num(params.wobble, 0.04), 0, 0.12);

        // Width/kick are subject-relative — scale by half-span.
        uWidth.value = Math.max(widthFrac * halfSpan, 1e-4);

        // ── Driving: engaged (or stateless tile) runs a REPEATING ring ─────
        // Speed scales the cycle period: a faster ring completes its travel
        // sooner, so the period shrinks. Period is bounded so a slow ring still
        // recycles within the tile's view and a fast one stays one-ring-at-a-time.
        const st = readState(target.userData);
        const engaged = st === null ? true : st > 0.5;
        const travelRadii = TRAVEL_RADII * halfSpan;
        const period = CYCLE_PERIOD / speed;

        let radius = -1;
        let env = 0;
        let shakeT = 0; // detonation-shake transient: peaks at birth, fades fast
        if (engaged) {
          // Phase in [0,1) of the crest currently traveling. frac(t/period +
          // offset) is a standing function of position/phase — at ANY pinned t a
          // crisp ring sits mid-travel, never a decayed after-state. The offset
          // keeps the seek(t=1) control pin off the recycle seam (see
          // PHASE_OFFSET). At t=0 phase = offset, which is mid-plateau — but the
          // IDLE frame is special-cased to phase 0 below so the card rests clean.
          const raw = t / period + PHASE_OFFSET;
          const phase = t <= 0 ? 0 : raw - Math.floor(raw);
          cycleStart = Math.floor(raw) * period - PHASE_OFFSET * period; // crest birth
          radius = phase * travelRadii;
          env = standingEnvelope(phase);
          // The "room shook" impulse belongs to the DETONATION (the crest's
          // birth), not the whole travel — a sharp transient that peaks just
          // after phase 0 and is gone by the time the ring reaches mid-card, so
          // the pinned/plateau frame carries NO standing offset.
          shakeT = phase < SHAKE_PHASE ? 1 - phase / SHAKE_PHASE : 0;
        } else {
          cycleStart = null; // explicitly disengaged: no ring
        }

        uRadius.value = radius;
        uKick.value = kickFrac * halfSpan * env;
        // uWobble: the UV-refraction shear amplitude (published for tests; the
        // standing-corrugation lane reads it too). uWobbleZ: the standing
        // z-ripple corrugation amplitude in subject-relative units — riding the
        // ring band, this is the channel the advocate sees re-render at the
        // frozen control-sweep pose. Both scale with the same enveloped wobble so
        // a smooth ring at wobble=0 grows visibly grooved toward wobble=max.
        uWobble.value = wobble * env;
        uWobbleZ.value = wobble * env * halfSpan * WOBBLE_Z_GAIN;

        // ── Camera-shake: a decaying whole-overlay kick riding each crest ──
        if (canOverlay && sheet) {
          // (b) LIVE TRANSFORM TRACKING — co-bindings may animate the hidden
          // subject; re-register the overlay on its CURRENT local pose first.
          overlay.position.copy(subject.position);
          overlay.quaternion.copy(subject.quaternion);
          overlay.scale.copy(subject.scale);
          // Shake peaks at each crest's birth and is gone by mid-travel (a
          // transient, NOT a standing offset), on a deterministic per-crest dir.
          if (engaged && cycleStart !== null && shakeT > 0) {
            const shakeEnv = shakeT * shakeT; // sharp decay from the detonation
            const { sx, sy } = shakePhase(cycleStart);
            overlay.position.x += sx * SHAKE_FRAC * halfSpan * shakeEnv;
            overlay.position.y += sy * SHAKE_FRAC * halfSpan * shakeEnv;
          }

          // (a) LATE TEXTURE POUR — rebuild the sheet's material the moment the
          // live source material instance or its map identity changes.
          const src = liveSourceMaterial();
          const liveMap = (src?.map as Texture | null | undefined) ?? null;
          if (src !== builtSrcMat || liveMap !== builtSrcMap) {
            const old = sheet.material as Material;
            sheet.material = buildMaterial();
            old.dispose();
          } else if (src && !liveMap && src.color) {
            uColor.value.copy(src.color); // live tint tracking on the fallback
          }

          // Rigid chrome (the dot) kicks along the field every frame.
          placeRigidChrome(radius, env, kickFrac);
        } else {
          // Fallback 'beat' mode: nothing to overlay — the WHOLE subject pulses
          // outward on detonation (a scale beat riding the ring envelope),
          // never placeholder geometry.
          const beat = 1 + kickFrac * 0.5 * env;
          subject.scale.set(baseScale.x * beat, baseScale.y * beat, baseScale.z);
        }
      };

      /** CPU mirror of the field for the rigid chrome (the dot): kick each
       *  small child outward along the radial as the ring crosses it, delayed
       *  by its distance from center. */
      const placeRigidChrome = (radius: number, env: number, kickFrac: number) => {
        if (!rigidChrome.length) return;
        const wv = Math.max(uWidth.value, 1e-4);
        const freq = uWobbleFreq.value;
        const wobZ = uWobbleZ.value; // standing-corrugation amplitude (units)
        for (const c of rigidChrome) {
          const dist = Math.hypot(c.ox, c.oy);
          let zk = 0;
          let outKick = 0;
          if (radius >= 0) {
            const dd = (dist - radius) / wv;
            const g = Math.exp(-dd * dd);
            // Smooth kick + the SAME standing corrugation the sheet rides, so the
            // dot grooves in lock-step with the ring when wobble is high.
            zk = kickFrac * halfSpan * g * env + wobZ * Math.sin(dist * freq) * g;
            // A small outward in-plane shove as the front passes (per-child
            // delay is intrinsic: g peaks when radius reaches THIS child).
            outKick = Math.abs(zk) * 0.5;
          }
          const dn = Math.max(dist, 1e-4);
          c.mesh.position.set(
            sheetX + c.ox + (c.ox / dn) * outKick,
            sheetY + c.oy + (c.oy / dn) * outKick,
            faceZ + c.dz + zk,
          );
        }
      };

      // Deterministic initial state: the rig pins idle at t=0 disengaged. With
      // no fire stamped, the surface is flat and fully legible.
      apply(0);

      return {
        // Stateful, state-fired: never settles to a fixed end.
        duration: () => Infinity,
        seek: (t) => apply(t),
        // Re-apply at the live time so paused control tweaks (the CONTROLS gate
        // drives one control at the pinned engaged state) take effect.
        onParamChange: (_id: string, _value: ControlValue) => apply(lastT),
        dispose: () => {
          delete target.userData.clickShockwave;
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
            subject.scale.copy(baseScale);
            subject.position.copy(basePos);
          }
        },
      };
    },
  ),
};
