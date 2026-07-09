// W-BG — gradient-light volume (kind: 'gradient-volume'), R3F wrapper.
//
// The CHEAP premium family: layered gradient light computed per-fragment from
// the RAY DIRECTION on a camera-centred inverted sphere (same carrier as the
// nebula), so every variant reads as an infinite environment that answers
// camera rotation. No raymarch loop → T0-capable; the 2d-hub workhorse
// (W-2D). Variants: wash / beams / aurora / horizon / rings / spot.
//
// The MATERIAL is built by the shared render-core (one source of truth with
// the runtime's procedural-background mounter); this component owns the R3F
// lifecycle: geometry, uniform sync, camera-centring, disposal.

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  createGradientVolumeMaterial,
  createGradientVolumeUniforms,
  GRADIENT_SPHERE_RADIUS,
  type GradientVolumeVariant,
} from "@/lib/editor/backgrounds/render-core/gradient-volume-material";
import type { BackgroundPalette } from "@/lib/editor/backgrounds/palettes";
import type { BackgroundLayerParams } from "@/lib/prism-graph/types";
import type { TierBudget } from "@/lib/editor/backgrounds/tier";

export type { GradientVolumeVariant };

export interface GradientVolumeLayerProps {
  palette: BackgroundPalette;
  params: BackgroundLayerParams;
  budget: TierBudget;
  renderOrder?: number;
  /** Translucent-veil mode over a backdrop plate (same contract as the nebula):
   *  emission with alpha = light coverage, so the plate leads. */
  overBackdrop?: boolean;
  /** Veil strength in overBackdrop mode (the layer's `opacity`). */
  veilOpacity?: number;
}

export function GradientVolumeLayer({
  palette,
  params,
  budget,
  renderOrder = -2,
  overBackdrop = false,
  veilOpacity = 1,
}: GradientVolumeLayerProps) {
  const camera = useThree((s) => s.camera);
  const meshRef = useRef<THREE.Mesh>(null);

  const variant = ((params.variant as string) ||
    "wash") as GradientVolumeVariant;

  // Live uniforms — sliders + time flow through these, no shader rebuild.
  const uniforms = useMemo(() => createGradientVolumeUniforms(), []);

  const material = useMemo(
    () =>
      createGradientVolumeMaterial({
        palette,
        variant,
        // Tier gate: T0 drops the fractal-noise texture octaves (2 vs 3).
        octaves: budget.raymarchSteps >= 18 ? 3 : 2,
        overBackdrop,
        uniforms,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [palette.id, variant, budget.raymarchSteps, overBackdrop],
  );

  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    uniforms.uDensity.value =
      typeof params.density === "number" ? params.density : 0.6;
    uniforms.uIntensity.value =
      typeof params.intensity === "number" ? params.intensity : 0.7;
    uniforms.uVeil.value = veilOpacity;
  }, [params.density, params.intensity, veilOpacity, uniforms]);

  useFrame((_, delta) => {
    uniforms.uTime.value +=
      delta * (typeof params.drift === "number" ? 0.3 + params.drift : 0.8);
    if (meshRef.current) meshRef.current.position.copy(camera.position);
  });

  return (
    <mesh
      ref={meshRef}
      renderOrder={renderOrder}
      frustumCulled={false}
      material={material}
    >
      <sphereGeometry args={[GRADIENT_SPHERE_RADIUS, 48, 32]} />
    </mesh>
  );
}
