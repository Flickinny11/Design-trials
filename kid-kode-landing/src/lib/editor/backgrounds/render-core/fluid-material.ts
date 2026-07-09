// W-BG render-core — fluid-overlay material builder (pure three+tsl, no
// React, no DOM). ONE source shared by the R3F FluidOverlayLayer and the
// runtime procedural-background mounter. Shader story documented in
// FluidOverlayLayer.tsx (variants: silk/ink/caustic/smoke/plasma).

import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  Fn,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
  float,
  sin,
  abs,
  pow,
  mix,
  clamp as tslClamp,
  smoothstep,
  length as tslLength,
  mx_fractal_noise_float,
} from "three/tsl";
import type { BackgroundPalette } from "../palettes";
import type { BgNumericUniform } from "./uniform-types";

type TNode = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export type FluidVariant = "silk" | "ink" | "caustic" | "smoke" | "plasma";

export const FLUID_PLANE_W = 96;
export const FLUID_PLANE_H = 56;

export interface FluidSpec {
  stretch: [number, number];
  freq: number;
  warp: number;
  speed: number;
  additive: boolean;
  opacity: number;
  rise: number;
}

export const FLUID_VARIANTS: Record<FluidVariant, FluidSpec> = {
  silk: {
    stretch: [1.1, 3.6],
    freq: 1.4,
    warp: 1.5,
    speed: 0.35,
    additive: false,
    opacity: 0.85,
    rise: 0,
  },
  ink: {
    stretch: [1.5, 1.5],
    freq: 1.9,
    warp: 2.4,
    speed: 0.22,
    additive: false,
    opacity: 0.95,
    rise: 0,
  },
  caustic: {
    stretch: [1.6, 1.6],
    freq: 2.6,
    warp: 1.2,
    speed: 0.5,
    additive: true,
    opacity: 0.7,
    rise: 0,
  },
  smoke: {
    stretch: [1.2, 0.9],
    freq: 1.2,
    warp: 1.8,
    speed: 0.28,
    additive: false,
    opacity: 0.6,
    rise: 0.05,
  },
  plasma: {
    stretch: [1.3, 1.3],
    freq: 2.2,
    warp: 3.2,
    speed: 0.75,
    additive: true,
    opacity: 0.8,
    rise: 0,
  },
};

export interface FluidUniforms {
  uTime: BgNumericUniform;
  uDensity: BgNumericUniform;
  uIntensity: BgNumericUniform;
  uOpacity: BgNumericUniform;
}

export function createFluidUniforms(): FluidUniforms {
  return {
    uTime: uniform(0) as unknown as BgNumericUniform,
    uDensity: uniform(0.6) as unknown as BgNumericUniform,
    uIntensity: uniform(0.7) as unknown as BgNumericUniform,
    uOpacity: uniform(1) as unknown as BgNumericUniform,
  };
}

export function createFluidMaterial(opts: {
  palette: BackgroundPalette;
  variant: FluidVariant;
  /** Noise octaves (2 on T0, 3 on T1+). */
  octaves: number;
  uniforms: FluidUniforms;
}): MeshBasicNodeMaterial {
  const { palette, variant, octaves: OCTAVES, uniforms } = opts;
  const spec = FLUID_VARIANTS[variant];

  const base = new THREE.Color(palette.base);
  const gasDeep = new THREE.Color(palette.gas[0]);
  const gasMid = new THREE.Color(palette.gas[1]);
  const gasWisp = new THREE.Color(palette.gas[2]);
  const glow = new THREE.Color(palette.glow);
  const v3 = (c: THREE.Color): TNode => vec3(c.r, c.g, c.b);

  const tt = uniforms.uTime as TNode;
  const den = uniforms.uDensity as TNode;
  const inten = uniforms.uIntensity as TNode;

  const render = Fn((): TNode => {
    const pUv = uv() as TNode;
    // Aspect-corrected, variant-stretched field coordinate; smoke rises.
    const p: TNode = vec2(
      pUv.x.mul(spec.stretch[0] * (FLUID_PLANE_W / FLUID_PLANE_H)),
      pUv.y.mul(spec.stretch[1]).sub(tt.mul(spec.rise)),
    );

    // Domain warp: a low-frequency flow field advects the sampling point —
    // the classic warped-fbm fluid read (family: gpu-fluid-overlay).
    const w1: TNode = mx_fractal_noise_float(vec3(p.mul(0.7), tt.mul(0.21)), 2);
    const w2: TNode = mx_fractal_noise_float(
      vec3(p.mul(0.7).add(vec2(5.2, 1.3)), tt.mul(0.17)),
      2,
    );
    const q: TNode = p.mul(spec.freq).add(vec2(w1, w2).mul(spec.warp));
    const field: TNode = mx_fractal_noise_float(vec3(q, tt.mul(0.33)), OCTAVES)
      .mul(0.5)
      .add(0.5);

    // Variant shaping → f (media amount 0..1) and sheen (hot detail).
    let f: TNode;
    let sheen: TNode;
    if (variant === "ink") {
      const lo: TNode = float(0.62).sub(den.mul(0.22));
      f = smoothstep(lo, lo.add(0.24), field);
      sheen = pow(f, float(5));
    } else if (variant === "caustic") {
      const ridge: TNode = float(1).sub(abs(field.mul(2).sub(1)));
      f = pow(ridge, float(7).sub(den.mul(3)));
      sheen = pow(ridge, float(12));
    } else if (variant === "plasma") {
      f = pow(abs(sin(field.mul(6.2).add(tt.mul(0.9)))), float(2.4));
      sheen = pow(f, float(3));
    } else {
      // silk / smoke: soft graded media.
      const lo: TNode = float(0.42).sub(den.mul(0.2));
      f = smoothstep(lo, float(1.02), field);
      sheen = pow(f, float(4));
    }

    // Palette ramp deep → mid → wisp with a hot sheen toward the glow.
    const tone: TNode = mix(
      v3(gasDeep),
      v3(gasMid),
      tslClamp(f.mul(1.5), float(0), float(1)),
    );
    const tone2: TNode = mix(
      tone,
      v3(gasWisp),
      tslClamp(f.sub(0.55).mul(2.4), float(0), float(1)),
    );
    const color: TNode = tone2
      .add(v3(glow).mul(sheen).mul(inten.mul(0.9).add(0.2)))
      .add(v3(base).mul(0.06));

    // Radial edge feather so the sheet composes with no hard rectangle.
    const d: TNode = tslLength(pUv.sub(vec2(0.5, 0.5)));
    const feather: TNode = smoothstep(float(0.7), float(0.32), d);

    const alpha: TNode = tslClamp(
      f
        .mul(spec.opacity)
        .mul(feather)
        .mul(uniforms.uOpacity as TNode),
      float(0),
      float(1),
    );
    return vec4(color, alpha);
  });

  const rendered = render();
  const mat = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: spec.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    toneMapped: false,
    fog: false,
    side: THREE.DoubleSide,
  });
  (mat as unknown as { colorNode: unknown }).colorNode = (
    rendered as TNode
  ).rgb;
  (mat as unknown as { opacityNode: unknown }).opacityNode = (
    rendered as TNode
  ).a;
  return mat;
}
