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

  // span: from the TIME ruler (where the handle knob rides) down to just below
  // the last property track — the bar sweeps across every groove as time advances.
  const lastTrackY = LAYOUT.tracks[LAYOUT.tracks.length - 1].y;
  const top = LAYOUT.rulerY;
  const bottom = lastTrackY - 0.52;
  const barH = top - bottom;
  const barCenterY = (top + bottom) / 2;

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    g.position.x = timeToX(useKeyframeStore.getState().playhead);
  });

  return (
    <group ref={groupRef} position={[timeToX(0), 0, FRONT_Z + 0.04]}>
      {/* the scrubbing bar (the draggable handle knob rides the ruler above, in
          the knobs layer) */}
      <RoundedBox
        args={[PLAYHEAD_W, barH, 0.05]}
        radius={0.022}
        smoothness={3}
        position={[0, barCenterY, 0]}
        material={material}
        castShadow
      />
    </group>
  );
}
