"use client";

// PhotoCompositeScene — mounts an R2 composite manifest as a live layered
// parallax scene in an R3F canvas (W-PHOTO D2). The heavy assembly lives in
// @/lib/photo-pipeline/scene (single source of truth, shared with the
// layered-photo-scene catalog primitive); this is the React/owned-canvas wrapper.
//
// Parallax `drive` comes from the pointer by default (moving the cursor tilts
// the layers with differentiated depth); a window handle lets a verification
// script pin `drive` to capture deterministic parallax frames.

import { useEffect, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  buildLayeredPhotoScene,
  loadCompositeManifest,
  type LayeredPhotoScene,
} from "@/lib/photo-pipeline/scene";
import type { CompositeManifest } from "@/lib/photo-pipeline/types";

export interface PhotoCompositeSceneProps {
  manifestUrl: string;
  parallaxDepth?: number;
  floatAmount?: number;
  /** When set, overrides pointer drive (−1..1) for deterministic capture. */
  driveOverride?: number | null;
}

export function PhotoCompositeScene({
  manifestUrl,
  parallaxDepth = 1.2,
  floatAmount = 1,
  driveOverride = null,
}: PhotoCompositeSceneProps) {
  const [manifest, setManifest] = useState<CompositeManifest | null>(null);
  useEffect(() => {
    let ok = true;
    loadCompositeManifest(manifestUrl)
      .then((m) => ok && setManifest(m))
      .catch(() => {});
    return () => {
      ok = false;
    };
  }, [manifestUrl]);

  const built = useMemo<LayeredPhotoScene | null>(
    () => (manifest ? buildLayeredPhotoScene(manifest) : null),
    [manifest],
  );
  useEffect(() => () => built?.dispose(), [built]);

  const pointer = useThree((s) => s.pointer);
  useFrame((state) => {
    if (!built) return;
    const drive = driveOverride ?? pointer.x; // −1..1
    built.apply({
      drive,
      parallaxDepth,
      floatAmount,
      time: state.clock.elapsedTime,
    });
    if (typeof window !== "undefined") {
      (window as unknown as { __PHOTO_SCENE__?: unknown }).__PHOTO_SCENE__ = {
        layers: built.layers.length,
        hue: manifest?.themeHue,
      };
    }
  });

  if (!built) return null;
  return <primitive object={built.group} />;
}
