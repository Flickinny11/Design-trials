// W-BG — fluid overlay (kind: 'fluid-overlay').
//
// A flowing TSL noise-advection SHEET derived from the `gpu-fluid-overlay`
// grammar family: domain-warped fractal noise advected over time reads as
// silk / ink / caustics / smoke / plasma without a compute sim — the honest
// budget-tiered rendition of the family's technique vocabulary (the full
// Navier-Stokes compute path stays a documented seam). The sheet is a
// world-anchored plane (same 96×56 sizing convention as ParallaxPlaneLayer)
// with a radial edge feather so it composes over any environment, or a
// camera-locked near-lens film when the layer's attachment says so.
//
// One renderer (INV-1): `MeshBasicNodeMaterial` from `three/webgpu`, TSL only,
// WebGPU + WebGL2-fallback safe (no nested loops, no raw GLSL). Palette from
// the shared BackgroundPalette only (INV-9: no purple).

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
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
import type { BackgroundPalette } from "@/lib/editor/backgrounds/palettes";
import type { BackgroundLayerParams } from "@/lib/prism-graph/types";
import type { TierBudget } from "@/lib/editor/backgrounds/tier";

type TNode = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export type FluidVariant = "silk" | "ink" | "caustic" | "smoke" | "plasma";

const PLANE_W = 96;
const PLANE_H = 56;

interface FluidSpec {
  /** uv anisotropy (x, y) — stretches the field (silk ribbons vs round billows). */
  stretch: [number, number];
  /** Base field frequency. */
  freq: number;
  /** Domain-warp strength. */
  warp: number;
  /** Advection speed multiplier. */
  speed: number;
  /** Additive (light) vs normal (media) blending. */
  additive: boolean;
  /** Overall layer opacity ceiling. */
  opacity: number;
  /** Continuous upward drift (smoke rises). */
  rise: number;
}

const FLUID_VARIANTS: Record<FluidVariant, FluidSpec> = {
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

export interface FluidOverlayLayerProps {
  palette: BackgroundPalette;
  params: BackgroundLayerParams;
  budget: TierBudget;
  z?: number;
  opacity?: number;
  cameraLocked?: boolean;
  renderOrder?: number;
}

export function FluidOverlayLayer({
  palette,
  params,
  budget,
  z = -60,
  opacity = 1,
  cameraLocked = false,
  renderOrder = -1.5,
}: FluidOverlayLayerProps) {
  const camera = useThree((s) => s.camera);
  const meshRef = useRef<THREE.Mesh>(null);

  const variant = ((params.variant as string) || "silk") as FluidVariant;

  const uniforms = useMemo(
    () => ({
      uTime: uniform(0),
      uDensity: uniform(0.6),
      uIntensity: uniform(0.7),
      uOpacity: uniform(1),
    }),
    [],
  );

  const material = useMemo(() => {
    const spec = FLUID_VARIANTS[variant];
    // Tier gate: T0 gets 2 noise octaves, T1+ gets 3.
    const OCTAVES = budget.raymarchSteps >= 18 ? 3 : 2;

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
        pUv.x.mul(spec.stretch[0] * (PLANE_W / PLANE_H)),
        pUv.y.mul(spec.stretch[1]).sub(tt.mul(spec.rise)),
      );

      // Domain warp: a low-frequency flow field advects the sampling point —
      // the classic warped-fbm fluid read (family: gpu-fluid-overlay).
      const w1: TNode = mx_fractal_noise_float(
        vec3(p.mul(0.7), tt.mul(0.21)),
        2,
      );
      const w2: TNode = mx_fractal_noise_float(
        vec3(p.mul(0.7).add(vec2(5.2, 1.3)), tt.mul(0.17)),
        2,
      );
      const q: TNode = p.mul(spec.freq).add(vec2(w1, w2).mul(spec.warp));
      const field: TNode = mx_fractal_noise_float(
        vec3(q, tt.mul(0.33)),
        OCTAVES,
      )
        .mul(0.5)
        .add(0.5);

      // Variant shaping → f (media amount 0..1) and sheenBoost (hot detail).
      let f: TNode;
      let sheen: TNode;
      if (variant === "ink") {
        // Marbled billows: hard threshold band around the density knob.
        const lo: TNode = float(0.62).sub(den.mul(0.22));
        f = smoothstep(lo, lo.add(0.24), field);
        sheen = pow(f, float(5));
      } else if (variant === "caustic") {
        // Bright web: ridges of the field (fold around the mid line).
        const ridge: TNode = float(1).sub(abs(field.mul(2).sub(1)));
        f = pow(ridge, float(7).sub(den.mul(3)));
        sheen = pow(ridge, float(12));
      } else if (variant === "plasma") {
        // Energetic bands through the warped field.
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

      // Radial edge feather (ParallaxPlaneLayer idiom) so the sheet composes
      // over any environment with no hard rectangle.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette.id, variant, budget.raymarchSteps]);

  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    uniforms.uDensity.value =
      typeof params.density === "number" ? params.density : 0.6;
    uniforms.uIntensity.value =
      typeof params.intensity === "number" ? params.intensity : 0.7;
    uniforms.uOpacity.value = opacity;
  }, [params.density, params.intensity, opacity, uniforms]);

  useFrame((_, delta) => {
    const spec = FLUID_VARIANTS[variant];
    uniforms.uTime.value +=
      delta *
      spec.speed *
      (typeof params.drift === "number" ? 0.3 + params.drift * 1.4 : 1);
    if (cameraLocked && meshRef.current) {
      meshRef.current.position.set(
        camera.position.x,
        camera.position.y,
        camera.position.z + z,
      );
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={cameraLocked ? undefined : [0, 0, z]}
      renderOrder={renderOrder}
      frustumCulled={false}
      material={material}
    >
      <planeGeometry args={[PLANE_W, PLANE_H, 1, 1]} />
    </mesh>
  );
}
