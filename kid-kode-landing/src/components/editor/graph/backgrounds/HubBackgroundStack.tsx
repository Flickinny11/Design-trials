// THREE-D-BACKGROUNDS — the per-hub background layer-stack dispatcher.
//
// Reads `PrismHub.background` (the SOURCE of truth, INV-4) and renders each
// procedural layer by its `kind` into the live R3F scene, composited back-to-
// front (A6). Image/legacy layers are NOT handled here — they continue through
// `SceneBackdrop`'s flat-plate path. Tiering (D4): the device tier gates a
// layer's `minTier` (e.g. a splat layer drops on mobile) and supplies the per-
// tier budget (raymarch steps / particle count) to each layer. No per-hub
// hard-coded background (FP-3) — everything is driven by the schema.

import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { PrismHub, PrismHubBackgroundLayer } from '@/lib/prism-graph/types';
import { getBackgroundPalette } from '@/lib/editor/backgrounds/palettes';
import { tierMeets, type DeviceTier } from '@/lib/editor/backgrounds/tier';
import { useBackgroundTier } from './useBackgroundTier';
import { VolumetricNebulaLayer } from './VolumetricNebulaLayer';
import { ParticleFieldLayer, type ParticleVariant } from './ParticleFieldLayer';

/** Does this hub carry any procedural (non-image) background layer? Used by the
 *  scene to suppress the flat gradient skybox when a nebula owns the backdrop. */
export function hubHasProceduralBackground(hub: PrismHub | undefined | null): boolean {
  return !!hub?.background?.some(
    (l) => l.kind && l.kind !== 'image' && l.kind !== 'parallax-plane',
  );
}

export function hubHasVolumetricNebula(hub: PrismHub | undefined | null): boolean {
  return !!hub?.background?.some((l) => l.kind === 'volumetric-nebula');
}

function ProceduralLayer({
  layer,
  index,
  forceTier,
}: {
  layer: PrismHubBackgroundLayer;
  index: number;
  forceTier?: DeviceTier | null;
}) {
  const { tier, budget } = useBackgroundTier(forceTier);

  // Tier floor: drop a layer the device can't afford (e.g. splat → 'T2').
  if (layer.minTier && !tierMeets(tier, layer.minTier)) return null;

  const palette = getBackgroundPalette(layer.params?.palette as string | undefined);
  const params = layer.params ?? {};
  // Back-to-front: env at the deepest renderOrder, scatter in front, near FX last.
  const renderOrder = -3 + index * 0.25;

  switch (layer.kind) {
    case 'volumetric-nebula':
      return (
        <VolumetricNebulaLayer
          palette={palette}
          params={params}
          budget={budget}
          renderOrder={renderOrder}
        />
      );
    case 'particle-field': {
      const variant = ((params.variant as string) || 'starfield') as ParticleVariant;
      return (
        <ParticleFieldLayer
          palette={palette}
          params={params}
          budget={budget}
          variant={variant}
          cameraLocked={layer.attachment === 'camera-locked'}
          renderOrder={renderOrder}
        />
      );
    }
    // 'image' / 'parallax-plane' / 'splat' are handled elsewhere (SceneBackdrop
    // flat plate; P2 parallax-plane; P3 splat). No-op here.
    default:
      return null;
  }
}

// Dev/verification probe: publishes the live camera pose + a content-scale
// estimate so the capture harness can size/scale the procedural layers to the
// scene. No-op for production rendering.
function BackgroundCameraProbe() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as { target?: { x: number; y: number; z: number } } | null;
  useFrame(() => {
    const w = globalThis as { __PRISM_BG_CAMERA__?: unknown };
    const t = controls?.target;
    w.__PRISM_BG_CAMERA__ = {
      pos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: t ? { x: t.x, y: t.y, z: t.z } : null,
      dist: t
        ? Math.hypot(camera.position.x - t.x, camera.position.y - t.y, camera.position.z - t.z)
        : camera.position.length(),
      // @ts-expect-error PerspectiveCamera fov/far at runtime
      fov: camera.fov, far: camera.far,
    };
  });
  return null;
}

export function HubBackgroundStack({
  hub,
  forceTier,
}: {
  hub: PrismHub | undefined | null;
  forceTier?: DeviceTier | null;
}) {
  const layers = useMemo(
    () =>
      (hub?.background ?? []).filter(
        (l) => l.kind === 'volumetric-nebula' || l.kind === 'particle-field',
      ),
    [hub?.background],
  );
  if (layers.length === 0) return null;
  return (
    <group name="hub:procedural-background">
      <BackgroundCameraProbe />
      {layers.map((layer, i) => (
        <ProceduralLayer key={layer.id} layer={layer} index={i} forceTier={forceTier} />
      ))}
    </group>
  );
}
