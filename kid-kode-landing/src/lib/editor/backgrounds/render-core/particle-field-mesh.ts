// W-BG render-core — particle-field instanced-sprite builder (pure three+tsl,
// no React, no DOM). Extracted verbatim from ParticleFieldLayer (the judged
// 3DBG instanced-quad field, incl. the W-BG weather variants) so the editor
// R3F layer and the runtime mounter share ONE construction. Scatter is
// deterministic (index hash, no Math.random).

import * as THREE from "three";
import { SpriteNodeMaterial } from "three/webgpu";
import {
  uniform,
  instanceIndex,
  hash,
  uv,
  vec2,
  vec3,
  float,
  sin,
  fract,
  length as tslLength,
  smoothstep,
} from "three/tsl";
import type { BackgroundPalette } from "../palettes";
import type { BgNumericUniform } from "./uniform-types";

type TNode = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export type ParticleVariant =
  | "embers"
  | "crystals"
  | "motes"
  | "starfield"
  | "snow"
  | "rain"
  | "fireflies"
  | "dust"
  | "ash";

export interface ParticleVariantSpec {
  countScale: number;
  baseSize: number;
  spreadXY: number;
  zNear: number;
  zFar: number;
  driftAmp: number;
  driftSpeed: number;
  twinkle: number;
  opacity: number;
  /** Continuous fall speed (fraction of the Y span per second at drift=1). */
  fall?: number;
  /** Vertical quad elongation (rain streaks); 1 = round sprite. */
  stretchY?: number;
}

export const PARTICLE_VARIANTS: Record<ParticleVariant, ParticleVariantSpec> = {
  embers: {
    countScale: 0.32,
    baseSize: 0.085,
    spreadXY: 32,
    zNear: 6,
    zFar: -90,
    driftAmp: 0.55,
    driftSpeed: 0.25,
    twinkle: 0.45,
    opacity: 0.6,
  },
  crystals: {
    countScale: 0.7,
    baseSize: 0.07,
    spreadXY: 36,
    zNear: 4,
    zFar: -120,
    driftAmp: 0.3,
    driftSpeed: 0.18,
    twinkle: 0.75,
    opacity: 0.8,
  },
  starfield: {
    countScale: 1.0,
    baseSize: 0.052,
    spreadXY: 48,
    zNear: 2,
    zFar: -170,
    driftAmp: 0.16,
    driftSpeed: 0.08,
    twinkle: 0.6,
    opacity: 0.85,
  },
  motes: {
    countScale: 0.14,
    baseSize: 0.13,
    spreadXY: 9,
    zNear: 8,
    zFar: -14,
    driftAmp: 0.35,
    driftSpeed: 0.45,
    twinkle: 0.55,
    opacity: 0.45,
  },
  snow: {
    countScale: 0.5,
    baseSize: 0.08,
    spreadXY: 30,
    zNear: 6,
    zFar: -80,
    driftAmp: 0.8,
    driftSpeed: 0.3,
    twinkle: 0.2,
    opacity: 0.7,
    fall: 0.045,
  },
  rain: {
    countScale: 0.6,
    baseSize: 0.03,
    spreadXY: 26,
    zNear: 6,
    zFar: -60,
    driftAmp: 0.06,
    driftSpeed: 0.1,
    twinkle: 0.1,
    opacity: 0.5,
    fall: 0.5,
    stretchY: 14,
  },
  fireflies: {
    countScale: 0.06,
    baseSize: 0.16,
    spreadXY: 22,
    zNear: 6,
    zFar: -50,
    driftAmp: 1.6,
    driftSpeed: 0.5,
    twinkle: 0.95,
    opacity: 0.8,
  },
  dust: {
    countScale: 0.8,
    baseSize: 0.035,
    spreadXY: 34,
    zNear: 4,
    zFar: -110,
    driftAmp: 0.5,
    driftSpeed: 0.12,
    twinkle: 0.3,
    opacity: 0.35,
    fall: 0.008,
  },
  ash: {
    countScale: 0.3,
    baseSize: 0.075,
    spreadXY: 28,
    zNear: 6,
    zFar: -70,
    driftAmp: 0.9,
    driftSpeed: 0.2,
    twinkle: 0.35,
    opacity: 0.55,
    fall: 0.03,
  },
};

export interface ParticleUniforms {
  uTime: BgNumericUniform;
  uTwinkle: BgNumericUniform;
  uSize: BgNumericUniform;
}

export function createParticleUniforms(): ParticleUniforms {
  return {
    uTime: uniform(0) as unknown as BgNumericUniform,
    uTwinkle: uniform(0.4) as unknown as BgNumericUniform,
    uSize: uniform(1.3) as unknown as BgNumericUniform,
  };
}

export function createParticleFieldMesh(opts: {
  palette: BackgroundPalette;
  variant: ParticleVariant;
  /** Tier budget particle count (TierBudget.particleCount). */
  particleBudget: number;
  density: number;
  depthSpread: number;
  uniforms: ParticleUniforms;
}): { mesh: THREE.InstancedMesh; count: number } {
  const { palette, variant, particleBudget, density, depthSpread, uniforms } =
    opts;
  const spec = PARTICLE_VARIANTS[variant];
  const target = Math.max(
    400,
    Math.round(particleBudget * spec.countScale * (0.4 + density * 0.6)),
  );
  const zSpan = (spec.zFar - spec.zNear) * (0.4 + depthSpread * 0.9);

  const star = new THREE.Color(palette.star);
  const glow = new THREE.Color(palette.glow);

  const mat = new SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  // Per-instance values derived ON THE GPU from `instanceIndex` via `hash`.
  const h = (salt: number): TNode => hash((instanceIndex as TNode).add(salt));
  const tt = uniforms.uTime as TNode;

  const baseX: TNode = h(0)
    .sub(0.5)
    .mul(2 * spec.spreadXY);
  // Falling variants wrap the Y coordinate continuously via fract.
  const fall = spec.fall ?? 0;
  const baseY: TNode =
    fall > 0
      ? fract(h(11).sub(tt.mul(fall)))
          .sub(0.5)
          .mul(2 * spec.spreadXY * 0.8)
      : h(11)
          .sub(0.5)
          .mul(2 * spec.spreadXY * 0.8);
  const baseZ: TNode = float(spec.zNear).add(h(23).mul(zSpan));
  const seed: TNode = h(37).mul(100);
  // Size: squared bias → many small, a few bright big.
  const hs: TNode = h(51);
  const size: TNode = float(0.45).add(hs.mul(hs).mul(2.4)).mul(spec.baseSize);

  // GPU vertex-stage drift: per-instance base position + small sinusoid.
  const drift: TNode = vec3(
    sin(tt.mul(spec.driftSpeed).add(seed)).mul(spec.driftAmp),
    sin(tt.mul(spec.driftSpeed * 0.8).add(seed.mul(1.3))).mul(
      spec.driftAmp * 1.4,
    ),
    sin(tt.mul(spec.driftSpeed * 0.6).add(seed.mul(0.7))).mul(
      spec.driftAmp * 0.5,
    ),
  );
  (mat as unknown as { positionNode: unknown }).positionNode = vec3(
    baseX,
    baseY,
    baseZ,
  ).add(drift);
  // Rain streaks: elongate the quad vertically; everything else stays round.
  const stretchY = spec.stretchY ?? 1;
  const scale: TNode = size.mul(uniforms.uSize as TNode);
  (mat as unknown as { scaleNode: unknown }).scaleNode =
    stretchY === 1 ? scale : vec2(scale, scale.mul(stretchY));

  // Round soft glow (quad uv → real disc) + per-instance twinkle.
  const pUv = uv() as TNode;
  const dist: TNode = tslLength(pUv.sub(vec2(0.5, 0.5)));
  const disc: TNode = smoothstep(float(0.5), float(0.04), dist);
  const twk: TNode = sin(tt.mul(1.6).add(seed.mul(2.1)))
    .mul(0.5)
    .add(0.5)
    .mul(uniforms.uTwinkle as TNode)
    .add(float(1).sub(uniforms.uTwinkle as TNode));
  (mat as unknown as { colorNode: unknown }).colorNode = vec3(
    star.r,
    star.g,
    star.b,
  )
    .mul(0.7)
    .add(vec3(glow.r, glow.g, glow.b).mul(0.45))
    .mul(twk);
  (mat as unknown as { opacityNode: unknown }).opacityNode = disc
    .mul(twk)
    .mul(float(spec.opacity));

  const geo = new THREE.PlaneGeometry(1, 1);
  const m = new THREE.InstancedMesh(geo, mat, target);
  // InstancedMesh allocates instanceMatrix as ZEROS — set identity matrices;
  // SpriteNodeMaterial drives the center via positionNode.
  const idm = new THREE.Matrix4();
  for (let i = 0; i < target; i++) m.setMatrixAt(i, idm);
  m.instanceMatrix.needsUpdate = true;
  m.frustumCulled = false;
  return { mesh: m, count: target };
}
