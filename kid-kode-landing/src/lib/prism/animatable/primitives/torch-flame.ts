// torch-flame — a single tall torch flame licking upward with a bright hot core
// and a smoky tapering tip, swaying side-to-side as it burns. HARD / GPU
// primitive. Swaps the host plane's material for a MeshBasicNodeMaterial
// (transparent, additive) whose colorNode builds a flame from upward-advected
// layered noise (uv.y - uTime*rise) shaped by a TALL NARROW horizontal envelope
// whose center SWAYS with height (cx = 0.5 + sin(uv.y*2 + uTime)*sway*uv.y) and
// TAPERS toward the top into a smoky tip. The palette ramps blackbody hot-core
// white/yellow -> orange -> dark. opacityNode = flame mask. seek() advances
// uTime; onParamChange() updates the live uniforms.
//
// DISTINCT from fire-flame (wide blaze) and campfire (tight multi-tongue): this
// is ONE tall column, narrow, that sways as a whole and tapers to a single
// smoky tip — a torch, not a bonfire.
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
  floor,
  fract,
  dot,
  mix,
  max,
  abs,
  smoothstep,
  clamp as tslClamp,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'rise', label: 'Rise', type: 'knob', min: 0.3, max: 4, step: 0.05, default: 1.6 },
  { id: 'sway', label: 'Sway', type: 'knob', min: 0, max: 0.4, step: 0.01, default: 0.16 },
  { id: 'height', label: 'Height', type: 'knob', min: 0.4, max: 1.8, step: 0.05, default: 1.1 },
] as const;

export const torchFlamePrimitive: PrimitiveDefinition = {
  name: 'torch-flame',
  label: 'Torch Flame',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A tall torch flame licks upward with a bright hot core and a smoky tapering tip, swaying as it burns.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'torch-flame', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uRise = uniform(num(params.rise, 1.6));
      const uSway = uniform(num(params.sway, 0.16));
      const uHeight = uniform(num(params.height, 1.1));

      // Publish handles so the CPU test (and host) can observe state.
      target.userData.torchFlame = { uTime, uRise, uSway, uHeight };

      // ── TSL value-noise + fbm (deterministic; no Math.random in shader) ────
      // TSL node types are intentionally loose (cast to a generic node) so strict
      // typing of vec2() join-nodes does not pin helper params — mirrors
      // caustics.ts / campfire.ts casting discipline.
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

      // Normalized height up the flame (0 at base, 1 at the flame tip).
      const yUp = u.y.div(max(uHeight, float(0.001)));
      const yC = tslClamp(yUp, float(0), float(1));

      // Sway: the flame's center line bends with height and time, so the whole
      // tall column leans and waves as one — cx = 0.5 + sin(uv.y*2 + t)*sway*uv.y.
      const swayPhase = u.y.mul(2.0).add(uTime.mul(1.8));
      const cx = float(0.5).add(sin(swayPhase).mul(uSway).mul(u.y));
      const xc = u.x.sub(cx);

      // Upward-advected noise field: subtracting uTime*rise from y scrolls the
      // noise upward so the flame licks/rises. Layered octaves give detail.
      const t = uTime.mul(uRise);
      const flow = vec2(u.x.mul(3.5), u.y.mul(4.2).sub(t.mul(2.2)));
      const n1 = noise(flow);
      const n2 = noise(flow.mul(2.07).add(vec2(t.mul(0.4), t))).mul(0.5);
      const n3 = noise(flow.mul(4.13).sub(vec2(t.mul(0.6), t.mul(0.8)))).mul(0.25);
      const n4 = noise(flow.mul(8.21).add(vec2(t.mul(0.3), t.mul(1.6)))).mul(0.125);
      const fbm = n1.add(n2).add(n3).add(n4).mul(float(1).div(1.875));

      // TALL NARROW envelope that TAPERS toward the top into a smoky tip. The
      // half-width starts modest at the base and shrinks to a point near the tip.
      const width = mix(float(0.22), float(0.02), smoothstep(float(0.0), float(1.0), yC));
      const sideMask = smoothstep(width, width.mul(0.3), abs(xc));

      // Vertical body glow fades from base to top; a height-rising threshold
      // breaks the upper flame into licking, dissolving tips.
      const baseGlow = smoothstep(float(1.15), float(0.0), yUp);
      const threshold = yUp.mul(0.62).add(0.06);
      const raw = max(
        fbm.mul(baseGlow).mul(sideMask).sub(threshold),
        float(0),
      ).mul(float(4.2));

      // flame mask m = smoothstep(0,1, flameProfile)
      const m = smoothstep(float(0), float(1), raw);

      // Blackbody palette: hot white/yellow core -> orange -> dark smoky red.
      const core = vec3(1.0, 0.96, 0.74); // hot blackbody core
      const yellow = vec3(1.0, 0.74, 0.16);
      const orange = vec3(1.0, 0.33, 0.03);
      const dark = vec3(0.26, 0.05, 0.02);
      const ramp1 = mix(dark, orange, smoothstep(float(0.0), float(0.36), m));
      const ramp2 = mix(ramp1, yellow, smoothstep(float(0.32), float(0.68), m));
      const ramp3 = mix(ramp2, core, smoothstep(float(0.68), float(1.0), m));
      // Smoky tip: cool the upper flame so the tapering tip reads as smoke.
      const smokeTip = mix(float(1), float(0.55), smoothstep(float(0.55), float(1.0), yC));
      const colorNode = ramp3.mul(smokeTip);

      // opacityNode = flame mask, with a soft top fade so the tip dissolves.
      const topFade = smoothstep(float(1.1), float(0.15), yUp);
      const opacityNode = tslClamp(m.mul(1.3).mul(topFade), float(0), float(1));

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
        // Looping, time-driven burn — purely stateful.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uRise.value = num(params.rise, 1.6);
          uSway.value = num(params.sway, 0.16);
          uHeight.value = num(params.height, 1.1);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'rise') uRise.value = num(value, 1.6);
          else if (id === 'sway') uSway.value = num(value, 0.16);
          else if (id === 'height') uHeight.value = num(value, 1.1);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
          delete target.userData.torchFlame;
        },
      };
    },
  ),
};
