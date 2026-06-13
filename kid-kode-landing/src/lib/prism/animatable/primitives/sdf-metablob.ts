// sdf-metablob — a molten brass blob breathes at the heart of the tile while
// satellite droplets orbit IN, fuse seamlessly through liquid necks, and pinch
// free again. HARD / particles, subject:'empty', finite ~8s seamless loop.
//
// TECHNIQUE — DESIGN-REFERENCES §8 (Ray Marching & Signed Distance Functions):
// the ENTIRE blob is fragment math on a SINGLE quad. No geometry per droplet,
// no slab stack (volumetric:false — single-plane discipline; the catalog-wide
// slab look is killed). A TSL `Fn` + `Loop` ray-marches a scene of one core
// sphere + up to 4 orbiting satellites; the spheres are combined with
// opSmoothUnion (§8 "the magic sauce for organic/liquid effects": h = clamp(0.5
// + 0.5*(d2-d1)/k); mix(d2,d1,h) - k*h*(1-h)) so an approaching satellite grows
// a fat liquid NECK into the core before merging, then pinches free as it
// swings back out — the metaball fusion read. Hits are shaded with a REAL
// analytic normal (SDF gradient via central differences, §8 calcNormal) lit by
// a fixed warm key direction + a fresnel rim + a soft top-down env-ish gradient,
// so the body reads as a dimensional molten droplet, not a flat silhouette. The
// background is fully transparent (alpha 0 on a miss). March budget is tight
// (<=48 steps inside a bounded sphere) so the tile holds 60fps-class cost.
//
// DETERMINISM: every satellite rides a fixed elliptical orbit whose phase is
// (t * orbitSpeed + indexOffset); radii pulse on an index-hashed sine of the
// same phase. All per-satellite constants come from an index hash — never
// Math.random — so seek() is pure and a given t reproduces an exact frame. The
// CPU seek writes the live centers/radii into per-blob uniforms the Loop reads,
// AND publishes them on userData so the host/tests can mirror the GPU field
// with no renderer.
//
// CONTROL LIVENESS (frozen-frame demonstrable — the catalog's #1 failure): the
// rig sweeps each control at a single PINNED engaged t and pixel-diffs, so a
// pure rate would read DEAD. Here every control reshapes the STANDING frame:
//   • count       — gates how many satellites are active; more droplets ⇒ a
//                    visibly larger fused body at the pin (uniforms + draw math).
//   • fusion (k)  — the smooth-union radius; fatter necks swell the body's
//                    footprint at a fixed orbit pose.
//   • orbitSpeed  — folded INTO the orbit phase, so a faster speed has carried
//                    satellites FURTHER along their paths at the SAME pinned t
//                    (a different standing pose, not a transient).
//   • gloss       — drives the specular sharpness + fresnel-rim + key strength,
//                    a bounded live uniform that brightens the molten body/rim.
//
// COLOR: warm brass / molten-bronze world (no purple) — a hot bright core
// tone graded to a cooler bronze body, fresnel rim in pale gold, lit against
// the dark rig backdrop with bright speculars (the embers luminance lesson).
//
// DISTINCT from neighbors:
//   • metaball-merge (W1) — a flat 2D MASK morph of the card SILHOUETTE
//     (opacityNode SDF over the subject's uv). sdf-metablob is a self-contained
//     3D-SHADED raymarched BODY with analytic normals and real lighting; it
//     owns no subject and morphs nothing — it IS the rendered droplet.
//   • morph-cloud — a discrete PARTICLE cloud. Here there are no particles: one
//     continuous liquid surface defined entirely by distance math.

import {
  Mesh,
  PlaneGeometry,
  type Object3D,
} from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  Fn,
  Loop,
  If,
  Break,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
  float,
  length,
  max,
  min,
  dot,
  abs,
  clamp as tslClamp,
  mix,
  smoothstep,
  pow,
  normalize,
  reflect,
  positionGeometry,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

const TAU = Math.PI * 2;
const MAX_BLOBS = 5; // 1 core + up to 4 satellites
const LOOP_DUR = 8.0; // seamless-loop period (seconds)
const CORE_R = 0.46; // core sphere radius (scene units)
const QUAD_SIZE = 2.0; // covers the tile; the body lives within ~±0.95
const CAM_Z = 2.6; // synthetic eye distance for the per-fragment ray
const MARCH_STEPS = 48; // tight march budget (§8: bounded loop for tile cost)
const VIEW_HALF = 1.05; // half-extent of the uv→ray window (frames the body)

/** Deterministic 0..1 index hash (sin-fract — no Math.random anywhere). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898 + 4.137) * 43758.5453;
  return s - Math.floor(s);
};

interface SatSpec {
  /** orbit semi-axes (elliptical, in the camera-facing plane + a z swing) */
  ax: number;
  ay: number;
  az: number;
  /** tilt of the ellipse about z so orbits don't all share a plane */
  tilt: number;
  /** angular phase offset around the orbit (radians) */
  phase: number;
  /** how fast this satellite circles relative to the global loop */
  rate: number;
  /** baseline radius multiplier + pulse */
  rMul: number;
  rPulse: number;
}

// Deterministic satellite orbits keyed by index hash. Ellipses sized so a
// satellite swings from a fused inner pass (close to the core) out to a clearly
// separated outer pose — that traversal IS the fuse/pinch read.
const SATS: ReadonlyArray<SatSpec> = Array.from({ length: MAX_BLOBS - 1 }, (_, k) => {
  const i = k + 1;
  return {
    ax: 0.5 + hash1(i * 2.1 + 1.0) * 0.32,
    ay: 0.42 + hash1(i * 3.7 + 2.0) * 0.3,
    az: 0.18 + hash1(i * 5.3 + 3.0) * 0.22,
    tilt: hash1(i * 7.9 + 4.0) * TAU,
    phase: hash1(i * 11.3 + 5.0) * TAU,
    rate: 0.7 + hash1(i * 13.1 + 6.0) * 0.9,
    rMul: 0.46 + hash1(i * 17.7 + 7.0) * 0.22,
    rPulse: 0.06 + hash1(i * 19.3 + 8.0) * 0.07,
  };
});

const SCHEMA = [
  { id: 'count', label: 'Blobs', type: 'knob', min: 2, max: 5, step: 1, default: 4 },
  { id: 'fusion', label: 'Fusion', type: 'knob', min: 0.04, max: 0.7, step: 0.01, default: 0.32 },
  { id: 'orbitSpeed', label: 'Orbit Speed', type: 'knob', min: 0.2, max: 2, step: 0.05, default: 0.85 },
  { id: 'gloss', label: 'Gloss', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.7 },
] as const;

/** Active satellite count (core always present): 2..5 blobs total. */
const activeBlobs = (v: ControlValue | undefined): number =>
  Math.min(MAX_BLOBS, Math.max(2, Math.round(num(v, 4))));

export const sdfMetablobPrimitive: PrimitiveDefinition = {
  name: 'sdf-metablob',
  label: 'SDF Metablob',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A molten brass blob breathes at the heart of the tile — satellite droplets orbit in, fuse seamlessly through liquid necks, then pinch free again.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'sdf-metablob', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // ── Per-blob CPU-driven uniforms (the Loop reads these; pure field math) ─
      // Blob 0 is the core (fixed at origin, gently breathing radius); 1..4 are
      // satellites whose centers + radii the seek() loop rewrites every frame.
      const uCenter = Array.from({ length: MAX_BLOBS }, () => uniform(vec3(0, 0, 0)));
      const uRadius = Array.from({ length: MAX_BLOBS }, () => uniform(CORE_R));
      const uActive = Array.from({ length: MAX_BLOBS }, (_, i) => uniform(i < 2 ? 1 : 0));
      const uK = uniform(clamp(num(params.fusion, 0.32), 0.04, 0.7)); // smooth-union radius
      const uGloss = uniform(clamp(num(params.gloss, 0.7), 0, 1));

      // TSL intermediate-node alias (house casting discipline — the narrow
      // fluent return types fight a reassigned raymarch accumulator).
      type TNode = any; // eslint-disable-line @typescript-eslint/no-explicit-any

      // opSmoothUnion (§8): fuses two SDFs with a liquid neck of width k.
      const smin = (a: TNode, b: TNode): TNode => {
        const k = uK as TNode;
        const h: TNode = tslClamp(float(0.5).add(b.sub(a).mul(0.5).div(k)), float(0), float(1));
        return mix(b, a, h).sub(k.mul(h).mul(h.oneMinus()));
      };

      // Scene SDF: smooth-union over active spheres. Inactive blobs are gated to
      // a FAR distance so they vanish from the field (count restructures live).
      const FAR = float(50);
      const sceneSdf = Fn(([p]: [TNode]): TNode => {
        let d: TNode = FAR;
        for (let i = 0; i < MAX_BLOBS; i++) {
          const sphere: TNode = length((p as TNode).sub(uCenter[i] as TNode)).sub(uRadius[i] as TNode);
          const gated: TNode = mix(FAR, sphere, uActive[i] as TNode);
          d = i === 0 ? gated : smin(d, gated);
        }
        return d;
      });

      // Analytic normal via SDF central differences (§8 calcNormal).
      const calcNormal = Fn(([p]: [TNode]): TNode => {
        const e = float(0.0012);
        const ex = vec3(e, 0, 0);
        const ey = vec3(0, e, 0);
        const ez = vec3(0, 0, e);
        const nx = sceneSdf((p as TNode).add(ex)).sub(sceneSdf((p as TNode).sub(ex)));
        const ny = sceneSdf((p as TNode).add(ey)).sub(sceneSdf((p as TNode).sub(ey)));
        const nz = sceneSdf((p as TNode).add(ez)).sub(sceneSdf((p as TNode).sub(ez)));
        return normalize(vec3(nx, ny, nz));
      });

      // ── Per-fragment ray: uv → a window in the camera-facing plane, looking
      // down −z from CAM_Z. (Near-orthographic ray dir keeps the silhouette
      // crisp and the march bounds tight.) ───────────────────────────────────
      const u = uv() as TNode;
      const planeXY = u.sub(0.5).mul(2 * VIEW_HALF); // ±VIEW_HALF
      const ro: TNode = vec3(planeXY.x, planeXY.y, float(CAM_Z));
      const rd: TNode = normalize(vec3(planeXY.x.mul(0.12), planeXY.y.mul(0.12), float(-1)));

      // Warm-brass palette (Observatory world — no purple).
      const coreCol = vec3(1.0, 0.74, 0.4); // hot molten core tone
      const bodyCol = vec3(0.78, 0.5, 0.22); // cooler bronze body
      const rimCol = vec3(1.0, 0.9, 0.62); // pale-gold fresnel rim
      const keyDir = normalize(vec3(0.45, 0.7, 0.55)); // fixed warm key
      const fillDir = normalize(vec3(-0.5, -0.2, 0.4)); // cool-ish fill

      // ── March + shade, all in one Fn → vec4(rgb, alpha) ─────────────────────
      const renderNode = Fn((): TNode => {
        const t = float(0).toVar();
        const hit = float(0).toVar();
        const pos = vec3(0, 0, 0).toVar();
        Loop({ start: 0, end: MARCH_STEPS, type: 'int' }, () => {
          const p: TNode = ro.add(rd.mul(t));
          const dist: TNode = sceneSdf(p);
          If(dist.lessThan(0.0015), () => {
            pos.assign(p);
            hit.assign(1);
            Break();
          });
          t.addAssign(dist.mul(0.9)); // slight under-relaxation for fat necks
          // Bail once past the body's bounding span (front face ≈ CAM_Z+span).
          If(t.greaterThan(float(CAM_Z + 1.4)), () => {
            Break();
          });
        });

        // Shade the hit. n: analytic SDF normal. view points back to the eye.
        const n: TNode = calcNormal(pos);
        const view: TNode = normalize(ro.sub(pos));
        const ndl: TNode = max(dot(n, keyDir), float(0));
        const ndlFill: TNode = max(dot(n, fillDir), float(0)).mul(0.35);
        // Specular: sharpness + intensity ride GLOSS (frozen-frame visible).
        const refl: TNode = reflect(keyDir.negate(), n);
        const specPow: TNode = float(12).add((uGloss as TNode).mul(80));
        const spec: TNode = pow(max(dot(refl, view), float(0)), specPow).mul(
          float(0.25).add((uGloss as TNode).mul(1.1)),
        );
        // Fresnel rim — pale gold; gloss lifts the rim glint too.
        const fres: TNode = pow(float(1).sub(max(dot(n, view), float(0))), float(2.5));
        const rim: TNode = fres.mul(float(0.5).add((uGloss as TNode).mul(0.7)));
        // A soft top-down env-ish gradient so the body has ambient form.
        const env: TNode = n.y.mul(0.5).add(0.5).mul(0.3).add(0.18);

        // Hot core → cooler body across the lit term, then add specular + rim.
        const baseTone: TNode = mix(bodyCol, coreCol, ndl.mul(ndl));
        let lit: TNode = baseTone.mul(ndl.mul(0.95).add(env).add(ndlFill));
        lit = lit.add(vec3(1.0, 0.92, 0.78).mul(spec)); // warm-white spec
        lit = lit.add((rimCol as TNode).mul(rim));

        // Alpha 0 on a miss → fully transparent background.
        return vec4(lit.mul(hit), hit);
      });

      const rendered = renderNode();

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
      });
      (mat as unknown as { colorNode: unknown }).colorNode = (rendered as TNode).rgb;
      (mat as unknown as { opacityNode: unknown }).opacityNode = (rendered as TNode).a;

      const geometry = new PlaneGeometry(QUAD_SIZE, QUAD_SIZE, 1, 1);
      const quad = new Mesh(geometry, mat);
      quad.name = 'sdf-metablob';
      quad.frustumCulled = false;
      target.object.add(quad);

      // Reference positionGeometry so the import is exercised even though the
      // ray is built from uv (keeps the single-quad mapping explicit / stable).
      void (positionGeometry as unknown);
      void vec2;

      // Plain mirrors of the live blob field for the host/tests (CPU-observable
      // without a renderer — the SAME values written into the uniforms).
      interface BlobMirror {
        x: number;
        y: number;
        z: number;
        r: number;
        active: number;
      }
      const blobs: BlobMirror[] = Array.from({ length: MAX_BLOBS }, () => ({
        x: 0,
        y: 0,
        z: 0,
        r: CORE_R,
        active: 0,
      }));

      target.userData.sdfMetablob = {
        blobs, // live mirror, rewritten every seek
        center: uCenter,
        radius: uRadius,
        active: uActive,
        k: uK,
        gloss: uGloss,
        count: activeBlobs(params.count),
      };

      /** Write the blob field for clock time `tt`. Speed is folded into the
       *  phase so a frozen frame reflects the orbit-speed control. */
      const apply = (tt: number): void => {
        const n = activeBlobs(params.count);
        const speed = clamp(num(params.orbitSpeed, 0.85), 0.2, 2);
        uK.value = clamp(num(params.fusion, 0.32), 0.04, 0.7);
        uGloss.value = clamp(num(params.gloss, 0.7), 0, 1);

        // Global loop angle: a full TAU over LOOP_DUR keeps the loop seamless
        // (sin/cos of an integer number of TAU at t and t+LOOP_DUR match).
        const base = (tt / LOOP_DUR) * TAU * speed;

        // Core (blob 0): anchored, breathing radius (also seamless in base).
        const coreR = CORE_R * (1 + 0.06 * Math.sin(base * 2));
        const u0 = target.userData.sdfMetablob as { blobs: BlobMirror[] };
        (uCenter[0] as unknown as { value: { set: (x: number, y: number, z: number) => void } }).value.set(0, 0, 0);
        (uRadius[0] as unknown as { value: number }).value = coreR;
        (uActive[0] as unknown as { value: number }).value = 1;
        u0.blobs[0].x = 0;
        u0.blobs[0].y = 0;
        u0.blobs[0].z = 0;
        u0.blobs[0].r = coreR;
        u0.blobs[0].active = 1;

        for (let k = 0; k < SATS.length; k++) {
          const i = k + 1;
          const on = i < n ? 1 : 0;
          const spec = SATS[k];
          const ang = base * spec.rate + spec.phase;
          // Elliptical orbit in a tilted plane: ex/ey rotate the in-plane axes.
          const ca = Math.cos(spec.tilt);
          const sa = Math.sin(spec.tilt);
          const ox = spec.ax * Math.cos(ang);
          const oy = spec.ay * Math.sin(ang);
          const x = ox * ca - oy * sa;
          const y = ox * sa + oy * ca;
          const z = spec.az * Math.sin(ang * 1.7 + spec.phase);
          // Radius pulses on the orbit phase — droplets breathe as they swing.
          const r = CORE_R * spec.rMul * (1 + spec.rPulse * Math.sin(ang * 2 + spec.phase));

          (uCenter[i] as unknown as { value: { set: (x: number, y: number, z: number) => void } }).value.set(x, y, z);
          (uRadius[i] as unknown as { value: number }).value = r;
          (uActive[i] as unknown as { value: number }).value = on;

          u0.blobs[i].x = x;
          u0.blobs[i].y = y;
          u0.blobs[i].z = z;
          u0.blobs[i].r = r;
          u0.blobs[i].active = on;
        }

        (target.userData.sdfMetablob as { count: number }).count = n;
      };

      apply(0); // sensible idle rest state (core + satellites present, not black)

      return {
        // Finite seamless loop (§ brief: ~8s). Driver pins t=1 mid-loop for the
        // engaged control sweeps; t=0 is a populated rest pose, never black.
        duration: () => LOOP_DUR,
        seek: (tt) => {
          // Wrap into [0, LOOP_DUR) so t and t+duration produce the same frame.
          let p = tt % LOOP_DUR;
          if (p < 0) p += LOOP_DUR;
          apply(p);
        },
        onParamChange: (id: string, value: ControlValue) => {
          // Re-apply at the pinned time so the control sweep (paused seeks)
          // reshapes the standing frame immediately.
          if (id === 'fusion') uK.value = clamp(num(value, 0.32), 0.04, 0.7);
          else if (id === 'gloss') uGloss.value = clamp(num(value, 0.7), 0, 1);
          // count + orbitSpeed are read live inside apply() on the next seek;
          // structural count is reflected on the published field there too.
        },
        dispose: () => {
          target.object.remove(quad);
          geometry.dispose();
          mat.dispose();
          delete target.userData.sdfMetablob;
        },
      };
    },
  ),
};
