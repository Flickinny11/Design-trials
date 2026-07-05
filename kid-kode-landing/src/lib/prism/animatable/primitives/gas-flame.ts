// gas-flame — a blue gas-burner flame. HARD / volumetric / GPU primitive.
// Swaps the host plane's material for a MeshBasicNodeMaterial whose colorNode
// paints a row of small blue flame cones across x: each cone is a narrow
// upward envelope with a sharp tip and a bright hot inner core. The palette
// runs deep-blue -> cyan -> white-hot at the core, and a fast low-amplitude
// flicker driven by a time uniform keeps it hissing and steady like a stovetop.
// opacityNode masks the surface to the flame body. seek() advances uTime; live
// param reads (and onParamChange) re-drive the uniforms with no rebuild.
//
// DISTINCT from fire-flame / torch (orange): blue gas-burner cones with cyan
// flanks and white-hot cores, not a single warm flame.

import { Mesh, Color, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec3,
  float,
  sin,
  fract,
  abs,
  pow,
  max,
  min,
  mix,
  smoothstep,
  clamp,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'jets', label: 'Jets', type: 'knob', min: 2, max: 8, step: 1, default: 5 },
  { id: 'flicker', label: 'Flicker', type: 'knob', min: 0, max: 2, step: 0.05, default: 1 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0.2, max: 2.5, step: 0.05, default: 1.2 },
] as const;

const c = (hex: string): [number, number, number] => {
  const col = new Color(hex);
  return [col.r, col.g, col.b];
};

// Palette: deep blue base -> cyan flanks -> white-hot inner core.
const DEEP = c('#0a2bd8'); // deep cobalt blue
const CYAN = c('#23d9ff'); // bright cyan
const HOT = c('#eafcff'); // near-white hot

export const gasFlamePrimitive: PrimitiveDefinition = {
  name: 'gas-flame',
  label: 'Gas Flame',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A blue gas-burner flame — sharp cones of blue with hot inner cores, hissing and steady like a stovetop.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'gas-flame', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uJets = uniform(num(params.jets, 5));
      const uFlicker = uniform(num(params.flicker, 1));
      const uIntensity = uniform(num(params.intensity, 1.2));

      const uDeep = uniform(vec3(DEEP[0], DEEP[1], DEEP[2]));
      const uCyan = uniform(vec3(CYAN[0], CYAN[1], CYAN[2]));
      const uHot = uniform(vec3(HOT[0], HOT[1], HOT[2]));

      const u = uv();
      const t = uTime;

      // ── Lay out `jets` cones across x. Each column is its own cone cell. ──
      // cell index along x and the local x within the cell ([0,1)).
      const cells = uJets;
      const cellF = u.x.mul(cells); // 0..jets across the surface
      const idx = cellF.sub(fract(cellF)); // floor → cone index (for per-jet phase)
      const localX = fract(cellF); // 0..1 within this cone's column
      const centeredX = localX.sub(0.5).mul(2); // -1..1, 0 at the jet centre

      // Per-jet flicker phase: a cheap deterministic offset so neighbouring
      // jets hiss out of sync. fast, low-amplitude.
      const jetSeed = sin(idx.mul(12.9898)).mul(43758.5453);
      const jetPhase = fract(jetSeed); // 0..1 stable per jet

      // Fast low-amplitude flicker: tip height wobbles a little around 1.
      const flick = sin(t.mul(11).add(jetPhase.mul(6.283)))
        .mul(0.5)
        .add(sin(t.mul(23).add(idx)).mul(0.5))
        .mul(0.06)
        .mul(uFlicker);
      // Cone height as a function of how high up the surface we are.
      // y=0 at the base (bottom of the plane), 1 at the top.
      const y = u.y;
      const tipH = float(0.92).add(flick); // top of this cone

      // Cone half-width shrinks linearly from base to tip → sharp cone.
      // base width fraction of a cell, narrowing to ~0 at the tip.
      const along = clamp(y.div(tipH), float(0), float(1)); // 0 at base .. 1 at tip
      const halfWidth = float(0.85).mul(float(1).sub(along)); // 0.85 .. 0 (in centeredX units)

      // Distance from the jet centreline, normalised by the local half-width.
      const dist = abs(centeredX).div(max(halfWidth, float(0.001)));

      // Inside-the-cone factor: 1 at the centreline, fades to 0 at the edge.
      // sharpen the edge so the cone reads crisp.
      const body = smoothstep(float(1.0), float(0.55), dist);

      // Vertical envelope: present from base up to the (flickering) tip, with a
      // soft top so the cone tapers out rather than clipping.
      const vert = smoothstep(tipH, tipH.sub(0.12), y).mul(smoothstep(float(-0.02), float(0.08), y));

      // The flame mask: cone body AND vertical envelope.
      const flame = body.mul(vert);

      // Hot inner core: a much narrower, taller wedge near the centreline that
      // glows white-hot at the bottom of the cone.
      const coreDist = abs(centeredX).div(max(halfWidth.mul(0.42), float(0.001)));
      const core = smoothstep(float(1.0), float(0.2), coreDist)
        .mul(smoothstep(float(0.62), float(0.0), y)) // hottest near the base
        .mul(vert);

      // ── Colour: deep blue → cyan → white-hot inner. ──
      // base blue at the flanks; cyan as we approach the centreline; hot core.
      const flank = float(1).sub(clamp(dist, float(0), float(1)));
      let acc: any = mix(uDeep, uCyan, pow(flank, float(1.4)));
      acc = mix(acc, uHot, clamp(core, float(0), float(1)));

      // Brightness driven by intensity, modulated by a fast field flicker so the
      // whole burner pulses subtly (hiss). Multiply by the flame mask so colour
      // only appears inside the cones.
      const fieldFlick = sin(t.mul(31)).mul(0.04).mul(uFlicker).add(1);
      const bright = max(flame, min(core, float(1))).mul(uIntensity).mul(fieldFlick);
      const colorNode = acc.mul(bright);

      // Opacity mask: visible where there is flame or core.
      const opacityNode = clamp(max(flame, core).mul(uIntensity), float(0), float(1));

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish the live uniform handles into the host scratch space so the
      // driver (and tests) can observe what seek() pushed to the GPU. This is
      // the contract-sanctioned channel for sharing uniform handles with the
      // host (AnimatableTarget.userData).
      target.userData.gasFlame = { uTime, uJets, uFlicker, uIntensity };

      return {
        // Looping/continuous flicker — no settled end-state.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Live param reads so control changes apply without a rebuild.
          uJets.value = num(params.jets, 5);
          uFlicker.value = num(params.flicker, 1);
          uIntensity.value = num(params.intensity, 1.2);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'jets') uJets.value = num(value, 5);
          else if (id === 'flicker') uFlicker.value = num(value, 1);
          else if (id === 'intensity') uIntensity.value = num(value, 1.2);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
