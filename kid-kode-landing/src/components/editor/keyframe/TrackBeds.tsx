'use client';

// TrackBeds — the recessed worn-metal FLOOR of each milled channel. The glass
// pane's channels are cut clean through; a thin brushed-alloy strip sits just
// BEHIND the front face inside each channel so the groove reads as a real milled
// channel with a metal bed (not an open slot to the backdrop). Reuses the
// chassis worn-alloy PBR (gunmetal set) so the finish matches the toolbar.

import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { applyWornMaterial, type WornMaps } from '@/components/editor/chassis/materials';
import { LAYOUT } from './keyframe-config';
import { CHANNEL_CX, CHANNEL_W } from './GlassTimelinePane';

const BED_INSET = 0.07; // bed sits a touch inside the milled channel walls
const BED_H = 0.7 - BED_INSET; // channel height minus inset
const BED_DEPTH = 0.07;
const BED_Z = -0.06; // recessed behind the pane center → reads as a channel floor

export function TrackBeds({ gunmetal }: { gunmetal: WornMaps }) {
  // One dark brushed material, repeated horizontally so the grain runs the channel.
  const material = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial();
    applyWornMaterial(mat, gunmetal);
    mat.color = new THREE.Color('#3a4150'); // darken the bed so it recedes
    mat.envMapIntensity = 0.4;
    mat.clearcoat = 0.04;
    mat.roughness = 1;
    return mat;
  }, [gunmetal]);

  const rows = [LAYOUT.rulerY, ...LAYOUT.tracks.map((t) => t.y)];

  return (
    <>
      {rows.map((y, i) => (
        <RoundedBox
          key={i}
          args={[CHANNEL_W - BED_INSET, BED_H, BED_DEPTH]}
          radius={0.12}
          smoothness={4}
          position={[CHANNEL_CX, y, BED_Z]}
          material={material}
          receiveShadow
        />
      ))}
    </>
  );
}
