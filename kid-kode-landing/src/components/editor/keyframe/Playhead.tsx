'use client';

// Playhead — a thin vertical worn-metal scrubber that sweeps horizontally ACROSS
// the milled grooves as time advances. Its x is mapped from the current playhead
// time (seconds); it rides just proud of the front glass face so it reads as a
// machined indicator laid over the timeline. The draggable handle knob that seats
// in the TIME-ruler channel is added in the knobs layer.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { applyWornMaterial, type WornMaps } from '@/components/editor/chassis/materials';
import { FRONT_Z, LAYOUT, PLAYHEAD_W, timeToX } from './keyframe-config';
import { useKeyframeStore } from './use-keyframe-store';

export function Playhead({ steel }: { steel: WornMaps }) {
  const groupRef = useRef<THREE.Group>(null);

  // bright brushed steel — distinct from the jewel-tone track knobs
  const material = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial();
    applyWornMaterial(mat, steel);
    mat.color = new THREE.Color('#cdd6e2');
    mat.envMapIntensity = 1.3;
    mat.clearcoat = 0.2;
    return mat;
  }, [steel]);

  // span: from just above the ruler down to just below the last property track
  const lastTrackY = LAYOUT.tracks[LAYOUT.tracks.length - 1].y;
  const top = LAYOUT.rulerY + 0.52;
  const bottom = lastTrackY - 0.52;
  const barH = top - bottom;
  const barCenterY = (top + bottom) / 2;

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    g.position.x = timeToX(useKeyframeStore.getState().playhead);
  });

  return (
    <group ref={groupRef} position={[timeToX(0), 0, FRONT_Z + 0.05]}>
      {/* the scrubbing bar */}
      <RoundedBox
        args={[PLAYHEAD_W, barH, 0.06]}
        radius={0.025}
        smoothness={3}
        position={[0, barCenterY, 0]}
        material={material}
        castShadow
      />
      {/* top finial — a small diamond cap so the head reads as a scrubber */}
      <mesh position={[0, top + 0.04, 0]} rotation={[0, 0, Math.PI / 4]} material={material} castShadow>
        <boxGeometry args={[0.16, 0.16, 0.06]} />
      </mesh>
    </group>
  );
}
