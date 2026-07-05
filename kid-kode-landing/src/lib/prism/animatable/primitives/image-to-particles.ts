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
// TEXTURE-TRUE (the §11 "carry its actual colors" promise) — when the subject has
// a real .map the grain material's colorNode samples the SUBJECT'S OWN live texture
// at the grain's instanced UV cell (texture shared by reference, scroll-stagger-rise
// / morph-into-card discipline): a late texture pour or an applyImageSpec material
// swap rebuilds the grain material the moment the map identity changes, so a mounted
// artifact's grains upgrade to its real pixels in flight. When the subject is
// map-less (the catalog card ships map-less GEOMETRY — a dark panel plus colored
// chrome children: a brass/amber header bar, an ice accent dot, grey content rows),
// each grain is colored by the CARD REGION its home cell covers: the chrome
// children's OWN materials/positions seed a region color-map (brass over the header,
// ice over the dot, grey over the rows, lifted panel over the bare body), so the
// dissolving storm visibly CARRIES THE CARD'S COLORS — a recognizable color map of
// the card, NEVER a flat gray fill. A radial soft-falloff alpha on each quad's uv
// (gaussian core killed to EXACT zero before the edge) keeps grains as soft motes,
// never hard squares; depthWrite:false so the translucent storm composites.
//
// STANDING-FRAME DISCOVERABILITY (the W5 advocate fix) — the held engaged pin is a
// VISIBLE lit mid-storm, never a void: (1) the per-grain fade is FLOORED (a launched
// grain dims to ~0.45, never to black) so the dispersed cloud stays lit; (2) the
// launch travel is VIEWPORT-BOUNDED (offset magnitude clamped + a final absolute
// frame-box clamp) so grains spread but stay ON-FRAME under any scatter/swirl,
// never flung off-screen. scatterDistance grows the standing radius within that
// envelope; swirlTurbulence reshapes the standing cloud's layout; grainDensity
// scales the live population; dissolveSoftness widens the mid-transit band.
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

      // ── Region color map (the card's ACTUAL colors per face region) ───────
      // Walk the subject's chrome children (header bar, accent dot, content rows
      // — each a Mesh with its own colored material) and record, in the SUBJECT'S
      // LOCAL frame (the same frame as the grain home positions below), each
      // child's footprint AABB + its emissive-lifted color. A grain whose home
      // cell falls inside a region takes that region's color; bare body grains
      // take the lifted panel color. This is what makes the dissolving storm a
      // recognizable COLOR MAP of the card rather than a flat gray fill — derived
      // from the chrome's OWN materials/positions, never invented.
      interface Region {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
        r: number;
        g: number;
        b: number;
      }
      const regions: Region[] = [];
      const rgbOf = (m: SourceLike | null): { r: number; g: number; b: number } => {
        const c = m?.color instanceof Color ? m.color : new Color('#3a4150');
        const e = m?.emissive instanceof Color ? m.emissive : new Color('#000000');
        const eI = m?.emissiveIntensity ?? 0;
        // Lift the color by its emissive contribution + a brightness floor so the
        // storm reads bright/saturated against the dark rig (embers lesson).
        return {
          r: Math.min(1, c.r + e.r * eI + 0.18),
          g: Math.min(1, c.g + e.g * eI + 0.16),
          b: Math.min(1, c.b + e.b * eI + 0.14),
        };
      };
      {
        const childBox = new Box3();
        const cMin = new Vector3();
        const cMax = new Vector3();
        subject.traverse((o) => {
          if (o === subject || o === mesh) return;
          const mm = o as Mesh;
          if (!mm.isMesh || !mm.geometry) return;
          childBox.setFromObject(mm);
          if (!Number.isFinite(childBox.min.x)) return;
          // Into the subject's local frame (chrome is parented to the subject, so
          // its world AABB → local via the subject's inverse world matrix).
          cMin.copy(childBox.min).applyMatrix4(invWorld);
          cMax.copy(childBox.max).applyMatrix4(invWorld);
          const childMat = (Array.isArray(mm.material) ? mm.material[0] : mm.material) as
            | SourceLike
            | null;
          const { r, g, b } = rgbOf(childMat);
          regions.push({
            minX: Math.min(cMin.x, cMax.x),
            maxX: Math.max(cMin.x, cMax.x),
            minY: Math.min(cMin.y, cMax.y),
            maxY: Math.max(cMin.y, cMax.y),
            r,
            g,
            b,
          });
        });
      }
      // Lifted panel (bare-body) base — the subject's own color/emissive, lifted
      // so body grains still glow against the graphite rig (never pure black).
      const bodyRGB = rgbOf(
        mesh
          ? ((Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as SourceLike)
          : null,
      );

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
      // premultiplied) → carries the per-grain REGION color AND the per-grain
      // opacity fade (premultiplied so it reads as an alpha fade). Declared here
      // so rebuildGrid can fill the cell uvs (per-cell constants) at build time.
      const cellUvArr = new Float32Array(MAX_GRAINS * 2);
      const tintArr = new Float32Array(MAX_GRAINS * 3);
      // Per-grain REGION base color (rgb, 0..1) — the card's ACTUAL color at the
      // grain's home cell: brass over the header, ice over the accent dot, grey
      // over the content rows, lifted panel over the bare body. Filled per density
      // in rebuildGrid from the chrome children's own materials + positions, so
      // the dissolving storm visibly CARRIES THE CARD'S COLORS (never a flat gray
      // fill). The map path overrides this with a live texture sample.
      const regionColor = new Float32Array(MAX_GRAINS * 3);

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
            // REGION COLOR: which chrome region does this grain's home cell sit
            // in? Last matching region wins (children pushed front-to-back). Bare
            // body grains take the lifted panel color. A tiny per-cell tonal
            // jitter keeps the cloud from banding flat. This carries the CARD'S
            // OWN COLORS into the storm.
            let rc = bodyRGB.r;
            let gc = bodyRGB.g;
            let bc = bodyRGB.b;
            for (let ri = 0; ri < regions.length; ri++) {
              const rg = regions[ri];
              if (
                homeX[idx] >= rg.minX &&
                homeX[idx] <= rg.maxX &&
                homeY[idx] >= rg.minY &&
                homeY[idx] <= rg.maxY
              ) {
                rc = rg.r;
                gc = rg.g;
                bc = rg.b;
              }
            }
            const tone = 0.86 + hash1(idx * 8.13 + v * 6.0) * 0.28; // 0.86..1.14
            regionColor[idx * 3] = Math.min(1, rc * tone);
            regionColor[idx * 3 + 1] = Math.min(1, gc * tone);
            regionColor[idx * 3 + 2] = Math.min(1, bc * tone);
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

      const prevVisible = subject.visible;

      // ── State integration (morph-into-card convention) ───────────────────
      let progress = 0; // 0 = assembled card, 1 = fully scattered storm
      let lastT: number | null = null;

      // A held-engaged boolean settles to a MID-STORM equilibrium (not full
      // scatter) so the pinned frame is a VISIBLE mid-effect storm where EVERY
      // control reshapes the standing population (W4 liveness — softness in
      // particular only differentiates the mid-transit band). At this value a
      // good fraction of grains are mid-transit — dispersed, lit (the fade is
      // floored), and ON-FRAME (travel is viewport-bounded) — so the standing
      // frame is a lit colored cloud of the card's grains, never a void. A
      // NUMERIC state scrubs the dissolve directly to that value (0 assembled → 1
      // storm), the §11 scrub. String 'on'/'active'/'hover' = engaged.
      const ENGAGED_TARGET = 0.52;
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
          // Refresh the bare-body color from the live source and rebuild the grid
          // so map-less region colors track a material swap.
          const lifted = rgbOf(live);
          bodyRGB.r = lifted.r;
          bodyRGB.g = lifted.g;
          bodyRGB.b = lifted.b;
          const side = curSide;
          curSide = -1;
          rebuildGrid(side);
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
        // Viewport-frame envelope (card half-extent + a margin): the standing
        // storm is hard-clamped inside this so no grain is ever flung off-frame.
        const frameHalfX = W * 0.5 + span * 0.6;
        const frameHalfY = H * 0.5 + span * 0.6;

        // Chrome co-fade with the EARLY dissolve: gone by ~40% scattered.
        const chromeFade = 1 - clamp(progress / 0.4, 0, 1);
        for (const c of chrome) {
          c.m.opacity = c.opacity * chromeFade;
        }
        // The original card is hidden the instant the storm begins (the grains
        // are the card now); restored when fully reassembled.
        subject.visible = progress <= 0.001 ? prevVisible : false;

        const tintFor = (i: number, depart: number): void => {
          // depart 0 = on the face (full), 1 = fully launched. The fade is
          // FLOORED: a launched grain dims but NEVER sinks to black while the
          // storm is held — so the standing engaged frame is a VISIBLE lit cloud
          // of the card's grains (the discoverability fix), not a void. The fade
          // premultiplies into RGB so it still reads as a gentle dim under
          // additive blending; full brightness only at home (depart 0).
          const fade = 1 - depart * 0.55; // 1.0 at home → 0.45 fully launched
          if (builtMap) {
            // MAP PATH: the texture sample carries the TRUE color; the tint is a
            // near-white SCALAR so the card's real pixels pass through faithfully,
            // dimmed (floored) as the grain leaves, with a gentle lift over the rig.
            const lum = fade * 1.35;
            tintArr[i * 3] = lum;
            tintArr[i * 3 + 1] = lum;
            tintArr[i * 3 + 2] = lum;
            return;
          }
          // MAP-LESS: the grain's REGION color (brass header / ice dot / grey rows
          // / lifted body — the card's ACTUAL colors per region, filled in
          // rebuildGrid), premultiplied by the floored fade. The storm reads as a
          // recognizable COLOR MAP of the card — never a flat gray fill.
          tintArr[i * 3] = regionColor[i * 3] * fade;
          tintArr[i * 3 + 1] = regionColor[i * 3 + 1] * fade;
          tintArr[i * 3 + 2] = regionColor[i * 3 + 2] * fade;
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

          // Launch path: outward drift, a curl swirl, and a slight gravity sag —
          // the §9 procedural curl that gives the storm its swirl. Reassembly
          // flies the SAME path in reverse with a late overshoot snap near home.
          const e = snapEase(depart); // 0 at home → ~1 launched (slight overshoot)
          // BOUNDED on-frame travel: scatterDistance modulates the storm radius
          // WITHIN a viewport-bounded envelope so grains spread but stay ON-FRAME
          // and visible (the advocate's "pushed into the void" fix). Even at
          // scatter=5 the radius stays ≈0.9·span, roughly one card half-extent —
          // a wide standing cloud, never off-screen.
          const travel = e * span * (0.26 + scatter * 0.13);
          // Curl: rotate the launch DIRECTION by an angle that grows with travel,
          // scaled by the turbulence control — a swirl that reshapes the cloud's
          // angular layout. Applied to the unit direction BEFORE the travel scale
          // (plus a bounded radial wobble) so swirl reshapes the storm without
          // ever blowing the radius off-frame.
          const ang = (swirlFreq[i] * e * Math.PI + spin[i]) * (0.35 + swirl * 0.65);
          const ca = Math.cos(ang);
          const sa = Math.sin(ang);
          const rx = dirX[i] * ca - dirY[i] * sa;
          const ry = dirX[i] * sa + dirY[i] * ca;
          // Swirl mixes the rotated direction into the launch and adds a bounded
          // per-grain radial wobble so the cloud visibly reshapes low→high swirl.
          const wob = 1 + swirl * swirlAmp[i] * 0.35 * Math.sin(swirlFreq[i] * e * 3.0 + spin[i]);
          const mix = clamp(swirl * 0.5, 0, 1);
          const dx = dirX[i] * (1 - mix) + rx * mix;
          const dy = dirY[i] * (1 - mix) + ry * mix;
          // Planar offset from home, then HARD-CLAMP its magnitude to a viewport-
          // bounded envelope so NO grain (not even a long-direction outlier under
          // high scatter × swirl wobble) is flung off-frame into the void. The
          // controls still modulate spread up to this cap — a wide standing cloud
          // that always stays on-screen and lit.
          let offX = dx * travel * wob;
          let offY = dy * travel * wob - e * e * span * 0.18;
          const offLen = Math.hypot(offX, offY);
          const OFFSET_MAX = span * 1.0; // ≈ one card half-extent of spread
          if (offLen > OFFSET_MAX) {
            const k = OFFSET_MAX / offLen;
            offX *= k;
            offY *= k;
          }
          // Final absolute-position clamp to a viewport-frame box (card extent +
          // margin): a hard guarantee that EVERY grain — including corner grains —
          // stays on-screen, lit, and legible. The storm never bleeds to a void.
          let px = homeX[i] + offX;
          let py = homeY[i] + offY;
          px = clamp(px, CX - frameHalfX, CX + frameHalfX);
          py = clamp(py, CY - frameHalfY, CY + frameHalfY);
          posV.set(px, py, CZ + dirZ[i] * travel);
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
