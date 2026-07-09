// W-BG render-core — volumetric-nebula material builder (pure three+tsl, no
// React, no DOM). Extracted verbatim from VolumetricNebulaLayer (the judged
// 3DBG raymarcher) so the editor R3F layer and the runtime mounter share ONE
// shader. Physics + tuning documented in VolumetricNebulaLayer.tsx.

import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  Fn,
  Loop,
  If,
  Break,
  uniform,
  vec3,
  vec4,
  float,
  exp,
  dot,
  mix,
  max,
  pow,
  clamp as tslClamp,
  smoothstep,
  normalize,
  cameraPosition,
  positionWorld,
  mx_fractal_noise_float,
} from "three/tsl";
import type { BackgroundPalette } from "../palettes";
import type { BgNumericUniform } from "./uniform-types";

type TNode = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export const NEBULA_SPHERE_RADIUS = 450; // camera-centred shell; always fills the frustum.
const MARCH_DIST = 560; // world units the primary ray covers.
const ABSORPTION = 0.5; // σ — extinction per unit density·distance.

function hexToVec3(hex: string): TNode {
  const c = new THREE.Color(hex);
  return vec3(c.r, c.g, c.b);
}

export interface NebulaUniforms {
  uTime: BgNumericUniform;
  uDensity: BgNumericUniform;
  uDrift: BgNumericUniform;
  uIntensity: BgNumericUniform;
  uVeil: BgNumericUniform;
}

export function createNebulaUniforms(): NebulaUniforms {
  return {
    uTime: uniform(0) as unknown as BgNumericUniform,
    uDensity: uniform(0.6) as unknown as BgNumericUniform,
    uDrift: uniform(0.5) as unknown as BgNumericUniform,
    uIntensity: uniform(0.7) as unknown as BgNumericUniform,
    uVeil: uniform(1) as unknown as BgNumericUniform,
  };
}

export function createNebulaMaterial(opts: {
  palette: BackgroundPalette;
  raymarchSteps: number;
  lightMarchSteps: number;
  overBackdrop: boolean;
  uniforms: NebulaUniforms;
}): MeshBasicNodeMaterial {
  const { palette, overBackdrop, uniforms } = opts;
  const STEPS = Math.max(6, Math.round(opts.raymarchSteps));
  const LIGHT_STEPS = Math.max(0, Math.round(opts.lightMarchSteps));
  const stepSize = MARCH_DIST / STEPS;

  const base = hexToVec3(palette.base);
  const gasDeep = hexToVec3(palette.gas[0]);
  const gasMid = hexToVec3(palette.gas[1]);
  const gasWisp = hexToVec3(palette.gas[2]);
  const glow = hexToVec3(palette.glow);

  const lightDir = normalize(vec3(0.42, 0.66, 0.5));
  const G = 0.42; // Henyey-Greenstein forward anisotropy.
  const g2 = G * G;

  const density = Fn(([p]: [TNode]): TNode => {
    const drift = (uniforms.uDrift as TNode).mul(uniforms.uTime).mul(0.8);
    const q = (p as TNode)
      .mul(0.02)
      .add(vec3(drift.mul(0.06), drift.mul(0.02), drift.mul(0.04)));
    const env = mx_fractal_noise_float(q.mul(0.5), 3).mul(0.5).add(0.5);
    const detail = mx_fractal_noise_float(
      q.mul(1.9).add(vec3(11.2, 3.4, 7.1)),
      3,
    )
      .mul(0.5)
      .add(0.5);
    const field = env.mul(0.7).add(detail.mul(0.5)); // ~0..1.2
    const thr = float(0.66).sub((uniforms.uDensity as TNode).mul(0.2));
    const shaped = smoothstep(thr, float(1.12), field);
    const d = pow(shaped, float(1.7));
    return d.mul((uniforms.uDensity as TNode).mul(0.5).add(0.6)).mul(2.0);
  });

  // Cheap density (2 octaves) for the self-shadow light-march taps.
  const densityCheap = Fn(([p]: [TNode]): TNode => {
    const q = (p as TNode).mul(0.02);
    const env = mx_fractal_noise_float(q.mul(0.5), 2).mul(0.5).add(0.5);
    const thr = float(0.66).sub((uniforms.uDensity as TNode).mul(0.2));
    const d = pow(smoothstep(thr, float(1.05), env), float(1.5));
    return d.mul((uniforms.uDensity as TNode).mul(0.5).add(0.6)).mul(2.0);
  });

  const render = Fn((): TNode => {
    const ro: TNode = cameraPosition;
    const rd: TNode = normalize((positionWorld as TNode).sub(cameraPosition));

    const transmittance = float(1).toVar();
    const scattered = vec3(0, 0, 0).toVar();
    const t = float(8).toVar();

    // Henyey-Greenstein phase for the primary ray vs the key light.
    const cosT = dot(rd, lightDir);
    const denom = pow(float(1 + g2).sub(float(2 * G).mul(cosT)), float(1.5));
    const phase = float((1 - g2) / (4 * Math.PI))
      .div(max(denom, float(1e-3)))
      .add(0.06);

    // Self-shadow via a short fixed light-march, UNROLLED on the JS side (no
    // nested TSL Loop — that mis-compiled to black).
    const shadowStep = (NEBULA_SPHERE_RADIUS * 0.16) / Math.max(1, LIGHT_STEPS);
    const selfShadow = (p: TNode): TNode => {
      let lt: TNode = float(1);
      for (let k = 1; k <= LIGHT_STEPS; k++) {
        const lp: TNode = p.add(lightDir.mul(shadowStep * k));
        lt = lt.mul(exp(densityCheap(lp).mul(-ABSORPTION).mul(shadowStep)));
      }
      return lt;
    };

    Loop({ start: 0, end: STEPS, type: "int" }, () => {
      const p: TNode = ro.add(rd.mul(t));
      const d: TNode = density(p);
      If(d.greaterThan(0.001), () => {
        const lt: TNode = LIGHT_STEPS > 0 ? selfShadow(p) : float(1);
        const tone: TNode = mix(
          gasDeep,
          gasMid,
          tslClamp(d.mul(1.4), float(0), float(1)),
        );
        const tone2: TNode = mix(
          tone,
          gasWisp,
          tslClamp(d.sub(0.5).mul(2.2), float(0), float(1)),
        );
        const core: TNode = glow.mul(pow(d, float(2.2))).mul(1.5);
        const lit: TNode = tone2.mul(lt.mul(0.55).add(0.35)).add(core.mul(lt));
        const contribution: TNode = transmittance
          .mul(d)
          .mul(stepSize)
          .mul(ABSORPTION)
          .mul(phase)
          .mul((uniforms.uIntensity as TNode).mul(0.7).add(0.5))
          .mul(3.1);
        scattered.addAssign(lit.mul(contribution));
        transmittance.mulAssign(exp(d.mul(-ABSORPTION).mul(stepSize)));
      });
      t.addAssign(float(stepSize));
      If(transmittance.lessThan(0.015), () => {
        Break();
      });
    });

    // gas coverage (0 = clear void, 1 = thick gas).
    const coverage: TNode = float(1).sub(transmittance);
    if (overBackdrop) {
      const veilA: TNode = tslClamp(
        coverage.mul(uniforms.uVeil as TNode),
        float(0),
        float(1),
      );
      return vec4(
        scattered
          .mul((uniforms.uVeil as TNode).mul(0.5).add(0.5))
          .add(gasDeep.mul(coverage).mul(0.1)),
        veilA,
      );
    }
    const skyTint: TNode = base.mul(1.25).add(gasDeep.mul(0.22));
    return vec4(skyTint.mul(transmittance).add(scattered), float(1));
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
