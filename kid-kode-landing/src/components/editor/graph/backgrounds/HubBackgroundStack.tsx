// THREE-D-BACKGROUNDS — the per-hub background layer-stack dispatcher.
//
// Reads `PrismHub.background` (the SOURCE of truth, INV-4) and renders each
// procedural layer by its `kind` into the live R3F scene, composited back-to-
// front (A6). Image/legacy layers are NOT handled here — they continue through
// `SceneBackdrop`'s flat-plate path. Tiering (D4): the device tier gates a
// layer's `minTier` (e.g. a splat layer drops on mobile) and supplies the per-
// tier budget (raymarch steps / particle count) to each layer. No per-hub
// hard-coded background (FP-3) — everything is driven by the schema.

import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type {
  PrismHub,
  PrismHubBackgroundLayer,
} from "@/lib/prism-graph/types";
import { getBackgroundPalette } from "@/lib/editor/backgrounds/palettes";
import { tierMeets, type DeviceTier } from "@/lib/editor/backgrounds/tier";
import { useBackgroundTier } from "./useBackgroundTier";
import { VolumetricNebulaLayer } from "./VolumetricNebulaLayer";
import { ParticleFieldLayer, type ParticleVariant } from "./ParticleFieldLayer";
import { ParallaxPlaneLayer } from "./ParallaxPlaneLayer";
import { SplatLayer } from "./SplatLayer";
import { GradientVolumeLayer } from "./GradientVolumeLayer";
import { FluidOverlayLayer } from "./FluidOverlayLayer";

const PROCEDURAL_KINDS = new Set([
  "volumetric-nebula",
  "particle-field",
  "parallax-plane",
  "image",
  "splat",
  "gradient-volume",
  "fluid-overlay",
]);

// Environment-owning kinds: camera-centred infinite shells that can carry the
// whole backdrop (galaxy env-only path + skybox suppression read this).
const ENV_KINDS = new Set(["volumetric-nebula", "gradient-volume"]);

/** Does this hub carry any procedural (non-legacy) background layer? */
export function hubHasProceduralBackground(
  hub: PrismHub | undefined | null,
): boolean {
  return !!hub?.background?.some((l) => l.kind && PROCEDURAL_KINDS.has(l.kind));
}

export function hubHasVolumetricNebula(
  hub: PrismHub | undefined | null,
): boolean {
  return !!hub?.background?.some((l) => l.kind === "volumetric-nebula");
}

/** Any environment-owning shell (nebula OR gradient-volume) — the layer set
 *  the galaxy env-only path renders as the universe backdrop. */
export function hubHasEnvBackdrop(hub: PrismHub | undefined | null): boolean {
  return !!hub?.background?.some((l) => !!l.kind && ENV_KINDS.has(l.kind));
}

/** A hybrid image/parallax plate behind the procedural layers (the "image half"). */
function hubHasBackdropPlate(hub: PrismHub | undefined | null): boolean {
  return !!hub?.background?.some(
    (l) => l.kind === "image" || l.kind === "parallax-plane",
  );
}

/** Suppress the flat gradient skybox only when an OPAQUE environment shell
 *  (nebula or gradient-volume) owns the whole backdrop (no plate behind it).
 *  With a plate present the shell is a translucent veil and the feathered
 *  plate corners blend into the skybox. */
export function hubSuppressesSkybox(hub: PrismHub | undefined | null): boolean {
  return hubHasEnvBackdrop(hub) && !hubHasBackdropPlate(hub);
}

function ProceduralLayer({
  layer,
  index,
  forceTier,
  overBackdrop,
  flatPlate,
}: {
  layer: PrismHubBackgroundLayer;
  index: number;
  forceTier?: DeviceTier | null;
  overBackdrop: boolean;
  flatPlate?: boolean;
}) {
  const { tier, budget } = useBackgroundTier(forceTier);

  // Tier floor: drop a layer the device can't afford (e.g. splat → 'T2').
  if (layer.minTier && !tierMeets(tier, layer.minTier)) return null;

  const palette = getBackgroundPalette(
    layer.params?.palette as string | undefined,
  );
  const params = layer.params ?? {};
  // Back-to-front: env at the deepest renderOrder, scatter in front, near FX last.
  const renderOrder = -3 + index * 0.25;

  switch (layer.kind) {
    case "volumetric-nebula":
      return (
        <VolumetricNebulaLayer
          palette={palette}
          params={params}
          budget={budget}
          renderOrder={renderOrder}
          overBackdrop={overBackdrop}
          veilOpacity={typeof layer.opacity === "number" ? layer.opacity : 1}
        />
      );
    case "particle-field": {
      const variant = ((params.variant as string) ||
        "starfield") as ParticleVariant;
      return (
        <ParticleFieldLayer
          palette={palette}
          params={params}
          budget={budget}
          variant={variant}
          cameraLocked={layer.attachment === "camera-locked"}
          renderOrder={renderOrder}
        />
      );
    }
    case "parallax-plane":
    case "image": {
      if (!layer.sourceUrl) return null;
      return (
        <ParallaxPlaneLayer
          sourceUrl={layer.sourceUrl}
          depthMapUrl={layer.depthMapUrl}
          params={params}
          z={typeof layer.z === "number" ? layer.z : -40}
          opacity={typeof layer.opacity === "number" ? layer.opacity : 1}
          flat={layer.kind === "image" || !!flatPlate}
          renderOrder={renderOrder}
        />
      );
    }
    case "splat": {
      if (!layer.sourceUrl || !layer.depthMapUrl) return null;
      return (
        <SplatLayer
          sourceUrl={layer.sourceUrl}
          depthMapUrl={layer.depthMapUrl}
          params={params}
          budget={budget}
          z={typeof layer.z === "number" ? layer.z : -26}
          renderOrder={renderOrder}
        />
      );
    }
    case "gradient-volume":
      return (
        <GradientVolumeLayer
          palette={palette}
          params={params}
          budget={budget}
          renderOrder={renderOrder}
          overBackdrop={overBackdrop}
          veilOpacity={typeof layer.opacity === "number" ? layer.opacity : 1}
        />
      );
    case "fluid-overlay":
      return (
        <FluidOverlayLayer
          palette={palette}
          params={params}
          budget={budget}
          z={typeof layer.z === "number" ? layer.z : -60}
          opacity={typeof layer.opacity === "number" ? layer.opacity : 1}
          cameraLocked={layer.attachment === "camera-locked"}
          renderOrder={renderOrder}
        />
      );
    default:
      return null;
  }
}

// Dev/verification probe: publishes the live camera pose + a content-scale
// estimate so the capture harness can size/scale the procedural layers to the
// scene. No-op for production rendering.
function BackgroundCameraProbe() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as {
    target?: { x: number; y: number; z: number };
  } | null;
  useFrame(() => {
    const w = globalThis as { __PRISM_BG_CAMERA__?: unknown };
    const t = controls?.target;
    w.__PRISM_BG_CAMERA__ = {
      pos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: t ? { x: t.x, y: t.y, z: t.z } : null,
      dist: t
        ? Math.hypot(
            camera.position.x - t.x,
            camera.position.y - t.y,
            camera.position.z - t.z,
          )
        : camera.position.length(),
      // @ts-expect-error PerspectiveCamera fov/far at runtime
      fov: camera.fov,
      far: camera.far,
    };
  });
  return null;
}

export function HubBackgroundStack({
  hub,
  forceTier,
  flatPlate,
  envOnly,
}: {
  hub: PrismHub | undefined | null;
  forceTier?: DeviceTier | null;
  /** Verification only: force parallax-plane layers to render FLAT (the C6
   *  control — proves the depth displacement is what creates the parallax). */
  flatPlate?: boolean;
  /** Galaxy mode: render ONLY the far volumetric-nebula env layer (as the
   *  universe backdrop the planets sit in front of) — the near-field particle /
   *  plate / splat layers are hub-interior and omitted (C8 galaxy). */
  envOnly?: boolean;
}) {
  const layers = useMemo(
    () =>
      (hub?.background ?? []).filter(
        (l) =>
          l.kind &&
          PROCEDURAL_KINDS.has(l.kind) &&
          (!envOnly || ENV_KINDS.has(l.kind)),
      ),
    [hub?.background, envOnly],
  );
  const overBackdrop = useMemo(() => hubHasBackdropPlate(hub), [hub]);
  if (layers.length === 0) return null;
  return (
    <group name="hub:procedural-background">
      <BackgroundCameraProbe />
      {layers.map((layer, i) => (
        <ProceduralLayer
          key={layer.id}
          layer={layer}
          index={i}
          forceTier={forceTier}
          overBackdrop={overBackdrop}
          flatPlate={flatPlate}
        />
      ))}
    </group>
  );
}
