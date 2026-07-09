// THREE-D-BACKGROUNDS — depth-scattered particle field (A4), instanced sprites.
//
// The literal "depth-scattered 3D elements layered into space": camera-facing
// billboard sprites scattered through REAL world Z so the camera-journey flies
// THROUGH them with true parallax (FP-1). WebGPU renders THREE.Points at a
// fixed 1px, so sized particles MUST be instanced quads — `SpriteNodeMaterial`
// on a `THREE.InstancedMesh`. Deterministic scatter (index hash) so frozen
// frames reproduce for the numeric harness. Chrome-Arc palettes only (INV-9).
//
// W-BG: the mesh/material construction (incl. the weather variants snow /
// rain / fireflies / dust / ash) moved verbatim into the shared render-core
// (`render-core/particle-field-mesh.ts`) so the runtime's procedural-
// background mounter builds the SAME field; this component owns the R3F
// lifecycle: uniform sync, camera-lock, count probe, disposal.
//
// `world` attachment = world-anchored (camera flies through → parallax).
// `camera-locked` attachment = near-FX motes that follow the camera.

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  createParticleFieldMesh,
  createParticleUniforms,
  PARTICLE_VARIANTS,
  type ParticleVariant,
} from "@/lib/editor/backgrounds/render-core/particle-field-mesh";
import type { BackgroundPalette } from "@/lib/editor/backgrounds/palettes";
import type { BackgroundLayerParams } from "@/lib/prism-graph/types";
import type { TierBudget } from "@/lib/editor/backgrounds/tier";

export type { ParticleVariant };

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

  const uniforms = useMemo(() => createParticleUniforms(), []);

  const density = typeof params.density === "number" ? params.density : 0.6;
  const depthSpread =
    typeof params.depthSpread === "number" ? params.depthSpread : 0.6;

  const { mesh, count } = useMemo(
    () =>
      createParticleFieldMesh({
        palette,
        variant,
        particleBudget: budget.particleCount,
        density,
        depthSpread,
        uniforms,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [palette.id, variant, budget.particleCount, density, depthSpread],
  );

  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    },
    [mesh],
  );

  useEffect(() => {
    const spec = PARTICLE_VARIANTS[variant];
    uniforms.uTwinkle.value = spec.twinkle;
    uniforms.uSize.value =
      1 + (typeof params.intensity === "number" ? params.intensity : 0.7) * 0.6;
  }, [variant, params.intensity, uniforms]);

  useFrame((_, delta) => {
    uniforms.uTime.value +=
      delta * (typeof params.drift === "number" ? 0.4 + params.drift : 0.7);
    if (cameraLocked && meshRef.current) {
      meshRef.current.position.copy(camera.position);
    }
  });

  // Expose the live count for the numeric harness (C3).
  useEffect(() => {
    const w = globalThis as {
      __PRISM_BG_PARTICLE_COUNTS__?: Record<string, number>;
    };
    w.__PRISM_BG_PARTICLE_COUNTS__ = w.__PRISM_BG_PARTICLE_COUNTS__ || {};
    w.__PRISM_BG_PARTICLE_COUNTS__[variant] = count;
    return () => {
      const m = (
        globalThis as { __PRISM_BG_PARTICLE_COUNTS__?: Record<string, number> }
      ).__PRISM_BG_PARTICLE_COUNTS__;
      if (m) delete m[variant];
    };
  }, [variant, count]);

  return <primitive ref={meshRef} object={mesh} renderOrder={renderOrder} />;
}
