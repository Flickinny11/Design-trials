'use client';

// Tooltip — an IN-CANVAS hover label for the focused button. Troika SDF text on a
// small dark rounded plate, billboarded to face the review camera. Entirely
// in-engine (no DOM, no drei <Html>, no overlay). Floats just in front of the
// glass, above the hovered cube.

import { useMemo } from 'react';
import { Billboard, Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { FRONT_Z, type PlacedButton } from './chassis-config';

const FONT = '/fonts/Inter-Variable.ttf';
const PLATE_MAT = new THREE.MeshBasicMaterial({ color: '#0b0f17', transparent: true, opacity: 0.86, toneMapped: false });

export function Tooltip({ btn }: { btn: PlacedButton | null }) {
  const label = btn?.fn.label ?? '';
  const plateW = useMemo(() => Math.max(0.9, label.length * 0.14 + 0.34), [label]);
  if (!btn) return null;
  return (
    <group position={[btn.x, btn.y + 0.46, FRONT_Z + 0.34]}>
      <Billboard>
        <RoundedBox args={[plateW, 0.34, 0.04]} radius={0.08} smoothness={4} material={PLATE_MAT} />
        <Text
          font={FONT}
          fontSize={0.16}
          position={[0, 0, 0.035]}
          anchorX="center"
          anchorY="middle"
          color="#eef4ff"
          material-toneMapped={false}
        >
          {label}
        </Text>
      </Billboard>
    </group>
  );
}
