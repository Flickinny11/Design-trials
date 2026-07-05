// campfire — a small, tight, flickering campfire: licking orange-to-yellow
// flame tongues with a hot blackbody core and a settling warmth toward the
// edges. HARD / GPU primitive. Swaps the host plane's material for a
// MeshBasicNodeMaterial (transparent, additive) whose colorNode builds a
// vertical flame mask `m = smoothstep(0,1, flameProfile(uv, uTime))`, where
// flameProfile uses upward-advected layered noise (uv.y - uTime) modulated by a
// centered horizontal envelope that NARROWS toward the top into a multi-tongue
// shape. The palette ramps blackbody hot-core -> yellow -> orange -> dark by
// height/intensity. opacityNode = m. seek() advances uTime (flicker);
// onParamChange() updates the live uniforms. Distinct from fire-flame: tighter
// horizontal envelope, multiple discrete tongues, warmer/hotter blackbody core.
//
// Uniform handles are published on target.userData so a headless CPU test can
// observe the animation without a real GPU.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial, AdditiveBlending } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  sin,
  cos,
  floor,
  fract,
  dot,
  mix,
  max,
  abs,
  exp,
  smoothstep,
  clamp as tslClamp,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Flicker', type: 'knob', min: 0.1, max: 5, step: 0.1, default: 2.2 },
  { id: 'height', label: 'Height', type: 'knob', min: 0.3, max: 1.8, step: 0.05, default: 0.85 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0.2, max: 2.5, step: 0.05, default: 1.2 },
] as const;

export const campfirePrimitive: PrimitiveDefinition = {
  name: 'campfire',
  label: 'Campfire',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A small flickering campfire — licking orange-to-yellow flame tongues with a hot core and rising sparks, warmer and tighter than the big fire.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'campfire', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 2.2));
      const uHeight = uniform(num(params.height, 0.85));
      const uIntensity = uniform(num(params.intensity, 1.2));

      // Publish handles so the CPU test (and host) can observe state.
      target.userData.campfire = { uTime, uSpeed, uHeight, uIntensity };

      // ── TSL value-noise + fbm (deterministic; no Math.random in shader) ────
      // TSL node types are intentionally loose (cast to a generic node) so strict
      // typing of vec2() join-nodes does not pin helper params — mirrors
      // caustics.ts / fire-flame.ts casting discipline.
      type TVec = ReturnType<typeof vec2>;
      const asNode = (p: unknown) => p as TVec;
      const hash = (p0: unknown) => {
        const p = asNode(p0);
        return fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
      };
      const noise = (p0: unknown) => {
        const p = asNode(p0);
        const i = floor(p);
        const f = fract(p);
        const w = f.mul(f).mul(float(3).sub(f.mul(2)));
        const a = hash(i);
        const b = hash(i.add(vec2(1, 0)));
        const c = hash(i.add(vec2(0, 1)));
        const d = hash(i.add(vec2(1, 1)));
        const x1 = mix(a, b, w.x);
        const x2 = mix(c, d, w.x);
        return mix(x1, x2, w.y);
      };

      const u = uv();
      const t = uTime.mul(uSpeed);

      // flameProfile(uv, uTime): upward-advected fbm masked by a centered,
      // top-narrowing horizontal envelope shaped into multiple tongues.
      // uv.y - uTime scrolls the noise upward (flames lick upward).
      const yUp = u.y.div(max(uHeight, float(0.001)));
      const yC = tslClamp(yUp, float(0), float(1));

      // Advected noise field; tight horizontal frequency keeps the fire small.
      const flow = vec2(u.x.mul(4.5), u.y.mul(5.5).sub(t.mul(2.2)));
      const n1 = noise(flow);
      const n2 = noise(flow.mul(2.07).add(vec2(t.mul(0.6), t))).mul(0.5);
      const n3 = noise(flow.mul(4.13).sub(vec2(t, t.mul(0.8)))).mul(0.25);
      const n4 = noise(flow.mul(8.21).add(vec2(t.mul(0.4), t.mul(1.9)))).mul(0.125);
      const fbm = n1.add(n2).add(n3).add(n4).mul(float(1).div(1.875));

      // Multi-tongue horizontal envelope: a few cosine lobes across x give the
      // discrete licking tongues, drifting slightly with time so they dance.
      const xc = u.x.sub(0.5);
      const tongues = cos(xc.mul(18).add(t.mul(1.7))).mul(0.5).add(0.5);
      // Centered base envelope that NARROWS toward the top (tighter than fire).
      const width = mix(float(0.34), float(0.05), yC);
      const sideMask = smoothstep(width, width.mul(0.35), abs(xc));
      // Tongues are stronger low, blended toward solid body at the base.
      const tongueMask = mix(float(1), tongues, yC.mul(0.85));

      // Base glow fades from base to top; rising threshold breaks tips into licks.
      const baseGlow = smoothstep(float(1.1), float(0.0), yUp);
      const threshold = yUp.mul(0.5).add(0.1);
      const raw = max(
        fbm.mul(baseGlow).mul(sideMask).mul(tongueMask).sub(threshold),
        float(0),
      ).mul(float(3.4).mul(uIntensity));

      // m = smoothstep(0,1, flameProfile)
      const m = smoothstep(float(0), float(1), raw);

      // Blackbody palette by height/intensity: hot white-blue core -> yellow ->
      // orange -> dark red embers at the cool fringes.
      const core = vec3(1.0, 0.97, 0.78); // hot blackbody core
      const yellow = vec3(1.0, 0.78, 0.18);
      const orange = vec3(1.0, 0.36, 0.04);
      const dark = vec3(0.32, 0.04, 0.01);
      const ramp1 = mix(dark, orange, smoothstep(float(0.0), float(0.35), m));
      const ramp2 = mix(ramp1, yellow, smoothstep(float(0.3), float(0.66), m));
      const ramp3 = mix(ramp2, core, smoothstep(float(0.66), float(1.0), m));
      // Warm flicker pulse on the core so it breathes hotter/cooler.
      const flick = sin(uTime.mul(uSpeed).mul(7).add(u.x.mul(11))).mul(0.5).add(0.5).mul(0.16);

      // ── Rising sparks (punch-list fix 2026-06-11) ───────────────────────────
      // The description promises "rising sparks" but the shader never had any.
      // Deterministic ember points on an upward-advected cell grid: each cell
      // (22 across × 9 tall) hosts a spark when its hash clears ~0.8 (≈1 in 5),
      // jittered inside the cell, drawn as a tight isotropic gaussian dot
      // (cell space is 22:9 anisotropic, so the y term is rescaled by 22/9).
      // The grid scrolls up with t (sparks rise), each spark twinkles on its
      // own hash phase, and a window confines them to above the flame column.
      const sparkGrid = vec2(u.x.mul(22.0), u.y.mul(9.0).sub(t.mul(3.4)));
      const sparkCell = floor(sparkGrid);
      const sparkF = fract(sparkGrid);
      const sparkSeed = hash(sparkCell);
      const sparkJx = hash(sparkCell.add(vec2(7.3, 1.1))).mul(0.6).add(0.2);
      const sparkJy = hash(sparkCell.add(vec2(3.7, 9.2))).mul(0.6).add(0.2);
      const sdx = sparkF.x.sub(sparkJx);
      const sdy = sparkF.y.sub(sparkJy).mul(22.0 / 9.0);
      const sparkD2 = sdx.mul(sdx).add(sdy.mul(sdy));
      const sparkDot = exp(sparkD2.mul(-110.0));
      const sparkGate = smoothstep(float(0.78), float(0.82), sparkSeed);
      const twinkle = sin(t.mul(9.0).add(sparkSeed.mul(41.0))).mul(0.5).add(0.5);
      // Window: from the upper flame body to just below the top edge, and
      // horizontally near the flame column (ascending smoothstep edges only).
      const sparkBandY = smoothstep(float(0.18), float(0.38), u.y)
        .mul(float(1).sub(smoothstep(float(0.78), float(0.98), u.y)));
      const sparkBandX = float(1).sub(smoothstep(float(0.16), float(0.4), abs(xc)));
      const spark = sparkDot
        .mul(sparkGate)
        .mul(twinkle)
        .mul(sparkBandY)
        .mul(sparkBandX)
        .mul(tslClamp(uIntensity, float(0), float(2)));

      const sparkColor = vec3(1.0, 0.72, 0.3); // ember orange-gold
      const colorNode = ramp3
        .mul(float(1).add(flick))
        .mul(uIntensity)
        .add(sparkColor.mul(spark));

      // opacityNode = m, with a soft top fade so tongue tips dissolve; sparks
      // add their own alpha so they survive above the flame body.
      const topFade = smoothstep(float(1.05), float(0.2), yUp);
      const opacityNode = tslClamp(
        m.mul(1.25).mul(topFade).add(spark),
        float(0),
        float(1),
      );

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        // Looping, time-driven flicker — purely stateful.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 2.2);
          uHeight.value = num(params.height, 0.85);
          uIntensity.value = num(params.intensity, 1.2);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 2.2);
          else if (id === 'height') uHeight.value = num(value, 0.85);
          else if (id === 'intensity') uIntensity.value = num(value, 1.2);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
          delete target.userData.campfire;
        },
      };
    },
  ),
};
