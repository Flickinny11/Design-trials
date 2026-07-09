// THREE-D-BACKGROUNDS — TSL volumetric nebula (the premium procedural core, A3).
//
// A camera-centred inverted sphere whose fragment shader RAYMARCHES a world-
// anchored 3D density field from the camera outward (DESIGN-REFERENCES §9 +
// QUEUE-PREP-RESEARCH §A3): Beer-Lambert absorption, Henyey-Greenstein
// forward-biased in-scatter, tier-gated light-marching for self-shadow.
// Because the field is sampled in WORLD space, the nebula PARALLAXES as the
// camera flies through it (C1) instead of reading as a flat skybox (FP-1).
//
// W-BG: the MATERIAL construction moved verbatim into the shared render-core
// (`render-core/nebula-material.ts`) so the runtime's procedural-background
// mounter renders the SAME shader; this component owns the R3F lifecycle:
// geometry, uniform sync, camera-centring, disposal. One renderer (INV-1),
// TSL only, WebGPU + WebGL2-fallback safe. Chrome-Arc palettes only (INV-9).

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  createNebulaMaterial,
  createNebulaUniforms,
  NEBULA_SPHERE_RADIUS,
} from "@/lib/editor/backgrounds/render-core/nebula-material";
import type { BackgroundPalette } from "@/lib/editor/backgrounds/palettes";
import type { BackgroundLayerParams } from "@/lib/prism-graph/types";
import type { TierBudget } from "@/lib/editor/backgrounds/tier";

export interface VolumetricNebulaLayerProps {
  palette: BackgroundPalette;
  params: BackgroundLayerParams;
  budget: TierBudget;
  renderOrder?: number;
  /** When true the nebula is a TRANSLUCENT veil (alpha = gas coverage) so an
   *  image/parallax-plate behind it shows through the dark dust voids (hybrid,
   *  C5). When false (default) it is the OPAQUE backdrop (its own dark base
   *  fills the voids; the flat skybox is suppressed). */
  overBackdrop?: boolean;
  /** Veil strength in overBackdrop mode: scales the gas alpha so the plate leads
   *  and the veil is a subtle accent (1 = full coverage). Ignored when opaque. */
  veilOpacity?: number;
}

export function VolumetricNebulaLayer({
  palette,
  params,
  budget,
  renderOrder = -2,
  overBackdrop = false,
  veilOpacity = 1,
}: VolumetricNebulaLayerProps) {
  const camera = useThree((s) => s.camera);
  const meshRef = useRef<THREE.Mesh>(null);

  // Live uniforms — updated on param change + per frame (time), no rebuild.
  const uniforms = useMemo(() => createNebulaUniforms(), []);

  // Structural: the shader is rebuilt when palette or tier-step-count changes
  // (Loop bounds are compile-time). Live sliders flow through the uniforms.
  const material = useMemo(
    () =>
      createNebulaMaterial({
        palette,
        raymarchSteps: budget.raymarchSteps,
        lightMarchSteps: budget.lightMarchSteps,
        overBackdrop,
        uniforms,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [palette.id, budget.raymarchSteps, budget.lightMarchSteps, overBackdrop],
  );

  useEffect(() => () => material.dispose(), [material]);

  // Push live param values into the uniforms on change (no rebuild).
  useEffect(() => {
    uniforms.uDensity.value =
      typeof params.density === "number" ? params.density : 0.6;
    uniforms.uDrift.value =
      typeof params.drift === "number" ? params.drift : 0.5;
    uniforms.uIntensity.value =
      typeof params.intensity === "number" ? params.intensity : 0.7;
    uniforms.uVeil.value = veilOpacity;
  }, [params.density, params.drift, params.intensity, veilOpacity, uniforms]);

  // Keep the shell centred on the camera (infinite-environment feel) + advance
  // the drift clock.
  useFrame((_, delta) => {
    uniforms.uTime.value += delta;
    if (meshRef.current) meshRef.current.position.copy(camera.position);
  });

  return (
    <mesh
      ref={meshRef}
      renderOrder={renderOrder}
      frustumCulled={false}
      material={material}
    >
      <sphereGeometry args={[NEBULA_SPHERE_RADIUS, 48, 32]} />
    </mesh>
  );
}
