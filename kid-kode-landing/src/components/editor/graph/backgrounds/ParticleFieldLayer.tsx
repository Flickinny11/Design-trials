// THREE-D-BACKGROUNDS — depth-scattered particle field (A4), instanced sprites.
//
// The literal "depth-scattered 3D elements layered into space": a field of
// camera-facing billboard sprites scattered through REAL world Z so the camera-
// journey flies THROUGH them with true parallax + a near/far size spread, not a
// flat star texture (FP-1). WebGPU renders THREE.Points at a fixed 1px (the spec
// has no point size), so sized particles MUST be instanced quads — a
// `SpriteNodeMaterial` on a `THREE.InstancedMesh` (the three.js webgpu particle
// pattern). Per-instance position/seed/size come from instanced buffer
// attributes; drift runs on the GPU vertex stage from a time uniform + seed.
// Round soft glows via the quad uv; additive — premium starlight. Deterministic
// scatter (index hash, no Math.random) so frozen frames reproduce for the
// numeric harness. Observatory-Brass palette only (INV-9).
//
// `world` attachment = world-anchored (camera flies through → parallax).
// `camera-locked` attachment = near-FX motes that follow the camera.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SpriteNodeMaterial } from 'three/webgpu';
import {
  uniform,
  instanceIndex,
  hash,
  uv,
  vec2,
  vec3,
  float,
  sin,
  length as tslLength,
  smoothstep,
} from 'three/tsl';
import type { BackgroundPalette } from '@/lib/editor/backgrounds/palettes';
import type { BackgroundLayerParams } from '@/lib/prism-graph/types';
import type { TierBudget } from '@/lib/editor/backgrounds/tier';

type TNode = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export type ParticleVariant = 'embers' | 'crystals' | 'motes' | 'starfield';

interface VariantSpec {
  countScale: number;
  baseSize: number;
  spreadXY: number;
  zNear: number;
  zFar: number;
  driftAmp: number;
  driftSpeed: number;
  twinkle: number;
  opacity: number;
}

// Scale: hub-scene content sits at ~10–20 units (camera at z≈10–18, fov 45). The
// field spans a volume the camera flies THROUGH — from in front of the camera
// (positive z) back past the content — so near sprites parallax + grow while far
// sprites stay small (C1/C3). Sprite sizes are world units (real geometry → true
// perspective attenuation).
const VARIANTS: Record<ParticleVariant, VariantSpec> = {
  embers: { countScale: 0.32, baseSize: 0.085, spreadXY: 32, zNear: 6, zFar: -90, driftAmp: 0.55, driftSpeed: 0.25, twinkle: 0.45, opacity: 0.6 },
  crystals: { countScale: 0.7, baseSize: 0.07, spreadXY: 36, zNear: 4, zFar: -120, driftAmp: 0.3, driftSpeed: 0.18, twinkle: 0.75, opacity: 0.8 },
  starfield: { countScale: 1.0, baseSize: 0.052, spreadXY: 48, zNear: 2, zFar: -170, driftAmp: 0.16, driftSpeed: 0.08, twinkle: 0.6, opacity: 0.85 },
  motes: { countScale: 0.14, baseSize: 0.13, spreadXY: 9, zNear: 8, zFar: -14, driftAmp: 0.35, driftSpeed: 0.45, twinkle: 0.55, opacity: 0.45 },
};

export interface ParticleFieldLayerProps {
  palette: BackgroundPalette;
  params: BackgroundLayerParams;
  budget: TierBudget;
  variant: ParticleVariant;
  cameraLocked?: boolean;
  renderOrder?: number;
}

export function ParticleFieldLayer({
  palette,
  params,
  budget,
  variant,
  cameraLocked = false,
  renderOrder = -1,
}: ParticleFieldLayerProps) {
  const camera = useThree((s) => s.camera);
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const uniforms = useMemo(
    () => ({ uTime: uniform(0), uTwinkle: uniform(0.4), uSize: uniform(1.3) }),
    [],
  );

  const density = typeof params.density === 'number' ? params.density : 0.6;
  const depthSpread = typeof params.depthSpread === 'number' ? params.depthSpread : 0.6;

  const { mesh, count } = useMemo(() => {
    const spec = VARIANTS[variant];
    const target = Math.max(
      400,
      Math.round(budget.particleCount * spec.countScale * (0.4 + density * 0.6)),
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

    // Per-instance values are derived ON THE GPU from `instanceIndex` via `hash`
    // (deterministic, no instanced attributes/storage needed — robust on the
    // WebGPU backend where THREE.Points are 1px). Each salt decorrelates a draw.
    const h = (salt: number): TNode => hash((instanceIndex as TNode).add(salt));
    const tt = uniforms.uTime as TNode;

    const baseX: TNode = h(0).sub(0.5).mul(2 * spec.spreadXY);
    const baseY: TNode = h(11).sub(0.5).mul(2 * spec.spreadXY * 0.8);
    const baseZ: TNode = float(spec.zNear).add(h(23).mul(zSpan));
    const seed: TNode = h(37).mul(100);
    // Size: squared bias → many small, a few bright big.
    const hs: TNode = h(51);
    const size: TNode = float(0.45).add(hs.mul(hs).mul(2.4)).mul(spec.baseSize);

    // GPU vertex-stage drift: per-instance base position + small sinusoid.
    const drift: TNode = vec3(
      sin(tt.mul(spec.driftSpeed).add(seed)).mul(spec.driftAmp),
      sin(tt.mul(spec.driftSpeed * 0.8).add(seed.mul(1.3))).mul(spec.driftAmp * 1.4),
      sin(tt.mul(spec.driftSpeed * 0.6).add(seed.mul(0.7))).mul(spec.driftAmp * 0.5),
    );
    (mat as unknown as { positionNode: unknown }).positionNode = vec3(baseX, baseY, baseZ).add(drift);
    (mat as unknown as { scaleNode: unknown }).scaleNode = size.mul(uniforms.uSize as TNode);

    // Round soft glow (quad uv → real disc) + per-instance twinkle.
    const pUv = uv() as TNode;
    const dist: TNode = tslLength(pUv.sub(vec2(0.5, 0.5)));
    const disc: TNode = smoothstep(float(0.5), float(0.04), dist);
    const twk: TNode = sin(tt.mul(1.6).add(seed.mul(2.1)))
      .mul(0.5)
      .add(0.5)
      .mul(uniforms.uTwinkle as TNode)
      .add(float(1).sub(uniforms.uTwinkle as TNode));
    (mat as unknown as { colorNode: unknown }).colorNode = vec3(star.r, star.g, star.b)
      .mul(0.7)
      .add(vec3(glow.r, glow.g, glow.b).mul(0.45))
      .mul(twk);
    (mat as unknown as { opacityNode: unknown }).opacityNode = disc
      .mul(twk)
      .mul(float(spec.opacity));

    const geo = new THREE.PlaneGeometry(1, 1);
    const m = new THREE.InstancedMesh(geo, mat, target);
    // InstancedMesh allocates instanceMatrix as ZEROS — every instance would
    // collapse to a degenerate (invisible) transform. SpriteNodeMaterial drives
    // the center via positionNode, so we just need identity matrices here.
    const idm = new THREE.Matrix4();
    for (let i = 0; i < target; i++) m.setMatrixAt(i, idm);
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    return { mesh: m, count: target };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette.id, variant, budget.particleCount, density, depthSpread]);

  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    },
    [mesh],
  );

  useEffect(() => {
    const spec = VARIANTS[variant];
    uniforms.uTwinkle.value = spec.twinkle;
    uniforms.uSize.value = 1 + (typeof params.intensity === 'number' ? params.intensity : 0.7) * 0.6;
  }, [variant, params.intensity, uniforms]);

  useFrame((_, delta) => {
    uniforms.uTime.value += delta * (typeof params.drift === 'number' ? 0.4 + params.drift : 0.7);
    if (cameraLocked && meshRef.current) {
      meshRef.current.position.copy(camera.position);
    }
  });

  // Expose the live count for the numeric harness (C3).
  useEffect(() => {
    const w = globalThis as { __PRISM_BG_PARTICLE_COUNTS__?: Record<string, number> };
    w.__PRISM_BG_PARTICLE_COUNTS__ = w.__PRISM_BG_PARTICLE_COUNTS__ || {};
    w.__PRISM_BG_PARTICLE_COUNTS__[variant] = count;
    return () => {
      const m = (globalThis as { __PRISM_BG_PARTICLE_COUNTS__?: Record<string, number> })
        .__PRISM_BG_PARTICLE_COUNTS__;
      if (m) delete m[variant];
    };
  }, [variant, count]);

  return <primitive ref={meshRef} object={mesh} renderOrder={renderOrder} />;
}
