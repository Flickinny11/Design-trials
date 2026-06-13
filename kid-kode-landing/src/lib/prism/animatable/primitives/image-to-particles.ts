// image-to-particles — the surface itself becomes sand: the card disintegrates
// into a storm of grains that carry its ACTUAL colors, swirl, and fly home to
// reassemble it perfectly. CATALOG primitive (hard / particles, subject:'card',
// state-driven, duration Infinity, mountable).
//
// TECHNIQUE — DESIGN-REFERENCES §11 "Image-to-Particles Dissolve" (the
// threshold-noise discard) made 3D + texture-true on our stack, with the §9
// noise/procedural curl displacement giving the storm its swirl. The §11 shader
// discards a fragment when a per-fragment noise threshold < uProgress; here that
// same idea drives a GRID of N instanced micro-quads tiling the subject's face:
// each grain owns a UV cell and a deterministic departure threshold (index-hash
// noise). state 0→1 scrubs the dissolve — a grain whose threshold has been
// crossed LAUNCHES on a curl-ish swirl path (outward drift + per-grain turbulence
// + a slight gravity sag), fading as it leaves; state 1→0 flies every grain home
// in reverse with a satisfying late snap (an overshoot ease near the end). All
// per-grain constants derive from index hashes — no Math.random, EVER — so seek()
// is a pure function of (state-integrated progress).
//
// TEXTURE-TRUE (the §11 "carry its actual colors" promise) — the grain material's
// colorNode samples the SUBJECT'S OWN live texture at the grain's instanced UV
// cell (texture shared by reference, scroll-stagger-rise / morph-into-card
// discipline): a late texture pour or an applyImageSpec material swap rebuilds the
// grain material the moment the map identity changes, so a mounted artifact's
// grains upgrade from the map-less fallback to its real pixels in flight. When the
// subject is map-less (the catalog card ships map-less), each grain's color comes
// from the subject material's own color/emissive PLUS a per-cell deterministic
// tonal variation, so the grid still reads as the card — NEVER an invented fill.
// A radial soft-falloff alpha on each quad's uv (gaussian core killed to EXACT
// zero before the edge) keeps grains as soft motes, never hard squares;
// depthWrite:false so the translucent storm composites.
//
// SUBJECT LOOK IS SACRED: the original card is HIDDEN while the storm is active
// (the grains ARE the card now) and restored byte-for-byte on dispose. CHROME
// children co-fade with the EARLY dissolve (the sdf-shape-morph / morph-into-card
// chrome co-treatment) — header bar, accent dot and rows dissolve into the first
// of the storm rather than floating as residue over the launched grains.
//
// PINNED ENGAGED (catalog rig): state held at a mid-dissolve storm is visible at
// the frozen frame; every control re-shapes that STANDING storm (W4 liveness):
//   • grainDensity   — structural; the live drawn grain count climbs (sparse →
//     dense grid) so the standing population is unmistakably different.
//   • swirlTurbulence — scales each grain's curl displacement; the frozen storm
//     visibly spreads/reshapes.
//   • scatterDistance — scales the launch travel; the standing storm radius grows.
//   • dissolveSoftness — the §11 threshold BAND width; a wider band catches more
//     grains mid-launch at the same pinned state → a denser mid-air storm.
//
// DISTINCT FROM NEIGHBORS:
//   • crumble-to-particles (displacement) — material-swap surface chunks drifting
//     off; one-shot time-driven, no reassembly, no per-grain texture sampling.
//   • particle-assemble (particles, subject:'empty') — generic motes assemble INTO
//     an abstract shape; carries NO subject texture, never disperses.
//   • pixel-dissolve (a flat 2D fade) — no 3D grains, no swirl, no reassembly.
//   Ours carries the SUBJECT'S REAL SAMPLED LOOK per grain, dissolves AND
//   reassembles, and is state-scrubbed (scrub anywhere in 0..1).
//
// volumetric:false implicitly — one instanced quad pass, never a slab-stack.

import {
  InstancedMesh,
  BufferGeometry,
  BufferAttribute,
  InstancedBufferAttribute,
  Box3,
  Color,
  Group,
  Matrix4,
  Vector3,
  AdditiveBlending,
  DynamicDrawUsage,
  Mesh,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { instancedBufferAttribute, texture, uv, vec3, vec4, float, exp, smoothstep } from 'three/tsl';
import { defineAnimatable } from '../base';
import { clamp, num, type ControlValue, type PrimitiveDefinition } from '../contract';

/** Deterministic 0..1 hash from a single seed (the classic fract(sin) hash —
 *  no Math.random, EVER, so seek(progress) is pure). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

// Build-time grid cap. `grainDensity` is a control (grains per side); we allocate
// to the max so the instance buffers never reallocate. Unused grains park at zero
// scale (cost-free, dark) and are excluded from the draw via mesh.count.
const MAX_SIDE = 30; // 30×30 = 900 grains at full density
const MAX_GRAINS = MAX_SIDE * MAX_SIDE;

// Fallback face extents (degenerate/headless subject — same numbers the catalog
// card uses): width 1.74, height 1.12, front face just proud of the panel.
const FALLBACK = { w: 1.74, h: 1.12, cx: 0, cy: 0, cz: 0.072 };

const DT_MAX = 0.25; // state-integration step clamp (driver hiccup guard)
const GRAIN_QUAD = 0.06; // base grain billboard size (world units)

const SCHEMA = [
  // STRUCTURAL: grains per side. Live mesh.count = side² so the standing storm
  // population is unmistakably different sparse→dense at the frozen pin.
  { id: 'grainDensity', label: 'Grain Density', type: 'knob', min: 10, max: MAX_SIDE, step: 1, default: 24 },
  // Curl/turbulence magnitude. Scales each launched grain's swirl displacement —
  // at the pinned storm a higher value visibly spreads/reshapes the grains.
  { id: 'swirlTurbulence', label: 'Swirl', type: 'fader', min: 0, max: 2, step: 0.01, default: 0.9 },
  // Launch travel distance. Directly scales how far departed grains fly — the
  // standing storm radius grows boldly at the pin.
  { id: 'scatterDistance', label: 'Scatter', type: 'fader', min: 1, max: 5, step: 0.1, default: 2.6, unit: 'x' },
  // §11 threshold BAND width: how staggered the departures are. A wider band
  // keeps more grains mid-launch at a fixed state → a denser mid-air storm.
  { id: 'dissolveSoftness', label: 'Softness', type: 'fader', min: 0.02, max: 0.6, step: 0.01, default: 0.32 },
] as const;

type SourceLike = Material & {
  color?: Color;
  emissive?: Color;
  emissiveIntensity?: number;
  map?: Texture | null;
};

/** First Mesh in the subject (the subject itself, or its first Mesh descendant
 *  for Group subjects). The card subject IS a Mesh, but stay tolerant. */
function primaryMeshOf(subject: Object3D): Mesh | null {
  if ((subject as Mesh).isMesh) return subject as Mesh;
  let found: Mesh | null = null;
  subject.traverse((o) => {
    if (!found && (o as Mesh).isMesh) found = o as Mesh;
  });
  return found;
}

export const imageToParticlesPrimitive: PrimitiveDefinition = {
  name: 'image-to-particles',
  label: 'Image To Particles',
  category: 'particles',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'state',
  // Texture-PRESERVING: the grains sample the subject's own map (never replace
  // it), and dispose restores the subject untouched — safe to run on mounts.
  mountable: true,
  schema: SCHEMA,
  description:
    'The card disintegrates into a storm of grains that carry its actual colors, swirl away, then fly home to reassemble it perfectly.',
  create: defineAnimatable(
    { name: 'image-to-particles', category: 'particles', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mesh = primaryMeshOf(subject);

      // ── Measure the face in the subject's own local frame ────────────────
      // The grain grid tiles this face; travel scales with it. Never hardcoded
      // world units — mounted artifacts vary wildly in size.
      const box = new Box3().setFromObject(subject);
      const size = new Vector3();
      const center = new Vector3();
      box.getSize(size);
      box.getCenter(center);
      // Pull the centre back into the subject's local frame (the grain group is
      // a sibling carrying the subject's transform, below).
      subject.updateWorldMatrix(true, true);
      const invWorld = new Matrix4().copy(subject.matrixWorld).invert();
      const localCenter = center.clone().applyMatrix4(invWorld);
      const W = size.x > 1e-4 ? size.x : FALLBACK.w;
      const H = size.y > 1e-4 ? size.y : FALLBACK.h;
      const CX = Number.isFinite(localCenter.x) ? localCenter.x : FALLBACK.cx;
      const CY = Number.isFinite(localCenter.y) ? localCenter.y : FALLBACK.cy;
      // Front face: just proud of the panel front (local), fallback for headless.
      const localMaxZ = new Box3()
        .setFromObject(subject)
        .max.clone()
        .applyMatrix4(invWorld).z;
      const CZ = Number.isFinite(localMaxZ) && localMaxZ > -1e8 ? localMaxZ : FALLBACK.cz;

      // ── Per-grain deterministic constants, cached once ───────────────────
      // cellU/cellV: the grain's UV cell centre (rebuilt per density). thresh:
      // its §11 departure threshold (0..1). launch dir + swirl axis + sag: a
      // hashed curl-ish path, scaled live by the controls. All index-hash.
      const cellU = new Float32Array(MAX_GRAINS);
      const cellV = new Float32Array(MAX_GRAINS);
      const homeX = new Float32Array(MAX_GRAINS);
      const homeY = new Float32Array(MAX_GRAINS);
      const thresh = new Float32Array(MAX_GRAINS);
      const dirX = new Float32Array(MAX_GRAINS); // outward+jitter launch direction
      const dirY = new Float32Array(MAX_GRAINS);
      const dirZ = new Float32Array(MAX_GRAINS);
      const swirlAmp = new Float32Array(MAX_GRAINS); // per-grain curl magnitude
      const swirlFreq = new Float32Array(MAX_GRAINS); // per-grain curl turns
      const spin = new Float32Array(MAX_GRAINS); // per-grain billboard spin

      // Per-grain UV cell (vec2) → texture sample location. Per-grain tint (vec3,
      // premultiplied) → carries the map-less fallback color AND the per-grain
      // opacity fade (premultiplied so it reads as an alpha fade). Declared here
      // so rebuildGrid can fill the cell uvs (per-cell constants) at build time.
      const cellUvArr = new Float32Array(MAX_GRAINS * 2);
      const tintArr = new Float32Array(MAX_GRAINS * 3);

      let curSide = -1;
      const rebuildGrid = (sideRaw: number): void => {
        const side = Math.max(2, Math.min(MAX_SIDE, Math.round(sideRaw)));
        if (side === curSide) return;
        curSide = side;
        for (let gy = 0; gy < side; gy++) {
          for (let gx = 0; gx < side; gx++) {
            const idx = gy * side + gx;
            // Cell CENTRE uv (so a grain samples the middle of its tile).
            const u = (gx + 0.5) / side;
            const v = (gy + 0.5) / side;
            cellU[idx] = u;
            cellV[idx] = v;
            // Mirror the cell uv into the instanced buffer NOW (it is a per-cell
            // constant) so the grid's texture-sample uvs exist immediately after
            // build, before the first seek.
            cellUvArr[idx * 2] = u;
            cellUvArr[idx * 2 + 1] = v;
            // Home position on the face (local frame).
            homeX[idx] = CX + (u - 0.5) * W;
            homeY[idx] = CY + (v - 0.5) * H;
            // §11 departure threshold from index-hash noise (the "left" order).
            thresh[idx] = hash1(idx * 1.37 + 0.7);
            // Launch direction: OUTWARD from the face centre (so the storm
            // expands) plus a hashed jitter and a forward (+z) bias so grains
            // peel off the surface toward the camera.
            const ox = homeX[idx] - CX;
            const oy = homeY[idx] - CY;
            const olen = Math.hypot(ox, oy) || 1;
            const jAng = hash1(idx * 2.91 + 3.3) * Math.PI * 2;
            const jMag = 0.35 + hash1(idx * 3.71 + 5.1) * 0.65;
            dirX[idx] = (ox / olen) * 0.6 + Math.cos(jAng) * jMag;
            dirY[idx] = (oy / olen) * 0.5 + Math.sin(jAng) * jMag - 0.15; // slight up-then-sag handled in seek
            dirZ[idx] = 0.4 + hash1(idx * 4.13 + 7.7) * 0.9; // toward the camera
            swirlAmp[idx] = 0.4 + hash1(idx * 5.33 + 9.2) * 0.9;
            swirlFreq[idx] = 1.5 + hash1(idx * 6.17 + 11.1) * 3.5;
            spin[idx] = (hash1(idx * 7.91 + 13.3) - 0.5) * Math.PI * 2;
          }
        }
      };
      rebuildGrid(num(params.grainDensity, 24));

      // ── Geometry: one billboard quad + per-grain instanced attributes ─────
      // Its OWN quad geometry (never a shared one) so dispose() frees it; the
      // renderer's geometry-dispose listener also releases the instanced buffers.
      const geometry = new BufferGeometry();
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      geometry.setAttribute(
        'position',
        new BufferAttribute(
          new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]),
          3,
        ),
      );
      geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));

      // Wrap the per-grain buffers (filled above) as instanced attributes,
      // attached by name so tests/tools can discover the live buffers; the
      // material reads them via instancedBufferAttribute().
      const cellUvAttr = new InstancedBufferAttribute(cellUvArr, 2);
      const tintAttr = new InstancedBufferAttribute(tintArr, 3);
      cellUvAttr.setUsage(DynamicDrawUsage); // rewritten on density change
      tintAttr.setUsage(DynamicDrawUsage); // rewritten every seek (fade)
      geometry.setAttribute('instanceCellUv', cellUvAttr);
      geometry.setAttribute('instanceTint', tintAttr);

      // ── Look layer: radial soft-falloff alpha × texture-true color ────────
      // d: 0 at the quad centre → 1 at the edge midpoint. A gaussian glow core
      // killed to EXACT zero before the quad edge so no square rim shows.
      const d = uv().sub(0.5).mul(2).length();
      const soft = exp(d.mul(d).mul(-2.4));
      const rim = smoothstep(float(0.72), float(0.97), d).oneMinus();
      const falloff = soft.mul(rim);
      // TSL d.ts types instancedBufferAttribute() as a bare Node; the runtime is a
      // full chainable ShaderNodeObject (house casting discipline, cf. embers.ts).
      type N3 = ReturnType<typeof vec3>;
      const grainTint = instancedBufferAttribute(tintAttr) as unknown as {
        mul: (x: unknown) => N3;
      };
      const grainUvNode = instancedBufferAttribute(cellUvAttr);

      // buildMat closes over the live source material so a poured map / material
      // swap is picked up by rebuilding (ensureBound below). Returns a fresh
      // node material whose colorNode is the subject's REAL sampled look × the
      // per-grain tint (premultiplied fade), all × the radial falloff.
      //
      // ADDITIVE blending for BOTH paths (the embers P0-fixed pattern): every
      // shaping term — the radial falloff AND the per-grain fade — is
      // PREMULTIPLIED into the RGB, with alpha pinned to 1. Under additive
      // blending that premultiply IS the alpha fade (a leaving grain's RGB sinks
      // to zero, so it dissolves rather than darkening to a black square), and a
      // grain reads as a soft glowing mote against the dark graphite rig (no hard
      // quad rim, ever). The map path's sampled color rides the SAME premultiply,
      // so texture-true grains glow softly with the card's own pixels.
      const buildMat = (src: SourceLike | null): MeshBasicNodeMaterial => {
        const map = (src?.map ?? null) as Texture | null;
        const m = new MeshBasicNodeMaterial({
          transparent: true,
          opacity: 1,
          blending: AdditiveBlending,
          depthWrite: false,
        });
        // HARD RULE: sample the subject's own map at the grain's UV cell (shared
        // by reference) when present; otherwise the per-grain tint alone carries
        // the subject's color/emissive (CPU-written below) — never an invented
        // fill. The premultiplied tint (alpha-fade) × radial falloff rides in
        // both paths.
        const colorRGB: N3 = map
          ? (texture(map, grainUvNode as unknown as ReturnType<typeof uv>).rgb as unknown as {
              mul: (x: unknown) => N3;
            }).mul(grainTint.mul(falloff))
          : grainTint.mul(falloff);
        (m as unknown as { colorNode: unknown }).colorNode = vec4(colorRGB, float(1));
        return m;
      };

      // Live-source tracking (the late-pour / swap discipline).
      let srcMat: SourceLike | null = mesh
        ? ((Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as SourceLike)
        : null;
      let builtMap: Texture | null = srcMat?.map ?? null;
      let material = buildMat(srcMat);

      const grains = new InstancedMesh(geometry, material, MAX_GRAINS);
      grains.instanceMatrix.setUsage(DynamicDrawUsage);
      grains.frustumCulled = false; // grains fly far beyond the unit quad
      grains.count = curSide * curSide; // live density narrows this in seek()
      grains.name = 'image-to-particles';

      // The grain mesh lives in a SIBLING group carrying the subject's exact
      // local transform (a hidden parent hides its children in three.js, so the
      // grains cannot live under the hidden subject itself).
      const grainGroup = new Group();
      grainGroup.name = 'image-to-particles-group';
      grainGroup.add(grains);
      if (subject.parent) {
        grainGroup.position.copy(subject.position);
        grainGroup.quaternion.copy(subject.quaternion);
        grainGroup.scale.copy(subject.scale);
        subject.parent.add(grainGroup);
      } else {
        target.object.add(grainGroup);
      }

      // ── Chrome co-treatment (snapshot opacity + transparent, restore exact) ─
      interface ChromeSnap {
        m: Material & { opacity: number };
        opacity: number;
        transparent: boolean;
      }
      const chrome: ChromeSnap[] = [];
      subject.traverse((o) => {
        if (o === mesh || o === subject) return;
        const mm = o as Mesh;
        if (!mm.isMesh || !mm.material) return;
        const arr = Array.isArray(mm.material) ? mm.material : [mm.material];
        for (const mat of arr) {
          chrome.push({
            m: mat as Material & { opacity: number },
            opacity: (mat as Material & { opacity: number }).opacity,
            transparent: mat.transparent,
          });
          mat.transparent = true;
        }
      });

      // Map-less fallback color: the subject material's color/emissive blend, so
      // the grid reads as the card without a texture. Cached; re-derived when the
      // source material changes.
      const fallbackBase = new Color('#2a2f3a');
      const computeFallback = (src: SourceLike | null): void => {
        const c = src?.color instanceof Color ? src.color : new Color('#1d212b');
        const e = src?.emissive instanceof Color ? src.emissive : new Color('#12151d');
        const eI = src?.emissiveIntensity ?? 0.42;
        // Lift it well above the dark panel value so the storm reads bright
        // against the graphite rig (the embers brightness lesson, lum ≥ 0.06).
        fallbackBase.setRGB(
          Math.min(1, c.r + e.r * eI + 0.16),
          Math.min(1, c.g + e.g * eI + 0.16),
          Math.min(1, c.b + e.b * eI + 0.14),
        );
      };
      computeFallback(srcMat);

      const prevVisible = subject.visible;

      // ── State integration (morph-into-card convention) ───────────────────
      let progress = 0; // 0 = assembled card, 1 = fully scattered storm
      let lastT: number | null = null;

      // A held-engaged boolean settles to a MID-STORM equilibrium (not full
      // scatter) so the pinned frame is a VISIBLE mid-effect storm where EVERY
      // control reshapes the standing population (W4 liveness — softness in
      // particular only differentiates the mid-transit band). A NUMERIC state
      // scrubs the dissolve directly to that value (0 assembled → 1 storm), the
      // §11 scrub. String 'on'/'active'/'hover' = engaged.
      const ENGAGED_TARGET = 0.62;
      /** Target progress for the driver, or null when no state input exists. */
      const readStateTarget = (): number | null => {
        const ud = target.userData as Record<string, unknown>;
        const s = ud.state ?? ud.hover;
        if (typeof s === 'boolean') return s ? ENGAGED_TARGET : 0;
        if (typeof s === 'number' && Number.isFinite(s)) return clamp(s, 0, 1);
        if (typeof s === 'string') {
          return s === 'on' || s === 'active' || s === 'hover' ? ENGAGED_TARGET : 0;
        }
        return null;
      };

      // Time-fallback loop (no state input): scatter → hold → reassemble → hold.
      const HOLD = 0.7;
      const RAMP = 1.1;
      const loopProgress = (t: number): number => {
        const cycle = 2 * RAMP + 2 * HOLD;
        const m = ((t % cycle) + cycle) % cycle;
        if (m < RAMP) return m / RAMP;
        if (m < RAMP + HOLD) return 1;
        if (m < 2 * RAMP + HOLD) return 1 - (m - RAMP - HOLD) / RAMP;
        return 0;
      };

      // ── Live-source rebind: pour/swap upgrades the grains to the real map ─
      const ensureBound = (): void => {
        if (!mesh) return;
        const live = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as
          | SourceLike
          | null;
        const liveMap = (live?.map ?? null) as Texture | null;
        if (live !== srcMat || liveMap !== builtMap) {
          srcMat = live;
          builtMap = liveMap;
          computeFallback(live);
          const next = buildMat(live);
          grains.material = next;
          material.dispose();
          material = next;
        }
      };

      // Reusable scratch.
      const mat4 = new Matrix4();
      const posV = new Vector3();
      const sclV = new Vector3();
      const ZERO = new Matrix4().makeScale(0, 0, 0);

      // easeOutBack-ish late snap on reassembly: a small overshoot near home.
      const snapEase = (w: number): number => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        const x = 1 - w; // reverse: w is "how scattered", we want home-ness
        return 1 - (c3 * x * x * x - c1 * x * x);
      };

      const liveSide = (): number =>
        Math.max(2, Math.min(MAX_SIDE, Math.round(num(params.grainDensity, 24))));

      const apply = (t: number): void => {
        ensureBound();

        // Keep the grain group registered on the subject's CURRENT local pose
        // (co-bindings may animate the hidden subject).
        if (subject.parent) {
          grainGroup.position.copy(subject.position);
          grainGroup.quaternion.copy(subject.quaternion);
          grainGroup.scale.copy(subject.scale);
        }

        // Integrate progress TOWARD the driver's target (or run the time loop).
        // Moving toward a target (rather than a fixed ±1 ramp) lets a held
        // boolean settle to a mid-storm equilibrium and a numeric state scrub
        // to an exact frame; reaching the target then HOLDS it, so the pinned
        // engaged frame persists across repeated control-sweep seeks.
        const targetP = readStateTarget();
        const dur = RAMP;
        if (targetP === null) {
          progress = loopProgress(t);
          lastT = t;
        } else {
          const dt = lastT === null ? 0 : clamp(t - lastT, 0, DT_MAX);
          lastT = t;
          const step = dt / dur; // progress units per second toward the target
          if (progress < targetP) progress = Math.min(targetP, progress + step);
          else if (progress > targetP) progress = Math.max(targetP, progress - step);
        }

        // Live param reads (no rebuild for non-structural controls).
        const side = liveSide();
        if (side !== curSide) {
          rebuildGrid(side);
        }
        const swirl = num(params.swirlTurbulence, 0.9);
        const scatter = num(params.scatterDistance, 2.6);
        const softness = clamp(num(params.dissolveSoftness, 0.32), 0.02, 0.6);
        const count = side * side;
        grains.count = count;

        // Reference span for travel (face diagonal-ish), so scatter reads the
        // same on any artifact size.
        const span = Math.max(0.4, Math.hypot(W, H) * 0.5);

        // Chrome co-fade with the EARLY dissolve: gone by ~40% scattered.
        const chromeFade = 1 - clamp(progress / 0.4, 0, 1);
        for (const c of chrome) {
          c.m.opacity = c.opacity * chromeFade;
        }
        // The original card is hidden the instant the storm begins (the grains
        // are the card now); restored when fully reassembled.
        subject.visible = progress <= 0.001 ? prevVisible : false;

        const tintFor = (i: number, depart: number): void => {
          // depart 0 = on the face (full), 1 = fully launched (faded out).
          // Premultiplied fade so it reads as an alpha fade under additive
          // blending (a leaving grain's RGB sinks toward 0 ⇒ it dissolves).
          const fade = 1 - depart; // grains fade as they leave
          if (builtMap) {
            // MAP PATH: the texture sample carries the TRUE color; the tint is a
            // near-white SCALAR so the card's real pixels pass through faithfully,
            // just faded as the grain leaves, with a gentle lift over the dark rig.
            const lum = fade * 1.25;
            tintArr[i * 3] = lum;
            tintArr[i * 3 + 1] = lum;
            tintArr[i * 3 + 2] = lum;
            return;
          }
          // MAP-LESS FALLBACK: the subject-derived base color × a per-cell
          // deterministic tonal variation, so the grid still reads as the card
          // (rows of slightly different luminance) — never a flat invented fill.
          const tone = 0.72 + hash1(i * 8.13 + cellV[i] * 6.0) * 0.56; // 0.72..1.28
          const lum = fade * tone;
          tintArr[i * 3] = fallbackBase.r * lum;
          tintArr[i * 3 + 1] = fallbackBase.g * lum;
          tintArr[i * 3 + 2] = fallbackBase.b * lum;
        };

        for (let i = 0; i < count; i++) {
          // §11 staggered departure: a grain begins leaving once `progress`
          // crosses its threshold, completing across the softness BAND. A wider
          // band keeps more grains mid-transit at a fixed progress.
          const depart = clamp((progress - thresh[i] * (1 - softness)) / softness, 0, 1);

          // Cell UV (rewritten on density change; cheap to write every seek).
          cellUvArr[i * 2] = cellU[i];
          cellUvArr[i * 2 + 1] = cellV[i];

          if (depart <= 1e-4) {
            // Settled on the face — exact home, full size.
            posV.set(homeX[i], homeY[i], CZ);
            sclV.set(GRAIN_QUAD, GRAIN_QUAD, 1);
            mat4.makeScale(sclV.x, sclV.y, sclV.z);
            mat4.setPosition(posV);
            grains.setMatrixAt(i, mat4);
            tintFor(i, 0);
            continue;
          }

          // Launch path: outward drift × scatter, a curl swirl (deterministic
          // sine of the grain's own travel), and a slight gravity sag — the §9
          // procedural curl that gives the storm its swirl. Reassembly flies the
          // SAME path in reverse with a late overshoot snap near home.
          const e = snapEase(depart); // 0 at home → ~1 launched (slight overshoot)
          const travel = e * scatter * span;
          // Curl: rotate the launch direction by an angle that grows with travel
          // (a swirl), magnitude scaled by the turbulence control.
          const ang = swirlFreq[i] * e * Math.PI + spin[i];
          const ca = Math.cos(ang);
          const sa = Math.sin(ang);
          const sx = dirX[i] * ca - dirY[i] * sa;
          const sy = dirX[i] * sa + dirY[i] * ca;
          const swirlOff = swirl * swirlAmp[i] * e;
          posV.set(
            homeX[i] + (dirX[i] + sx * swirlOff) * travel,
            homeY[i] + (dirY[i] + sy * swirlOff) * travel - e * e * scatter * 0.35,
            CZ + dirZ[i] * travel,
          );
          // Grains shrink slightly as they fly (sand grains, not growing blobs).
          const gs = GRAIN_QUAD * (1 - depart * 0.35);
          // Billboard spin: a cheap z-rotation so flying grains tumble.
          const rot = spin[i] + e * swirlFreq[i] * 2;
          const cr = Math.cos(rot) * gs;
          const sr = Math.sin(rot) * gs;
          // Compose a rotated+scaled+translated matrix by hand (z-rotation only).
          mat4.set(
            cr, -sr, 0, posV.x,
            sr, cr, 0, posV.y,
            0, 0, gs, posV.z,
            0, 0, 0, 1,
          );
          grains.setMatrixAt(i, mat4);
          tintFor(i, depart);
        }
        // Park unused grains at a degenerate (zero-scale, dark) pose.
        for (let i = count; i < MAX_GRAINS; i++) {
          grains.setMatrixAt(i, ZERO);
          tintArr[i * 3] = 0;
          tintArr[i * 3 + 1] = 0;
          tintArr[i * 3 + 2] = 0;
        }
        grains.instanceMatrix.needsUpdate = true;
        cellUvAttr.needsUpdate = true;
        tintAttr.needsUpdate = true;
      };

      let lastSeekT = 0;
      return {
        duration: () => Infinity, // stateful; time fallback loops
        seek: (t) => {
          lastSeekT = t;
          apply(t);
        },
        onParamChange: (id: string, value: ControlValue) => {
          // Structural control: rebuild the grid + narrow the draw immediately so
          // a pin re-seek shows the new population (seek re-applies poses anyway).
          if (id === 'grainDensity') {
            rebuildGrid(num(value, 24));
            grains.count = curSide * curSide;
          }
          apply(lastSeekT);
        },
        dispose: () => {
          if (grainGroup.parent) grainGroup.parent.remove(grainGroup);
          geometry.dispose();
          material.dispose();
          grains.dispose();
          // Restore the subject + chrome EXACTLY as found (subject resources are
          // never touched — only our grain mesh/material were created).
          subject.visible = prevVisible;
          for (const c of chrome) {
            c.m.opacity = c.opacity;
            c.m.transparent = c.transparent;
          }
        },
      };
    },
  ),
};
