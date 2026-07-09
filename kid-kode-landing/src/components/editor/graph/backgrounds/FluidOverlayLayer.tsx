// W-BG — fluid overlay (kind: 'fluid-overlay'), R3F wrapper.
//
// A flowing TSL noise-advection SHEET from the `gpu-fluid-overlay` grammar
// family: domain-warped fbm advected over time reads as silk / ink / caustic
// / smoke / plasma without a compute sim. World-anchored plane (96×56, the
// ParallaxPlaneLayer sizing convention) with a radial edge feather, or a
// camera-locked near-lens film when the layer's attachment says so.
//
// The MATERIAL is built by the shared render-core (one source of truth with
// the runtime's procedural-background mounter); this component owns the R3F
// lifecycle: geometry, uniform sync, camera-lock, disposal.

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  createFluidMaterial,
  createFluidUniforms,
  FLUID_VARIANTS,
  FLUID_PLANE_W,
  FLUID_PLANE_H,
  type FluidVariant,
} from "@/lib/editor/backgrounds/render-core/fluid-material";
import type { BackgroundPalette } from "@/lib/editor/backgrounds/palettes";
import type { BackgroundLayerParams } from "@/lib/prism-graph/types";
import type { TierBudget } from "@/lib/editor/backgrounds/tier";

export type { FluidVariant };

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

  const uniforms = useMemo(() => createFluidUniforms(), []);

  const material = useMemo(
    () =>
      createFluidMaterial({
        palette,
        variant,
        // Tier gate: T0 gets 2 noise octaves, T1+ gets 3.
        octaves: budget.raymarchSteps >= 18 ? 3 : 2,
        uniforms,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [palette.id, variant, budget.raymarchSteps],
  );

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
      <planeGeometry args={[FLUID_PLANE_W, FLUID_PLANE_H, 1, 1]} />
    </mesh>
  );
}
