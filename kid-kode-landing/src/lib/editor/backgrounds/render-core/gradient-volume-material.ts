// W-BG render-core — gradient-volume material builder (pure three+tsl, no
// React, no DOM). ONE source of truth consumed by BOTH the editor's R3F
// GradientVolumeLayer and the runtime's imperative procedural-background
// mounter, so a generated background looks identical in canvas, preview-app,
// and the shipped /preview route. Shader story documented in
// GradientVolumeLayer.tsx (variants: wash/beams/aurora/horizon/rings/spot).

import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  Fn,
  uniform,
  vec3,
  vec4,
  float,
  sin,
  abs,
  exp,
  pow,
  mix,
  max,
  clamp as tslClamp,
  smoothstep,
  normalize,
  dot,
  cameraPosition,
  positionWorld,
  mx_fractal_noise_float,
} from "three/tsl";
import type { BackgroundPalette } from "../palettes";
import type { BgNumericUniform } from "./uniform-types";

type TNode = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export type GradientVolumeVariant =
  "wash" | "beams" | "aurora" | "horizon" | "rings" | "spot";

export const GRADIENT_SPHERE_RADIUS = 440;

export interface GradientVolumeUniforms {
  uTime: BgNumericUniform;
  uDensity: BgNumericUniform;
  uIntensity: BgNumericUniform;
  uVeil: BgNumericUniform;
}

export function createGradientVolumeUniforms(): GradientVolumeUniforms {
  return {
    uTime: uniform(0) as unknown as BgNumericUniform,
    uDensity: uniform(0.6) as unknown as BgNumericUniform,
    uIntensity: uniform(0.7) as unknown as BgNumericUniform,
    uVeil: uniform(1) as unknown as BgNumericUniform,
  };
}

function hexToVec3(hex: string): TNode {
  const c = new THREE.Color(hex);
  return vec3(c.r, c.g, c.b);
}

export function createGradientVolumeMaterial(opts: {
  palette: BackgroundPalette;
  variant: GradientVolumeVariant;
  /** Noise octaves (2 on T0, 3 on T1+). */
  octaves: number;
  overBackdrop: boolean;
  uniforms: GradientVolumeUniforms;
}): MeshBasicNodeMaterial {
  const { palette, variant, octaves: OCTAVES, overBackdrop, uniforms } = opts;

  const base = hexToVec3(palette.base);
  const gasDeep = hexToVec3(palette.gas[0]);
  const gasMid = hexToVec3(palette.gas[1]);
  const gasWisp = hexToVec3(palette.gas[2]);
  const glow = hexToVec3(palette.glow);

  const tt = uniforms.uTime as TNode;
  const den = uniforms.uDensity as TNode;
  const inten = uniforms.uIntensity as TNode;

  const render = Fn((): TNode => {
    const rd: TNode = normalize((positionWorld as TNode).sub(cameraPosition));
    const el: TNode = rd.y; // elevation −1..1
    // Deep sky base: palette void graded slightly lighter toward the zenith
    // so even the "empty" region reads authored, not dead black.
    const sky: TNode = mix(
      base,
      gasDeep.mul(0.35).add(base.mul(0.7)),
      smoothstep(float(-0.4), float(0.9), el),
    );

    const light = vec3(0, 0, 0).toVar();

    if (variant === "wash") {
      const wob: TNode = rd.add(
        vec3(
          sin(tt.mul(0.05)).mul(0.08),
          sin(tt.mul(0.04).add(2.1)).mul(0.06),
          float(0),
        ),
      );
      const d1: TNode = normalize(vec3(-0.55, 0.2, -0.81));
      const d2: TNode = normalize(vec3(0.62, 0.42, -0.66));
      const d3: TNode = normalize(vec3(-0.1, -0.42, -0.9));
      const spread: TNode = float(9).sub(den.mul(5)); // density widens blooms
      const b1: TNode = pow(max(dot(wob, d1), float(0)), spread);
      const b2: TNode = pow(max(dot(wob, d2), float(0)), spread.mul(1.4));
      const b3: TNode = pow(max(dot(wob, d3), float(0)), spread.mul(2.2));
      const breathe: TNode = sin(tt.mul(0.13)).mul(0.15).add(0.85);
      light.assign(
        gasDeep
          .mul(b1)
          .mul(0.9)
          .add(gasMid.mul(b2).mul(0.8).mul(breathe))
          .add(glow.mul(b3).mul(inten).mul(0.55)),
      );
    } else if (variant === "beams") {
      const s: TNode = rd.x.mul(2.3).add(rd.y.mul(0.9)).add(tt.mul(0.03));
      const freq: TNode = float(4).add(den.mul(6));
      const shafts: TNode = pow(abs(sin(s.mul(freq))), float(7)).mul(
        smoothstep(float(-0.25), float(0.55), el),
      );
      const soft: TNode = pow(
        abs(sin(s.mul(freq).mul(0.5).add(1.7))),
        float(3),
      ).mul(0.35);
      const top: TNode = smoothstep(float(-0.5), float(0.7), el);
      light.assign(
        gasMid
          .mul(shafts.add(soft))
          .mul(top)
          .mul(inten.mul(0.8).add(0.4))
          .add(
            glow
              .mul(pow(shafts, float(2)).mul(top))
              .mul(inten)
              .mul(0.5),
          ),
      );
    } else if (variant === "aurora") {
      const warp: TNode = mx_fractal_noise_float(
        vec3(rd.x.mul(1.6), rd.y.mul(0.8), tt.mul(0.05)),
        OCTAVES,
      );
      const x: TNode = rd.x.mul(3.2).add(warp.mul(1.8)).add(tt.mul(0.07));
      const curtain: TNode = pow(
        abs(sin(x.mul(float(2).add(den.mul(2.5))))),
        float(3.5),
      );
      const band: TNode = smoothstep(float(0.02), float(0.42), el).mul(
        smoothstep(float(0.95), float(0.5), el),
      );
      const flicker: TNode = sin(tt.mul(0.5).add(x)).mul(0.18).add(0.82);
      const a: TNode = curtain.mul(band).mul(flicker);
      light.assign(
        gasMid
          .mul(a)
          .mul(1.1)
          .add(gasWisp.mul(pow(a, float(2))).mul(0.8))
          .add(
            glow
              .mul(pow(a, float(3)))
              .mul(inten)
              .mul(0.9),
          )
          .add(
            gasDeep.mul(smoothstep(float(-0.1), float(-0.65), el)).mul(0.25),
          ),
      );
    } else if (variant === "horizon") {
      const lift: TNode = den.mul(0.16).sub(0.1);
      const dist: TNode = abs(el.sub(lift));
      const bandGlow: TNode = exp(dist.mul(-9));
      const wide: TNode = exp(dist.mul(-2.6)).mul(0.55);
      const below: TNode = smoothstep(float(0.05), float(-0.5), el).mul(0.5);
      light.assign(
        gasMid
          .mul(wide)
          .add(glow.mul(bandGlow).mul(inten.mul(0.9).add(0.35)))
          .add(gasDeep.mul(below)),
      );
    } else if (variant === "rings") {
      const dir: TNode = normalize(vec3(0, 0.06, -1));
      const cosA: TNode = tslClamp(dot(rd, dir), float(-1), float(1));
      // angle proxy: 1−cos rises smoothly from the focus outward (cheap acos).
      const ang: TNode = float(1).sub(cosA);
      const freq: TNode = float(14).add(den.mul(18));
      const rings: TNode = pow(
        abs(sin(ang.mul(freq).sub(tt.mul(0.6)))),
        float(5),
      );
      const falloff: TNode = exp(ang.mul(-3.2));
      const core: TNode = exp(ang.mul(-16)).mul(inten);
      light.assign(
        gasMid
          .mul(rings)
          .mul(falloff)
          .mul(0.9)
          .add(glow.mul(rings).mul(falloff).mul(inten).mul(0.6))
          .add(glow.mul(core).mul(0.7)),
      );
    } else {
      // 'spot'
      const dir: TNode = normalize(vec3(0.12, 0.3, -0.95));
      const tight: TNode = float(18).sub(den.mul(12));
      const b: TNode = pow(max(dot(rd, dir), float(0)), tight);
      const bounce: TNode = smoothstep(float(-0.15), float(-0.75), el).mul(0.3);
      light.assign(
        gasWisp
          .mul(b)
          .mul(0.9)
          .add(
            glow
              .mul(pow(b, float(2)))
              .mul(inten)
              .mul(0.8),
          )
          .add(gasDeep.mul(bounce)),
      );
    }

    // Gentle authored grain so broad gradients don't band (cheap 2-octave).
    const grain: TNode = mx_fractal_noise_float(
      rd.mul(46).add(vec3(tt.mul(0.02), 0, 0)),
      2,
    ).mul(0.02);

    if (overBackdrop) {
      const lum: TNode = tslClamp(
        dot(light, vec3(0.33, 0.34, 0.33)).mul(2.4),
        float(0),
        float(1),
      );
      const veilA: TNode = lum.mul(uniforms.uVeil as TNode);
      return vec4(light.add(grain), veilA);
    }
    return vec4(sky.add(light).add(grain), float(1));
  });

  const rendered = render();
  const mat = new MeshBasicNodeMaterial({
    side: THREE.BackSide,
    transparent: overBackdrop,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  (mat as unknown as { colorNode: unknown }).colorNode = (
    rendered as TNode
  ).rgb;
  if (overBackdrop)
    (mat as unknown as { opacityNode: unknown }).opacityNode = (
      rendered as TNode
    ).a;
  return mat;
}
