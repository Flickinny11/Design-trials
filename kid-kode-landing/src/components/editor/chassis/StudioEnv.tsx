'use client';

// StudioEnv — loads the equirectangular studio map and installs it as the scene's
// environment (so the transmission glass genuinely refracts + the metals/stones
// genuinely reflect a real environment). The map is used for reflections only; the
// visible backdrop is a separate editorial gradient so the see-through reads.
//
// Isolated WebGL — this is editor-chrome chassis, never the unified graph scene.

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { ENV_MAP_URL } from './chassis-config';

export function StudioEnv() {
  const scene = useThree((s) => s.scene);
  const tex = useTexture(ENV_MAP_URL) as THREE.Texture;

  useEffect(() => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    const prev = scene.environment;
    const prevIntensity = scene.environmentIntensity;
    const prevRotation = scene.environmentRotation?.clone?.();
    scene.environment = tex;
    // Calm the studio softbox so its reflection does not blow out the glass over
    // the engraved labels, and swing/tilt the bright lobe off the label band into a
    // broad soft satin sheen (premium glass) instead of a hot blob.
    scene.environmentIntensity = 0.5;
    if (scene.environmentRotation) scene.environmentRotation.set(0.35, -Math.PI * 0.35, 0);
    return () => {
      scene.environment = prev;
      scene.environmentIntensity = prevIntensity;
      if (prevRotation && scene.environmentRotation) scene.environmentRotation.copy(prevRotation);
    };
  }, [scene, tex]);

  return null;
}
