// aurora — aurora borealis curtains painted over the plane surface. HARD / GPU
// primitive. Swaps the host plane's material for a MeshBasicNodeMaterial whose
// colorNode draws 2-3 vertical ribbons of light whose horizontal position waves
// with uv.y and a time uniform: ribbon = exp(-((uv.x - curtainPath)/width)^2).
// Intensity falls off with height; the palette mixes green->teal->violet by
// uv.y with a slow hue drift over time. opacityNode = total intensity. seek()
// advances the time uniform; onParamChange() updates the live uniforms.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, sin, exp, mix, vec3, float, sqrt, max, min, sub, smoothstep } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 3, step: 0.1, default: 1 },
  { id: 'width', label: 'Width', type: 'knob', min: 0.02, max: 0.4, step: 0.01, default: 0.12 },
  { id: 'brightness', label: 'Brightness', type: 'knob', min: 0, max: 3, step: 0.05, default: 1.4 },
] as const;

export const auroraPrimitive: PrimitiveDefinition = {
  name: 'aurora',
  label: 'Aurora',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Aurora borealis curtains — vertical ribbons of green-to-violet light waving and shimmering across a night sky.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'aurora', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 1));
      const uWidth = uniform(num(params.width, 0.12));
      const uBright = uniform(num(params.brightness, 1.4));

      const u = uv();
      const t = uTime.mul(uSpeed);

      // A vertical curtain: its horizontal center wanders with uv.y and time so
      // the ribbon waves like an aurora. Gaussian falloff in x gives a soft
      // glowing band; intensity decays toward the top (high uv.y).
      const heightFade = float(0.15).add(u.y.mul(0.85)); // brighter low, fading up

      const curtain = (phase: number, sway: number, freq: number) => {
        const center = float(0.5)
          .add(sin(u.y.mul(freq).add(t).add(float(phase))).mul(sway))
          .add(sin(u.y.mul(freq * 1.7).sub(t.mul(0.6))).mul(sway * 0.4));
        const d = u.x.sub(center).div(uWidth);
        return exp(d.mul(d).negate()).mul(heightFade);
      };

      const c1 = curtain(0.0, 0.22, 5.0);
      const c2 = curtain(2.1, 0.16, 7.0);
      const c3 = curtain(4.3, 0.28, 4.0);

      // ── Control-range containment (punch-list fix 2026-06-11) ──────────────
      // At control extremes (width 0.4 + brightness 3) the three unit-peak
      // gaussians overlap into total ≈ 6–7: the palette saturates to a white
      // blob that fills the tile (the "control-range clipping" defect; the
      // DEFAULT state was already clean). Two physically-motivated fixes:
      //  1. ENERGY CONSERVATION — widening a curtain dims it (amp ∝ (w₀/w)^0.75,
      //     a touch past √ so merged wide curtains stay ribbons, not a wall).
      //  2. SOFT KNEE — totals are linear (untouched) up to K=1.8 (above the
      //     typical default peak, so the default look is essentially
      //     unchanged), then firmly compressed so extremes glow hot in-palette
      //     instead of clipping the tile center to white.
      const wRatio = float(0.12).div(max(uWidth, float(0.02)));
      const amp = min(sqrt(wRatio).mul(sqrt(sqrt(wRatio))), float(1.6)); // (w0/w)^0.75
      const totalRaw = c1.add(c2).add(c3).mul(uBright).mul(amp);
      const knee = float(1.5);
      const excess = max(totalRaw.sub(knee), float(0));
      const compressed = min(totalRaw, knee).add(excess.div(float(1).add(excess.mul(2.0))));
      //  3. EDGE CONTAINMENT — the literal "pushes the effect out of the tile
      //     bounds" defect: at control extremes the glow ran to the plane
      //     borders and hard-clipped. A soft window fades all four edges
      //     (ascending smoothstep edges only); the default ribbons live mid-
      //     plane so the default read is barely touched, while extremes now
      //     dissolve organically inside the tile instead of slamming its rim.
      const edgeWin = smoothstep(float(0), float(0.1), u.x)
        .mul(smoothstep(float(0), float(0.1), sub(float(1), u.x)))
        .mul(smoothstep(float(0), float(0.12), u.y))
        .mul(smoothstep(float(0), float(0.12), sub(float(1), u.y)));
      const total = compressed.mul(edgeWin);

      // Palette: green -> teal -> violet by uv.y, with a slow hue drift in time.
      const green = vec3(0.15, 0.95, 0.45);
      const teal = vec3(0.1, 0.8, 0.85);
      const violet = vec3(0.65, 0.35, 0.95);
      const drift = sin(t.mul(0.3)).mul(0.5).add(0.5); // 0..1 slow oscillation
      const lowMix = mix(green, teal, u.y);
      const palette = mix(lowMix, violet, u.y.mul(drift));

      const colorNode = palette.mul(total);

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = total;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles on the shared scratch space so the host (and
      // headless tests, which have no GPU to read shader output) can observe the
      // seek-driven clock and live control values.
      target.userData.auroraUniforms = { uTime, uSpeed, uWidth, uBright };

      return {
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 1);
          uWidth.value = num(params.width, 0.12);
          uBright.value = num(params.brightness, 1.4);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 1);
          else if (id === 'width') uWidth.value = num(value, 0.12);
          else if (id === 'brightness') uBright.value = num(value, 1.4);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
